// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Hosting audit log repository — file-backed via dataStore.
 *
 * Stored at `${LUXIPANEL_CONFIG_DIR}/hosting/audit-log.json` on the connected
 * server (per-server isolation invariant: state resolves via the request's
 * Executor / context executor, never the panel host). Mirrors the pattern of
 * `modules/auth/repositories/audit.repository.ts`.
 *
 * CONSUMERS: the shared quota checker (`shared/quota/quota-checker.ts`, owner A3)
 * emits QUOTA_EXCEEDED here; the hosting service emits the lifecycle events
 * (ACCOUNT_CREATED / UPDATED / SUSPENDED / UNSUSPENDED / TERMINATED /
 * PASSWORD_CHANGED). HOSTING_LOGIN is logged by auth.service (NOT duplicated here).
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import { DEFAULT_AUDIT_LIMIT } from "../../../shared/constants.js";
import type { AuditEntry, HostingAuditSeverity, NewAuditEntry } from "../models/audit.model.js";

const MODULE = "hosting";
const COLLECTION = "audit-log";

const VALID_SEVERITY = new Set<HostingAuditSeverity>(["info", "warning", "critical"]);

/** Stored shape — kv-store injects `id` as a STRING and assigns `createdAt`. */
interface StoredAudit {
  id: string;
  accountId: number;
  eventType: string;
  severity: string;
  actor: string;
  context: Record<string, unknown> | null;
  createdAt: string;
}

function normalizeSeverity(s: string | undefined): HostingAuditSeverity {
  return s && VALID_SEVERITY.has(s as HostingAuditSeverity) ? (s as HostingAuditSeverity) : "info";
}

function fromStored(d: StoredAudit): AuditEntry {
  return {
    id: String(d.id),
    accountId: typeof d.accountId === "number" ? d.accountId : Number(d.accountId) || 0,
    eventType: d.eventType,
    severity: normalizeSeverity(d.severity),
    actor: d.actor ?? "",
    context: d.context ?? {},
    createdAt: d.createdAt,
  };
}

const store = makeKvStore<StoredAudit>({ module: MODULE, collection: COLLECTION, idStrategy: "uuid" });

export const hostingAuditRepository = {
  /**
   * Append an audit entry. Best-effort by design — callers (the hosting service
   * lifecycle, the quota checker) wrap this in try/catch so an audit write
   * failure never breaks the underlying operation.
   */
  async append(entry: NewAuditEntry, executor?: Executor | null): Promise<AuditEntry> {
    const created = await store(executor).create({
      // omit id → uuid strategy assigns it
      accountId: entry.accountId,
      eventType: entry.eventType,
      severity:  normalizeSeverity(entry.severity),
      actor:     entry.actor ?? "",
      context:   entry.context ?? null,
      createdAt: "",
    } as StoredAudit);
    return fromStored(created as unknown as StoredAudit);
  },

  /**
   * Return the most recent entries for one account, newest first.
   * `limit` is clamped to 1..100.
   */
  async findByAccount(accountId: number, limit = DEFAULT_AUDIT_LIMIT, executor?: Executor | null): Promise<AuditEntry[]> {
    const items = await store(executor).query((d) => Number(d.accountId) === accountId);
    return items
      .map((d) => fromStored(d as unknown as StoredAudit))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, Math.min(Math.max(1, limit), 100));
  },
};
