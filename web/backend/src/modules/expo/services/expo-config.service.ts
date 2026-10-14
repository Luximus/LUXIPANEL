// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Expo config service — access-token storage.
 *
 * The token lives in panel_settings under category "expo", key "expo_token"
 * (same pattern as the Cloudflare / OpenClaw modules). It is only ever returned
 * masked; the raw value is exported into the environment of every `eas`
 * invocation (EXPO_TOKEN) and as the Bearer for the Expo GraphQL API. It is
 * NEVER logged or shipped to the browser, and is in HIDDEN_SETTING_KEYS so
 * GET /api/settings can't leak it.
 *
 * The service body is the shared `makeSecretConfigService()` factory (B-08);
 * only the category / key / wording live here.
 */

import { makeSecretConfigService, type SecretConfigView } from "../../admin/services/secret-config.factory.js";
import type { Executor } from "../../../shared/executor/index.js";

const secret = makeSecretConfigService({
  category: "expo",
  key: "expo_token",
  description: "Expo access token",
  missing: {
    message: "No hay un token de acceso de Expo configurado. Guárdalo en la configuración del módulo.",
    code: "EXPO_TOKEN_MISSING",
  },
});

export type ExpoConfig = SecretConfigView;

export const expoConfigService = {
  async getConfig(): Promise<ExpoConfig> {
    return secret.getConfig();
  },

  async saveToken(token: string): Promise<void> {
    await secret.save(token);
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

  /** Raw token. Throws 409 when not configured. */
  async getToken(): Promise<string> {
    return secret.get();
  },

  /** Token or null (for code paths that want to degrade rather than throw). */
  async getTokenOrNull(): Promise<string | null> {
    return secret.getOrNull();
  },
};
