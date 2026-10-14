// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `makeSecretConfigService()` — the "one integration secret in panel_settings"
 * service, parameterized (B-08).
 *
 * Cloudflare, Expo and BitNinja each shipped a byte-for-byte clone of the same
 * service (`{tokenSet, tokenPreview}` view, `maskKey()`, `getConfig()` over
 * `settingsRepository.getByCategory`, `save`, `clear` through
 * `serverSettingsService.remove`, and a raw getter). Only the category, the key
 * and the wording changed.
 *
 * Contract notes (all preserved from the clones):
 *  - The raw secret is NEVER returned by `getConfig()` — only `tokenSet` and a
 *    4+4 masked preview.
 *  - `clear()` goes through `serverSettingsService.remove` (NOT
 *    `settingsRepository.delete`): it must also rewrite the connected server's
 *    `settings.json` mirror, otherwise the next full Settings save resurrects
 *    the "deleted" secret on disk and in `GET /api/settings`.
 *  - `get()` throws `AppError(409, <missing.code>)` when the module declares a
 *    `missing` mapping (Cloudflare/Expo), and returns `""` when it does not
 *    (BitNinja, whose installer degrades instead of failing).
 */

import { settingsRepository } from "../repositories/index.js";
import { serverSettingsService } from "./server-settings.service.js";
import { AppError, type ErrorCode } from "../../../shared/errors/index.js";
import type { Executor } from "../../../shared/executor/index.js";

/** Browser-safe projection of a stored secret. */
export interface SecretConfigView {
  tokenSet: boolean;
  tokenPreview: string;
}

export interface SecretConfigSpec {
  /** `panel_settings` category, e.g. `"cloudflare"`. */
  category: string;
  /** `panel_settings` key, e.g. `"cloudflare_api_token"`. */
  key: string;
  /** Human description stored alongside the row. */
  description: string;
  /**
   * 409 mapping for `get()`. Omit to make `get()` return `""` when unset.
   */
  missing?: { message: string; code: ErrorCode };
}

/**
 * Mask a secret for display: `abcd…wxyz`, or all-bullets when it is short
 * enough that a 4+4 preview would reveal most of it.
 */
function maskSecret(value: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length <= 8) return "•".repeat(trimmed.length);
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export interface SecretConfigService {
  getConfig(executor?: Executor | null): Promise<SecretConfigView>;
  save(value: string, executor?: Executor | null): Promise<void>;
  clear(executor?: Executor | null): Promise<void>;
  /** Raw secret; throws 409 when `spec.missing` is set, else `""`. */
  get(executor?: Executor | null): Promise<string>;
  /** Raw secret or `null` — for callers that degrade instead of failing. */
  getOrNull(executor?: Executor | null): Promise<string | null>;
}

export function makeSecretConfigService(spec: SecretConfigSpec): SecretConfigService {
  const read = async (executor?: Executor | null): Promise<string> => {
    const rows = await settingsRepository.getByCategory(spec.category, executor ?? undefined);
    return rows.find((r) => r.key === spec.key)?.value ?? "";
  };

  return {
    async getConfig(executor?: Executor | null): Promise<SecretConfigView> {
      const value = await read(executor);
      return { tokenSet: Boolean(value), tokenPreview: maskSecret(value) };
    },

    async save(value: string, executor?: Executor | null): Promise<void> {
      await settingsRepository.set(
        spec.key,
        value.trim(),
        spec.category,
        spec.description,
        executor ?? undefined,
      );
    },

    async clear(executor?: Executor | null): Promise<void> {
      await serverSettingsService.remove(executor ?? null, spec.key);
    },

    async get(executor?: Executor | null): Promise<string> {
      const value = await read(executor);
      if (!value && spec.missing) {
        throw new AppError(spec.missing.message, 409, spec.missing.code);
      }
      return value;
    },

    async getOrNull(executor?: Executor | null): Promise<string | null> {
      return (await read(executor)) || null;
    },
  };
}
