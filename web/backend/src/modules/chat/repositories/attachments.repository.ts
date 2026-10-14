// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Chat attachment storage on the connected target (mirrors the AI-assistant
 * attachments repo).
 *
 * Binary files live under `${LUXIPANEL_CONFIG_DIR}/chat/attachments/<convId>/`
 * and a JSON index (`chat/attachments-index.json`) maps each id to its metadata
 * so the serve endpoint can find them.
 */

import { randomUUID } from "node:crypto";
import { dataStore } from "../../../shared/data-store/index.js";
import {
  deleteConvBlobs,
  ensureBlobDir,
  readBlob,
  safeConvSegment,
} from "../../../shared/blob-store/conv-blob-store.js";
import { type Executor } from "../../../shared/executor/index.js";
import { panelConfigDir } from "@config/paths.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("chat-attachments");

export interface ChatAttachmentRecord {
  id?: string;
  convId: string;
  name: string;
  mimeType: string;
  path: string;
  bytes: number;
  ts: string;
}

const MODULE = "chat";
const COLLECTION = "attachments-index";

function attachmentsDir(): string {
  return `${panelConfigDir()}/chat/attachments`;
}

function index(executor?: Executor | null) {
  return dataStore<ChatAttachmentRecord>(executor, MODULE, COLLECTION, {
    idStrategy: "uuid",
    timestamps: false,
  });
}

export const attachmentsRepository = {
  /**
   * Store several attachments from one message. Per-id binary files are written
   * in parallel (distinct paths), but the JSON index is registered in a SINGLE
   * atomic transaction — concurrent read-modify-write of the shared index map
   * would otherwise clobber all-but-one record (only the last writer survives),
   * so only one image would resolve and the rest 404 in the bubble.
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
      const rec: ChatAttachmentRecord = {
        convId,
        name: file.name,
        mimeType: file.mimeType,
        path: `${dir}/${id}-${safe}`,
        bytes: buf.length,
        ts,
      };
      return { file, buf, id, rec };
    });

    await Promise.all(prepared.map((p) => executor.writeFile(p.rec.path, p.buf, { mode: 0o600 })));

    await index(executor).transaction(async (current) => {
      for (const p of prepared) current[p.id] = p.rec;
      return { next: current, result: undefined };
    });

    return prepared.map((p) => ({ id: p.id, name: p.file.name, mimeType: p.file.mimeType }));
  },

  async get(executor: Executor | null | undefined, id: string): Promise<ChatAttachmentRecord | null> {
    return index(executor).get(id) as Promise<ChatAttachmentRecord | null>;
  },

  /**
   * `attachmentId → bytes` for one conversation, read from the shared index in
   * ONE round trip. The index has no `messageId`/`from`, so the caller joins it
   * against the message rows; this only supplies the size.
   */
  async listByConvId(executor: Executor, convId: string): Promise<Map<string, number>> {
    const rows = await index(executor).list();
    const sizes = new Map<string, number>();
    for (const row of rows) {
      if (row.convId !== convId) continue;
      const id = String(row.id ?? "");
      if (!id) continue;
      sizes.set(id, typeof row.bytes === "number" ? row.bytes : 0);
    }
    return sizes;
  },

  /** Read raw bytes (base64 over exec to stay binary-safe). */
  async read(executor: Executor, rec: ChatAttachmentRecord): Promise<Buffer> {
    return readBlob(executor, rec.path);
  },

  /** Delete every attachment of one conversation (files + index entries). */
  async deleteByConvId(executor: Executor, convId: string): Promise<void> {
    await deleteConvBlobs(executor, {
      dir: `${attachmentsDir()}/${safeConvSegment(convId)}`,
      index: index(executor),
      convId,
      onRmError: (err) => log.warn({ err, convId }, "Failed to rm conversation attachments dir"),
    });
  },
};
