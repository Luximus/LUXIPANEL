import { coreRepository } from "../../../shared/github/owner-contributions.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Team task isolation — git worktrees + per-path lease fallback.
 *
 * When a leader assigns a task on a project whose `path` is a git repo, the
 * worker gets its OWN `git worktree` + branch (`lxp/task-<id>`) so parallel
 * workers on the same repo can't clobber each other; the branch preserves the
 * work (auto-commit on close) and yields per-task artifacts (diff/numstat).
 * Non-git paths fall back to an in-process LEASE that serializes writers of
 * the same path (the task defers until the holder releases).
 *
 * Git runner over the per-server Executor. The command line itself comes from
 * `shared/system/git-cmd.ts` (`gitCmdIn` = `git -c safe.directory=* -C <root>
 * …`), shared with `files/git.service.ts` — ai-assistant must not import other
 * modules, so the builder lives in `shared/` (B-13).
 *
 * Leases and mutexes are in-process (best-effort across restarts): the queued
 * turn of a deferred task lives in agent-queue.json and re-drains after a
 * restart, so at worst two workers of the same path overlap post-restart.
 */

import { executionKey } from "./execution-scope.js";
import { env } from "../../../config/env.js";
import type { ExecResult, Executor } from "../../../shared/executor/index.js";
import { quoteArg } from "../../../shared/executor/index.js";
import { gitCmdIn } from "../../../shared/system/git-cmd.js";
import { GIT_TIMEOUT_MS } from "../../../shared/constants.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type {
  TeamTaskArtifacts,
  TeamTaskFileChange,
  TeamTaskIsolation,
} from "../models/team-task.types.js";

const log = createModuleLogger("assistant-team-isolation");

/** Task ids are repo-derived names (branch/dir) — keep the charset tight. */
const TASK_ID_RE = /^[A-Za-z0-9-]+$/;
/** Cap on filesChanged entries persisted per task. */
const MAX_FILES_CHANGED = 200;

export interface PreparedIsolation {
  isolation: TeamTaskIsolation;
  /** cwd the worker run must use (worktree + subruta). Absent en lease/none. */
  forcedCwd?: string;
  /** True → the caller must NOT start the run yet (lease busy): queue it. */
  deferred: boolean;
  /** El checkout principal tenía cambios sin commitear (el worktree no los ve). */
  baseHadUncommitted?: boolean;
}

async function git(executor: Executor, repo: string, args: string[]): Promise<ExecResult> {
  return executor.exec(gitCmdIn(repo, args), { timeoutMs: GIT_TIMEOUT_MS });
}

function worktreePathFor(repoRoot: string, taskId: string): string {
  return `${repoRoot}/.lxp/worktrees/${taskId}`;
}

function branchFor(taskId: string): string {
  return `lxp/task-${taskId}`;
}

// ── In-process serialization ────────────────────────────────────────────────

/** Per-path lease: holder taskId. Writers of the same path run one at a time. */
const leases = new Map<string, string>();

/** Per-repo mutex around `worktree add` (two assigns racing the same repo). */
const repoLocks = new Map<string, Promise<unknown>>();

async function withRepoLock<T>(repoRoot: string, fn: () => Promise<T>): Promise<T> {
  const prev = repoLocks.get(repoRoot) ?? Promise.resolve();
  // Store the SAME promise object we compare against in `finally`. The old code
  // stored `next.catch(...)` but compared against a freshly-created
  // `next.catch(...)` — two distinct promise objects that never compare equal,
  // so the entry (and the retained promise chain) was never deleted and the Map
  // grew unbounded per repoRoot. Match `finalizeTask`'s working pattern.
  const next = prev.catch(() => undefined).then(fn);
  repoLocks.set(repoRoot, next);
  try {
    return await next;
  } finally {
    if (repoLocks.get(repoRoot) === next) repoLocks.delete(repoRoot);
  }
}

