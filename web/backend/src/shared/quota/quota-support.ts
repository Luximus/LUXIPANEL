// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Filesystem disk-quota support detection + best-effort apply (Fase 6).
 *
 * Many VPS images ship WITHOUT kernel quotas enabled (no `usrquota`/`prjquota`
 * mount option, no `xfs_quota`/`setquota` binaries). Disk-quota enforcement is
 * therefore FAIL-SOFT: we provision a hard quota when the kernel supports it,
 * and otherwise fall back to "stats only" (the hosting stats card already shows
 * diskUsedMb via `du`). A missing quota mechanism must NEVER abort account
 * creation.
 *
 * The detection result is cached per server in the kv-store
 * (`system/quota-support`) with a lazy refresh, because the probe shells out a
 * few times.
 */

import type { Executor } from "../executor/types.js";
import { quoteArg } from "../executor/quote.js";
import { kv } from "../kv-store/index.js";
import { createModuleLogger } from "../logger/index.js";

const log = createModuleLogger("quota-support");

export interface QuotaSupport {
  /** XFS project quota available (xfs_quota present + an XFS mount). */
  xfsQuota: boolean;
  /** ext-family user quota available (setquota present + a quota mount). */
  extQuota: boolean;
  /** True when neither kernel mechanism is available → soft/stats only. */
  softOnly: boolean;
  /** Mount point that backs the home tree (default "/"). */
  mount: string;
  /** ISO timestamp of the probe. */
  probedAt: string;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — quota tooling rarely changes.

/** Detect quota support on the connected server. Cached per server. */
export async function detectQuotaSupport(executor: Executor): Promise<QuotaSupport> {
  const store = kv(executor).module("system").collection<QuotaSupport>("quota-support");
  try {
    const cached = await store.get("current");
    if (cached && Date.now() - new Date(cached.probedAt).getTime() < CACHE_TTL_MS) {
      return cached;
    }
  } catch {
    /* cache miss / unreadable → re-probe */
  }

  const support = await probe(executor);
  try {
    await store.set("current", support);
  } catch {
    /* best-effort cache write */
  }
  return support;
}

async function probe(executor: Executor): Promise<QuotaSupport> {
  // Single shell that always exits 0 and prints three lines we parse:
  //   xfs_quota present? / setquota present? / mount-with-quota?
  const cmd = [
    "command -v xfs_quota >/dev/null 2>&1 && echo XFS=1 || echo XFS=0",
    "command -v setquota >/dev/null 2>&1 && echo SETQUOTA=1 || echo SETQUOTA=0",
    // A mount with usrquota/prjquota (best-effort; absent on most images).
    "(grep -qE '(usrquota|prjquota|quota)' /proc/mounts && echo QMOUNT=1 || echo QMOUNT=0)",
  ].join("; ");

  let stdout = "";
  try {
    const res = await executor.exec(`sh -c ${quoteArg(cmd)}`, { timeoutMs: 15_000 });
    stdout = res.stdout;
  } catch (err) {
    log.debug({ err: (err as Error).message, target: executor.target.id }, "quota probe failed → softOnly");
  }
  const has = (k: string): boolean => new RegExp(`${k}=1`).test(stdout);
  const xfsQuota = has("XFS") && has("QMOUNT");
  const extQuota = has("SETQUOTA") && has("QMOUNT");
  return {
    xfsQuota,
    extQuota,
    softOnly: !xfsQuota && !extQuota,
    mount: "/",
    probedAt: new Date().toISOString(),
  };
}
