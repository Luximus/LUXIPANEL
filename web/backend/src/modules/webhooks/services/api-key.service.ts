// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * API key service — generate, validate, and revoke API keys.
 */

import crypto from "node:crypto";
import { apiKeyRepository } from "../repositories/api-key.repository.js";
import { type ApiKey } from "../models/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { sha256 } from "../../../shared/utils/crypto.js";

const log = createModuleLogger("api-key");

const PREFIX = "lxp_";

export const apiKeyService = {
  /** Generate a new API key. Returns { key, record } — key is shown once. */
  async generate(opts: {
    name: string;
    scopes?: string[] | null;
    expiresAt?: Date;
  }): Promise<{ key: string; record: ApiKey }> {
    const raw = PREFIX + crypto.randomBytes(32).toString("base64url");
    const keyHash = sha256(raw);
    const keyPrefix = raw.slice(0, PREFIX.length + 8);

    const record = await apiKeyRepository.create({
      name: opts.name,
      keyHash,
      keyPrefix,
      scopes: opts.scopes ?? null,
      expiresAt: opts.expiresAt ?? null,
      enabled: true,
    });

    log.info({ id: record.id, name: opts.name }, "API key generated");
    return { key: raw, record };
  },

  /**
   * Validate a raw API key string.
   * Returns the ApiKey record if valid and enabled, null otherwise.
   */
  async validate(rawKey: string): Promise<ApiKey | null> {
    if (!rawKey.startsWith(PREFIX)) return null;

    const keyHash = sha256(rawKey);
    const record = await apiKeyRepository.findByHash(keyHash);
    if (!record) return null;
    if (!record.enabled) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    await apiKeyRepository.touchLastUsed(record.id);
    return record;
  },

  async revoke(id: number): Promise<boolean> {
    const ok = await apiKeyRepository.delete(id);
    if (ok) log.info({ id }, "API key revoked");
    return ok;
  },

  async list(): Promise<ApiKey[]> {
    return apiKeyRepository.findAll();
  },
};
