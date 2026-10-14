// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — backup/repositories/provider-credentials.repository.ts
 *
 * Focus: `listPublic` reads the shared `provider-creds.json` collection ONCE
 * (both R2 + S3 live in the same file), and maps to the write-only public shape
 * (secret never exposed; hasSecret flag instead; R2 endpoint derived).
 */

import { describe, it, expect, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import { providerCredentialsRepository } from "./provider-credentials.repository.js";

/** Minimal Executor stub that serves one collection file via `readFile`. */
function fakeExecutor(content: string | null): { executor: Executor; readFile: ReturnType<typeof vi.fn> } {
  const readFile = vi.fn(async () => {
    if (content === null) {
      const err = new Error("ENOENT: no such file") as Error & { code?: string };
      err.code = "ENOENT";
      throw err;
    }
    return content;
  });
  // `exec` is only reached on the ENOENT recovery path; return no stdout.
  const exec = vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 1 }));
  return {
    executor: { target: { id: "test-target" }, readFile, exec } as unknown as Executor,
    readFile,
  };
}

describe("providerCredentialsRepository.listPublic", () => {
  it("reads the collection file exactly ONCE for both providers", async () => {
    const content = JSON.stringify({
      r2: { accountId: "acc123", accessKeyId: "AKR2", secretAccessKey: "sekret", updatedAt: "2026-01-01" },
      s3: { region: "us-east-1", accessKeyId: "AKS3", secretAccessKey: "sekret2", updatedAt: "2026-01-02" },
    });
    const { executor, readFile } = fakeExecutor(content);

    const out = await providerCredentialsRepository.listPublic(executor);

    // The whole point of the perf fix: one round-trip, not one per provider.
    expect(readFile).toHaveBeenCalledTimes(1);

    expect(out).toHaveLength(2);
    const [r2, s3] = out;
    expect(r2.provider).toBe("r2");
    expect(r2.configured).toBe(true);
    expect(r2.hasSecret).toBe(true);
    expect(r2.accessKeyId).toBe("AKR2");
    // R2 endpoint is derived from the account id (never stored verbatim).
    expect(r2.endpoint).toBe("https://acc123.r2.cloudflarestorage.com");
    // Secret is write-only — never present on the public shape.
    expect(r2 as Record<string, unknown>).not.toHaveProperty("secretAccessKey");

    expect(s3!.provider).toBe("s3");
    expect(s3!.region).toBe("us-east-1");
    expect(s3!.hasSecret).toBe(true);
  });

  it("returns both providers as unconfigured when the file does not exist (still one read attempt)", async () => {
    const { executor, readFile } = fakeExecutor(null);

    const out = await providerCredentialsRepository.listPublic(executor);

    expect(readFile).toHaveBeenCalledTimes(1);
    expect(out.map((c) => c.provider)).toEqual(["r2", "s3"]);
    expect(out.every((c) => c.configured === false && c.hasSecret === false)).toBe(true);
  });
});
