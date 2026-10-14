// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-conversation BLOB storage primitives (B-07).
 *
 * Three repositories store binary files on the connected target under
 * `<root>/<convId>/…` with a JSON sidecar index mapping id → metadata:
 * `ai-assistant/repositories/attachments.repository.ts` (the canonical one),
 * `chat/repositories/attachments.repository.ts` (whose own header admitted it
 * "mirrors the AI-assistant attachments repo") and
 * `ai-assistant/repositories/audio.repository.ts`. Their `read()`,
 * `totalBytes()`, `deleteByConvId()`, `clearAll()`, the conversation-id
 * sanitizing and the `mkdir -p && chmod 700` were byte-identical.
 *
 * Only the PRIMITIVES live here: each repo keeps its own record type, its own
 * write path (the audio one needs a chunked base64 fallback for large clips)
 * and its own index instance. Modules must not import each other, so the shared
 * home is `shared/`.
 *
 * SECURITY: `chmod 700` on the per-conversation directory is not cosmetic —
 * attachments are user content on a multi-user box.
 */

import type { DataStore } from "../data-store/index.js";
import { quoteArg } from "../executor/quote.js";
import type { Executor } from "../executor/types.js";

/** Minimum shape every blob index record must have. */
export interface ConvBlobRecord {
  id?: string;
  convId: string;
  path: string;
  bytes: number;
}

/**
 * Filesystem-safe conversation segment. Anything outside `[A-Za-z0-9._-]`
 * becomes `_`, which also neutralizes `/` and `..` — the segment is
 * concatenated into a path, so this IS the traversal guard.
 */
export function safeConvSegment(convId: string, fallback = ""): string {
  return convId.replace(/[^A-Za-z0-9._-]/g, "_") || fallback;
}

/** `mkdir -p <dir> && chmod 700 <dir>` on the target. */
export async function ensureBlobDir(executor: Executor, dir: string): Promise<void> {
  await executor.exec(`mkdir -p ${quoteArg(dir)} && chmod 700 ${quoteArg(dir)}`, { timeoutMs: 5_000 });
}

/**
 * Read a blob's raw bytes. Goes through `base64 -w0` instead of `readFile`
 * because the exec channel is text-only — raw binary would be mangled by the
 * UTF-8 decode on the way back.
 */
export async function readBlob(executor: Executor, path: string): Promise<Buffer> {
  const out = await executor.exec(`base64 -w0 ${quoteArg(path)}`, { timeoutMs: 15_000 });
  const b64 = (out.stdout ?? "").replace(/\s+/g, "");
  return Buffer.from(b64, "base64");
}

/** Sum of `bytes` over every record in the index. */
export async function totalBlobBytes<T extends ConvBlobRecord>(index: DataStore<T>): Promise<number> {
  const all = await index.list();
  return all.reduce((sum, r) => sum + (r.bytes || 0), 0);
}

/**
 * Delete every blob of ONE conversation: `rm -rf` the directory and drop its
 * index records in a SINGLE transaction, so a deleted chat leaves neither
 * orphaned files nor orphaned rows. `rm -rf` failure is non-fatal (reported
 * through `onRmError`) — the index must still be pruned.
 */
export async function deleteConvBlobs<T extends ConvBlobRecord>(
  executor: Executor,
  opts: { dir: string; index: DataStore<T>; convId: string; onRmError?: (err: unknown) => void },
): Promise<void> {
  try {
    await executor.exec(`rm -rf ${quoteArg(opts.dir)}`, { timeoutMs: 15_000 });
  } catch (err) {
    opts.onRmError?.(err);
  }
  await opts.index.transaction(async (current) => {
    for (const [id, rec] of Object.entries(current)) {
      if (rec.convId === opts.convId) delete current[id];
    }
    return { next: current, result: undefined };
  });
}

/** Delete every blob of every conversation (files + index). */
export async function clearAllBlobs<T extends ConvBlobRecord>(
  executor: Executor,
  opts: { root: string; index: DataStore<T>; onRmError?: (err: unknown) => void },
): Promise<void> {
  try {
    await executor.exec(`rm -rf ${quoteArg(opts.root)}`, { timeoutMs: 15_000 });
  } catch (err) {
    opts.onRmError?.(err);
  }
  const all = await opts.index.list();
  for (const r of all) await opts.index.delete(r.id!).catch(() => false);
}
