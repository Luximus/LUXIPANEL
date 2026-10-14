// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Storage provider — move finished backup archives to their destination.
 * Supports: local (move file), S3-compatible (aws CLI), R2 (same CLI).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("storage-provider");

export interface StorageConfig {
  provider: "local" | "s3" | "r2";
  /** Base directory for local provider. */
  localDir?: string;
  /** S3/R2 bucket name. */
  bucket?: string;
  /** Key prefix (folder path inside bucket). */
  prefix?: string;
  /** AWS region (S3 only). */
  region?: string;
  /** Custom endpoint URL (R2: https://<account>.r2.cloudflarestorage.com). */
  endpoint?: string;
  /** AWS_ACCESS_KEY_ID. */
  accessKeyId?: string;
  /** AWS_SECRET_ACCESS_KEY. */
  secretAccessKey?: string;
}

export const storageProviderService = {
  /**
   * Upload/move a backup archive to its destination.
   * @returns Destination URI (file path or s3://bucket/key).
   */
  async upload(archivePath: string, config: StorageConfig): Promise<string> {
    switch (config.provider) {
      case "local":
        return this._uploadLocal(archivePath, config);
      case "s3":
      case "r2":
        return this._uploadS3(archivePath, config);
      default:
        throw new Error(`Unknown storage provider: ${config.provider}`);
    }
  },

  _uploadLocal(archivePath: string, config: StorageConfig): string {
    const destDir = config.localDir ?? "/var/backups/luxipanel";
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, path.basename(archivePath));
    fs.renameSync(archivePath, dest);
    log.info({ dest }, "Backup stored locally");
    return dest;
  },

  _uploadS3(archivePath: string, config: StorageConfig): string {
    const bucket = config.bucket ?? "";
    const prefix = (config.prefix ?? "").replace(/\/$/, "");
    const key = `${prefix}/${path.basename(archivePath)}`.replace(/^\//, "");
    const s3Uri = `s3://${bucket}/${key}`;

    const env: NodeJS.ProcessEnv = { ...process.env };
    if (config.accessKeyId) env["AWS_ACCESS_KEY_ID"] = config.accessKeyId;
    if (config.secretAccessKey) env["AWS_SECRET_ACCESS_KEY"] = config.secretAccessKey;
    if (config.region) env["AWS_DEFAULT_REGION"] = config.region;

    const endpointFlag = config.endpoint ? ["--endpoint-url", config.endpoint] : [];
    execFileSync("aws", ["s3", "cp", archivePath, s3Uri, ...endpointFlag], {
      env,
      stdio: "pipe",
      timeout: 300_000,
    });

    fs.unlinkSync(archivePath);
    log.info({ s3Uri }, "Backup uploaded to S3/R2");
    return s3Uri;
  },

  /**
   * Prune old backups keeping only the most recent `retainCount`.
   * Local only — S3/R2 pruning requires listing objects (future enhancement).
   */
  pruneLocal(dir: string, retainCount: number): void {
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith(".tar.gz"))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    const toDelete = files.slice(retainCount);
    for (const file of toDelete) {
      fs.unlinkSync(path.join(dir, file.name));
      log.info({ file: file.name }, "Old backup pruned");
    }
  },
};
