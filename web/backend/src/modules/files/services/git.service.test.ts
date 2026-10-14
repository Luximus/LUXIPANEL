// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gitService, _internal } from "./git.service.js";
import { ALLOWED_BASES, setAllowedBases } from "./filesystem.service.js";

let originalBases: string[] = [];
beforeEach(() => { originalBases = [...ALLOWED_BASES]; setAllowedBases(["/srv"]); });
afterEach(() => setAllowedBases(originalBases));

describe("parseBranchLine", () => {
  it("extracts branch + ahead/behind", () => {
    expect(_internal.parseBranchLine("## main...origin/main [ahead 1, behind 2]")).toEqual({ branch: "main", ahead: 1, behind: 2 });
    expect(_internal.parseBranchLine("## dev")).toEqual({ branch: "dev", ahead: 0, behind: 0 });
    expect(_internal.parseBranchLine("## release/1.2...origin/release/1.2 [behind 2]")).toEqual({ branch: "release/1.2", ahead: 0, behind: 2 });
  });
});

describe("gitService.checkRemote", () => {
  it("fetches only the active branch and compares commits without switching branches", async () => {
    const executor = gitExec((cmd) => {
      if (cmd.includes("--show-toplevel")) return { stdout: "/srv/app" };
      if (cmd.includes("'status'")) return { stdout: "## main...origin/main" };
      if (cmd.includes("'rev-parse' 'HEAD'")) return { stdout: "abc" };
      if (cmd.includes("'@{upstream}'")) return { stdout: "origin/main" };
      if (cmd.includes("'remote' 'get-url'")) return { stdout: "https://github.com/acme/app.git" };
      if (cmd.includes("'rev-list'")) return { stdout: "0\t2" };
      return null;
    });
    const result = await gitService.checkRemote(executor, "/srv/app");
    expect(result).toMatchObject({ ok: true, branch: "main", ahead: 0, behind: 2, dirty: false });
    const commands = (executor as { exec: ReturnType<typeof vi.fn> }).exec.mock.calls.map((call) => call[0] as string);
    expect(commands.some((cmd) => cmd.includes("'fetch' '--no-tags' 'origin' 'main'"))).toBe(true);
    expect(commands.some((cmd) => cmd.includes("'checkout'") || cmd.includes("'pull'"))).toBe(false);
  });

  it("refuses branches that do not track the matching origin branch", async () => {
    const executor = gitExec((cmd) => {
      if (cmd.includes("--show-toplevel")) return { stdout: "/srv/app" };
      if (cmd.includes("'status'")) return { stdout: "## main...other/main" };
      if (cmd.includes("'@{upstream}'")) return { stdout: "other/main" };
      return null;
    });
    const result = await gitService.checkRemote(executor, "/srv/app");
    expect(result.ok).toBe(false);
    expect((executor as { exec: ReturnType<typeof vi.fn> }).exec.mock.calls.some((call) => String(call[0]).includes("'fetch'"))).toBe(false);
  });
});

function gitExec(handlers: (cmd: string) => { stdout?: string; exitCode?: number } | null) {
  const exec = vi.fn(async (cmd: string) => {
    const h = handlers(cmd) ?? {};
    return { stdout: h.stdout ?? "", stderr: "", exitCode: h.exitCode ?? 0, durationMs: 1 };
  });
  return { target: { id: "r", name: "R" }, exec } as never;
}

describe("gitService.status", () => {
  it("parses branch, head, files and branches", async () => {
    const exec = gitExec((cmd) => {
      if (cmd.includes("--show-toplevel")) return { stdout: "/srv/app", exitCode: 0 };
      if (cmd.includes("'status'")) return { stdout: "## main...origin/main [ahead 1]\n M src/a.php\n?? new.txt\nA  staged.js" };
      if (cmd.includes("rev-parse") && cmd.includes("HEAD")) return { stdout: "deadbee" };
      if (cmd.includes("'branch'")) return { stdout: "main\ndev" };
      return null;
    });
    const s = await gitService.status(exec, "/srv/app/src/a.php");
    expect(s.isRepo).toBe(true);
    expect(s.root).toBe("/srv/app");
    expect(s.branch).toBe("main");
    expect(s.ahead).toBe(1);
    expect(s.head).toBe("deadbee");
    expect(s.branches).toEqual(["main", "dev"]);
    const byPath = Object.fromEntries(s.files.map((f) => [f.path, f]));
    expect(byPath["src/a.php"]?.staged).toBe(false);
    expect(byPath["new.txt"]?.untracked).toBe(true);
    expect(byPath["staged.js"]?.staged).toBe(true);
  });

  it("reports not-a-repo", async () => {
    const exec = gitExec(() => ({ stdout: "", exitCode: 128 }));
    const s = await gitService.status(exec, "/srv/plain");
    expect(s.isRepo).toBe(false);
  });
});

describe("gitService.commit", () => {
  it("adds -A then commits with the session author", async () => {
    const calls: string[] = [];
    const exec = vi.fn(async (cmd: string) => {
      calls.push(cmd);
      if (cmd.includes("--show-toplevel")) return { stdout: "/srv/app", stderr: "", exitCode: 0, durationMs: 1 };
      return { stdout: "1 file changed", stderr: "", exitCode: 0, durationMs: 1 };
    });
    const executor = { target: { id: "r", name: "R" }, exec } as never;
    const r = await gitService.commit(executor, "/srv/app", "fix: stuff", true, { name: "Ana", email: "ana@luxipanel.local" });
    expect(r.ok).toBe(true);
    expect(calls.some((c) => c.includes("'add' '-A'"))).toBe(true);
    const commitCall = calls.find((c) => c.includes("'commit'"))!;
    expect(commitCall).toContain("'user.name=Ana'");
    expect(commitCall).toContain("'user.email=ana@luxipanel.local'");
    expect(commitCall).toContain("'fix: stuff'");
  });

  it("rejects empty message without touching git", async () => {
    const exec = gitExec((cmd) => (cmd.includes("--show-toplevel") ? { stdout: "/srv/app", exitCode: 0 } : null));
    const r = await gitService.commit(exec, "/srv/app", "   ", true, { name: "A", email: "a@b" });
    expect(r.ok).toBe(false);
  });
});

describe("gitService.createBranch", () => {
  it("validates the branch name", async () => {
    const exec = gitExec(() => ({ stdout: "/srv/app", exitCode: 0 }));
    const r = await gitService.createBranch(exec, "/srv/app", "bad name!");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/inválid/);
  });
});
