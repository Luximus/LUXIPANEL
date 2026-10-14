// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Worklog recorder — buffers SIGNIFICANT user activity (mutations, deploys,
 * notable commands — never page views or reads) in the PANEL-HOST Redis,
 * aggregated + deduplicated per (panel, linux user, category, module, action,
 * detail) and per UTC day. The flusher (worklog-flusher.service.ts) drains the
 * buffer to LP (`POST /panel-api/service/worklog/events`) on a timer.
 *
 * COMPLETELY fail-open: `recordActivity` never throws, never blocks the
 * caller (fire-and-forget), and silently discards events it cannot attribute
 * to a (panel subdomain, linux user) pair. A worklog problem must never
 * degrade a real operation.
 *
 * Storage layout (panel-host Redis, TTL 7 days, all hashes share field keys):
 *   lxp:worklog:buf:<YYYY-MM-DD> field → JSON descriptor (HSETNX — immutable)
 *   lxp:worklog:cnt:<YYYY-MM-DD> field → occurrence count   (HINCRBY)
 *   lxp:worklog:mb:<YYYY-MM-DD>  field → accumulated MB      (HINCRBYFLOAT)
 *   lxp:worklog:min:<YYYY-MM-DD> field → accumulated minutes (HINCRBYFLOAT)
 *   lxp:worklog:dc:<YYYY-MM-DD>  group → distinct-detail counter (cap 5)
 * field = `${subdomain}|${linuxUser}|${category}|${module}|${action}|${md5_8(detail)}`
 * The parallel-counter scheme keeps every write atomic (no HGET+merge race).
 */

import { createHash } from "node:crypto";
import { env } from "../../config/env.js";
import { createModuleLogger } from "../logger/index.js";
import { getRedis } from "../redis/index.js";
import { getContextExecutor, getContextUser } from "../executor/context.js";
import type { Executor } from "../executor/types.js";
import { WORKLOG_CATEGORIES, type WorklogCategory } from "./worklog-taxonomy.js";

const log = createModuleLogger("worklog-recorder");

const WORKLOG_BUF_PREFIX = "lxp:worklog:buf:";
const WORKLOG_CNT_PREFIX = "lxp:worklog:cnt:";
const WORKLOG_MB_PREFIX = "lxp:worklog:mb:";
const WORKLOG_MIN_PREFIX = "lxp:worklog:min:";
const WORKLOG_DC_PREFIX = "lxp:worklog:dc:";

const TTL_SECONDS = 7 * 24 * 3600;
/** Max DISTINCT details kept per (sub, user, module, action) and day; further
 *  variants are folded into the detail-less bucket (still counted). */
const MAX_DETAILS_PER_GROUP = 5;

// Contract limits (LP validates these server-side too).
const MAX_MODULE = 40;
const MAX_ACTION = 60;
const MAX_DETAIL = 300;
const MAX_STACKS = 10;

/** Descriptor persisted as the hash-field value (count/metrics live in the
 *  parallel counter hashes so every write stays atomic). */
interface WorklogBufferedEvent {
  linuxUsername: string;
  category: WorklogCategory;
  module: string;
  action: string;
  detail: string;
  stacks: string[];
}

export interface RecordActivityInput {
  module: string;
  action: string;
  detail?: string;
  category?: string;
  stacks?: string[];
  count?: number;
  metrics?: { mb?: number; durationMin?: number };
  /** Explicit identity for callers outside the request ALS scope (event
   *  listeners with payload identity, ssh2 socket callbacks, WS handlers). */
  linuxUsername?: string;
  /** Explicit panel subdomain for callers outside the request ALS scope. */
  accessSubdomain?: string;
}

