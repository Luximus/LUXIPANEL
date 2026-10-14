// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OpenClaw service — handles configuration storage and connectivity probe
 * for the https://openclaw.ai integration.
 *
 * Configuration is stored in panel_settings under category "openclaw":
 *   - openclaw_api_key       (sensitive — only ever returned masked)
 *   - openclaw_endpoint      (defaults to https://openclaw.ai)
 *   - openclaw_default_model (free-form string, optional)
 */

import { settingsRepository } from "../../admin/repositories/index.js";
import { fetchWithTimeout } from "../../../shared/http/fetch-timeout.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { assertPublicUrl, SsrfBlockedError } from "../../../shared/net/ssrf-guard.js";

const log = createModuleLogger("openclaw");

const DEFAULT_ENDPOINT = "https://openclaw.ai";
const TEST_TIMEOUT_MS = 6000;

export interface OpenClawConfig {
  endpoint: string;
  defaultModel: string;
  apiKeySet: boolean;
  apiKeyPreview: string;
}

export interface OpenClawTestResult {
  ok: boolean;
  status: number;
  endpoint: string;
  message: string;
}

function maskKey(key: string): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "•".repeat(trimmed.length);
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

/** Lee las settings de la categoría "openclaw" como un mapa key→value. */
async function loadSettings(): Promise<Record<string, string>> {
  const rows = await settingsRepository.getByCategory("openclaw");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export const openclawService = {
  async getConfig(): Promise<OpenClawConfig> {
    const map = await loadSettings();
    const apiKey = map["openclaw_api_key"] ?? "";
    return {
      endpoint: map["openclaw_endpoint"] ?? DEFAULT_ENDPOINT,
      defaultModel: map["openclaw_default_model"] ?? "",
      apiKeySet: Boolean(apiKey),
      apiKeyPreview: maskKey(apiKey),
    };
  },

  /** Save the editable parts of the config. Empty `apiKey` leaves the existing key untouched. */
  async saveConfig(input: { apiKey?: string; endpoint?: string; defaultModel?: string }): Promise<void> {
    if (typeof input.endpoint === "string") {
      await settingsRepository.set(
        "openclaw_endpoint",
        input.endpoint.trim() || DEFAULT_ENDPOINT,
        "openclaw",
        "OpenClaw API endpoint",
      );
    }
    if (typeof input.defaultModel === "string") {
      await settingsRepository.set(
        "openclaw_default_model",
        input.defaultModel.trim(),
        "openclaw",
        "Default OpenClaw model",
      );
    }
    if (typeof input.apiKey === "string" && input.apiKey.trim().length > 0) {
      await settingsRepository.set(
        "openclaw_api_key",
        input.apiKey.trim(),
        "openclaw",
        "OpenClaw API key",
      );
    }
  },

  async clearApiKey(): Promise<void> {
    await settingsRepository.delete("openclaw_api_key");
  },

  /** Probe the configured endpoint to verify the API key is valid. */
  async testConnection(): Promise<OpenClawTestResult> {
    const map = await loadSettings();
    const apiKey = map["openclaw_api_key"] ?? "";
    const endpoint = map["openclaw_endpoint"] ?? DEFAULT_ENDPOINT;

    if (!apiKey) {
      return { ok: false, status: 0, endpoint, message: "Falta la API key de OpenClaw" };
    }

    // SSRF guard: the probe attaches the OpenClaw API key as a Bearer header, so
    // a hostile/misconfigured endpoint pointing at loopback/RFC1918 would
    // exfiltrate the key. Re-validate the URL (scheme + resolved address) before
    // dialing — the saved value could predate the tightened save schema.
    const probeUrl = `${endpoint.replace(/\/+$/, "")}/api/v1/me`;
    try {
      await assertPublicUrl(probeUrl);
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        // Do NOT log the raw endpoint/URL (may embed userinfo) or the key.
        log.warn({ code: err.code }, "OpenClaw endpoint rejected by SSRF guard");
        return { ok: false, status: 0, endpoint, message: "El endpoint no es una URL pública válida" };
      }
      throw err;
    }

    try {
      // Attempt a lightweight request. Endpoints that respond 401/403 with valid TLS
      // still confirm the host is reachable. We trust 2xx as a green check.
      const res = await fetchWithTimeout(
        probeUrl,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        },
        TEST_TIMEOUT_MS,
      );

      if (res.ok) {
        return { ok: true, status: res.status, endpoint, message: "Conexión exitosa" };
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, status: res.status, endpoint, message: "API key rechazada por el servidor" };
      }
      return {
        ok: false,
        status: res.status,
        endpoint,
        message: `OpenClaw respondió con HTTP ${res.status}`,
      };
    } catch (err) {
      // Sanitized: the raw fetch error can echo the request URL; never log it
      // (nor the Bearer key). Surface only the error name/category.
      const reason = err instanceof Error ? err.name : "UnknownError";
      log.warn({ reason }, "OpenClaw test request failed");
      return { ok: false, status: 0, endpoint, message: "No se pudo contactar OpenClaw" };
    }
  },
};
