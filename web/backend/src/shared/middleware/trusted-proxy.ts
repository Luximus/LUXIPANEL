// SPDX-License-Identifier: AGPL-3.0-only
import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { Request, RequestHandler } from "express";

/** The transport must be local AND attest to the configured ingress secret.
 * Nginx overwrites both headers; a local tenant cannot mint an attestation. */
export function trustedClientIp(req: Request): string | null {
  const peer = req.socket.remoteAddress;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer ?? "")) return null;
  const expected = process.env.LUXIPANEL_PROXY_SECRET;
  const supplied = req.headers["x-luxipanel-proxy-secret"];
  const ip = req.headers["x-luxipanel-client-ip"];
  if (!expected || expected.length < 32 || typeof supplied !== "string" || typeof ip !== "string") return null;
  const left = Buffer.from(expected), right = Buffer.from(supplied);
  if (left.length !== right.length || !timingSafeEqual(left, right) || !isIP(ip)) return null;
  return ip;
}

/** Discard unverified forwarding data before Express getters or logging use it. */
export const normalizeProxyHeaders: RequestHandler = (req, _res, next) => {
  const ip = trustedClientIp(req);
  if (ip) {
    req.headers["x-forwarded-for"] = ip;
    req.headers["cf-connecting-ip"] = ip;
    req.headers["x-real-ip"] = ip;
  } else {
    for (const name of ["forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip", "cf-connecting-ip"])
      delete req.headers[name];
  }
  next();
};
