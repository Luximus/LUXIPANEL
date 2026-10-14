// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Branding controller — manage logos and favicons on the selected server.
 * Local assets use the frontend public folder; remote uploads use CONFIG_DIR.
 * Uploads accept raw image bytes, max 5MB.
 */

import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { BRANDING_UPLOAD_MAX_BYTES } from "../../../shared/constants.js";
import { getExecutor, LOCAL_TARGET_ID } from "../../../shared/executor/index.js";
import { CONFIG_DIR } from "../../../config/paths.js";
import { isFileNotFoundError } from "../../../shared/kv-store/index.js";

const FRONTEND_PUBLIC = path.resolve(process.cwd(), "..", "frontend", "public");
// Production serves static assets from `frontend/dist/client`, NOT `public/`
// (public/ is only the build SOURCE, copied in at build time). Writing uploads
// solely to public/ made the returned URL 404 until the next rebuild. Mirror to
// both: dist/client (served immediately) + public/ (survives a rebuild).
const FRONTEND_DIST_CLIENT = path.resolve(process.cwd(), "..", "frontend", "dist", "client");

// SVG is intentionally EXCLUDED: an SVG served from the panel's own origin can
// carry <script>, i.e. stored XSS in an admin session. Raster/icon formats only.
const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".ico",
  ".avif",
]);

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
};

const MAX_UPLOAD_BYTES = BRANDING_UPLOAD_MAX_BYTES; // 5MB (SSOT: shared/constants.ts)

/** Strip path separators and unsafe chars; collapse to a safe basename. */
function sanitizeFilename(raw: string): string {
  const base = path.basename(raw).trim();
  return base
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]+/, "")
    .slice(0, 120);
}

interface ImageEntry {
  name: string;
  url: string;
  size: number;
  modifiedAt: string;
  previewUrl?: string;
}