/** Parse `git diff --numstat` + `--name-status` into TeamTaskFileChange[]. */
function parseChanges(numstat: string, nameStatus: string): {
  files: TeamTaskFileChange[];
  total: number;
  insertions: number;
  deletions: number;
} {
  const statusByPath = new Map<string, TeamTaskFileChange["status"]>();
  for (const line of nameStatus.split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 2) continue;
    const code = (parts[0] ?? "").charAt(0) as TeamTaskFileChange["status"];
    // Renames/copies (`R100\told\tnew`) report the NEW path last.
    const p = parts[parts.length - 1]!.trim();
    if (p) statusByPath.set(p, "AMDRC?".includes(code) ? code : "M");
  }
  const files: TeamTaskFileChange[] = [];
  let total = 0;
  let insertions = 0;
  let deletions = 0;
  for (const line of numstat.split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const path = parts[parts.length - 1]!.trim();
    if (!path) continue;
    total++;
    const ins = parts[0] === "-" ? 0 : Number(parts[0]) || 0;
    const del = parts[1] === "-" ? 0 : Number(parts[1]) || 0;
    insertions += ins;
    deletions += del;
    if (files.length < MAX_FILES_CHANGED) {
      files.push({ path, status: statusByPath.get(path) ?? "M", insertions: ins, deletions: del });
    }
  }
  return { files, total, insertions, deletions };
}

