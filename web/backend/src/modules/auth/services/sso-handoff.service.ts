// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * SSO handoff tickets — puente de sesión desde el portal LP-LS al box.
 *
 * El portal (otro origen) autentica al usuario contra el backend del box con
 * las credenciales Linux ya guardadas (cifradas) en LP-LS y obtiene un
 * **ticket de un solo uso**. El navegador lo canjea navegando a
 * `GET /api/auth/sso/handoff?ticket=…` en el propio dominio del box, que setea
 * la cookie de sesión **same-origin** (sin CORS ni SameSite=None) y redirige al
 * dashboard ya autenticado.
 *
 * El ticket es opaco (32 bytes aleatorios), vive ≤60s en Redis y se **consume
 * atómicamente** al canjear (`GETDEL`) → un solo uso, sin replay. Guarda el JWT
 * de sesión ya firmado por el box (no credenciales), su `expiresAt` y el flag
 * `remember` para poder setear la cookie con la misma duración que un login
 * normal.
 */
import { randomBytes } from "node:crypto";
import { getRedis } from "../../../shared/redis/index.js";

const PREFIX = "lxp:sso-handoff:";
const TTL_SECONDS = 60;

interface HandoffPayload {
  token: string;
  expiresAt?: number;
  remember: boolean;
}

export const ssoHandoffService = {
  /** Acuña un ticket de un solo uso que envuelve el JWT de sesión ya firmado. */
  async mint(payload: HandoffPayload): Promise<string> {
    const ticket = randomBytes(32).toString("base64url");
    const redis = getRedis();
    await redis.set(`${PREFIX}${ticket}`, JSON.stringify(payload), "EX", TTL_SECONDS);
    return ticket;
  },

  /**
   * Canjea (y destruye) el ticket. Devuelve el payload una sola vez; cualquier
   * segundo canje o un ticket inválido/expirado devuelve null.
   */
  async redeem(ticket: string): Promise<HandoffPayload | null> {
    if (!ticket || ticket.length > 256) return null;
    const redis = getRedis();
    // GETDEL: lee y elimina en una sola operación atómica → un solo uso.
    const raw = await redis.getdel(`${PREFIX}${ticket}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as HandoffPayload;
      if (!parsed?.token) return null;
      return parsed;
    } catch {
      return null;
    }
  },
};
