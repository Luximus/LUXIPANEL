// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Chat attachment storage on the connected target.
 *
 * Binary files live under `${LUXIPANEL_CONFIG_DIR}/assistant/attachments/<convId>/`
 * and a JSON index (`assistant/attachments-index.json`) maps each id to its
 * metadata so the serve endpoint and storage manager can find them.
 */

import { randomUUID } from "node:crypto";
import { dataStore } from "../../../shared/data-store/index.js";
import {
  clearAllBlobs,
  deleteConvBlobs,
  ensureBlobDir,
  readBlob,
  safeConvSegment,
  totalBlobBytes,
} from "../../../shared/blob-store/conv-blob-store.js";
import { type Executor } from "../../../shared/executor/index.js";
import { CONFIG_DIR } from "@config/paths.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("assistant-attachments");

export interface AttachmentRecord {
  id?: string;
  convId: string;
  name: string;
  mimeType: string;
  path: string;
  bytes: number;
  ts: string;
}

const MODULE = "assistant";
const COLLECTION = "attachments-index";

function baseDir(): string {
  return CONFIG_DIR;
}
function attachmentsDir(): string {
  return `${baseDir().replace(/\/+$/, "")}/assistant/attachments`;
}

function index(executor?: Executor | null) {
  return dataStore<AttachmentRecord>(executor, MODULE, COLLECTION, { idStrategy: "uuid", timestamps: false });
}

export const attachmentsRepository = {
  /** Write a base64 attachment to disk on the target + register it. */
  async store(
    executor: Executor,
    convId: string,
    file: { name: string; mimeType: string; dataBase64: string },
  ): Promise<{ id: string; name: string; mimeType: string }> {
    const [ref] = await this.storeMany(executor, convId, [file]);
    return ref!;
  },

  /**
   * Store several attachments from one turn. The per-id binary files are
   * written in parallel (distinct paths, no collision), but the JSON index is
   * registered in a SINGLE atomic transaction — otherwise concurrent
   * read-modify-write of the shared index map clobbers all-but-one record
   * (only the last writer survives), so only one image would ever resolve and
   * the rest 404 in the chat bubble.
   */
  async storeMany(
    executor: Executor,
    convId: string,
    files: Array<{ name: string; mimeType: string; dataBase64: string }>,
  ): Promise<Array<{ id: string; name: string; mimeType: string }>> {
    if (!files.length) return [];
    const dir = `${attachmentsDir()}/${safeConvSegment(convId)}`;
    await ensureBlobDir(executor, dir);

    const ts = new Date().toISOString();
    const prepared = files.map((file) => {
      const buf = Buffer.from(file.dataBase64, "base64");
      const id = randomUUID();
      const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80) || "file";
      const rec: AttachmentRecord = {
        convId,
        name: file.name,
        mimeType: file.mimeType,
        path: `${dir}/${id}-${safe}`,
        bytes: buf.length,
        ts,
      };
      return { file, buf, id, rec };
    });

    await Promise.all(prepared.map((p) => executor.writeFile(p.rec.path, p.buf)));

    // One read-modify-write for the whole index — no lost updates.
    await index(executor).transaction(async (current) => {
      for (const p of prepared) current[p.id] = p.rec;
      return { next: current, result: undefined };
    });

    return prepared.map((p) => ({ id: p.id, name: p.file.name, mimeType: p.file.mimeType }));
  },

  async get(executor: Executor | null | undefined, id: string): Promise<AttachmentRecord | null> {
    return index(executor).get(id) as Promise<AttachmentRecord | null>;
  },

  /** Read the raw bytes of an attachment (base64 over exec to stay binary-safe). */
  async read(executor: Executor, rec: AttachmentRecord): Promise<Buffer> {
    return readBlob(executor, rec.path);
  },

  /** Total bytes used by all stored attachments. */
  async totalBytes(executor?: Executor | null): Promise<number> {
    return totalBlobBytes(index(executor));
  },

  /**
   * Delete every attachment of ONE conversation (files + index entries).
   * Removes the per-conversation directory and drops its index records in a
   * single transaction so a deleted chat leaves no orphaned files or rows.
   */
  async deleteByConvId(executor: Executor, convId: string): Promise<void> {
    await deleteConvBlobs(executor, {
      dir: `${attachmentsDir()}/${safeConvSegment(convId)}`,
      index: index(executor),
      convId,
      onRmError: (err) => log.warn({ err, convId }, "Failed to rm conversation attachments dir"),
    });
  },

  /** Delete every attachment (files + index). */
  async clearAll(executor: Executor): Promise<void> {
    await clearAllBlobs(executor, {
      root: attachmentsDir(),
      index: index(executor),
      onRmError: (err) => log.warn({ err }, "Failed to rm attachments dir"),
    });
  },
};
