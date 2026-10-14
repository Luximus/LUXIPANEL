// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Helpers compartidos para cookies cross-cutting (purga de copias legadas,
 * matching de dominio en la request actual). Antes vivían duplicados en
 * `auth/services/token.service.ts` (`purgeLegacyDomainCookies`,
 * `cookieDomainMatchesHost`) y `auth/middlewares/csrf.middleware.ts`
 * (`purgeLegacyCsrfCookies`).
 */
import type { Response } from "express";
// SSOT de la normalización de host (trim + lowercase + sin puerto + sin puntos
// finales). Antes vivía aquí sin el recorte de puerto, que `cookieDomainMatchesHost`
// tenía que reaplicar a mano con `split(":")[0]`.
import { normalizeHost } from "./utils/host.js";

/**
 * Devuelve `true` si `requestHost` cae dentro del alcance de `cookieDomain`
 * (comparación exacta o como subdominio, tras normalizar). Usado para decidir
 * si una `clearCookie(..., { domain })` con ese dominio realmente borrará algo
 * en el browser del cliente.
 */
export function cookieDomainMatchesHost(
  cookieDomain: string | undefined | null,
  requestHost: string | undefined | null,
): boolean {
  if (!cookieDomain || !requestHost) return false;
  const host = normalizeHost(requestHost);
  const domain = normalizeHost(cookieDomain.replace(/^\./, ""));
  if (!host || !domain) return false;
  return host === domain || host.endsWith(`.${domain}`);
}

export interface PurgeLegacyCookiesOptions {
  /** Lista de dominios a purgar (los que NO son el actual). */
  legacyDomains: readonly string[];
  /** Dominio activo (no se purga). */
  activeDomain: string | undefined;
  /** Host de la request (`req.headers.host`). */
  requestHost: string | undefined;
  /** `secure` para `clearCookie`. */
  secure: boolean;
  /** `sameSite` para `clearCookie`. */
  sameSite: "lax" | "strict" | "none" | boolean;
  /** `httpOnly` para `clearCookie` (true para session, false para CSRF). */
  httpOnly: boolean;
}

/**
 * Emite un `clearCookie(name, { domain: legacy, ... })` por cada dominio
 * legado que cubra el host de la request (excluyendo el dominio activo). Antes
 * los flujos de session y CSRF lo hacían cada uno con su propia copia del
 * bucle.
 */
export function purgeLegacyDomainCookies(
  res: Response,
  name: string,
  opts: PurgeLegacyCookiesOptions,
): void {
  for (const legacy of opts.legacyDomains) {
    if (legacy === opts.activeDomain) continue;
    if (!cookieDomainMatchesHost(legacy, opts.requestHost)) continue;
    res.clearCookie(name, {
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      domain: legacy,
      path: "/",
    });
  }
}
