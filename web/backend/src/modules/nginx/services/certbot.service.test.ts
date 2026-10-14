// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";
import { certbotService } from "./certbot.service.js";

/**
 * Regression: `issueWithExecutor` must validate `domain`/`email` BEFORE it
 * ever builds/runs the certbot command. Invalid input → typed failure result
 * and the executor is never touched (no certbot spawn, no E2BIG arg blowup,
 * no flag-shaped domain reaching certbot's parser).
 */

function fakeExecutor() {
  const exec = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
  return { exec, target: { id: "test-target" } } as any;
}

describe("certbotService.issueWithExecutor — input validation", () => {
  let executor: ReturnType<typeof fakeExecutor>;
  beforeEach(() => {
    executor = fakeExecutor();
  });

  it("rejects a domain shaped like a flag WITHOUT calling certbot", async () => {
    const res = await certbotService.issueWithExecutor("--force-renewal", "a@b.com", executor);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/dominio inválido/i);
    expect(executor.exec).not.toHaveBeenCalled();
  });

  it("rejects a domain with shell/space chars WITHOUT calling certbot", async () => {
    const res = await certbotService.issueWithExecutor("evil.com; rm -rf /", "a@b.com", executor);
    expect(res.success).toBe(false);
    expect(executor.exec).not.toHaveBeenCalled();
  });

  it("rejects an over-long domain (E2BIG guard) WITHOUT calling certbot", async () => {
    const huge = "a".repeat(300) + ".com";
    const res = await certbotService.issueWithExecutor(huge, "a@b.com", executor);
    expect(res.success).toBe(false);
    expect(executor.exec).not.toHaveBeenCalled();
  });

  it("rejects an invalid email WITHOUT calling certbot", async () => {
    const res = await certbotService.issueWithExecutor("example.com", "not-an-email", executor);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/email inválido/i);
    expect(executor.exec).not.toHaveBeenCalled();
  });

  it("rejects an over-long email (E2BIG guard) WITHOUT calling certbot", async () => {
    const huge = "a".repeat(320) + "@example.com";
    const res = await certbotService.issueWithExecutor("example.com", huge, executor);
    expect(res.success).toBe(false);
    expect(executor.exec).not.toHaveBeenCalled();
  });

  it("runs certbot for a valid domain + email and returns cert paths", async () => {
    const res = await certbotService.issueWithExecutor("example.com", "admin@example.com", executor);
    expect(executor.exec).toHaveBeenCalledTimes(1);
    const cmd = executor.exec.mock.calls[0][0] as string;
    expect(cmd).toContain("certbot");
    expect(cmd).toContain("-d");
    expect(cmd).toContain("example.com");
    expect(res.success).toBe(true);
    expect(res.certPath).toBe("/etc/letsencrypt/live/example.com/fullchain.pem");
    expect(res.keyPath).toBe("/etc/letsencrypt/live/example.com/privkey.pem");
  });

  it("surfaces a non-zero certbot exit as a typed failure", async () => {
    executor.exec = vi.fn(async () => ({ exitCode: 1, stdout: "", stderr: "boom" }));
    const res = await certbotService.issueWithExecutor("example.com", "admin@example.com", executor);
    expect(res.success).toBe(false);
    expect(res.error).toBe("boom");
  });
});
