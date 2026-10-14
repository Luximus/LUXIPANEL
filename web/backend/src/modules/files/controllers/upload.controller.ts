// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Upload controller — binary file upload and download.
 *
 * Upload uses application/octet-stream body (max `FILES_UPLOAD_MAX_BYTES`, 512
 * MiB default, via the raw body parser on the route). Download streams the file
 * with appropriate Content-Type.
 */

import path from "node:path";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z } from "zod";

import { pathOnlySchema } from "../../../shared/validators/index.js";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor, getContextUser, quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { normalizeAbsPath } from "../../../shared/utils/posix-path.js";
import { sshProxyClient } from "../../../shared/executor/ssh-proxy-client.service.js";
import { invalidateDir, invalidateFile, invalidateStat } from "../../../shared/files-cache/index.js";
import { canAccessPath } from "../../../shared/auth/role-permissions.js";
import { ForbiddenError, AppError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { writePrivilegedFile } from "../../../shared/system/privileged-file-write.js";
import { isPermissionDenied, resolvePathOwner } from "../../../shared/system/privileged-fs-ops.js";
import { assertCanEscalate, auditPrivilegedFileOp } from "../../../shared/system/privilege-escalation.js";
import { dirOf } from "../../../shared/utils/posix-path.js";
import { snapshotService, archiveService } from "../services/index.js";
import { filesConfigService } from "../services/files-config.service.js";
import { assertCanonicalFilePathPermission } from "../middlewares/role-file-permissions.middleware.js";

/** Hard cap on the bytes we buffer into memory on the in-memory DOWNLOAD path
 *  (executor.readFile fallback when no SFTP stream is available) — guards the
 *  panel host from OOMing on a huge remote file. Uploads use their own,
 *  larger cap (`env.FILES_UPLOAD_MAX_BYTES`) since they stream to the target
 *  over SFTP instead of being re-buffered for the client. */
const MAX_TRANSFER_BYTES = 10 * 1024 * 1024;

const uploadDestSchema = z.object({
  dest: z.string().min(1),
  filename: z.string().min(1).max(255),
});

/**
 * Build a safe `Content-Disposition: attachment` header value for `filename`.
 * The raw basename can carry quotes / CR / LF / control chars (header injection
 * → response splitting), so strip them from the quoted-string fallback and add
 * an RFC 5987 `filename*` with the full UTF-8 name percent-encoded.
 */
function contentDisposition(filename: string): string {
  const asciiName =
    filename.replace(/[\r\n"\\]/g, "_").replace(/[\x00-\x1f\x7f]/g, "") || "download";
  const encodedName = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

/**
 * Stream an already-resolved server path back to the client, picking the same
 * transport the file download uses: local pipe, remote SFTP stream, or a
 * size-capped in-memory buffer when no SFTP stream is available.
 */
async function streamServerFile(
  req: Request,
  res: Response,
  executor: Executor,
  absPath: string,
  size: number,
): Promise<void> {
  if (executor.target.id === "local") {
    await pipeline(fs.createReadStream(absPath), res);
    return;
  }

  const bridgedSession = req.res?.locals?.bridgedSession as { remoteSessionId?: string } | undefined;
  if (!bridgedSession?.remoteSessionId) {
    if (typeof size === "number" && size > MAX_TRANSFER_BYTES) {
      throw new AppError(`File too large to download (max ${MAX_TRANSFER_BYTES} bytes)`, 413, ErrorCodes.PAYLOAD_TOO_LARGE);
    }
    const content = await executor.readFile(absPath, "" as unknown as BufferEncoding);
    res.end(Buffer.isBuffer(content) ? content : Buffer.from(content as string, "binary"));
    return;
  }

  const remoteStream = sshProxyClient.openSftpStream(bridgedSession.remoteSessionId, absPath, "read");
  await pipeline(remoteStream, res);
}

/**
 * Compress `sources` (a single file, a whole directory, or several selected
 * entries) into a panel-generated temp ZIP on the target, stream it to the
 * client as `downloadName`, then remove the temp dir. Works for both the local
 * and bridged executors — the mktemp + zip build run on the CONNECTED server
 * via the Executor, never on the panel host (per-server isolation invariant).
 *
 * The archive is built into an isolated `mktemp -d` scratch dir (so a hostile
 * basename can't collide with or clobber an existing file) and fully materialised
 * BEFORE any response header is written, so a build failure surfaces as a typed
 * error with a clean response instead of a half-streamed body.
 */
async function streamZipDownload(
  req: Request,
  res: Response,
  executor: Executor,
  sources: string[],
  downloadName: string,
): Promise<void> {
  const mk = await executor.exec("mktemp -d 2>/dev/null || mktemp -d -t lxp-dl");
  const tmpDir = mk.stdout.trim();
  if (mk.exitCode !== 0 || !tmpDir) {
    throw new AppError("Could not allocate a temp directory for the ZIP on the server", 500, ErrorCodes.INTERNAL_ERROR);
  }
  const tmpZip = `${tmpDir}/${downloadName}`;
  try {
    // Built ON THE TARGET via the Executor (local or bridged) — clean member
    // names, python3-preferred with a `cd parent && zip` fallback.
    await archiveService.buildDownloadZip(sources, tmpZip, executor);
    const info = await executor.stat(tmpZip);
    res.setHeader("Content-Disposition", contentDisposition(downloadName));
    res.setHeader("Content-Type", "application/zip");
    if (typeof info.size === "number") res.setHeader("Content-Length", info.size);
    await streamServerFile(req, res, executor, tmpZip, info.size as number);
  } finally {
    // Best-effort cleanup — never mask the download outcome.
    void executor.exec(quoteCmd("rm", ["-rf", tmpDir])).catch(() => {});
  }
}


/**
 * Write the uploaded bytes to `destPath` on the CONNECTED server (local or
 * bridged), via the Executor — never on the panel host directly.
 *
 * The panel's SSH/local user often can't write a directory owned by another
 * Linux user or by root (EACCES) — e.g. uploading into `/home/<otheruser>`.
 * A plain `executor.writeFile` there surfaced as an opaque 500. So on a
 * permission-denied failure we fall back to the shared privileged ladder:
 * stage a 0600 temp the user CAN write (binary-safe), then `sudo cp` into
 * place (the executor boundary injects the stored sudo passphrase). Uploads
 * into a writable dir keep the direct, unprivileged path (and their owner).
 *
 * OWNERSHIP: the `sudo cp` ladder would leave the file `root:root`, which locks
 * the destination dir's real owner out of their own upload (the
 * `/home/dayz/@LuxiCore.zip` bug). So before the privileged write we resolve
 * the destination DIRECTORY's `uid:gid` and hand it to `writePrivilegedFile`,
 * which `sudo chown`s the file to match. Fail-open: if the owner can't be
 * resolved we still write the file (just without the ownership fixup).
 */
async function writeUploadBytes(
  req: Request,
  executor: Executor,
  destPath: string,
  body: Buffer,
): Promise<void> {
  const bridgedSession = req.res?.locals?.bridgedSession as { remoteSessionId?: string } | undefined;
  try {
    if (executor.target.id !== "local" && bridgedSession?.remoteSessionId) {
      const remoteStream = sshProxyClient.openSftpStream(bridgedSession.remoteSessionId, destPath, "write");
      await pipeline(Readable.from(body), remoteStream);
    } else {
      await executor.writeFile(destPath, body);
    }
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
    // Escalation gate: only sudo/wheel members of the connected server may fall
    // back to the sudo staging ladder; everyone else gets the typed 403 here.
    await assertCanEscalate(executor, "upload", [destPath]);
    const owner = await resolvePathOwner(executor, dirOf(destPath));
    await writePrivilegedFile(executor, destPath, body, { tmpPrefix: "lxp-upload", owner });
    auditPrivilegedFileOp("upload", [destPath], true);
  }
}

/** Guess MIME type from extension. */
function guessMime(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".xml": "application/xml",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    // Video
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".webm": "video/webm",
    ".ogv": "video/ogg",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    // Audio
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
    ".opus": "audio/opus",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".tar": "application/x-tar",
    ".gz": "application/gzip",
    ".sh": "text/x-shellscript",
    ".conf": "text/plain",
    ".log": "text/plain",
  };
  return map[ext] ?? "application/octet-stream";
}

export const uploadController = {
  /**
   * GET /api/files/download?path=[&zip=true] — download a file, or stream a ZIP
   * of the path (a file OR a whole directory) when `zip=true`.
   *
   * The ZIP is built ON THE TARGET (per-server, via the Executor — never on the
   * panel host) into an isolated `mktemp -d` scratch dir, streamed back, then
   * removed. This is how the file manager's "Descargar como ZIP" action
   * downloads a folder, and how a bulk selection downloads each folder entry.
   */
  download: asyncHandler(async (req: Request, res: Response) => {
    const { path: filePath } = pathOnlySchema.parse({ path: req.query["path"] });
    const wantZip = req.query["zip"] === "true";
    const executor = getExecutor(req);
    const info = await executor.stat(filePath);

    if (wantZip) {
      const baseName = path.basename(filePath) || "download";
      await streamZipDownload(req, res, executor, [filePath], `${baseName}.zip`);
      return;
    }

    if (info.type === "dir") {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "downloadDirectory") });
      return;
    }

    const filename = path.basename(filePath);
    res.setHeader("Content-Disposition", contentDisposition(filename));
    res.setHeader("Content-Type", guessMime(filename));
    res.setHeader("Content-Length", info.size);
    await streamServerFile(req, res, executor, filePath, info.size);
  }),

  /**
   * POST /api/files/upload?dest=/var/www&filename=index.html
   * Body: raw binary (Content-Type: application/octet-stream)
   * Max `FILES_UPLOAD_MAX_BYTES` (512 MiB default) — enforced on the route via
   * express.raw() and re-checked here (typed 413 on overflow).
   */
  upload: asyncHandler(async (req: Request, res: Response) => {
    const query = uploadDestSchema.parse({
      dest: req.query["dest"],
      filename: req.query["filename"],
    });

    // SECURITY: the per-path permission middleware checks `dest` BEFORE the
    // join, but path.join(dest, filename) with filename="../../etc/cron.d/x"
    // escapes the granted dir at write time. Re-resolve the final target and
    // re-check it against the pinned user's path policy before writing.
    const destPath = normalizeAbsPath(path.join(query.dest, query.filename));
    const user = res.locals.user ?? getContextUser();
    if (user && !canAccessPath(user, destPath, "write")) {
      throw new ForbiddenError(`Path access denied for ${destPath}`);
    }

    const body = req.body as Buffer;

    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "uploadEmptyBody") });
      return;
    }
    const executor = getExecutor(req);
    const config = await filesConfigService.get(executor);
    if (body.length > config.uploadMaxBytes) {
      throw new AppError(
        `Upload too large (max ${config.uploadMaxBytes} bytes)`,
        413,
        "PAYLOAD_TOO_LARGE",
      );
    }

    if (user) await assertCanonicalFilePathPermission(executor, user, destPath, "write");
    // Mini-backup of the destination in case the upload replaces it (non-fatal).
    await snapshotService.capture(executor, destPath, "replace");
    await writeUploadBytes(req, executor, destPath, body);
    // AWAIT the cache drop before responding: these hit the per-server cache
    // Redis over SSH (slower than writing this HTTP response), and the frontend
    // reloads the directory listing the instant it sees the 201. Fire-and-forget
    // (`void`) let that reload race ahead of the DEL and read the STALE cached
    // listing — the just-uploaded file would be missing until the 60s TTL. The
    // invalidate* helpers are fail-open (never throw), so awaiting them can only
    // add a bounded round-trip, never surface a new error.
    await Promise.all([
      invalidateDir(executor, destPath),
      invalidateFile(executor, destPath),
      invalidateStat(executor, destPath),
    ]);
    res.status(201).json({ ok: true, path: destPath, size: body.length });
  }),
};