/** Strip control chars (incl. ANSI-breaking ones) and collapse whitespace. */
function clean(value: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Field segments must not break the `|`-separated field key. */
function seg(value: string, max: number): string {
  return clean(value, max).replace(/\|/g, "/");
}

function shortHash(text: string): string {
  return createHash("md5").update(text).digest("hex").slice(0, 8);
}

/**
 * Panel subdomain of an executor: DirectSshExecutor exposes it as
 * `usageAttribution.accessSubdomain` (the same attribution the SSH usage
 * reporter uses); direct bridges also encode it as `target.id = "panel:<sub>"`.
 * Returns null when the executor can't be attributed to a managed panel
 * (e.g. localExecutor, SSO proxy with an LP server id) — fail-open: discard.
 */
export function subdomainFromExecutor(executor: Executor | null): string | null {
  if (!executor) return null;
  const attr = (executor as { usageAttribution?: { accessSubdomain: string } | null }).usageAttribution;
  if (attr?.accessSubdomain) return attr.accessSubdomain;
  const m = /^panel:(.+)$/.exec(executor.target?.id ?? "");
  if (m?.[1] && m[1] !== "local") return m[1];
  return null;
}

function normalizeCategory(category: string | undefined): WorklogCategory {
  return (WORKLOG_CATEGORIES as readonly string[]).includes(category ?? "")
    ? (category as WorklogCategory)
    : "other";
}

async function record(input: RecordActivityInput): Promise<void> {
  // Identity — without a linux user AND a panel subdomain the event can't be
  // attributed; discard silently (fail-open by design).
  const executor = getContextExecutor();
  const linuxUsername = seg(
    input.linuxUsername ?? executor?.sshUsername ?? getContextUser()?.username ?? "",
    64,
  );
  if (!linuxUsername) return;
  const subdomain = seg(input.accessSubdomain ?? subdomainFromExecutor(executor) ?? "", 64).toLowerCase();
  if (!subdomain) return;

  const category = normalizeCategory(input.category);
  const module = seg(input.module, MAX_MODULE);
  const action = seg(input.action, MAX_ACTION);
  if (!module || !action) return;
  let detail = clean(input.detail ?? "", MAX_DETAIL);
  const stacks = (input.stacks ?? []).map((s) => clean(s, 40)).filter(Boolean).slice(0, MAX_STACKS);
  const count = Number.isFinite(input.count) && (input.count as number) > 0 ? Math.floor(input.count as number) : 1;
  const mb = input.metrics?.mb;
  const durationMin = input.metrics?.durationMin;

  const redis = getRedis();
  const day = new Date().toISOString().slice(0, 10); // UTC
  const bufKey = `${WORKLOG_BUF_PREFIX}${day}`;

  // Distinct-detail cap: at most MAX_DETAILS_PER_GROUP detail variants per
  // (sub, user, module, action) and day; overflow folds into detail="".
  if (detail) {
    const field = `${subdomain}|${linuxUsername}|${category}|${module}|${action}|${shortHash(detail)}`;
    const exists: number = await redis.hexists(bufKey, field);
    if (!exists) {
      const dcKey = `${WORKLOG_DC_PREFIX}${day}`;
      const group = `${subdomain}|${linuxUsername}|${module}|${action}`;
      const distinct: number = await redis.hincrby(dcKey, group, 1);
      await redis.expire(dcKey, TTL_SECONDS);
      if (distinct > MAX_DETAILS_PER_GROUP) detail = "";
    }
  }

  const field = `${subdomain}|${linuxUsername}|${category}|${module}|${action}|${shortHash(detail)}`;
  const descriptor: WorklogBufferedEvent = { linuxUsername, category, module, action, detail, stacks };

  const multi = redis.multi();
  multi.hsetnx(bufKey, field, JSON.stringify(descriptor));
  multi.expire(bufKey, TTL_SECONDS);
  multi.hincrby(`${WORKLOG_CNT_PREFIX}${day}`, field, count);
  multi.expire(`${WORKLOG_CNT_PREFIX}${day}`, TTL_SECONDS);
  if (typeof mb === "number" && Number.isFinite(mb) && mb > 0) {
    multi.hincrbyfloat(`${WORKLOG_MB_PREFIX}${day}`, field, mb);
    multi.expire(`${WORKLOG_MB_PREFIX}${day}`, TTL_SECONDS);
  }
  if (typeof durationMin === "number" && Number.isFinite(durationMin) && durationMin > 0) {
    multi.hincrbyfloat(`${WORKLOG_MIN_PREFIX}${day}`, field, durationMin);
    multi.expire(`${WORKLOG_MIN_PREFIX}${day}`, TTL_SECONDS);
  }
  await multi.exec();
}

/**
 * Record one significant-activity event. Fire-and-forget and COMPLETELY
 * fail-open: never throws, never blocks the caller, logs only at debug on
 * failure. Call sites use `void recordActivity({...})`.
 */
export function recordActivity(input: RecordActivityInput): void {
  try {
    if (!env.WORKLOG_ENABLED) return;
    void record(input).catch((err) => {
      log.debug({ err: (err as Error).message, module: input.module, action: input.action }, "worklog record failed");
    });
  } catch (err) {
    log.debug({ err: (err as Error).message }, "worklog record failed (sync)");
  }
}
