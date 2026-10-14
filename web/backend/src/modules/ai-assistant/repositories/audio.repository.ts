// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cached text-to-speech audio for assistant replies, stored on the connected
 * target alongside chat images.
 *
 * Generated audio lives under `${LUXIPANEL_CONFIG_DIR}/assistant/audio/<convId>/`
 * (sibling of `assistant/attachments/`) and a JSON index
 * (`assistant/audio-index.json`) maps each id to its metadata. Each record also
 * carries a content `key` (hash of conversation + voice + text), so re-asking to
 * "listen" to the SAME reply reuses the already-synthesized file instead of
 * paying for / regenerating the TTS call every time.
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
import type { Executor } from "../../../shared/executor/index.js";
import { quoteArg, quoteCmd } from "../../../shared/executor/index.js";
import { CONFIG_DIR } from "@config/paths.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("assistant-audio");

export interface AudioRecord {
  id?: string;
  /** Conversation the reply belongs to ("_loose" for chats with no id). */
  convId: string;
  /** Dedup hash (conversation + engine + voice + text). */
  key: string;
  /** TTS voice name used (engine-specific). */
  voice: string;
  mimeType: string;
  path: string;
  bytes: number;
  ts: string;
}

const MODULE = "assistant";
const COLLECTION = "audio-index";

function baseDir(): string {
  return CONFIG_DIR;
}
function audioDir(): string {
  return `${baseDir().replace(/\/+$/, "")}/assistant/audio`;
}
function safeConv(convId: string): string {
  return safeConvSegment(convId, "_loose");
}
function extForMime(mime: string): string {
  if (/mpeg|mp3/i.test(mime)) return "mp3";
  if (/wav/i.test(mime)) return "wav";
  if (/ogg|opus/i.test(mime)) return "ogg";
  if (/aac|m4a|mp4/i.test(mime)) return "m4a";
  return "audio";
}

const PROXY_WRITEFILE_FALLBACK_THRESHOLD = 512 * 1024;
const BASE64_CHUNK_SIZE = 48_000;

function index(executor?: Executor | null) {
  return dataStore<AudioRecord>(executor, MODULE, COLLECTION, { idStrategy: "uuid", timestamps: false });
}

async function writeBinaryWithExecFallback(executor: Executor, filePath: string, buf: Buffer): Promise<void> {
  const tmp = `${filePath}.b64-${randomUUID()}`;
  const base64 = buf.toString("base64");
  await executor.exec(quoteCmd("sh", ["-lc", `: > ${quoteArg(tmp)} && chmod 600 ${quoteArg(tmp)}`]), { timeoutMs: 15_000 });
  try {
    for (let i = 0; i < base64.length; i += BASE64_CHUNK_SIZE) {
      const chunk = base64.slice(i, i + BASE64_CHUNK_SIZE);
      await executor.exec(
        quoteCmd("sh", ["-lc", `printf '%s' '${chunk}' >> ${quoteArg(tmp)}`]),
        { timeoutMs: 15_000 },
      );
    }
    await executor.exec(
      quoteCmd("sh", ["-lc", `base64 -d ${quoteArg(tmp)} > ${quoteArg(filePath)} && chmod 600 ${quoteArg(filePath)}`]),
      { timeoutMs: 30_000 },
    );
  } finally {
    await executor.exec(quoteCmd("rm", ["-f", tmp]), { timeoutMs: 15_000 }).catch(() => undefined);
  }
}

export const audioRepository = {
  /** Look up a previously-synthesized clip by its content key (dedup). */
  async findByKey(executor: Executor | null | undefined, key: string): Promise<AudioRecord | null> {
    return index(executor).find((r) => r.key === key);
  },

  async get(executor: Executor | null | undefined, id: string): Promise<AudioRecord | null> {
    return index(executor).get(id) as Promise<AudioRecord | null>;
  },

  /** Write a base64 audio clip to disk on the target + register it in the index. */
  async store(
    executor: Executor,
    input: { convId: string; key: string; voice: string; mimeType: string; dataBase64: string },
  ): Promise<AudioRecord & { id: string }> {
    const dir = `${audioDir()}/${safeConv(input.convId)}`;
    await ensureBlobDir(executor, dir);

    const buf = Buffer.from(input.dataBase64, "base64");
    const id = randomUUID();
    const rec: AudioRecord = {
      convId: input.convId,
      key: input.key,
      voice: input.voice,
      mimeType: input.mimeType,
      path: `${dir}/${id}.${extForMime(input.mimeType)}`,
      bytes: buf.length,
      ts: new Date().toISOString(),
    };
    if (buf.length <= PROXY_WRITEFILE_FALLBACK_THRESHOLD) {
      try {
        await executor.writeFile(rec.path, buf);
      } catch (err) {
        log.warn({ err, path: rec.path, bytes: buf.length }, "Audio writeFile failed; retrying via exec fallback");
        await writeBinaryWithExecFallback(executor, rec.path, buf);
      }
    } else {
      await writeBinaryWithExecFallback(executor, rec.path, buf);
    }
    // One read-modify-write for the whole index — no lost updates under concurrency.
    await index(executor).transaction(async (current) => {
      current[id] = rec;
      return { next: current, result: undefined };
    });
    return { ...rec, id };
  },

  /** Read the raw bytes of a clip (base64 over exec to stay binary-safe). */
  async read(executor: Executor, rec: AudioRecord): Promise<Buffer> {
    return readBlob(executor, rec.path);
  },

  /** Total bytes used by all cached audio clips. */
  async totalBytes(executor?: Executor | null): Promise<number> {
    return totalBlobBytes(index(executor));
  },

  /** Delete every clip of ONE conversation (files + index entries). */
  async deleteByConvId(executor: Executor, convId: string): Promise<void> {
    await deleteConvBlobs(executor, {
      dir: `${audioDir()}/${safeConv(convId)}`,
      index: index(executor),
      convId,
      onRmError: (err) => log.warn({ err, convId }, "Failed to rm conversation audio dir"),
    });
  },

  /** Delete every cached clip (files + index). */
  async clearAll(executor: Executor): Promise<void> {
    await clearAllBlobs(executor, {
      root: audioDir(),
      index: index(executor),
      onRmError: (err) => log.warn({ err }, "Failed to rm audio dir"),
    });
  },
};
