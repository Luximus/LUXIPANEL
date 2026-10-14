// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-target audit log of assistant tool invocations.
 *
 * Sidecar:  ${LUXIPANEL_CONFIG_DIR}/assistant/audit.json
 *
 * Bounded: keeps the last `MAX_ENTRIES` events so the file stays small.
 * Writes are best-effort — if persistence fails we log a warning but never
 * fail the agent run on the user's behalf.
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("assistant-audit");

const MAX_ENTRIES = 200;

export interface AuditEntry {
  id?: string | number;
  ts: string;
  provider: string;
  tool: string;
  success: boolean;
  durationMs: number;
  userId?: string;
  /** Legacy field: never persist or return raw tool output. */
  outputPreview?: string;
  /**
   * Cross-server access record (set only for `servers.*` tools that reach an
   * OTHER server than the connected one). Built ENTIRELY from LUXIPANEL-local
   * sources — nothing is fetched from LP-LS for the record. Persisted in the
   * connected server's `${LUXIPANEL_CONFIG_DIR}/assistant/audit.json` (0600).
   *
   * Legacy secret and command fields are retained in the type solely to scrub
   * records written by older versions.
   */
  kind?: "cross-server" | "peer-inbound";
  username?: string;
  targetServerId?: string;
  targetServerName?: string;
  targetHost?: string;
  linuxUser?: string;
  passphrase?: string;
  privateKey?: string;
  password?: string;
  command?: string;
}

const MODULE = "assistant";
const COLLECTION = "audit";
const store = makeKvStore<AuditEntry>({ module: MODULE, collection: COLLECTION, idStrategy: "uuid" });

/** Audit records are metadata, never a second credential or tool-output store. */
function sanitize(entry: AuditEntry): AuditEntry {
  const { passphrase: _passphrase, privateKey: _privateKey, password: _password,
    command: _command, outputPreview: _outputPreview, ...safe } = entry;
  return safe;
}

function hasUnsafeFields(entry: AuditEntry): boolean {
  return ["passphrase", "privateKey", "password", "command", "outputPreview"]
    .some((key) => Object.prototype.hasOwnProperty.call(entry, key));
}

export const assistantAuditRepository = {
  async append(entry: AuditEntry, executor?: Executor | null): Promise<void> {
    try {
      const ds = store(executor);
      await ds.create(sanitize(entry));
      // Trim oldest entries (best-effort).
      const all = await ds.list();
      if (all.length > MAX_ENTRIES) {
        const sorted = [...all].sort((a, b) => (a.ts < b.ts ? -1 : 1));
        for (const old of sorted.slice(0, all.length - MAX_ENTRIES)) {
          await ds.delete(old.id!);
        }
      }
    } catch (err) {
      log.warn({ err }, "Failed to append audit entry");
    }
  },

  async list(executor?: Executor | null, limit = 100): Promise<AuditEntry[]> {
    const ds = store(executor);
    const all = await ds.list();
    // Opportunistically purge legacy plaintext from this target's persisted
    // audit file. The response is sanitized even if the write cannot complete.
    if (all.some(hasUnsafeFields)) {
      try {
        await ds.transaction(async (current) => ({
          next: Object.fromEntries(Object.entries(current).map(([id, entry]) => [id, sanitize(entry)])),
          result: undefined,
        }));
      } catch (err) {
        log.warn({ err }, "Failed to scrub legacy audit fields");
      }
    }
    return [...all]
      .map(sanitize)
      .sort((a, b) => (a.ts < b.ts ? 1 : -1))
      .slice(0, limit);
  },
};