export const teamIsolationService = {
  /**
   * Prepare isolation for a task on `projectPath`: git repo → worktree+branch;
   * non-git (or worktree failure) → lease. Never throws — worst case is
   * `{mode:"none"}` (documented risk: unisolated, like the legacy behaviour).
   */
  async prepare(
    executor: Executor,
    args: { taskId: string; projectPath: string },
  ): Promise<PreparedIsolation> {
    const { taskId, projectPath } = args;
    if (!env.ASSISTANT_TEAM_ISOLATION_ENABLED) {
      return { isolation: { mode: "none" }, deferred: false };
    }
    if (!TASK_ID_RE.test(taskId) || !projectPath.startsWith("/")) {
      log.warn({ taskId, projectPath }, "isolation skipped — invalid taskId/path");
      return { isolation: { mode: "none" }, deferred: false };
    }

    // Detect the git repo root. Any failure → lease path.
    let repoRoot = "";
    try {
      const top = await git(executor, projectPath, ["rev-parse", "--show-toplevel"]);
      if (top.exitCode === 0) repoRoot = top.stdout.trim();
    } catch (err) {
      log.warn({ err: (err as Error).message, projectPath }, "git detection failed");
    }

    if (repoRoot) {
      try {
        return await withRepoLock(executionKey(repoRoot, executor.target.id), () => this.prepareWorktree(executor, { taskId, projectPath, repoRoot }));
      } catch (err) {
        if(executor.target.id==="local"&&repoRoot===coreRepository())throw err;
        log.warn({ err: (err as Error).message, repoRoot, taskId }, "worktree prepare failed — falling back to lease");
      }
    }

    // Lease fallback (non-git path or worktree failure).
    const acquired = this.tryAcquireLease(projectPath, taskId, executor.target.id);
    return {
      isolation: { mode: "lease", leasePath: projectPath },
      deferred: !acquired,
    };
  },

  /** Worktree branch of `prepare` (already under the repo lock). Throws on failure. */
  async prepareWorktree(
    executor: Executor,
    args: { taskId: string; projectPath: string; repoRoot: string },
  ): Promise<PreparedIsolation> {
    const { taskId, projectPath, repoRoot } = args;
    const ownerCore=executor.target.id==="local"&&repoRoot===coreRepository();
    const base = await git(executor, repoRoot, ["rev-parse", ownerCore?"refs/remotes/lxp-owner/developer":"HEAD"]);
    if (base.exitCode !== 0) throw new Error(`repo sin commits (${base.stderr.trim().slice(0, 120)})`);
    const baseSha = base.stdout.trim();
    const dirty = await git(executor, repoRoot, ["status", "--porcelain"]);
    const baseHadUncommitted = dirty.exitCode === 0 && dirty.stdout.trim().length > 0;

    // Keep `.lxp/` out of the main checkout's `git status` (idempotent append).
    const exclude = `${repoRoot}/.git/info/exclude`;
    await executor
      .exec(
        `grep -qxF '/.lxp/' ${quoteArg(exclude)} 2>/dev/null || printf '%s\\n' '/.lxp/' >> ${quoteArg(exclude)}`,
        { timeoutMs: GIT_TIMEOUT_MS },
      )
      .catch(() => undefined);

    const worktreePath = worktreePathFor(repoRoot, taskId);
    const branch = branchFor(taskId);
    // Resume an existing task without resetting its branch or removing its files.
    const existing = await git(executor, worktreePath, ["rev-parse", "--show-toplevel"]);
    const add = existing.exitCode===0 && existing.stdout.trim()===worktreePath
      ? existing
      : await git(executor, repoRoot, ["worktree", "add", worktreePath, "-b", branch, baseSha]);
    if (add.exitCode !== 0) {
      throw new Error(`git worktree add falló: ${(add.stderr || add.stdout).trim().slice(0, 200)}`);
    }

    // project.path puede ser un subdirectorio del repo → misma subruta en el worktree.
    const sub = projectPath === repoRoot ? "" : projectPath.slice(repoRoot.length);
    const cwd = `${worktreePath}${sub}`;
    const isolation: TeamTaskIsolation = {
      mode: "worktree",
      repoRoot,
      worktreePath,
      branch,
      baseSha,
      cwd,
    };
    log.info({ taskId, repoRoot, worktreePath, branch, baseHadUncommitted }, "task worktree ready");
    return {
      isolation,
      forcedCwd: cwd,
      deferred: false,
      ...(baseHadUncommitted ? { baseHadUncommitted: true } : {}),
    };
  },

  /**
   * Auto-commit the worktree (preserves work on the branch even if the model
   * didn't commit) + capture numstat/name-status/diff against the base.
   * Best-effort: throws only bubble as missing artifacts.
   */
  async captureArtifacts(
    executor: Executor,
    iso: TeamTaskIsolation,
  ): Promise<{ artifacts: TeamTaskArtifacts; headSha?: string }> {
    if (iso.mode !== "worktree" || !iso.worktreePath || !iso.baseSha) return { artifacts: {} };
    const wt = iso.worktreePath;
    await git(executor, wt, ["add", "-A"]).catch(() => undefined);
    // "nothing to commit" exits non-zero — fine, the branch just has no delta.
    await git(executor, wt, [
      "-c", "user.name=LUXIPANEL Team",
      "-c", "user.email=team@luxipanel.local",
      "commit", "-m", "lxp: snapshot del trabajo de la tarea",
    ]).catch(() => undefined);
    const head = await git(executor, wt, ["rev-parse", "HEAD"]);
    const headSha = head.exitCode === 0 ? head.stdout.trim() : undefined;

    const range = `${iso.baseSha}..HEAD`;
    const [numstat, nameStatus] = await Promise.all([
      git(executor, wt, ["diff", "--numstat", range]),
      git(executor, wt, ["diff", "--name-status", range]),
    ]);
    const parsed = parseChanges(
      numstat.exitCode === 0 ? numstat.stdout : "",
      nameStatus.exitCode === 0 ? nameStatus.stdout : "",
    );

    const previewBytes = env.ASSISTANT_TEAM_DIFF_PREVIEW_BYTES;
    let diffPreview = "";
    let diffTruncated = false;
    if (parsed.total > 0) {
      const preview = await executor.exec(
        `${gitCmdIn(wt, ["diff", range])} | head -c ${previewBytes + 1}`,
        { timeoutMs: GIT_TIMEOUT_MS },
      );
      if (preview.exitCode === 0) {
        diffPreview = preview.stdout.slice(0, previewBytes);
        diffTruncated = preview.stdout.length > previewBytes;
      }
    }

    const artifacts: TeamTaskArtifacts = {
      ...(parsed.files.length ? { filesChanged: parsed.files } : {}),
      filesChangedTotal: parsed.total,
      insertions: parsed.insertions,
      deletions: parsed.deletions,
      ...(diffPreview ? { diffPreview, diffTruncated } : {}),
    };
    return { artifacts, ...(headSha ? { headSha } : {}) };
  },

  /** Remove the worktree (the branch survives unless `deleteBranch`). */
  async cleanup(
    executor: Executor,
    iso: TeamTaskIsolation,
    opts: { deleteBranch: boolean },
  ): Promise<void> {
    if (iso.mode === "lease") return; // released by the caller via releaseLease
    if (iso.mode !== "worktree" || !iso.repoRoot) return;
    if (iso.worktreePath) {
      await git(executor, iso.repoRoot, ["worktree", "remove", "--force", iso.worktreePath]).catch(() => undefined);
    }
    await git(executor, iso.repoRoot, ["worktree", "prune"]).catch(() => undefined);
    if (opts.deleteBranch && iso.branch) {
      await git(executor, iso.repoRoot, ["branch", "-D", iso.branch]).catch(() => undefined);
    }
  },

  /**
   * Merge the task branch into the main checkout: ff-only → --no-ff → abort +
   * report conflicts. A dirty main checkout refuses upfront (never mixes the
   * user's uncommitted work into a merge).
   */
  async integrate(
    executor: Executor,
    iso: TeamTaskIsolation,
  ): Promise<{ ok: boolean; message: string; conflicts?: string[] }> {
    if (iso.mode !== "worktree" || !iso.repoRoot || !iso.branch) {
      return { ok: false, message: "La tarea no tiene rama de trabajo (sin aislamiento worktree)." };
    }
    const root = iso.repoRoot;
    const verify = await git(executor, root, ["rev-parse", "--verify", iso.branch]);
    if (verify.exitCode !== 0) {
      return { ok: false, message: `La rama ${iso.branch} ya no existe.` };
    }
    const dirty = await git(executor, root, ["status", "--porcelain"]);
    if (dirty.exitCode === 0 && dirty.stdout.trim()) {
      return {
        ok: false,
        message:
          "El checkout principal tiene cambios sin commitear — haz commit o stash antes de integrar la rama " +
          iso.branch + ".",
      };
    }
    const ff = await git(executor, root, ["merge", "--ff-only", iso.branch]);
    if (ff.exitCode === 0) return { ok: true, message: `Rama ${iso.branch} integrada (fast-forward).` };
    const merge = await git(executor, root, ["merge", "--no-ff", "-m", `lxp: integrar ${iso.branch}`, iso.branch]);
    if (merge.exitCode === 0) return { ok: true, message: `Rama ${iso.branch} integrada (merge).` };
    const conflictsOut = await git(executor, root, ["diff", "--name-only", "--diff-filter=U"]);
    const conflicts = conflictsOut.stdout.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 50);
    await git(executor, root, ["merge", "--abort"]).catch(() => undefined);
    return {
      ok: false,
      message: `Conflicto al integrar ${iso.branch} (merge abortado, el checkout quedó limpio).`,
      conflicts,
    };
  },

  /** Full diff of the task branch vs its base (live branch only). */
  async fullDiff(executor: Executor, iso: TeamTaskIsolation, maxBytes: number): Promise<string | null> {
    if (iso.mode !== "worktree" || !iso.repoRoot || !iso.branch || !iso.baseSha) return null;
    const verify = await git(executor, iso.repoRoot, ["rev-parse", "--verify", iso.branch]);
    if (verify.exitCode !== 0) return null;
    const out = await executor.exec(
      `${gitCmdIn(iso.repoRoot, ["diff", `${iso.baseSha}..${iso.branch}`])} | head -c ${maxBytes + 1}`,
      { timeoutMs: GIT_TIMEOUT_MS * 2 },
    );
    if (out.exitCode !== 0) return null;
    return out.stdout.slice(0, maxBytes);
  },

  /** Soporte de PR del repo: remote origin + gh CLI autenticado. */
  async detectPrSupport(executor: Executor, repoRoot: string): Promise<{ remote: string | null; gh: boolean }> {
    const remote = await git(executor, repoRoot, ["remote", "get-url", "origin"]).catch(() => null);
    const remoteUrl = remote && remote.exitCode === 0 ? remote.stdout.trim() : null;
    if (!remoteUrl) return { remote: null, gh: false };
    const gh = await executor
      .exec("command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1 && echo ok", {
        timeoutMs: GIT_TIMEOUT_MS,
      })
      .catch(() => null);
    return { remote: remoteUrl, gh: Boolean(gh && gh.exitCode === 0 && gh.stdout.includes("ok")) };
  },

  /**
   * Modo PR de team.integrate: push de la rama de la tarea a origin y, si hay
   * `gh` autenticado, creación del PR. Usa las credenciales AMBIENTALES del
   * servidor (ssh-agent / credential helper) — sin credencial el push falla
   * con mensaje claro y el fallback es el merge local. La rama local NO se
   * borra (se limpia cuando el PR mergee; sweep manual).
   */
  async createPr(
    executor: Executor,
    iso: TeamTaskIsolation,
    args: { title: string; body: string },
  ): Promise<{ ok: boolean; message: string; prUrl?: string }> {
    if (iso.mode !== "worktree" || !iso.repoRoot || !iso.branch) {
      return { ok: false, message: "La tarea no tiene rama de trabajo (sin aislamiento worktree)." };
    }
    const support = await this.detectPrSupport(executor, iso.repoRoot);
    if (!support.remote) {
      return { ok: false, message: "El repo no tiene remote 'origin'; usa el modo merge local." };
    }
    const push = await executor.exec(gitCmdIn(iso.repoRoot, ["push", "-u", "origin", iso.branch]), {
      timeoutMs: 60_000,
    });
    if (push.exitCode !== 0) {
      return {
        ok: false,
        message:
          `git push falló: ${(push.stderr || push.stdout).trim().slice(0, 200)} — ` +
          "¿hay credenciales de git configuradas en el servidor? Alternativa: modo merge local.",
      };
    }
    if (support.gh) {
      const pr = await executor.exec(
        `cd ${quoteArg(iso.repoRoot)} && gh pr create --head ${quoteArg(iso.branch)} --title ${quoteArg(args.title)} --body ${quoteArg(args.body)}`,
        { timeoutMs: 60_000 },
      );
      if (pr.exitCode === 0) {
        const prUrl = pr.stdout.trim().split("\n").filter(Boolean).pop() ?? "";
        return { ok: true, message: `PR creado: ${prUrl}`, ...(prUrl ? { prUrl } : {}) };
      }
      return {
        ok: true,
        message:
          `Rama ${iso.branch} subida a origin, pero \`gh pr create\` falló ` +
          `(${(pr.stderr || pr.stdout).trim().slice(0, 150)}). Crea el PR a mano.`,
      };
    }
    return { ok: true, message: `Rama ${iso.branch} subida a origin (sin gh CLI). Crea el PR desde tu forja.` };
  },

  /** Acquire the per-path write lease. Idempotent for the same holder. */
  tryAcquireLease(path: string, taskId: string, targetId?: string): boolean {
    path = executionKey(path.replace(new RegExp("/+$"), "") || "/", targetId);
    const holder = leases.get(path);
    if (holder === undefined) {
      leases.set(path, taskId);
      return true;
    }
    return holder === taskId;
  },

  releaseLease(path: string, taskId: string, targetId?: string): void {
    path = executionKey(path.replace(new RegExp("/+$"), "") || "/", targetId);
    if (leases.get(path) === taskId) leases.delete(path);
  },

  /**
   * Remove worktrees under `<repoRoot>/.lxp/worktrees/` whose task id is NOT
   * in `keepTaskIds` (crashed/pre-restart leftovers). Best-effort.
   */
  async sweepOrphans(executor: Executor, repoRoot: string, keepTaskIds: Set<string>): Promise<void> {
    if(executor.target.id==="local"&&repoRoot===coreRepository())return;
    const ls = await executor
      .exec(`ls -1 ${quoteArg(`${repoRoot}/.lxp/worktrees`)} 2>/dev/null`, { timeoutMs: GIT_TIMEOUT_MS })
      .catch(() => null);
    if (!ls || ls.exitCode !== 0) return;
    for (const name of ls.stdout.split("\n").map((s) => s.trim()).filter(Boolean)) {
      if (keepTaskIds.has(name) || !TASK_ID_RE.test(name)) continue;
      await git(executor, repoRoot, ["worktree", "remove", "--force", worktreePathFor(repoRoot, name)]).catch(
        () => undefined,
      );
    }
    await git(executor, repoRoot, ["worktree", "prune"]).catch(() => undefined);
  },

  /** Test helper — wipe in-process lease/lock state. */
  _resetForTest(): void {
    leases.clear();
    repoLocks.clear();
  },
};
