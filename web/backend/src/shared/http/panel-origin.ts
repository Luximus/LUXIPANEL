// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Deriva el `origin` (esquema + host) del panel desde una `Request` de Express,
 * respetando los headers que añade el proxy inverso (`x-forwarded-proto` /
 * `x-forwarded-host`) y cayendo al `req.protocol`/`host` cuando no están.
 *
 * Se usa en callbacks cross-server (cross-MCP, link-back desde el target) para
 * que el panel al que el cliente debe llegar sea el mismo que el que originó
 * la request. La presencia de varios valores separados por coma (varios hops
 * de proxy) se resuelve quedándose con el primero.
 */
import type { Request } from "express";
import { firstForwardedValue } from "../utils/host.js";

export function panelOriginFromRequest(req: Request): string {
  const proto = firstForwardedValue(req.header("x-forwarded-proto") ?? req.protocol ?? "https");
  const host = firstForwardedValue(req.header("x-forwarded-host") ?? req.header("host") ?? "");
  return host ? `${proto}://${host}` : "";
}
