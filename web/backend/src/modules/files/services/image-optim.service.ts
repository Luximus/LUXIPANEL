// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Image optimization (#22).
 *
 * Convert to WebP, compress in place, resize, and generate responsive variants
 * using whatever tooling the target has (ImageMagick `magick`/`convert`, `cwebp`,
 * `jpegoptim`, `optipng`). Each op detects the required command first and
 * returns an actionable "install X" message if it's missing. In-place compress
 * snapshots the original first (safe-changes). Everything runs via the executor.
 */

import path from "node:path";
import { quoteCmd, quoteArg, type Executor } from "../../../shared/executor/index.js";
import { safePath } from "./filesystem.service.js";
import { snapshotService } from "./snapshot.service.js";
import { invalidateDir, invalidateFile, invalidateStat } from "../../../shared/files-cache/index.js";

const OP_TIMEOUT_MS = 60_000;
const SCAN_TIMEOUT_MS = 25_000;

export interface ImageCapabilities {
  magick: boolean;   // ImageMagick (magick or convert)
  magickCmd: string; // resolved binary ("magick" | "convert" | "")
  cwebp: boolean;
  jpegoptim: boolean;
  optipng: boolean;
}

export interface ImageProcessResult {
  ok: boolean;
  message?: string;
  /** New file path for webp/resize. */
  dest?: string;
  /** Multiple outputs for responsive. */
  outputs?: string[];
  beforeBytes?: number;
  afterBytes?: number;
}

export interface LargeImage { path: string; name: string; sizeBytes: number; }

async function has(executor: Executor, cmd: string): Promise<boolean> {
  try {
    const r = await executor.exec(`command -v ${cmd}`);
    return r.exitCode === 0 && r.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function sizeOf(executor: Executor, p: string): Promise<number> {
  try {
    return (await executor.stat(p)).size;
  } catch {
    return 0;
  }
}

export const imageOptimService = {
  async capabilities(executor: Executor): Promise<ImageCapabilities> {
    const [magick, convert, cwebp, jpegoptim, optipng] = await Promise.all([
      has(executor, "magick"), has(executor, "convert"), has(executor, "cwebp"),
      has(executor, "jpegoptim"), has(executor, "optipng"),
    ]);
    const magickCmd = magick ? "magick" : convert ? "convert" : "";
    return { magick: magick || convert, magickCmd, cwebp, jpegoptim, optipng };
  },

  /** List image files over `minBytes` under a directory. */
  async scanLarge(executor: Executor, dir: string, minBytes = 300_000): Promise<LargeImage[]> {
    const safe = safePath(dir);
    const min = Math.max(1, Math.floor(minBytes / 1024));
    const cmd =
      `find ${quoteArg(safe)} -type f -size +${min}k ` +
      `\\( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.gif' -o -iname '*.bmp' -o -iname '*.tiff' -o -iname '*.webp' \\) ` +
      `-printf '%s\\t%p\\n' 2>/dev/null | sort -rn | head -n 300`;
    const out = await executor.exec(cmd, { timeoutMs: SCAN_TIMEOUT_MS });
    const list: LargeImage[] = [];
    for (const line of out.stdout.split("\n")) {
      if (!line.trim()) continue;
      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      const p = line.slice(tab + 1);
      list.push({ path: p, name: path.posix.basename(p), sizeBytes: Number(line.slice(0, tab)) || 0 });
    }
    return list;
  },

  /** Convert to WebP next to the source (`name.ext` → `name.webp`). */
  async toWebp(executor: Executor, target: string, quality: number, caps: ImageCapabilities): Promise<ImageProcessResult> {
    const safe = safePath(target);
    const dest = safe.replace(/\.[^./]+$/, "") + ".webp";
    const q = Math.min(100, Math.max(1, Math.round(quality)));
    const before = await sizeOf(executor, safe);
    let cmd: string;
    if (caps.cwebp) cmd = quoteCmd("cwebp", ["-q", String(q), safe, "-o", dest]);
    else if (caps.magickCmd) cmd = quoteCmd(caps.magickCmd, [safe, "-quality", String(q), dest]);
    else return { ok: false, message: "Instala cwebp o ImageMagick para convertir a WebP" };
    const out = await executor.exec(cmd, { timeoutMs: OP_TIMEOUT_MS });
    if (out.exitCode !== 0) return { ok: false, message: (out.stderr || "Conversión fallida").trim().slice(0, 200) };
    invalidateDir(executor, dest);
    return { ok: true, dest, beforeBytes: before, afterBytes: await sizeOf(executor, dest) };
  },

  /** Compress in place (snapshots the original first). */
  async compress(executor: Executor, target: string, quality: number, caps: ImageCapabilities): Promise<ImageProcessResult> {
    const safe = safePath(target);
    const before = await sizeOf(executor, safe);
    const q = Math.min(100, Math.max(1, Math.round(quality)));
    const lower = safe.toLowerCase();
    let cmd: string;
    if ((lower.endsWith(".jpg") || lower.endsWith(".jpeg")) && caps.jpegoptim) {
      cmd = quoteCmd("jpegoptim", [`--max=${q}`, "--strip-all", safe]);
    } else if (lower.endsWith(".png") && caps.optipng) {
      cmd = quoteCmd("optipng", ["-o2", "-quiet", safe]);
    } else if (caps.magickCmd) {
      cmd = quoteCmd(caps.magickCmd, [safe, "-strip", "-quality", String(q), safe]);
    } else {
      return { ok: false, message: "Instala ImageMagick (o jpegoptim/optipng) para comprimir" };
    }
    // Safe-changes: back up the original before overwriting it.
    await snapshotService.capture(executor, safe, "edit");
    const out = await executor.exec(cmd, { timeoutMs: OP_TIMEOUT_MS });
    if (out.exitCode !== 0) return { ok: false, message: (out.stderr || "Compresión fallida").trim().slice(0, 200) };
    invalidateFile(executor, safe);
    invalidateStat(executor, safe);
    return { ok: true, beforeBytes: before, afterBytes: await sizeOf(executor, safe) };
  },

  /** Resize to a target width (keeps aspect ratio) into a new `-<w>w` file. */
  async resize(executor: Executor, target: string, width: number, caps: ImageCapabilities): Promise<ImageProcessResult> {
    if (!caps.magickCmd) return { ok: false, message: "Instala ImageMagick para redimensionar" };
    const safe = safePath(target);
    const w = Math.min(10_000, Math.max(1, Math.round(width)));
    const ext = path.posix.extname(safe);
    const dest = `${safe.slice(0, safe.length - ext.length)}-${w}w${ext}`;
    const out = await executor.exec(quoteCmd(caps.magickCmd, [safe, "-resize", `${w}x`, dest]), { timeoutMs: OP_TIMEOUT_MS });
    if (out.exitCode !== 0) return { ok: false, message: (out.stderr || "Redimensión fallida").trim().slice(0, 200) };
    invalidateDir(executor, dest);
    return { ok: true, dest, afterBytes: await sizeOf(executor, dest) };
  },

  /** Generate several widths (responsive set). */
  async responsive(executor: Executor, target: string, widths: number[], caps: ImageCapabilities): Promise<ImageProcessResult> {
    if (!caps.magickCmd) return { ok: false, message: "Instala ImageMagick para generar variantes responsive" };
    const outputs: string[] = [];
    for (const w of widths.slice(0, 8)) {
      const r = await this.resize(executor, target, w, caps);
      if (r.ok && r.dest) outputs.push(r.dest);
    }
    if (outputs.length === 0) return { ok: false, message: "No se generó ninguna variante" };
    return { ok: true, outputs };
  },
};
