// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { TokenPayload } from "./token.service.js";

const HOUR_MS = 60 * 60 * 1000;

/** The per-target setting is the maximum lifetime of every full panel session. */
export function configuredSessionExpiry(hours: number, now = Date.now()): number {
  const boundedHours = Number.isFinite(hours) ? Math.min(720, Math.max(1, hours)) : 1;
  return now + boundedHours * HOUR_MS;
}

/** Refresh may update claims, but must never start a new session clock. */
export function refreshedSessionExpiry(payload: TokenPayload, hours: number, now = Date.now()): number | null {
  const started = payload.authTime ?? payload.iat;
  if (!Number.isFinite(started) || !Number.isFinite(payload.exp)) return null;
  const policyExpiry = configuredSessionExpiry(hours, started! * 1000);
  const expiresAt = Math.min(payload.exp! * 1000, policyExpiry);
  return expiresAt > now ? expiresAt : null;
}
