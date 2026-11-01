// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { open } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import type { Request, Response } from "express";

export function parseDownloadRange(value: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || !Number.isSafeInteger(size) || size <= 0 || (!match[1] && !match[2])) return null;
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return null;
  if (first === null) {
    if (!last || last < 0) return null;
    return { start: Math.max(0, size - last), end: size - 1 };
  }
  if (first < 0 || first >= size || (last !== null && last < first)) return null;
  return { start: first, end: Math.min(last ?? size - 1, size - 1) };
}

/** Called only after the ordinary files.download and path permission guards.
 * Open once: headers and streamed bytes refer to the same inode even if a build
 * replaces the APK. The validator prevents joining bytes from different builds. */
export async function streamLocalDownload(req: Request, res: Response, filePath: string): Promise<void> {
  const file = await open(filePath, "r");
  try {
    const stat = await file.stat({ bigint: true });
    const size = Number(stat.size);
    const etag = `"${stat.dev.toString(16)}-${stat.ino.toString(16)}-${stat.size.toString(16)}-${stat.mtimeNs.toString(16)}-${stat.ctimeNs.toString(16)}"`;
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", stat.mtime.toUTCString());
    res.setHeader("Cache-Control", "no-store, no-transform");
    res.setHeader("Content-Length", size);
    if (req.method === "HEAD") { res.end(); return; }

    const range = req.headers?.range;
    const ifRange = req.headers?.["if-range"];
    if (typeof range === "string" && (ifRange === undefined || ifRange === etag)) {
      const bounds = parseDownloadRange(range, size);
      if (!bounds) {
        res.status(416);
        res.setHeader("Content-Range", `bytes */${size}`);
        res.setHeader("Content-Length", 0);
        res.end();
        return;
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${bounds.start}-${bounds.end}/${size}`);
      res.setHeader("Content-Length", bounds.end - bounds.start + 1);
      await pipeline(file.createReadStream(bounds), res);
      return;
    }
    await pipeline(file.createReadStream(), res);
  } finally {
    await file.close().catch(() => {});
  }
}
