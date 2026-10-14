// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * BitNinja config service — stores the BitNinja license key so it can be
 * managed centrally from Settings → Credentials (instead of being re-typed in
 * the install/update form every time).
 *
 * The key lives in panel_settings under category "bitninja", key
 * "bitninja_license_key" (same pattern as Cloudflare/OpenClaw). Only ever
 * returned masked; the raw value is consumed server-side by the installer and
 * NEVER shipped to the browser.
 *
 * The service body is the shared `makeSecretConfigService()` factory (B-08).
 * Unlike Cloudflare/Expo this module declares NO `missing` mapping, so
 * `getKey()` keeps returning `""` when unset (the installer degrades instead of
 * answering 409).
 */

import { makeSecretConfigService, type SecretConfigView } from "../../admin/services/secret-config.factory.js";
import type { Executor } from "../../../shared/executor/index.js";

const secret = makeSecretConfigService({
  category: "bitninja",
  key: "bitninja_license_key",
  description: "BitNinja license key",
});

export type BitNinjaConfig = SecretConfigView;

export const bitninjaConfigService = {
  async getConfig(executor?: Executor | null): Promise<BitNinjaConfig> {
    return secret.getConfig(executor);
  },

  async saveKey(licenseKey: string, executor?: Executor | null): Promise<void> {
    await secret.save(licenseKey, executor);
  },

  async clearKey(executor?: Executor | null): Promise<void> {
    await secret.clear(executor);
  },

  /** Raw stored license key (empty string when not configured). */
  async getKey(executor?: Executor | null): Promise<string> {
    return secret.get(executor);
  },
};
