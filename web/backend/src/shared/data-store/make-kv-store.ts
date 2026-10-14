// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Factory para construir un `dataStore` por repositorio. Antes cada repo de
 * `modules/auth/repositories/*` repetía:
 *
 *     const MODULE = "auth";
 *     const COLLECTION = "audit-log";   // (o "otp", "totp", "passkey", "recovery")
 *
 *     function store(executor?: Executor | null) {
 *       return dataStore<StoredX>(executor, MODULE, COLLECTION, { idStrategy: "uuid" });
 *     }
 *
 * Centralizar el factory elimina esa boilerplate y hace imposible olvidarse
 * el `idStrategy: "uuid"` al añadir un repo nuevo (los repos con id no-uuid
 * lo pasan por `extra`).
 */
import { dataStore } from "./index.js";
import type { IdStrategy } from "./index.js";
import type { Executor } from "../executor/index.js";

export interface KvStoreOptions {
  /** Stable module id (e.g. "auth"). */
  module: string;
  /** Collection name within the module (e.g. "otp", "audit-log"). */
  collection: string;
  /** Override id strategy (e.g. "uuid" for collections that mint their own id). */
  idStrategy?: IdStrategy;
}

export function makeKvStore<Stored extends Record<string, any>>(opts: KvStoreOptions) {
  return (executor?: Executor | null) =>
    dataStore<Stored>(executor, opts.module, opts.collection, opts.idStrategy ? { idStrategy: opts.idStrategy } : undefined);
}
