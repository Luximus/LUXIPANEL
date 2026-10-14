// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * IP extraction from incoming requests.
 *
 * Supports X-Forwarded-For / X-Real-IP headers (common behind Nginx).
 */

import type { Request } from "express";

export function extractIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const xri = req.headers["x-real-ip"];
  if (typeof xri === "string" && xri.trim()) {
    return xri.trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}
