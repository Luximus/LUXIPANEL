/**
 * Cloudflare config service — API token storage.
 *
 * The token lives in panel_settings under category "cloudflare", key
 * "cloudflare_api_token" (same pattern as the OpenClaw module). It is only
 * ever returned masked; the raw value is consumed server-side by the API
 * client and NEVER logged or shipped to the browser.
 *
 * The service body is the shared `makeSecretConfigService()` factory (B-08);
 * only the category / key / wording live here.
 */

import { makeSecretConfigService, type SecretConfigView } from "../../admin/services/secret-config.factory.js";
import type { Executor } from "../../../shared/executor/index.js";

const secret = makeSecretConfigService({
  category: "cloudflare",
  key: "cloudflare_api_token",
  description: "Cloudflare API token",
  missing: {
    message: "No hay un token de API de Cloudflare configurado. Guárdalo en la configuración del módulo.",
    code: "CLOUDFLARE_TOKEN_MISSING",
  },
});

export type CloudflareConfig = SecretConfigView;

export const cloudflareConfigService = {
  async getConfig(): Promise<CloudflareConfig> {
    return secret.getConfig();
  },

  async saveToken(apiToken: string): Promise<void> {
    await secret.save(apiToken);
  },

  /**
   * Borra la fila del kv Y reescribe el espejo settings.json del servidor
   * conectado sin la clave. Sin esto, un guardado posterior de Ajustes (que
   * espeja el bag completo) mantendría vivo el token "borrado" en disco y en
   * GET /api/settings.
   */
  async clearToken(executor?: Executor | null): Promise<void> {
    await secret.clear(executor);
  },

  /** Raw token for the API client. Throws 409 when not configured. */
  async getToken(): Promise<string> {
    return secret.get();
  },
};
