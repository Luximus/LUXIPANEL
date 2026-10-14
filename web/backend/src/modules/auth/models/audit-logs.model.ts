// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Security audit log types — tracks auth events and security-relevant actions.
 */

export interface AuditLog {
  id: string;
  userId: number | null;
  eventType: string;
  /** info|low|medium|high|critical */
  severity: string;
  ip: string | null;
  userAgent: string | null;
  deviceId: string | null;
  requestId: string | null;
  context: Record<string, unknown>;
  createdAt: Date;
}

export interface NewAuditLog {
  id: string;
  userId?: number | null;
  eventType: string;
  /** info|low|medium|high|critical */
  severity?: string;
  ip?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  requestId?: string | null;
  context?: Record<string, unknown>;
  createdAt?: Date;
}
