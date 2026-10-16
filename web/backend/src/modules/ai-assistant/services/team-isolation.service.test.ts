// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../config/env.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../config/env.js")>();
  return {
    ...mod,
    env: {
      ...mod.env,
      ASSISTANT_TEAM_ISOLATION_ENABLED: true,
      ASSISTANT_TEAM_DIFF_PREVIEW_BYTES: 100,
      ASSISTANT_TEAM_DIFF_MAX_BYTES: 1000,
    },
  };
});

import { teamIsolationService } from "./team-isolation.service.js";
import type { Executor } from "../../../shared/executor/index.js";

type Rule = { match: (cmd: string) => boolean; stdout?: string; exitCode?: number };

/** Executor fake: rutea cada exec por substring del comando NORMALIZADO
 *  (sin las comillas simples que añade quoteArg por argumento). */
function makeExecutor(rules: Rule[]): { executor: Executor; calls: string[] } {
  const calls: string[] = [];
  const executor = {
    target: { id: "local" },
    exec: vi.fn(async (rawCmd: string) => {
      const cmd = rawCmd.replace(/'/g, "");
      calls.push(cmd);
      const rule = rules.find((r) => r.match(cmd));
      return {
        stdout: rule?.stdout ?? "",
        stderr: "",
        exitCode: rule?.exitCode ?? 0,
        durationMs: 1,
      };
    }),
  } as unknown as Executor;
  return { executor, calls };
}

beforeEach(() => {
  teamIsolationService._resetForTest();
});

describe("teamIsolationService.prepare", () => {
  it("ruta no-git → lease adquirido (y el segundo del mismo path difiere)", async () => {
    const { executor } = makeExecutor([{ match: (c) => c.includes("rev-parse --show-toplevel"), exitCode: 128 }]);
    const a = await teamIsolationService.prepare(executor, { taskId: "t1", projectPath: "/srv/app" });
    expect(a.isolation.mode).toBe("lease");
    expect(a.isolation.leasePath).toBe("/srv/app");
    expect(a.deferred).toBe(false);
    const b = await teamIsolationService.prepare(executor, { taskId: "t2", projectPath: "/srv/app" });
    expect(b.isolation.mode).toBe("lease");
    expect(b.deferred).toBe(true);
    // Liberar t1 → t2 puede adquirir.
    teamIsolationService.releaseLease("/srv/app", "t1");
    expect(teamIsolationService.tryAcquireLease("/srv/app", "t2")).toBe(true);
  });

  it("repo git → worktree + rama con el layout esperado y forcedCwd con subruta", async () => {
    const { executor, calls } = makeExecutor([
      { match: (c) => c.includes("rev-parse --show-toplevel"), stdout: "/srv/repo\n" },
      { match: (c) => c.includes("rev-parse HEAD"), stdout: "abc123\n" },
      { match: (c) => c.includes("status --porcelain"), stdout: " M dirty.txt\n" },
    ]);
    const prep = await teamIsolationService.prepare(executor, { taskId: "task-9", projectPath: "/srv/repo/web" });
    expect(prep.isolation.mode).toBe("worktree");
    expect(prep.isolation.repoRoot).toBe("/srv/repo");
    expect(prep.isolation.worktreePath).toBe("/srv/repo/.lxp/worktrees/task-9");
    expect(prep.isolation.branch).toBe("lxp/task-task-9");
    expect(prep.isolation.baseSha).toBe("abc123");
    expect(prep.forcedCwd).toBe("/srv/repo/.lxp/worktrees/task-9/web");
    expect(prep.baseHadUncommitted).toBe(true);
    expect(prep.deferred).toBe(false);
    expect(calls.some((c) => c.includes("worktree add") && c.includes("-b") && c.includes("lxp/task-task-9"))).toBe(true);
    // .lxp/ excluido del git status del checkout principal.
    expect(calls.some((c) => c.includes(".git/info/exclude"))).toBe(true);
  });

  it("worktree add falla → cae a lease", async () => {
    const { executor } = makeExecutor([
      { match: (c) => c.includes("rev-parse --show-toplevel"), stdout: "/srv/repo\n" },
      { match: (c) => c.includes("rev-parse HEAD"), stdout: "abc\n" },
      { match: (c) => c.includes("worktree add"), exitCode: 1 },
    ]);
    const prep = await teamIsolationService.prepare(executor, { taskId: "t3", projectPath: "/srv/repo" });
    expect(prep.isolation.mode).toBe("lease");
  });

  it("taskId inválido → none (nunca interpola nombres sucios en git)", async () => {
    const { executor, calls } = makeExecutor([]);
    const prep = await teamIsolationService.prepare(executor, { taskId: "x;rm -rf /", projectPath: "/srv/repo" });
    expect(prep.isolation.mode).toBe("none");
    expect(calls).toHaveLength(0);
  });
});

describe("teamIsolationService.captureArtifacts", () => {
  it("parsea numstat/name-status y recorta el preview", async () => {
    const longDiff = "x".repeat(150);
    const { executor, calls } = makeExecutor([
      { match: (c) => c.includes("rev-parse HEAD"), stdout: "head99\n" },
      { match: (c) => c.includes("--numstat"), stdout: "10\t2\tsrc/a.ts\n-\t-\timg.png\n3\t0\tsrc/b.ts\n" },
      { match: (c) => c.includes("--name-status"), stdout: "M\tsrc/a.ts\nA\timg.png\nR100\told.ts\tsrc/b.ts\n" },
      { match: (c) => c.includes("| head -c"), stdout: longDiff },
    ]);
    const { artifacts, headSha } = await teamIsolationService.captureArtifacts(executor, {
      mode: "worktree",
      worktreePath: "/srv/repo/.lxp/worktrees/t1",
      baseSha: "abc",
    });
    expect(headSha).toBe("head99");
    expect(artifacts.filesChangedTotal).toBe(3);
    expect(artifacts.insertions).toBe(13);
    expect(artifacts.deletions).toBe(2);
    expect(artifacts.filesChanged).toEqual([
      { path: "src/a.ts", status: "M", insertions: 10, deletions: 2 },
      { path: "img.png", status: "A", insertions: 0, deletions: 0 },
      { path: "src/b.ts", status: "R", insertions: 3, deletions: 0 },
    ]);
    expect(artifacts.diffPreview).toHaveLength(100);
    expect(artifacts.diffTruncated).toBe(true);
    // Auto-commit para preservar el trabajo en la rama.
    expect(calls.some((c) => c.includes("add -A"))).toBe(true);
    expect(calls.some((c) => c.includes("commit"))).toBe(true);
  });
});

describe("teamIsolationService.integrate", () => {
  const iso = { mode: "worktree" as const, repoRoot: "/srv/repo", branch: "lxp/task-t1", baseSha: "abc" };

  it("rechaza con el checkout principal sucio", async () => {
    const { executor } = makeExecutor([
      { match: (c) => c.includes("rev-parse --verify"), stdout: "abc\n" },
      { match: (c) => c.includes("status --porcelain"), stdout: " M pending.txt\n" },
    ]);
    const res = await teamIsolationService.integrate(executor, iso);
    expect(res.ok).toBe(false);
    expect(res.message).toContain("sin commitear");
  });

  it("fast-forward cuando puede", async () => {
    const { executor } = makeExecutor([
      { match: (c) => c.includes("rev-parse --verify"), stdout: "abc\n" },
      { match: (c) => c.includes("status --porcelain"), stdout: "" },
      { match: (c) => c.includes("--ff-only"), exitCode: 0 },
    ]);
    const res = await teamIsolationService.integrate(executor, iso);
    expect(res.ok).toBe(true);
    expect(res.message).toContain("fast-forward");
  });

  it("conflicto → aborta el merge y devuelve los archivos", async () => {
    const { executor, calls } = makeExecutor([
      { match: (c) => c.includes("rev-parse --verify"), stdout: "abc\n" },
      { match: (c) => c.includes("status --porcelain"), stdout: "" },
      { match: (c) => c.includes("--ff-only"), exitCode: 1 },
      { match: (c) => c.includes("--no-ff"), exitCode: 1 },
      { match: (c) => c.includes("--diff-filter=U"), stdout: "src/a.ts\nsrc/b.ts\n" },
    ]);
    const res = await teamIsolationService.integrate(executor, iso);
    expect(res.ok).toBe(false);
    expect(res.conflicts).toEqual(["src/a.ts", "src/b.ts"]);
    expect(calls.some((c) => c.includes("merge --abort"))).toBe(true);
  });
});

it("isolates identical lease paths by target and refuses a stale owner release", () => {
  expect(teamIsolationService.tryAcquireLease("/srv/app/", "a", "server-a")).toBe(true);
  expect(teamIsolationService.tryAcquireLease("/srv/app", "b", "server-b")).toBe(true);
  expect(teamIsolationService.tryAcquireLease("/srv/app", "c", "server-a")).toBe(false);
  teamIsolationService.releaseLease("/srv/app", "c", "server-a");
  expect(teamIsolationService.tryAcquireLease("/srv/app", "c", "server-a")).toBe(false);
  teamIsolationService.releaseLease("/srv/app", "a", "server-a");
  expect(teamIsolationService.tryAcquireLease("/srv/app", "c", "server-a")).toBe(true);
});
