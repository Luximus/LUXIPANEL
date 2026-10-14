// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Client-side image downscaling + compression for chat attachments.
 *
 * WHY: vision models bill by PIXELS, not bytes — Claude's cost is roughly
 * `(width × height) / 750` tokens, and it server-side downsamples anything past
 * ~1568px on the long edge / ~1.15 MP anyway. A 4032×3024 phone photo is ~16k
 * tokens; the same image capped at ~1.15 MP is ~1.5k — a 10× saving with no
 * quality the model could have used. We ALSO re-encode heavy images to JPEG so
 * the upload payload shrinks (and a big photo that would blow the 8 MB cap can
 * still be attached instead of rejected).
 *
 * Everything is best-effort: any failure (no canvas, decode error, unknown
 * type) falls back to the ORIGINAL bytes, so attaching never breaks.
 */

/** Long-edge cap (px). Claude downsamples beyond this, so larger is wasted upload. */
const MAX_EDGE = 1568;
/** Total-pixel cap (~1.15 MP) — the other half of the vision sizing rule. */
const MAX_PIXELS = 1_150_000;
/** Re-encode even a small-dimension image if it's heavier than this (payload). */
const SIZE_TRIGGER = 700 * 1024;
/** JPEG quality for the re-encode (0–1). 0.85 is visually lossless for photos. */
const JPEG_QUALITY = 0.85;
/** Raster types we can safely rasterize + recompress. SVG (vector/text) and GIF
 *  (animation) are left untouched. */
const RASTER_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export interface PreparedImage {
  /** Base64 WITHOUT the `data:` prefix (matches `ChatAttachment.dataBase64`). */
  dataBase64: string;
  mimeType: string;
  name: string;
  /** Byte size of the payload actually being sent (post-compression). */
  bytes: number;
}

function stamp(): string {
  // Avoid Date.now() collisions for multiple pastes in the same ms.
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Strip a file extension and append `.jpg` (the re-encode output). */
function renameToJpg(name: string | undefined): string {
  const base = (name && name.trim()) || `imagen-${stamp()}`;
  return `${typeof base === "string" ? base.replace(/\.[^.]+$/, "") : ""}.jpg`;
}

/** FileReader → base64 (no data-URL prefix). Exported: el composer del
 *  mensajero lo reusaba con una copia verbatim (F-23). */
export function readBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Approx decoded byte size of a base64 string (4 chars → 3 bytes). */
function base64Bytes(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/** Pass the original file through untouched (the fallback for everything we
 *  can't or shouldn't transform). */
async function passthrough(file: File): Promise<PreparedImage> {
  const dataBase64 = await readBase64(file);
  return {
    dataBase64,
    mimeType: file.type || "application/octet-stream",
    name: file.name || `archivo-${stamp()}`,
    bytes: file.size || base64Bytes(dataBase64),
  };
}

/**
 * Downscale + recompress `file` if it's a large/heavy raster image; otherwise
 * return its original bytes. Never throws — callers can treat the result as the
 * payload to attach.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return passthrough(file);
  }
  if (!RASTER_TYPES.has(file.type)) return passthrough(file);

  let bmp: ImageBitmap;
  try {
    // `from-image` honors EXIF orientation so portrait photos aren't sideways.
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return passthrough(file);
  }

  try {
    const { width, height } = bmp;
    if (!width || !height) return passthrough(file);

    // One scale factor that satisfies BOTH the long-edge and total-pixel caps.
    const scale = Math.min(
      1,
      MAX_EDGE / Math.max(width, height),
      Math.sqrt(MAX_PIXELS / (width * height)),
    );
    const needsResize = scale < 1;
    const needsCompress = file.size > SIZE_TRIGGER;
    if (!needsResize && !needsCompress) return passthrough(file);

    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return passthrough(file);
    // White matte: JPEG has no alpha, so transparent pixels would otherwise
    // turn black. White matches typical screenshots/diagrams.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return passthrough(file);
    // If we DIDN'T resize and the re-encode came out bigger (flat-color PNGs
    // beat JPEG), keep the original — no point sending a heavier file.
    if (!needsResize && blob.size >= file.size) return passthrough(file);

    const dataBase64 = await readBase64(blob);
    return { dataBase64, mimeType: "image/jpeg", name: renameToJpg(file.name), bytes: blob.size };
  } catch {
    return passthrough(file);
  } finally {
    bmp.close?.();
  }
}
