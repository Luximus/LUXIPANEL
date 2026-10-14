// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import path from "node:path";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutorForRead, LOCAL_TARGET_ID } from "../../../shared/executor/index.js";
import { BRANDING_UPLOAD_MAX_BYTES } from "../../../shared/constants.js";
import { settingsRepository } from "../repositories/settings.repository.js";
import { CONFIG_DIR } from "../../../config/paths.js";

const imageKeys = new Set(["layout_logo", "layout_favicon", "layout_logo_primary", "layout_logo_sidebar", "layout_logo_login", "layout_logo_footer"]);
const mimeTypes: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".avif": "image/avif",
};

// Only public raster files can cross the SSH bridge. Never accept a filesystem
// path from the request or use an arbitrary setting as an asset path.
export function layoutAssetPath(value: string): string | null {
  const relative = value.replace(/^\/panel\//, "/");
  if (!/^\/(?:branding\/)?[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(relative)) return null;
  if (!mimeTypes[path.extname(relative).toLowerCase()]) return null;
  return relative.slice(1);
}

export const layoutController = {
  read: asyncHandler(async (req, res) => {
    const executor = getExecutorForRead(req);
    const rows = await settingsRepository.getByCategory("layout", executor);
    const data = Object.fromEntries(rows.map(row => [row.key, row.value]));
    if (executor.target.id !== LOCAL_TARGET_ID) {
      for (const key of imageKeys) {
        if (data[key] && layoutAssetPath(data[key])) {
          const query = new URLSearchParams({ key, target: executor.target.id });
          data[key] = `/api/ui/layout/asset?${query}`;
        }
      }
    }
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, targetId: executor.target.id, data });
  }),

  asset: asyncHandler(async (req, res) => {
    const executor = getExecutorForRead(req);
    const key = String(req.query.key ?? "");
    if (!imageKeys.has(key) || req.query.target !== executor.target.id) {
      res.sendStatus(404); return;
    }
    const relative = layoutAssetPath(await settingsRepository.get(key, executor) ?? "");
    if (!relative) { res.sendStatus(404); return; }
    // Same installation-relative roots as branding uploads; dist is the served
    // copy, public is the source retained across rebuilds.
    const files = ["dist/client", "public"].map(folder => path.resolve(process.cwd(), "..", "frontend", folder, relative));
    if (executor.target.id !== LOCAL_TARGET_ID && relative.startsWith("branding/")) files.unshift(path.posix.join(CONFIG_DIR, relative));
    for (const file of files) {
      let stat;
      try { stat = await executor.stat(file); } catch { continue; }
      if (stat.type !== "file" || stat.size <= 0 || stat.size > BRANDING_UPLOAD_MAX_BYTES) continue;
      const encoded = await executor.readFile(file, "base64");
      const bytes = Buffer.from(String(encoded), "base64");
      if (bytes.length > BRANDING_UPLOAD_MAX_BYTES) { res.sendStatus(404); return; }
      res.set("Cache-Control", "no-store");
      res.type(mimeTypes[path.extname(relative).toLowerCase()]!);
      res.end(bytes); return;
    }
    res.sendStatus(404);
  }),
};
