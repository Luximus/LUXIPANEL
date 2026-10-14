// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Attachment serving policy — PURE, so the whole security decision is unit
 * testable without an HTTP round trip.
 *
 * The threat is stored XSS / drive-by execution from the API origin: an
 * attachment is user-supplied bytes with a user-supplied MIME type. The policy
 * is therefore deny-by-default:
 *
 *   1. `mimeType` must be in the INLINE allowlist (raster images, PDF, mp4 /
 *      webm video, the common audio containers). Anything else — SVG, HTML,
 *      text, unknown — is served as `application/octet-stream` + `attachment`.
 *   2. For the non-image types the BYTES must match the container signature
 *      (magic bytes). A "video/mp4" that is really an HTML document is demoted
 *      to an attachment, so a mislabelled upload cannot be rendered.
 *   3. `X-Content-Type-Options: nosniff` on every response, so the browser can
 *      never upgrade our octet-stream back into something scriptable.
 *   4. PDF gets `Content-Security-Policy: sandbox allow-scripts` (Chrome's
 *      PDFium needs scripting in an opaque origin); video/audio get a bare
 *      `sandbox`. Images need none.
 *
 * `Range` is handled here too (206/416): Safari refuses to play media served
 * without range support, and the caller reads the blob over SSH, so the byte
 * slicing must happen on an already-materialised buffer.
 */

/** Raster image MIME types safe to render `inline` (no scriptable formats). */
export const INLINE_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/avif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

/** Non-image types we are willing to render inline, gated by their signature. */
export const INLINE_MEDIA_MIME = new Set([
  "application/pdf",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/mp4",
]);

const ONE_DAY_SECONDS = 86_400;

export interface InlinePolicyInput {
  mimeType: string;
  name: string;
  buf: Buffer;
  rangeHeader?: string | string[] | undefined;
}

export interface InlinePolicy {
  /** 200 (full), 206 (range) or 416 (unsatisfiable range). */
  status: 200 | 206 | 416;
  contentType: string;
  headers: Record<string, string>;
  body: Buffer;
  /** True when the response renders in the browser instead of downloading. */
  inline: boolean;
}

/** Lowercased MIME without parameters (`image/png; charset=…` → `image/png`). */
export function normalizeMime(mimeType: string): string {
  return ((mimeType || "").toLowerCase().split(";")[0] ?? "").trim();
}

function startsWithBytes(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

function ascii(buf: Buffer, offset: number, length: number): string {
  if (buf.length < offset + length) return "";
  return buf.subarray(offset, offset + length).toString("latin1");
}

/** ISO-BMFF (mp4/m4a): `ftyp` box type at offset 4. */
function isIsoBmff(buf: Buffer): boolean {
  return ascii(buf, 4, 4) === "ftyp";
}

/** Matroska / WebM EBML header: 1A 45 DF A3. */
function isEbml(buf: Buffer): boolean {
  return startsWithBytes(buf, [0x1a, 0x45, 0xdf, 0xa3]);
}

/** MP3: an ID3 tag, or a raw MPEG frame sync (FF followed by Ex/Fx). */
function isMp3(buf: Buffer): boolean {
  if (ascii(buf, 0, 3) === "ID3") return true;
  if (buf.length < 2) return false;
  const second = buf[1] ?? 0;
  return buf[0] === 0xff && (second & 0xe0) === 0xe0;
}

/** RIFF….WAVE */
function isWav(buf: Buffer): boolean {
  return ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 4) === "WAVE";
}

/**
 * Does the payload actually look like the declared container? Only the
 * allowlisted non-image types are checked; raster images keep the historical
 * MIME-only gate (they are not scriptable, and `nosniff` pins the type).
 */
