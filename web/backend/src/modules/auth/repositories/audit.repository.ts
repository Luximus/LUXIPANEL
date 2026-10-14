// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Security audit log repository — file-backed via dataStore.
 * Stored at `${LUXIPANEL_CONFIG_DIR}/auth/audit-log.json` on the connected server.
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import { DEFAULT_AUDIT_LIMIT } from "../../../shared/constants.js";
import type { AuditLog, NewAuditLog } from "../models/index.js";

interface StoredAudit {
  id: string;
  userId: number | null;
  eventType: string;
  severity: string;
  ip: string | null;
  userAgent: string | null;
  deviceId: string | null;
  requestId: string | null;
  context: Record<string, unknown> | null;
  createdAt: string;
}

const store = makeKvStore<StoredAudit>({ module: "auth", collection: "audit-log", idStrategy: "uuid" });

function fromStored(d: StoredAudit): AuditLog {
  return {
    id: d.id,
    userId: d.userId,
    eventType: d.eventType,
    severity: d.severity,
    ip: d.ip,
    userAgent: d.userAgent,
    deviceId: d.deviceId,
    requestId: d.requestId,
    context: d.context,
    createdAt: new Date(d.createdAt),
  } as unknown as AuditLog;
}

export const auditRepository = {
  async append(entry: NewAuditLog, executor?: Executor | null): Promise<AuditLog> {
    const created = await store(executor).create({
      id: (entry as { id?: string }).id as string,
      userId: entry.userId ?? null,
      eventType: entry.eventType,
      severity: entry.severity ?? "info",
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      deviceId: entry.deviceId ?? null,
      requestId: entry.requestId ?? null,
      context: (entry.context as Record<string, unknown>) ?? null,
      createdAt: "",
    });
    return fromStored(created as unknown as StoredAudit);
  },

  async findByUser(userId: number, limit = 20, executor?: Executor | null): Promise<AuditLog[]> {
    const items = await store(executor).query((d) => d.userId === userId || d.userId === null);
    return items
      .map((d) => fromStored(d as unknown as StoredAudit))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, Math.min(Math.max(1, limit), 100));
  },

  async findRecentForUser(userId: number, limit = 50): Promise<AuditLog[]> {
    const items = await store().query(d => d.userId === userId);
    return items.map(d => fromStored(d as unknown as StoredAudit))
      .sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0,Math.min(Math.max(1,limit),200));
  },

  async findRecent(limit = DEFAULT_AUDIT_LIMIT, executor?: Executor | null): Promise<AuditLog[]> {
    const items = await store(executor).list();
    return items
      .map((d) => fromStored(d as unknown as StoredAudit))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, Math.min(Math.max(1, limit), 200));
  },
};
