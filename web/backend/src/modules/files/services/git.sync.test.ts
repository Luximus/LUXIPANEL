// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Control credential resolution; keep the real host parser.
vi.mock("./git-credentials.service.js", () => ({
  hostFromRemote: (u: string) => (u.includes("github.com") ? "github.com" : null),
  gitCredentialsService: {
    enabled: () => true,
    resolveForRemote: vi.fn(async () => ({
      cred: { id: "c1", label: "GH", type: "https", host: "github.com", username: "x-access-token", secretEnc: "x" },
      secret: "ghp_TOPSECRET",
    })),
  },
}));

const { gitService } = await import("./git.service.js");
const { ALLOWED_BASES, setAllowedBases } = await import("./filesystem.service.js");

let originalBases: string[] = [];
beforeEach(() => { originalBases = [...ALLOWED_BASES]; setAllowedBases(["/srv"]); });
afterEach(() => setAllowedBases(originalBases));

describe("gitService.pull (credential handling)", () => {
  it("never puts the secret in argv, stages it in a tmp file, and cleans up", async () => {
    const execCalls: string[] = [];
    const writes: Array<{ path: string; data: string; opts?: { mode?: number } }> = [];
    const exec = vi.fn(async (cmd: string) => {
      execCalls.push(cmd);
      if (cmd.includes("--show-toplevel")) return { stdout: "/srv/app", stderr: "", exitCode: 0, durationMs: 1 };
      if (cmd.includes("'remote'") && cmd.includes("'get-url'")) return { stdout: "https://github.com/o/r.git", stderr: "", exitCode: 0, durationMs: 1 };
      return { stdout: "Already up to date.", stderr: "", exitCode: 0, durationMs: 1 };
    });
    const writeFile = vi.fn(async (path: string, data: string, opts?: { mode?: number }) => { writes.push({ path, data, opts }); });
    const executor = { target: { id: "r", name: "R" }, exec, writeFile } as never;

    const r = await gitService.pull(executor, "/srv/app");
    expect(r.ok).toBe(true);

    // The secret must NEVER appear in any executed command line.
    for (const c of execCalls) expect(c).not.toContain("ghp_TOPSECRET");

    // It IS staged in a tmp token file (written via SFTP, not argv),
    // 0600 ATOMICALLY at creation (no write-then-chmod window).
    const tok = writes.find((w) => w.path.endsWith(".tok"));
    expect(tok?.data).toBe("ghp_TOPSECRET");
    expect(tok?.opts?.mode).toBe(0o600);
    // And an askpass helper script references it (0700 — must be executable).
    const askpass = writes.find((w) => w.path.includes("gitaskpass") && !w.path.endsWith(".tok"));
    expect(askpass?.data).toContain("case"); // a /bin/sh askpass script
    expect(askpass?.opts?.mode).toBe(0o700);
    // No separate chmod round-trips remain for the helper files.
    expect(execCalls.some((c) => c.startsWith("chmod ") && c.includes("gitaskpass"))).toBe(false);

    // The pull command carries GIT_ASKPASS (path only) and GIT_TERMINAL_PROMPT=0.
    const pullCmd = execCalls.find((c) => c.includes("'pull'"))!;
    expect(pullCmd).toContain("GIT_ASKPASS=");
    expect(pullCmd).toContain("GIT_TERMINAL_PROMPT=0");

    // Cleanup removed the tmp files (command name "rm" is unquoted by quoteCmd).
    const rmCmd = execCalls.find((c) => c.startsWith("rm ") && c.includes("gitaskpass"));
    expect(rmCmd).toBeTruthy();
  });

  it("ssh credential uses GIT_SSH_COMMAND with an ephemeral key (secret in a file)", async () => {
    const { gitCredentialsService } = await import("./git-credentials.service.js");
    (gitCredentialsService.resolveForRemote as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      cred: { id: "c2", label: "GH", type: "ssh", host: "github.com", secretEnc: "x" },
      secret: "-----BEGIN KEY-----\nABC\n-----END KEY-----",
    });
    const execCalls: string[] = [];
    const writes: Array<{ path: string; data: string; opts?: { mode?: number } }> = [];
    const exec = vi.fn(async (cmd: string) => {
      execCalls.push(cmd);
      if (cmd.includes("--show-toplevel")) return { stdout: "/srv/app", stderr: "", exitCode: 0, durationMs: 1 };
      if (cmd.includes("'get-url'")) return { stdout: "git@github.com:o/r.git", stderr: "", exitCode: 0, durationMs: 1 };
      return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
    });
    const writeFile = vi.fn(async (path: string, data: string, opts?: { mode?: number }) => { writes.push({ path, data, opts }); });
    const executor = { target: { id: "r", name: "R" }, exec, writeFile } as never;

    await gitService.push(executor, "/srv/app");
    for (const c of execCalls) expect(c).not.toContain("BEGIN KEY");
    const key = writes.find((w) => w.path.includes("gitkey"));
    expect(key?.data).toContain("BEGIN KEY");
    expect(key?.opts?.mode).toBe(0o600); // atomic 0600, no chmod window
    const pushCmd = execCalls.find((c) => c.includes("'push'"))!;
    expect(pushCmd).toContain("GIT_SSH_COMMAND=");
  });
});

describe("gitRoot sandbox containment (C2)", () => {
  it("treats a repo whose toplevel resolves OUTSIDE the sandbox as not-a-repo", async () => {
    const exec = vi.fn(async (cmd: string) => {
      if (cmd.includes("--show-toplevel")) return { stdout: "/opt/outside-repo", stderr: "", exitCode: 0, durationMs: 1 };
      return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
    });
    const executor = { target: { id: "r", name: "R" }, exec } as never;
    // /srv/app is allowed, but the resolved toplevel /opt/outside-repo is not →
    // every git op must refuse instead of running `-C /opt/outside-repo`.
    const r = await gitService.pull(executor, "/srv/app");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("No es un repositorio Git");
    expect(exec.mock.calls.some((c) => String(c[0]).includes("'pull'"))).toBe(false);
  });
});