export function signatureMatches(mime: string, buf: Buffer): boolean {
  switch (mime) {
    case "application/pdf":
      // Some producers emit a few junk bytes before `%PDF-`; browsers accept
      // that, so scan a small prefix instead of requiring offset 0.
      return buf.subarray(0, 1024).includes("%PDF-");
    case "video/mp4":
    case "audio/mp4":
      return isIsoBmff(buf);
    case "video/webm":
    case "audio/webm":
      return isEbml(buf);
    case "audio/ogg":
      return ascii(buf, 0, 4) === "OggS";
    case "audio/wav":
    case "audio/x-wav":
      return isWav(buf);
    case "audio/mpeg":
      return isMp3(buf);
    default:
      return false;
  }
}

/**
 * RFC 6266 `Content-Disposition` value. The bare `filename` is ASCII-only and
 * strips quotes/backslashes/control chars (a quote would end the parameter and
 * let the uploader inject extra directives); `filename*` carries the real UTF-8
 * name for browsers that understand it.
 */
export function contentDisposition(kind: "inline" | "attachment", name: string): string {
  const raw = (name || "file").replace(/[\r\n]/g, " ").trim() || "file";
  const asciiName = raw.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120) || "file";
  const encoded = encodeURIComponent(raw.slice(-120));
  return `${kind}; filename="${asciiName}"; filename*=UTF-8''${encoded}`;
}

interface ParsedRange {
  start: number;
  end: number;
}

/**
 * Single `bytes=a-b` range against `size`. Returns `null` when there is no
 * range header (serve the whole body) and `"invalid"` when the header is a
 * range we cannot satisfy (→ 416). Multi-range is treated as "no range".
 */
export function parseRange(
  header: string | string[] | undefined,
  size: number,
): ParsedRange | null | "invalid" {
  if (Array.isArray(header)) return null;
  const value = (header ?? "").trim();
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value);
  if (!match) return "invalid";
  const [, startRaw = "", endRaw = ""] = match;
  if (startRaw === "" && endRaw === "") return "invalid";

  let start: number;
  let end: number;
  if (startRaw === "") {
    // Suffix range: last N bytes.
    const suffix = Number.parseInt(endRaw, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number.parseInt(startRaw, 10);
    end = endRaw === "" ? size - 1 : Number.parseInt(endRaw, 10);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalid";
    if (end > size - 1) end = size - 1;
  }
  if (size === 0 || start > end || start < 0 || start >= size) return "invalid";
  return { start, end };
}

/**
 * Decide status, type, headers and body slice for one attachment response.
 * Pure: no Express, no I/O.
 */
export function resolveInlinePolicy(input: InlinePolicyInput): InlinePolicy {
  const buf = input.buf ?? Buffer.alloc(0);
  const mime = normalizeMime(input.mimeType);

  const isImage = INLINE_IMAGE_MIME.has(mime);
  const isMedia = INLINE_MEDIA_MIME.has(mime);
  // SVG / HTML / text and anything unknown never reach this branch.
  const inline = isImage || (isMedia && signatureMatches(mime, buf));

  const contentType = inline ? mime : "application/octet-stream";
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": contentDisposition(inline ? "inline" : "attachment", input.name),
    "Cache-Control": `private, max-age=${ONE_DAY_SECONDS}`,
    "Accept-Ranges": "bytes",
  };

  if (inline) {
    if (mime === "application/pdf") headers["Content-Security-Policy"] = "sandbox allow-scripts";
    else if (mime.startsWith("video/") || mime.startsWith("audio/")) {
      headers["Content-Security-Policy"] = "sandbox";
    }
  }

  const size = buf.length;
  const range = parseRange(input.rangeHeader, size);

  if (range === "invalid") {
    return {
      status: 416,
      contentType,
      headers: { ...headers, "Content-Range": `bytes */${size}`, "Content-Length": "0" },
      body: Buffer.alloc(0),
      inline,
    };
  }

  if (range) {
    const body = buf.subarray(range.start, range.end + 1);
    return {
      status: 206,
      contentType,
      headers: {
        ...headers,
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(body.length),
      },
      body,
      inline,
    };
  }

  return {
    status: 200,
    contentType,
    headers: { ...headers, "Content-Length": String(size) },
    body: buf,
    inline,
  };
}
