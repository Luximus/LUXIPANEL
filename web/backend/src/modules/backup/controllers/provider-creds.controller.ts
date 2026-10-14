// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Provider-credentials controller — account-level cloud storage credentials
 * (Cloudflare R2, generic S3). Configured ONCE from Settings → Credentials and
 * reused by backup targets (which then only need a bucket). The secret access
 * key is write-only: accepted on save, never returned.
 */

import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { STORAGE_PROVIDERS, type StorageProvider } from "../models/index.js";
import { providerCredentialsRepository } from "../repositories/provider-credentials.repository.js";
import { ValidationError } from "../../../shared/errors/index.js";

const REMOTE_STORAGE_PROVIDERS = STORAGE_PROVIDERS.filter(
  (provider): provider is Exclude<StorageProvider, "local"> => provider !== "local",
) as [Exclude<StorageProvider, "local">, ...Exclude<StorageProvider, "local">[]];

const providerParam = z.enum(REMOTE_STORAGE_PROVIDERS);

const saveSchema = z.object({
  accountId: z.string().trim().max(128).optional().default(""),
  endpoint: z.string().trim().max(255).optional().default(""),
  region: z.string().trim().max(64).optional().default(""),
  accessKeyId: z.string().trim().min(1, "Access Key ID requerido").max(255),
  secretAccessKey: z.string().max(512).optional().default(""),
});

export const providerCredsController = {
  /** GET /api/backups/provider-creds — status of R2 + S3 (no secrets). */
  list: asyncHandler(async (req, res) => {
    const executor = getExecutor(req);
    const data = await providerCredentialsRepository.listPublic(executor);
    res.json({ ok: true, data });
  }),

  /** PUT /api/backups/provider-creds/:provider — save account-level keys. */
  save: asyncHandler(async (req, res) => {
    const provider = providerParam.parse(String(req.params.provider));
    const body = saveSchema.parse(req.body);
    const executor = getExecutor(req);

    if (provider === "r2" && !body.accountId) {
      throw new ValidationError("Cloudflare R2 requiere el Account ID");
    }
    // On first save the secret is mandatory; on update an empty secret keeps it.
    const existing = await providerCredentialsRepository.getRaw(provider, executor);
    if (!existing?.secretAccessKey && !body.secretAccessKey) {
      throw new ValidationError("Secret Access Key requerido");
    }

    const data = await providerCredentialsRepository.save(provider, body, executor);
    res.json({ ok: true, data });
  }),

  /** DELETE /api/backups/provider-creds/:provider — clear the credential. */
  remove: asyncHandler(async (req, res) => {
    const provider = providerParam.parse(String(req.params.provider));
    const executor = getExecutor(req);
    await providerCredentialsRepository.remove(provider, executor);
    res.json({ ok: true });
  }),
};
