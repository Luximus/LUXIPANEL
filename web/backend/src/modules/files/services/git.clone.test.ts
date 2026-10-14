// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./git-credentials.service.js", () => ({
  hostFromRemote: (u: string) => (u.includes("github.com") ? "github.com" : null),
  gitCredentialsService: {
    enabled: () => true,
    resolveForRemote: vi.fn(async () => ({
      cred: { id: "c1", label: "GH", type: "https", host: "github.com", username: "x", secretEnc: "x" },
      secret: "ghp_SECRET",
    })),
  },
}));
vi.mock("../../../shared/files-cache/index.js", () => ({ invalidateDir: vi.fn() }));

const { gitService } = await import("./git.service.js");
const { ALLOWED_BASES, setAllowedBases } = await import("./filesystem.service.js");

let originalBases: string[] = [];
beforeEach(() => { originalBases = [...ALLOWED_BASES]; setAllowedBases(["/srv"]); });
afterEach(() => setAllowedBases(originalBases));

function execRecorder() {
  const calls: string[] = [];
  const writes: Array<{ path: string; data: string }> = [];
  const exec = vi.fn(async (cmd: string) => { calls.push(cmd); return { stdout: "done", stderr: "", exitCode: 0, durationMs: 1 }; });
  const writeFile = vi.fn(async (path: string, data: string) => { writes.push({ path, data }); });
  return { executor: { target: { id: "r", name: "R" }, exec, writeFile } as never, calls, writes };
}

describe("gitService.clone", () => {
  it("rejects a non-git URL and an arg-injection URL", async () => {
    const { executor } = execRecorder();
    expect((await gitService.clone(executor, "--upload-pack=evil", "/srv/x")).ok).toBe(false);
    expect((await gitService.clone(executor, "ftp://x/y", "/srv/x")).ok).toBe(false);
  });

  it("rejects a dest outside allowed bases", async () => {
    const { executor } = execRecorder();
    const r = await gitService.clone(executor, "https://github.com/o/r.git", "/etc/evil");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/permitidas/);
  });

  it("clones with the secret staged in a file (never in argv) and uses --", async () => {
    const { executor, calls, writes } = execRecorder();
    const r = await gitService.clone(executor, "https://github.com/o/r.git", "/srv/app", "main");
    expect(r.ok).toBe(true);
    expect(r.dest).toBe("/srv/app");
    const cloneCmd = calls.find((c) => c.includes("'clone'"))!;
    expect(cloneCmd).toContain("'--'"); // separator before url/dest
    expect(cloneCmd).toContain("'--branch' 'main'");
    for (const c of calls) expect(c).not.toContain("ghp_SECRET");
    expect(writes.find((w) => w.path.endsWith(".tok"))?.data).toBe("ghp_SECRET");
  });
});

describe("gitService.deploy", () => {
  it("checks out the branch then pulls", async () => {
    const { executor, calls } = execRecorder();
    // remote get-url must return a github url so pull resolves a cred path
    (executor as never as { exec: ReturnType<typeof vi.fn> }).exec.mockImplementation(async (cmd: string) => {
      calls.push(cmd);
      if (cmd.includes("--show-toplevel")) return { stdout: "/srv/app", stderr: "", exitCode: 0, durationMs: 1 };
      if (cmd.includes("'get-url'")) return { stdout: "https://github.com/o/r.git", stderr: "", exitCode: 0, durationMs: 1 };
      return { stdout: "ok", stderr: "", exitCode: 0, durationMs: 1 };
    });
    const r = await gitService.deploy(executor, "/srv/app", "main");
    expect(r.ok).toBe(true);
    expect(calls.some((c) => c.includes("'checkout' 'main'"))).toBe(true);
    expect(calls.some((c) => c.includes("'pull' '--ff-only'"))).toBe(true);
  });

  it("rejects an invalid branch", async () => {
    const { executor } = execRecorder();
    expect((await gitService.deploy(executor, "/srv/app", "bad branch!")).ok).toBe(false);
  });
});
