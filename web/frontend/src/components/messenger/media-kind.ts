// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bloque D — attachment classification shared by the media drawer, the message
 * bubbles and the carousel.
 *
 * `isInlineViewable` is an EXACT mirror of the backend allowlist
 * (`chat/controllers/attachment-headers.ts`): only those MIME types are served
 * with `Content-Disposition: inline` (raster images, `application/pdf`,
 * `video/mp4|webm` and the audio set). Anything else comes back as a download,
 * so the UI must not try to render it in an `<img>/<video>/<iframe>` — it would
 * just trigger a file save. Keep both lists in sync.
 */

export type MediaKind = "image" | "video" | "audio" | "pdf" | "document" | "other";

/** Raster images the backend serves inline (SVG is deliberately excluded). */
const INLINE_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
]);
const INLINE_VIDEO_MIMES = new Set(["video/mp4", "video/webm"]);
const INLINE_AUDIO_MIMES = new Set([
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/mp4",
]);

const DOCUMENT_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "odt", "rtf", "txt", "md", "csv", "tsv",
  "xls", "xlsx", "ods", "ppt", "pptx", "odp", "json", "xml", "yaml", "yml", "log",
]);

function normalizeMime(mimeType: string | null | undefined): string {
  return String(mimeType ?? "").split(";")[0]!.trim().toLowerCase();
}

export function extensionOf(name: string | null | undefined): string {
  const base = String(name ?? "").split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/** Bucket used by the drawer tabs and the bubble rendering. */
export function mediaKindOf(name: string | null | undefined, mimeType: string | null | undefined): MediaKind {
  const mime = normalizeMime(mimeType);
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const ext = extensionOf(name);
  if (ext === "pdf") return "pdf";
  if (mime.startsWith("text/") || DOCUMENT_EXTENSIONS.has(ext)) return "document";
  if (
    mime.startsWith("application/vnd.") ||
    mime === "application/msword" ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/rtf"
  ) {
    return "document";
  }
  return "other";
}

/**
 * True when the backend serves this attachment INLINE (mirror of its
 * allowlist). Everything else must be offered as a plain download.
 */
export function isInlineViewable(mimeType: string | null | undefined): boolean {
  const mime = normalizeMime(mimeType);
  if (!mime) return false;
  return (
    INLINE_IMAGE_MIMES.has(mime) ||
    mime === "application/pdf" ||
    INLINE_VIDEO_MIMES.has(mime) ||
    INLINE_AUDIO_MIMES.has(mime)
  );
}

/** Tabler icon class for an attachment. */
export function mediaIcon(name: string | null | undefined, mimeType: string | null | undefined): string {
  const kind = mediaKindOf(name, mimeType);
  if (kind === "image") return "ti-photo";
  if (kind === "video") return "ti-video";
  if (kind === "audio") return "ti-music";
  if (kind === "pdf") return "ti-file-type-pdf";
  const mime = normalizeMime(mimeType);
  const ext = extensionOf(name);
  if (mime.includes("zip") || mime.includes("compressed") || mime.includes("tar") || ["zip", "gz", "tar", "7z", "rar", "xz"].includes(ext)) {
    return "ti-file-zip";
  }
  if (mime.includes("sheet") || mime.includes("excel") || ["xls", "xlsx", "ods", "csv", "tsv"].includes(ext)) return "ti-file-type-xls";
  if (mime.includes("word") || ["doc", "docx", "odt", "rtf"].includes(ext)) return "ti-file-type-doc";
  if (mime.includes("presentation") || mime.includes("powerpoint") || ["ppt", "pptx", "odp"].includes(ext)) return "ti-file-type-ppt";
  if (kind === "document") return "ti-file-text";
  return "ti-file";
}

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Human size; `null`/negative/NaN → "" (the backend may not know the size). */
export function formatBytes(bytes: number | null | undefined, locale = "es"): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} ${UNITS[0]}`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  let text: string;
  try {
    text = new Intl.NumberFormat(locale.split("-")[0], { maximumFractionDigits: 1 }).format(rounded);
  } catch {
    text = String(rounded);
  }
  return `${text} ${UNITS[unit]}`;
}
