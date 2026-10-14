// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * QR Auth service — allows an authenticated mobile session to approve a new desktop session.
 *
 * Flow:
 *  1. Desktop calls POST /api/auth/qr/request → receives { requestId, expiresAt }
 *  2. Desktop displays a QR code encoding the requestId
 *  3. Mobile (already authenticated) calls POST /api/auth/qr/approve with { requestId }
 *  4. Desktop polls GET /api/auth/qr/poll/:requestId → on approval receives a session token
 */

import { getRedis } from "../../../shared/redis/index.js";
import { AuthError, ValidationError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { uuid, sha256 } from "../../../shared/utils/index.js";

const log = createModuleLogger("qr-auth");

/** Redis TTL for pending QR sessions (seconds). */
const QR_TTL = 300; // 5 minutes

type QrStatus = "pending" | "approved" | "consumed";

/**
 * Bridge/session-continuity fields captured from the APPROVING (mobile) session
 * so the desktop token minted on poll inherits the same bridged session. In
 * managed mode every /panel/* route requires a bridged session, so without this
 * the QR-issued cookie 401s everywhere. The desktop piggybacks on the mobile's
 * authenticated bridge (it has no SSH credentials of its own).
 */
export interface QrBridgeContext {
  bridgeSessionId?: string;
  remoteSessionId?: string;
  remoteUserId?: number;
  targetId?: string;
  targetName?: string;
  targetHost?: string;
  licenseSlots?: number;
  direct?: boolean;
  tenantId?: number;
}

interface QrSession {
  status: QrStatus;
  userId?: number;
  bridge?: QrBridgeContext;
  /** Fingerprint of the desktop that created the request (sha256 of IP+UA).
   *  The poll must present the SAME fingerprint so a session approved on one
   *  device can't be stolen by a different client that learns the requestId. */
  requester?: string;
}

function key(requestId: string): string {
  return `qr:${requestId}`;
}

/** Derive a non-reversible fingerprint binding a QR session to its creator. */
export function qrRequesterFingerprint(ip: string, userAgent: string): string {
  return sha256(`${ip}\n${userAgent}`);
}

/** Parse a stored QR session, rejecting corrupt/forged Redis values. */
function parseSession(raw: string): QrSession {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("Sesión QR inválida.");
  }
  if (!parsed || typeof parsed !== "object" || typeof (parsed as QrSession).status !== "string") {
    throw new ValidationError("Sesión QR inválida.");
  }
  return parsed as QrSession;
}

/** Overwrite a QR session while preserving its remaining TTL (min 30s). */
async function setPreservingTtl(requestId: string, session: QrSession): Promise<void> {
  const redis = getRedis();
  const ttl = await redis.ttl(key(requestId));
  const remainingTtl = ttl > 0 ? ttl : 30;
  await redis.setex(key(requestId), remainingTtl, JSON.stringify(session));
}

export const qrAuthService = {
  /** Create a new QR session. Returns the requestId the desktop should encode in
   *  the QR. `requester` binds the session to the creating client so only it can
   *  poll the issued token (set from the request's IP + user-agent). */
  async createRequest(requester?: string): Promise<{ requestId: string; expiresAt: Date }> {
    const requestId = uuid();
    const session: QrSession = { status: "pending", ...(requester ? { requester } : {}) };

    const redis = getRedis();
    await redis.setex(key(requestId), QR_TTL, JSON.stringify(session));

    const expiresAt = new Date(Date.now() + QR_TTL * 1000);
    log.info({ requestId }, "QR session created");
    return { requestId, expiresAt };
  },

  /** Approve a QR session from an authenticated mobile device. `bridge` carries
   *  the approver's bridged-session context so the desktop token inherits it. */
  async approve(requestId: string, userId: number, bridge?: QrBridgeContext): Promise<void> {
    const redis = getRedis();
    const raw = await redis.get(key(requestId));

    if (!raw) throw new AuthError("QR session expired or not found");

    const session = parseSession(raw);
    if (session.status !== "pending") {
      throw new AuthError("QR session is no longer pending");
    }

    const updated: QrSession = {
      status: "approved",
      userId,
      ...(session.requester ? { requester: session.requester } : {}),
      ...(bridge ? { bridge } : {}),
    };
    await setPreservingTtl(requestId, updated); // preserve remaining TTL

    log.info({ requestId, userId }, "QR session approved");
  },

  /**
   * Poll the status of a QR session.
   * Returns { status, userId } where userId is present only when approved.
   * On approved + consumed (first successful poll), the session is marked consumed.
   */
  async poll(
    requestId: string,
    requester?: string,
  ): Promise<{ status: QrStatus; userId?: number; bridge?: QrBridgeContext }> {
    const redis = getRedis();
    const raw = await redis.get(key(requestId));

    if (!raw) {
      return { status: "consumed" }; // Expired → treat as consumed
    }

    const session = parseSession(raw);

    // SECURITY: a session bound to a requester may only be polled by that same
    // client. Otherwise an attacker who learns the requestId (it travels in the
    // QR) could poll and steal the freshly-minted desktop token.
    if (session.requester && session.requester !== requester) {
      log.warn({ requestId }, "QR poll rejected: requester fingerprint mismatch");
      throw new AuthError("QR session not found");
    }

    if (session.status === "approved") {
      // Mark as consumed so subsequent polls don't re-issue tokens
      const consumed: QrSession = {
        status: "consumed",
        userId: session.userId,
        ...(session.requester ? { requester: session.requester } : {}),
        ...(session.bridge ? { bridge: session.bridge } : {}),
      };
      await setPreservingTtl(requestId, consumed);

      log.info({ requestId, userId: session.userId }, "QR session consumed");
      return { status: "approved", userId: session.userId, bridge: session.bridge };
    }

    return { status: session.status };
  },
};
