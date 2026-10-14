// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `requestMeta(req)` — the audit metadata every auth event carries (B-27).
 *
 * Ten call sites across `modules/auth/controllers/*` spelled out
 * `{ ip: extractIp(req), userAgent: req.headers["user-agent"] || "" }` by hand
 * (some of them adding a `host`). The shape is what `authService.logAudit`
 * persists, so it is frozen: `ip` from the proxy-aware `extractIp`, `userAgent`
 * never `undefined` (empty string when the header is absent).
 *
 * Call sites that also need a `host` spread this and add their own field —
 * host derivation differs (`getForwardedHost` vs raw `x-forwarded-host`) and
 * unifying it would change the SSO/login contracts.
 */

import type { Request } from "express";

import { extractIp } from "../utils/ip.js";

/** Audit metadata accepted by `authService.logAudit` / `handleFailedLogin`. */
export interface RequestAuditMeta {
  ip: string;
  userAgent: string;
}

/** Proxy-aware client IP + User-Agent for an audit record. */
export function requestMeta(req: Request): RequestAuditMeta {
  return { ip: extractIp(req), userAgent: req.headers["user-agent"] || "" };
}