function listImagesIn(dir: string, urlPrefix: string): ImageEntry[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const images: ImageEntry[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;
    const full = path.join(dir, entry.name);
    const stat = fs.statSync(full);
    images.push({
      name: entry.name,
      url: `${urlPrefix}${entry.name}`,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  }
  images.sort((a, b) => a.name.localeCompare(b.name));
  return images;
}

export const brandingController = {
  /**
   * GET /api/admin/branding/images
   * List image files in `frontend/public/` and `frontend/public/branding/`.
   */
  listImages: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    if (executor.target.id !== LOCAL_TARGET_ID) {
      let entries: Awaited<ReturnType<typeof executor.readdir>>;
      try { entries = await executor.readdir(path.posix.join(CONFIG_DIR, "branding")); }
      catch (err) {
        if (!isFileNotFoundError(err)) throw err;
        entries = [];
      }
      const images = entries.filter(entry => entry.type === "file" && sanitizeFilename(entry.name) === entry.name && ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        .map(entry => ({ name: entry.name, url: `/branding/${entry.name}`, size: entry.size, modifiedAt: entry.mtime.toISOString(),
          previewUrl: `/api/admin/branding/asset?${new URLSearchParams({ name: entry.name, target: executor.target.id })}` }));
      res.set("Cache-Control", "no-store");
      res.json({ ok: true, data: images });
      return;
    }
    const root = listImagesIn(FRONTEND_PUBLIC, "/");
    // Merge public/ + dist/client branding, deduped by name (dist wins as the
    // actually-served copy) so uploads show up regardless of which dir has them.
    const branded = new Map<string, ImageEntry>();
    for (const img of listImagesIn(path.join(FRONTEND_PUBLIC, "branding"), "/branding/")) {
      branded.set(img.name, img);
    }
    for (const img of listImagesIn(path.join(FRONTEND_DIST_CLIENT, "branding"), "/branding/")) {
      branded.set(img.name, img);
    }
    res.json({ ok: true, data: [...root, ...branded.values()] });
  }),

  /** Authenticated preview of a raster branding upload on this server. */
  asset: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const name = String(req.query.name ?? "");
    if (!name || sanitizeFilename(name) !== name || !ALLOWED_EXTENSIONS.has(path.extname(name).toLowerCase()) || req.query.target !== executor.target.id) {
      res.sendStatus(404); return;
    }
    const file = path.posix.join(CONFIG_DIR, "branding", name);
    let stat;
    try { stat = await executor.stat(file); } catch { res.sendStatus(404); return; }
    if (stat.type !== "file" || stat.size <= 0 || stat.size > MAX_UPLOAD_BYTES) { res.sendStatus(404); return; }
    const encoded = await executor.readFile(file, "base64");
    const bytes = Buffer.from(String(encoded), "base64");
    if (bytes.length > MAX_UPLOAD_BYTES) { res.sendStatus(404); return; }
    res.set("Cache-Control", "no-store");
    res.type(MIME_BY_EXT[path.extname(name).toLowerCase()]!);
    res.end(bytes);
  }),

  /**
   * POST /api/admin/branding/upload
   * Body: raw image bytes (Content-Type: image/*).
   * Header: X-Filename: original filename used to derive extension.
   * Saves to `frontend/public/branding/<sanitized-name>`.
   */
  upload: asyncHandler(async (req: Request, res: Response) => {
    const rawName = req.header("x-filename") ?? "";
    if (!rawName) {
      throw new ValidationError(apiModuleMessage(res.locals.locale, "brandingFilenameRequired"));
    }

    let decoded: string;
    try { decoded = decodeURIComponent(rawName); }
    catch { throw new ValidationError(apiModuleMessage(res.locals.locale, "brandingFilenameInvalid")); }
    const ext = path.extname(decoded).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new ValidationError(
        apiModuleMessage(res.locals.locale, "brandingExtensionInvalid")
          .replace("{extension}", () => ext || `(${apiModuleMessage(res.locals.locale, "brandingExtensionNone")})`)
          .replace("{allowed}", () => [...ALLOWED_EXTENSIONS].join(", ")),
      );
    }

    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new ValidationError(apiModuleMessage(res.locals.locale, "brandingBodyInvalid"));
    }
    if (body.length > MAX_UPLOAD_BYTES) {
      throw new ValidationError(apiModuleMessage(res.locals.locale, "brandingFileTooLarge").replace("{bytes}", () => String(body.length)));
    }

    const safeBase = sanitizeFilename(decoded);
    if (!safeBase) {
      throw new ValidationError(apiModuleMessage(res.locals.locale, "brandingFilenameInvalid"));
    }

    const executor = getExecutor(req);
    if (executor.target.id !== LOCAL_TARGET_ID) {
      const dir = path.posix.join(CONFIG_DIR, "branding");
      await executor.mkdir(dir, { recursive: true });
      let finalName = safeBase;
      try {
        await executor.stat(path.posix.join(dir, finalName));
        finalName = `${path.basename(safeBase, ext)}-${Date.now()}${ext}`;
      } catch (err) {
        if (!isFileNotFoundError(err)) throw err;
      }
      await executor.writeFile(path.posix.join(dir, finalName), body, { mode: 0o600 });
      res.status(201).json({ ok: true, data: { name: finalName, url: `/branding/${finalName}`, size: body.length, mime: MIME_BY_EXT[ext] } });
      return;
    }

    const brandingDir = path.join(FRONTEND_PUBLIC, "branding");
    const distBrandingDir = path.join(FRONTEND_DIST_CLIENT, "branding");
    if (!fs.existsSync(brandingDir)) {
      fs.mkdirSync(brandingDir, { recursive: true });
    }

    // Avoid overwriting existing files unless name matches exactly — append timestamp on collision.
    let finalName = safeBase;
    if (fs.existsSync(path.join(brandingDir, finalName)) || fs.existsSync(path.join(distBrandingDir, finalName))) {
      const stem = path.basename(safeBase, ext);
      const stamp = Date.now();
      finalName = `${stem}-${stamp}${ext}`;
    }

    // Write to public/ (build source) AND dist/client (served in prod) so the
    // returned URL resolves immediately and survives the next rebuild.
    fs.writeFileSync(path.join(brandingDir, finalName), body);
    try {
      if (!fs.existsSync(distBrandingDir)) fs.mkdirSync(distBrandingDir, { recursive: true });
      fs.writeFileSync(path.join(distBrandingDir, finalName), body);
    } catch {
      // dist/client may not exist in dev (astro serves public/ directly) — the
      // public/ write already covers that path.
    }

    res.status(201).json({
      ok: true,
      data: {
        name: finalName,
        url: `/branding/${finalName}`,
        size: body.length,
        mime: MIME_BY_EXT[ext] ?? "application/octet-stream",
      },
    });
  }),
};
