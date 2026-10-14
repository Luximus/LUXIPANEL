// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — backup/services/storage-provider.service.ts
 *
 * Characterizes the legacy panel-host storage path (local move, S3/R2 upload
 * via the `aws` CLI, and local pruning). fs + child_process are mocked so no
 * real files or processes are touched.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  default: {
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  },
}));
vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { storageProviderService } from "./storage-provider.service.js";

const mfs = vi.mocked(fs);
const mExec = vi.mocked(execFileSync);

beforeEach(() => vi.clearAllMocks());

describe("storageProviderService.upload — dispatch", () => {
  it("throws on an unknown provider", async () => {
    await expect(
      storageProviderService.upload("/tmp/a.tar.gz", { provider: "ftp" as never }),
    ).rejects.toThrow(/Unknown storage provider/);
  });
});

describe("_uploadLocal", () => {
  it("creates the dir, moves the archive and returns the destination path", () => {
    const dest = storageProviderService._uploadLocal("/tmp/foo.tar.gz", {
      provider: "local",
      localDir: "/backups",
    });
    expect(mfs.mkdirSync).toHaveBeenCalledWith("/backups", { recursive: true });
    expect(mfs.renameSync).toHaveBeenCalledWith("/tmp/foo.tar.gz", "/backups/foo.tar.gz");
    expect(dest).toBe("/backups/foo.tar.gz");
  });

  it("falls back to the default dir when localDir is omitted", () => {
    const dest = storageProviderService._uploadLocal("/tmp/foo.tar.gz", { provider: "local" });
    expect(dest).toBe("/var/backups/luxipanel/foo.tar.gz");
  });
});

describe("_uploadS3", () => {
  it("builds the s3 URI, invokes aws with the endpoint flag, and removes the local copy", () => {
    const uri = storageProviderService._uploadS3("/tmp/foo.tar.gz", {
      provider: "r2",
      bucket: "mybucket",
      prefix: "backups/",
      region: "auto",
      endpoint: "https://acc.r2.cloudflarestorage.com",
      accessKeyId: "AK",
      secretAccessKey: "SK",
    });
    expect(uri).toBe("s3://mybucket/backups/foo.tar.gz");
    expect(mExec).toHaveBeenCalledWith(
      "aws",
      ["s3", "cp", "/tmp/foo.tar.gz", "s3://mybucket/backups/foo.tar.gz", "--endpoint-url", "https://acc.r2.cloudflarestorage.com"],
      expect.objectContaining({ timeout: 300_000, stdio: "pipe" }),
    );
    // Credentials are passed via env, never on argv.
    const opts = mExec.mock.calls[0]![2] as { env: NodeJS.ProcessEnv };
    expect(opts.env["AWS_ACCESS_KEY_ID"]).toBe("AK");
    expect(opts.env["AWS_SECRET_ACCESS_KEY"]).toBe("SK");
    expect(opts.env["AWS_DEFAULT_REGION"]).toBe("auto");
    expect(mfs.unlinkSync).toHaveBeenCalledWith("/tmp/foo.tar.gz");
  });

  it("omits the endpoint flag for plain S3", () => {
    storageProviderService._uploadS3("/tmp/foo.tar.gz", {
      provider: "s3",
      bucket: "b",
      accessKeyId: "AK",
      secretAccessKey: "SK",
    });
    const argv = mExec.mock.calls[0]![1] as string[];
    expect(argv).not.toContain("--endpoint-url");
    expect(argv).toEqual(["s3", "cp", "/tmp/foo.tar.gz", "s3://b/foo.tar.gz"]);
  });
});

describe("pruneLocal", () => {
  it("keeps only the most recent N .tar.gz files and deletes the rest", () => {
    mfs.readdirSync.mockReturnValue([
      "old.tar.gz",
      "mid.tar.gz",
      "new.tar.gz",
      "notes.txt", // ignored (not a .tar.gz)
    ] as never);
    const mtimes: Record<string, number> = {
      "old.tar.gz": 100,
      "mid.tar.gz": 200,
      "new.tar.gz": 300,
    };
    mfs.statSync.mockImplementation(((p: string) => ({
      mtimeMs: mtimes[p.split("/").pop() ?? ""] ?? 0,
    })) as never);

    storageProviderService.pruneLocal("/backups", 1);

    // Only the single newest survives → the two older ones are deleted.
    expect(mfs.unlinkSync).toHaveBeenCalledTimes(2);
    expect(mfs.unlinkSync).toHaveBeenCalledWith("/backups/mid.tar.gz");
    expect(mfs.unlinkSync).toHaveBeenCalledWith("/backups/old.tar.gz");
    expect(mfs.unlinkSync).not.toHaveBeenCalledWith("/backups/new.tar.gz");
  });

  it("deletes nothing when the count is within the retention limit", () => {
    mfs.readdirSync.mockReturnValue(["a.tar.gz", "b.tar.gz"] as never);
    mfs.statSync.mockImplementation((() => ({ mtimeMs: 1 })) as never);
    storageProviderService.pruneLocal("/backups", 5);
    expect(mfs.unlinkSync).not.toHaveBeenCalled();
  });
});
