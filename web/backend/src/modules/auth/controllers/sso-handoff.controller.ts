// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * SSO handoff controller — entrada YA AUTENTICADA desde el portal LP-LS.
 *
 * Flujo (dos saltos, sin webview, sin CORS, sin SameSite=None):
 *   1. `POST /api/auth/sso/exchange` — lo llama el backend de LP-LS server-side
 *      con las credenciales Linux del panel (usuario + passphrase) que YA tiene
 *      guardadas cifradas. Autentica igual que `/api/login` (mismo lockout /
 *      rate-limit / método password) y devuelve un **ticket de un solo uso**.
 *      Si la cuenta tiene 2FA → `mfaRequired:true` y NO acuña ticket (el 2FA no
 *      se puede saltar; LP-LS cae al `/login` del box).
 *   2. `GET /api/auth/sso/handoff?ticket=…` — lo abre el NAVEGADOR (navegación
 *      top-level a este mismo origen). Canjea el ticket, setea la cookie de
 *      sesión same-origin y redirige a `/panel` ya autenticado.
 *
 * El handoff responde **200 + Set-Cookie + redirect client-side** (no 302): el
 * proxy Astro de `/api/*` sigue los redirects con su `fetch`, así que un 302 del
 * backend se resolvería server-side y se perdería; un 200 con cookie + meta/JS
 * refresh cruza intacto tanto por el proxy como por nginx directo.
 */
import { z } from "zod";
import type { Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import { tokenService } from "../services/token.service.js";
import { ssoHandoffService } from "../services/sso-handoff.service.js";
import { requestMeta } from "../../../shared/http/request-meta.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { resolveEffectiveLoginMethods } from "../services/login-methods.service.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";

const exchangeSchema = z.object({
  user: z.string().min(1, "Username is required").trim(),
  pass: z.string().min(1, "Password is required"),
  remember: z.boolean().default(true),
});

/**
 * Sólo se permite navegar a rutas internas seguras del propio box: el login o
 * el dashboard/módulos bajo `/panel`. Bloquea open-redirects (absolutas,
 * protocol-relative `//host`, backslashes) que un `next` malicioso intentara.
 */
function isSafeInternalPath(p: string): boolean {
  return typeof p === "string"
    && p.startsWith("/")
    && !p.startsWith("//")
    && !p.includes("\\")
    && (p === "/login" || p === "/panel" || p.startsWith("/panel/"));
}

/** Página mínima que setea la cookie (ya en la respuesta) y navega same-origin. */
function redirectHtml(target: string): string {
  const safe = isSafeInternalPath(target) ? target : "/login";
  return `<!doctype html><html><head><meta charset="utf-8">`
    + `<meta http-equiv="refresh" content="0;url=${encodeURI(safe)}">`
    + `<title>Redirigiendo…</title></head><body>`
    + `<script>location.replace(${JSON.stringify(safe)});</script>`
    + `</body></html>`;
}

export const ssoHandoffController = {
  /** POST /api/auth/sso/exchange — autentica (server-side, desde LP-LS) y acuña el ticket. */
  exchange: asyncHandler(async (req: Request, res: Response) => {
    const body = exchangeSchema.parse(req.body);

    // Mismo gate que /api/login: si el método password está deshabilitado en la
    // seguridad del panel, no se puede entrar por credenciales (ni por handoff).
    const methods = await resolveEffectiveLoginMethods();
    if (!methods.password) {
      res.status(403).json({ ok: false, error: apiModuleMessage(res.locals.locale, "passwordLoginDisabled"), code: ErrorCodes.PASSWORD_LOGIN_DISABLED });
      return;
    }

    // Autentica contra las cuentas Linux reales (loginLocal aplica lockout /
    // throttle igual que el login normal). Credenciales inválidas → AuthError →
    // el asyncHandler responde error y LP-LS cae al /login del box.
    const authMeta = {
      ...requestMeta(req),
      host: (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host,
    };
    const user = await authService.loginLocal(body.user, body.pass, body.remember, authMeta);

    // Emite el token de sesión SIN setear cookie (no hay `res`): lo guardamos en
    // el ticket. Con 2FA activo → mfaPending: no se acuña; el portal usa /login.
    const session = await authService.issueSession(user, body.remember);
    if (session.mfaPending || !session.token) {
      res.json({ ok: true, mfaRequired: true });
      return;
    }

    const ticket = await ssoHandoffService.mint({
      token: session.token,
      expiresAt: session.expiresAt,
      remember: body.remember,
    });
    res.json({ ok: true, ticket });
  }),

  /**
   * GET/POST /api/auth/sso/handoff — canjea el ticket, setea cookie y entra.
   * POST (ticket en el body) es el camino preferido del portal web: mantiene el
   * ticket FUERA de la URL (no queda en history ni en logs de nginx). GET
   * (`?ticket=`) se conserva para app/desktop y compat.
   */
  handoff: asyncHandler(async (req: Request, res: Response) => {
    const pick = (k: string): string => {
      const b = (req.body as Record<string, unknown> | undefined)?.[k];
      if (typeof b === "string" && b) return b;
      const q = req.query[k];
      return typeof q === "string" ? q : "";
    };
    const payload = await ssoHandoffService.redeem(pick("ticket"));
    // no-store: el HTML lleva el efecto de setear la cookie; nunca cachearlo.
    res.set("cache-control", "no-store");
    if (!payload) {
      // Ticket inválido/expirado/ya usado → login normal del box.
      res.status(200).type("html").send(redirectHtml("/login"));
      return;
    }
    // Deep-link opcional: si el caller pidió un módulo concreto (`next=/panel/…`),
    // aterriza ahí; si no, en el dashboard. `isSafeInternalPath` bloquea open-redirects.
    const nextRaw = pick("next");
    const target = isSafeInternalPath(nextRaw) ? nextRaw : "/panel";
    tokenService.setSessionCookie(res, payload.token, payload.remember, payload.expiresAt);
    res.status(200).type("html").send(redirectHtml(target));
  }),
};
