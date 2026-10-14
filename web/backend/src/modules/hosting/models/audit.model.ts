// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Hosting audit log — per-server sidecar record of significant tenant lifecycle
 * events (account create/suspend/terminate, password change, quota exceeded…).
 *
 * Stored at `${LUXIPANEL_CONFIG_DIR}/hosting/audit-log.json` on the connected
 * server via dataStore (idStrategy: "uuid"). NO DB. The reseller (admin) and the
 * tenant itself (scoped to its own account.id) read it back through
 * `GET /api/hosting/accounts/:id/audit`.
 */

/** Severity buckets, mirroring the auth audit log. */
export type HostingAuditSeverity = "info" | "warning" | "critical";

/** A single audit entry as returned to clients. */
export interface AuditEntry {
  /** UUID assigned by the kv-store. */
  id: string;
  /** Hosting account the event is about. */
  accountId: number;
  /** Event discriminator (ACCOUNT_CREATED, QUOTA_EXCEEDED, …). */
  eventType: string;
  severity: HostingAuditSeverity;
  /** Who/what triggered it — typically the account username. */
  actor: string;
  /** Free-form structured detail (plan, quotas, resource, changed fields…). */
  context: Record<string, unknown>;
  /** ISO timestamp. */
  createdAt: string;
}

/** Shape accepted by `hostingAuditRepository.append`. */
export interface NewAuditEntry {
  accountId: number;
  eventType: string;
  severity?: HostingAuditSeverity | string;
  actor?: string;
  context?: Record<string, unknown>;
}
