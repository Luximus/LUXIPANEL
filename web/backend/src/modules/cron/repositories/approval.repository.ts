/**
 * Human-approval requests for scheduled AI-agent runs.
 *
 * When a job has `requireApproval`, finishing a run creates one of these with
 * a single-use capability token. The approval URL (sent in the report email)
 * lets a human APPROVE (fires the deferred `nextJobId` chain), request
 * CHANGES (re-runs the job with the reviewer's feedback) or DENY (stops).
 *
 * Sidecar (per target): `${LUXIPANEL_CONFIG_DIR}/cron/approvals.json`.
 */

import { randomBytes } from "node:crypto";
import { ONE_DAY_SECONDS } from "../../../shared/constants.js";
import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { CronApproval, ApprovalStatus } from "../models/index.js";

export type { CronApproval, ApprovalStatus };

/** How long an approval link stays usable. */
const APPROVAL_TTL_MS = ONE_DAY_SECONDS * 1000;

export function approvalExpired(a: CronApproval): boolean {
  return Boolean(a.expiresAt && Date.parse(a.expiresAt) < Date.now());
}

const MODULE = "cron";
const COLLECTION = "approvals";

const store = makeKvStore<CronApproval>({ module: MODULE, collection: COLLECTION, idStrategy: "uuid" });

export const cronApprovalRepository = {
  async create(
    data: Omit<CronApproval, "token" | "status" | "decidedAt">,
    executor?: Executor | null,
  ): Promise<CronApproval & { id: string }> {
    return store(executor).create({
      ...data,
      token: randomBytes(24).toString("hex"),
      status: "pending",
      decidedAt: null,
      expiresAt: new Date(Date.now() + APPROVAL_TTL_MS).toISOString(),
    });
  },

  async list(executor?: Executor | null): Promise<Array<CronApproval & { id: string }>> {
    const all = (await store(executor).list()) as Array<CronApproval & { id: string }>;
    return all.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },

  async findByToken(token: string, executor?: Executor | null): Promise<(CronApproval & { id: string }) | null> {
    // Validate the token shape BEFORE any I/O so a malformed public URL never
    // reads the sidecar. Tokens are 48 lowercase-hex chars (randomBytes(24)).
    if (!/^[a-f0-9]{48}$/.test(token)) return null;
    // PERF NOTE (public email-clicked capability URL): this is a single
    // whole-collection read + in-memory scan. It is NOT the "list+sort" an
    // audit might assume — `dataStore.find` reads through the per-target cache
    // and never sorts. Keying the collection BY TOKEN (id = token) so this
    // became `store.get(token)` would NOT reduce the cost: kv-store reads the
    // ENTIRE collection JSON on every `get` too (same 1 round-trip), so the only
    // saving would be a negligible linear scan over a short-lived (24h TTL),
    // small map — at the price of a sidecar-shape migration that would break
    // in-flight approval links. Not worth it; left as a direct predicate find.
    return (await store(executor).find((a) => a.token === token)) as (CronApproval & { id: string }) | null;
  },

  async decide(
    id: string,
    status: Exclude<ApprovalStatus, "pending">,
    comment: string,
    executor?: Executor | null,
  ): Promise<(CronApproval & { id: string }) | null> {
    return store(executor).update(id, { status, comment, decidedAt: new Date().toISOString() }) as Promise<
      (CronApproval & { id: string }) | null
    >;
  },
};
