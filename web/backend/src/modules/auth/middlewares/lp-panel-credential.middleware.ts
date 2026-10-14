// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auth alternativa para el TÚNEL del asistente del portal LP (server-to-server).
 *
 * El portal LP (`/portal/ssh/assistant/*`) llama a esta caja con
 * `Authorization: Bearer lxp_live_…` — la MISMA credencial por-panel que esta
 * caja usa para identificarse ante LP (marketplace) y que la UI del portal
 * instruye pegar en el `.env` de la caja. Sin este middleware la caja exige su
 * JWT de sesión local en `/api/ai/*` y el túnel muere en 401 aunque LP ya
 * validara la credencial en su lado (incidente pestaña Agentes IA 2026-07-20).
 *
 * Contrato (acotado a propósito):
 *  - SOLO se monta en el router del asistente (`/api/ai/*`) — nunca amplía la
 *    superficie a otros módulos del panel.
 *  - Solo intercepta bearers con el prefijo `lxp_live_` (un JWT de sesión
 *    normal pasa de largo hacia `requireAuth`).
 *  - Kill-switch = `LP_PANEL_CREDENTIAL` vacía (default): con la env sin
 *    configurar todo bearer `lxp_live_` se rechaza con 401 explícito.
 *  - Comparación timing-safe sobre digests SHA-256 (longitud fija: no filtra
 *    ni longitud ni prefijos de la credencial configurada).
 *  - La sesión sintetizada es admin (el asistente CLI es admin-only) con
 *    target LOCAL: el túnel del portal administra ESTA caja, así que el
 *    executor de la request es el local (mismo modelo que una sesión local).
 */

import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { lpApiKey } from "../../../shared/lp-api-key.js";
import { AuthError } from "../../../shared/errors/index.js";
import { runWithExecutor } from "../../../shared/executor/context.js";
import { LOCAL_TARGET_ID } from "../../../shared/executor/local-executor.js";
import { getExecutorAsync } from "../../../shared/executor/factory.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { SessionUser } from "../../../shared/types/index.js";

const log = createModuleLogger("lp-panel-credential");

const PANEL_CREDENTIAL_PREFIX = "lxp_live_";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Identidad sintetizada del túnel del portal — visible en audit/usage como
 *  "lp-portal" para distinguirla de cualquier usuario Linux real. */
function portalTunnelUser(): SessionUser {
  return {
    userId: 0,
    username: "lp-portal",
    displayName: "Portal LP",
    role: "admin",
    modules: ["admin"],
    kind: "admin",
    targetId: LOCAL_TARGET_ID,
    targetName: "Local",
  } as SessionUser;
}

export const lpPanelCredentialAuth: RequestHandler = async (req, res, next) => {
  const auth = req.headers.authorization;
  const bearer = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : "";
  // Un JWT de sesión (o ausencia de bearer) no es asunto de este middleware.
  if (!bearer.startsWith(PANEL_CREDENTIAL_PREFIX)) {
    next();
    return;
  }
  const configured = lpApiKey();
  if (!configured) {
    next(
      new AuthError(
        "Esta caja no tiene habilitado el acceso del portal LP al asistente: configura la API KEY de la instalación desde el panel.",
      ),
    );
    return;
  }
  if (!timingSafeEqual(sha256(bearer), sha256(configured))) {
    log.warn({ ip: req.ip, path: req.path }, "lp-panel-credential: bearer lxp_live_ inválido");
    next(new AuthError("Credencial de panel inválida"));
    return;
  }
  const user = portalTunnelUser();
  res.locals.user = user;
  // Sesión LOCAL: el executor por-request resuelve al host del panel (esta
  // caja), igual que una sesión de login local sin target remoto conmutado.
  res.locals.bridgedSession = { targetId: LOCAL_TARGET_ID, targetName: "Local", local: true };
  const executor = await getExecutorAsync(req);
  runWithExecutor(executor, () => next(), user.userId, user);
};

/**
 * `requireAuth` condicionado: si `lpPanelCredentialAuth` ya autenticó la
 * request (res.locals.user presente), sigue de largo; si no, aplica el
 * requireAuth normal de sesión. Mantiene un ÚNICO punto de montaje en el
 * router del asistente.
 */
export function skipIfPanelCredential(requireAuth: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (res.locals.user) {
      next();
      return;
    }
    void requireAuth(req, res, next);
  };
}
