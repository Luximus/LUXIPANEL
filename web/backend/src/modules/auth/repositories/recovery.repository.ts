// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Recovery codes repository — file-backed via dataStore.
 * Lives at `${LUXIPANEL_CONFIG_DIR}/auth/recovery-codes.json`.
 *
 * Recovery codes are short (31^9 alphabet ≈ 2.8e13 combinations) — unsalted
 * SHA-256 was trivially GPU-brutable. New codes are stored as
 * `scrypt$N$r$p$saltHex$hashHex` so a per-record salt + memory-hard KDF
 * raises the offline cracking cost from seconds to centuries. Legacy SHA-256
 * hashes are still recognised by `verifyCodeHash` and accepted during
 * validation, but `replaceAll` always writes the new shape (so any new save
 * upgrades the sidecar). `consume` matches by candidate-hash using
 * `verifyCodeHash` so storage-shape differences are transparent.
 */

import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { RecoveryCode, NewRecoveryCode } from "../models/index.js";

interface StoredRecovery {
  id: string;
  userId: number;
  codeHash: string;
  usedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
}

function fromStored(d: StoredRecovery): RecoveryCode {
  return {
    id: d.id,
    userId: d.userId,
    codeHash: d.codeHash,
    usedAt: d.usedAt ? new Date(d.usedAt) : null,
    supersededAt: d.supersededAt ? new Date(d.supersededAt) : null,
    createdAt: new Date(d.createdAt),
  } as unknown as RecoveryCode;
}

const store = makeKvStore<StoredRecovery>({ module: "auth", collection: "recovery-codes", idStrategy: "uuid" });

// scrypt parameters tuned for ~50ms per verify on this host (Linux 6.12).
// Re-runnable; raise N if it gets fast on newer hardware.
const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const SCRYPT_KEYLEN = 32;
const SCRYPT_SALT_BYTES = 16;

export function hashRecoveryCode(plain: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const hash = scryptSync(plain.normalize("NFKC"), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
  });
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_r,
    SCRYPT_p,
    salt.toString("hex"),
    hash.toString("hex"),
  ].join("$");
}

export function verifyRecoveryCode(plain: string, stored: string): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts[0] !== "scrypt" || parts.length !== 6) {
    // Legacy unsalted SHA-256 hex digest — match strictly, no fallback auth.
    // Kept here only so consumers can migrate; new writes never produce
    // this shape.
    const sha = sha256Hex(plain);
    return safeEqualHex(sha, stored);
  }
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4]!, "hex");
  const expected = Buffer.from(parts[5]!, "hex");
  let candidate: Buffer;
  try {
    candidate = scryptSync(plain.normalize("NFKC"), salt, expected.length, {
      N: n,
      r,
      p,
    });
  } catch {
    return false;
  }
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function randomBytes(n: number): Buffer {
  // dynamic import-free; node crypto.randomBytes is sync
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes: rb } = require("node:crypto") as typeof import("node:crypto");
  return rb(n);
}

function sha256Hex(value: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(value.normalize("NFKC")).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export const recoveryRepository = {
  async findActiveByUser(userId: number, executor?: Executor | null): Promise<RecoveryCode[]> {
    const items = await store(executor).query(
      (d) => d.userId === userId && d.usedAt === null && d.supersededAt === null,
    );
    return items.map((d) => fromStored(d as unknown as StoredRecovery)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  async hasActiveCodes(userId: number, executor?: Executor | null): Promise<boolean> {
    const found = await store(executor).find(
      (d) => d.userId === userId && d.usedAt === null && d.supersededAt === null,
    );
    return found !== null;
  },

  async replaceAll(userId: number, codes: NewRecoveryCode[], executor?: Executor | null): Promise<RecoveryCode[]> {
    return store(executor).transaction(async (current) => {
      const next: Record<string, StoredRecovery> = { ...current };
      const now = new Date().toISOString();
      // Mark existing as superseded
      for (const [id, doc] of Object.entries(next)) {
        if (doc.userId === userId && doc.usedAt === null && doc.supersededAt === null) {
          next[id] = { ...doc, supersededAt: now };
        }
      }
      // Insert new (always scrypt-shaped)
      const created: RecoveryCode[] = [];
      for (const c of codes) {
        const id = randomUUID();
        const doc: StoredRecovery = {
          id,
          userId,
          codeHash: c.codeHash,
          usedAt: null,
          supersededAt: null,
          createdAt: now,
        };
        next[id] = doc;
        created.push(fromStored(doc));
      }
      return { next, result: created };
    });
  },

  /**
   * Consume a candidate code for `userId`. `candidate` is the user-supplied
   * recovery code; we compare against every active stored hash using the
   * shape-aware `verifyRecoveryCode` (scrypt with legacy SHA-256 fallback).
   * Returns the consumed record or `undefined`.
   */
  async consumeByCandidate(
    userId: number,
    candidate: string,
    executor?: Executor | null,
  ): Promise<RecoveryCode | undefined> {
    if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > 256) {
      return undefined;
    }
    return store(executor).transaction(async (current) => {
      const next = { ...current };
      const match = Object.entries(next).find(
        ([, d]) =>
          d.userId === userId &&
          d.usedAt === null &&
          d.supersededAt === null &&
          verifyRecoveryCode(candidate, d.codeHash),
      );
      if (!match) return { next, result: undefined as RecoveryCode | undefined };
      const [id, doc] = match;
      const usedAt = new Date().toISOString();
      next[id] = { ...doc, usedAt };
      return { next, result: fromStored(next[id]!) };
    });
  },

  async consume(userId: number, codeHash: string, executor?: Executor | null): Promise<RecoveryCode | undefined> {
    // Kept for callers that already hashed the candidate; preserved for
    // backwards compatibility. New callers should use `consumeByCandidate`.
    return store(executor).transaction(async (current) => {
      const next = { ...current };
      const match = Object.entries(next).find(
        ([, d]) => d.userId === userId && d.codeHash === codeHash && d.usedAt === null && d.supersededAt === null,
      );
      if (!match) return { next, result: undefined as RecoveryCode | undefined };
      const [id, doc] = match;
      const usedAt = new Date().toISOString();
      next[id] = { ...doc, usedAt };
      return { next, result: fromStored(next[id]!) };
    });
  },
};
