// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Storage-targets controller — CRUD for cloud backup destinations (S3 / R2).
 * The secret access key is write-only: accepted on create/update, never
 * returned. Update with an empty/omitted secret keeps the stored one.
 */

import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { STORAGE_PROVIDERS, type StorageProvider } from "../models/index.js";
import { storageRepository } from "../repositories/storage.repository.js";
import { providerCredentialsRepository } from "../repositories/provider-credentials.repository.js";
import { NotFoundError, ValidationError } from "../../../shared/errors/index.js";

const REMOTE_STORAGE_PROVIDERS = STORAGE_PROVIDERS.filter(
  (provider): provider is Exclude<StorageProvider, "local"> => provider !== "local",
) as [Exclude<StorageProvider, "local">, ...Exclude<StorageProvider, "local">[]];

// accessKeyId/secret are now OPTIONAL: a target may inherit the account-level
// provider credential configured in Settings → Credentials. When per-target
// keys are omitted, the central credential for that provider must exist.
const baseSchema = z.object({
  name: z.string().min(2).max(64).trim(),
  provider: z.enum(REMOTE_STORAGE_PROVIDERS),
  bucket: z.string().min(1).max(255).trim(),
  endpoint: z.string().trim().max(255).optional().default(""),
  region: z.string().trim().max(64).optional().default(""),
  prefix: z.string().trim().max(255).optional().default(""),
  accessKeyId: z.string().trim().max(255).optional().default(""),
  secretAccessKey: z.string().max(512).optional().default(""),
});

const createSchema = baseSchema;
const updateSchema = baseSchema.partial();

export const storagesController = {
  /** GET /api/backups/storages — list configured storage targets (no secrets). */
  list: asyncHandler(async (req, res) => {
    const executor = getExecutor(req);
    const data = await storageRepository.list(executor);
    res.json({ ok: true, data });
  }),

  /** POST /api/backups/storages — create a storage target. */
  create: asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const executor = getExecutor(req);

    // Per-target keys provided → validate them like before. Otherwise the
    // target inherits the account-level credential, which must exist.
    if (body.accessKeyId) {
      if (!body.secretAccessKey) throw new ValidationError("Secret Access Key requerido");
      if (body.provider === "r2" && !body.endpoint) throw new ValidationError("Cloudflare R2 requiere endpoint");
    } else {
      const central = await providerCredentialsRepository.getPublic(body.provider, executor);
      if (!central.configured) {
        throw new ValidationError(
          `No hay credencial de ${body.provider.toUpperCase()} configurada. Configúrala en Ajustes → Credenciales.`,
        );
      }
    }

    const created = await storageRepository.create(body, executor);
    res.status(201).json({ ok: true, data: created });
  }),

  /** PUT /api/backups/storages/:id — update; empty secret keeps the stored one. */
  update: asyncHandler(async (req, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) throw new ValidationError("Id inválido");
    const body = updateSchema.parse(req.body);
    const executor = getExecutor(req);
    const existing = await storageRepository.getRaw(id, executor);
    if (!existing) throw new NotFoundError("Storage");

    const patch: Record<string, unknown> = { ...body };
    // Don't overwrite the stored secret with an empty value.
    if (!body.secretAccessKey) delete patch.secretAccessKey;
    // R2 needs an endpoint ONLY when the target carries its own keys (no central
    // credential to inherit the derived endpoint from).
    const provider = body.provider ?? existing.provider;
    const hasOwnKeys = (body.accessKeyId ?? existing.accessKeyId) && (body.secretAccessKey || existing.secretAccessKey);
    if (provider === "r2" && hasOwnKeys) {
      const endpoint = body.endpoint ?? existing.endpoint;
      if (!endpoint) {
        const central = await providerCredentialsRepository.getPublic("r2", executor);
        if (!central.configured) throw new ValidationError("Cloudflare R2 requiere endpoint");
      }
    }

    const updated = await storageRepository.update(id, patch, executor);
    res.json({ ok: true, data: updated });
  }),

  /** DELETE /api/backups/storages/:id — remove a storage target. */
  remove: asyncHandler(async (req, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) throw new ValidationError("Id inválido");
    const executor = getExecutor(req);
    const ok = await storageRepository.remove(id, executor);
    if (!ok) throw new NotFoundError("Storage");
    res.json({ ok: true });
  }),
};
