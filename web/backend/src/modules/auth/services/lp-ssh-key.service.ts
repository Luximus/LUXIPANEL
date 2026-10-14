// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * LP-LICENSE-SERVER SSH key lookup.
 *
 * Asks LP for the SSH private key associated with the panel that owns the
 * subdomain the user is logging into AND the Linux username they entered.
 * Used by the SSH-based /login flow.
 */

import { env } from "../../../config/env.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { postLicenseServerJson } from "../../../shared/license-server-tls.js";
import { getActive as getActiveSharedSecret } from "../../secret-rotation/services/secret-store.service.js";
import { DEFAULT_SSH_PORT } from "../../servers/models/index.js";

function resolveLuxipanelKey(): string {
  return getActiveSharedSecret("luxipanel_key") || env.LUXIPANEL_KEY;
}

const log = createModuleLogger("lp-ssh-key");

/** Resultado de pedir a LP la clave de SERVICIO per-VPS (sudo-capaz) usada por
 *  el login de hosting (contraseña). `not_configured` cuando LP responde 404 /
 *  el VPS aún no está provisionado con una clave de servicio. */
export type ServiceKeyOutcome =
  | {
      state: "ok";
      privateKeyPem: string;
      passphrase: string;
      serverIp: string;
      sshPort: number;
      serviceUsername: string;
      fingerprint: string | null;
    }
  | { state: "not_configured" };

interface LpResponse {
  ok?: boolean;
  data?: {
    privateKey?: string;
    fingerprint?: string | null;
    serverIp?: string | null;
    sshUsername?: string;
    sshPort?: number;
    nickname?: string;
    /** Passphrase that unlocks the service key (hosting login service-key path). */
    passphrase?: string;
  };
  error?: string;
}

export const lpSshKeyService = {
  /**
   * Pide a LP la clave SSH de SERVICIO (sudo-capaz) provisionada para el VPS que
   * sirve `subdomain`. La usa el login de hosting (contraseña): el panel se
   * conecta con esta clave para leer el sidecar de cuentas, validar bcrypt y
   * luego operar con `sudo -u <owner>` (privilege drop). Autentica con el shared
   * secret Bearer `luxipanel_key` (no requiere JWT de panel — no hay contexto de
   * panel antes del login). El endpoint LP es Fase 2b; aquí solo el cliente.
   * 404 / no provisionado ⇒ `not_configured`.
   */
  async lookupServiceKey(subdomain: string): Promise<ServiceKeyOutcome> {
    const luxipanelKey = resolveLuxipanelKey();
    if (!luxipanelKey) {
      log.warn("LUXIPANEL_KEY no disponible — no se llama panel-api/service-key");
      return { state: "not_configured" };
    }
    try {
      const json = await postLicenseServerJson<LpResponse>(
        "/panel-api/service-key",
        { accessSubdomain: subdomain },
        env.SSH_PROXY_TIMEOUT_MS,
        { Authorization: `Bearer ${luxipanelKey}` },
      );
      if (!json?.ok || !json.data?.privateKey || !json.data.serverIp) {
        log.debug({ subdomain, error: json?.error ?? "no service key" }, "LP returned no service key");
        return { state: "not_configured" };
      }
      return {
        state: "ok",
        privateKeyPem: json.data.privateKey,
        passphrase: json.data.passphrase ?? "",
        serverIp: json.data.serverIp,
        sshPort: typeof json.data.sshPort === "number" ? json.data.sshPort : DEFAULT_SSH_PORT,
        serviceUsername: json.data.sshUsername ?? "root",
        fingerprint: json.data.fingerprint ?? null,
      };
    } catch (err) {
      // 404 = VPS sin clave de servicio provisionada: outcome de negocio, no
      // fallo de transporte. Cualquier otro error también se trata como
      // "no provisionado" para que el caller muestre un mensaje claro.
      const msg = errMessage(err);
      if (/License server returned 404\b/.test(msg)) {
        log.debug({ subdomain }, "LP 404 — no service key for VPS");
      } else {
        log.warn({ err, subdomain }, "Panel-api service-key lookup failed");
      }
      return { state: "not_configured" };
    }
  },
};
