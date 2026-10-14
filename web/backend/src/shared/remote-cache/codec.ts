// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * shared/remote-cache/codec.ts — the gzip+base64 blob codec shared by every
 * panel-side cache path (`remote-cache/index.ts` read path,
 * `remote-cache/submit-mutation.ts` write-behind path, `files-cache/index.ts`).
 *
 * WIRE CONTRACT — this encoding is read/written by the client-side Python
 * engines (`collector-*.py`, `engine-mirror.py`, `worker.py` via
 * `common.gz_b64` / `common.ungz_b64`). The produced bytes MUST stay
 * byte-for-byte identical, so the gzip level is pinned to `6` here and must
 * never drift between the copies (the whole point of centralising it).
 *
 * Semantics are deliberately raw string-in / string-out: callers that store
 * JSON do their own `JSON.stringify`/`JSON.parse` (file-content callers store
 * plain text, so the codec stays JSON-agnostic).
 */

import { gunzipSync, gzipSync } from "node:zlib";

/**
 * Decompression caps (gzip-bomb defense). The blob comes from the per-server
 * cache Redis, which ANY local process on the customer box can write, so a few
 * KB of crafted gzip could otherwise materialize gigabytes in the panel heap
 * and OOM-kill it (and the decode is synchronous — it also blocks the hot
 * DataTable path). We bound the decompressed size AND reject an oversized
 * base64 input up front (a legit projected collection is well under either).
 */
const MAX_GUNZIP_OUTPUT_BYTES = 32 * 1024 * 1024; // 32 MiB decompressed
const MAX_GUNZIP_INPUT_B64_LEN = 48 * 1024 * 1024; // ~36 MiB of compressed bytes

/** gzip (level 6, the engine-side default) a UTF-8 string and base64-encode it. */
export function gzipB64(text: string): string {
  return gzipSync(Buffer.from(text, "utf-8"), { level: 6 }).toString("base64");
}

/**
 * Inverse of {@link gzipB64}: base64-decode then gunzip to a UTF-8 string.
 * Throws (RangeError) when the input or the decompressed output exceeds the
 * caps above; every caller already treats a decode throw as a cache miss
 * (returns null / falls back to the legacy path), so the fail-open contract
 * holds.
 */
export function gunzipB64(b64: string): string {
  if (b64.length > MAX_GUNZIP_INPUT_B64_LEN) {
    throw new RangeError(
      `gunzipB64: compressed input too large (${b64.length} > ${MAX_GUNZIP_INPUT_B64_LEN})`,
    );
  }
  return gunzipSync(Buffer.from(b64, "base64"), {
    maxOutputLength: MAX_GUNZIP_OUTPUT_BYTES,
  }).toString("utf-8");
}
