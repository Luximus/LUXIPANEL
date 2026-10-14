// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Native Git integration — phase 1 (#14): local work-tree operations only.
 *
 * status / branches / commit / discard / switch-branch / create-branch. These
 * never touch the network or credentials (pull/push/clone come in a later
 * phase). All commands run `git -C <repo>` through the request executor.
 *
 * Git itself is the safety net here (HEAD/reflog), so these ops don't snapshot;
 * destructive ones (discard) are confirmed in the UI.
 */

import { randomUUID } from "node:crypto";
import { quoteCmd, quoteArg, type Executor } from "../../../shared/executor/index.js";
import { gitCmd } from "../../../shared/system/git-cmd.js";
import { GIT_TIMEOUT_MS } from "../../../shared/constants.js";
import { dirOf } from "../../../shared/utils/posix-path.js";
import { gitCredentialsService, hostFromRemote, type GitCredential } from "./git-credentials.service.js";
import { safePath } from "./filesystem.service.js";
import { invalidateDir } from "../../../shared/files-cache/index.js";

const BRANCH_RE = /^[A-Za-z0-9._/-]+$/;

export interface GitFileChange {
  path: string;
  /** Index (staged) status char. */
  x: string;
  /** Work-tree (unstaged) status char. */
  y: string;
  staged: boolean;
  untracked: boolean;
}

export interface GitStatus {
  isRepo: boolean;
  root: string | null;
  branch: string | null;
  head: string | null;
  ahead: number;
  behind: number;
  files: GitFileChange[];
  branches: string[];
}

export interface GitAuthor {
  name: string;
  email: string;
}


/**
 * Resolve the git work-tree root containing `dir`, RE-SANDBOXED.
 *
 * Exported because `file-history.service` needs exactly this and used to carry
 * a copy that skipped the `safePath(top)` step (B-13).
 */
export async function gitRoot(executor: Executor, dir: string): Promise<string | null> {
  try {
    const out = await executor.exec(gitCmd(["-C", dir, "rev-parse", "--show-toplevel"]), { timeoutMs: 8_000 });
    const top = out.stdout.trim();
    if (out.exitCode !== 0 || !top) return null;
    // Sandbox re-check: `dir` was validated, but the resolved toplevel can sit
    // ABOVE it (a repo rooted outside ALLOWED_BASES that contains an allowed
    // subdir). Every later git op runs `-C <root>`, so an out-of-sandbox root
    // would let commit/discard/clean/pull touch files outside the sandbox.
    try {
      return safePath(top);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/** Resolve the repo root for an arbitrary path (file or dir) inside the tree. */
async function resolveRoot(executor: Executor, target: string): Promise<string | null> {
  const safe = safePath(target);
  // If it's a file, look from its directory; a dir works directly.
  return (await gitRoot(executor, safe)) ?? (await gitRoot(executor, dirOf(safe)));
}

function parseBranchLine(line: string): { branch: string | null; ahead: number; behind: number } {
  // "## main...origin/main [ahead 1, behind 2]" or "## main" or "## HEAD (no branch)"
  const m = line.match(/^##\s+(.+?)(?:\.\.\.| \[|$)/);
  const branch = m ? m[1]! : null;
  const ahead = Number(line.match(/ahead (\d+)/)?.[1] ?? 0);
  const behind = Number(line.match(/behind (\d+)/)?.[1] ?? 0);
  return { branch, ahead, behind };
}

async function run(executor: Executor, root: string, args: string[]): Promise<{ ok: boolean; message: string }> {
  const out = await executor.exec(gitCmd(["-C", root, ...args]), { timeoutMs: GIT_TIMEOUT_MS });
  const message = (out.stderr || out.stdout || "").trim();
  return { ok: out.exitCode === 0, message };
}

const NETWORK_TIMEOUT_MS = 120_000;

/**
 * Run a git command that may need credentials. The secret is staged in an
 * ephemeral 0600 helper file on the target (NEVER argv) and fed to git via
 * GIT_ASKPASS (https) or GIT_SSH_COMMAND (ssh); the files are removed after.
 */
async function runWithCreds(
  executor: Executor,
  gitArgs: string[],
  cred: { cred: GitCredential; secret: string } | null,
): Promise<{ ok: boolean; message: string }> {
  const id = randomUUID();
  const cleanup: string[] = [];
  let envPrefix = "GIT_TERMINAL_PROMPT=0 ";
  try {
    if (cred?.cred.type === "https") {
      const askpath = `/tmp/lxp-gitaskpass-${id}`;
      const tokpath = `${askpath}.tok`;
      const username = cred.cred.username || "x-access-token";
      // GIT_ASKPASS gets the prompt text as $1: Username* → user, else → token file.
      const script = `#!/bin/sh\ncase "$1" in\n  Username*) printf '%s' ${quoteArg(username)} ;;\n  *) cat ${quoteArg(tokpath)} ;;\nesac\n`;
      // Atomic modes at creation (no write-then-chmod window where the umask
      // leaves the files world-readable). The askpass helper must be
      // executable → 0700; the token file holds the secret → 0600.
      await executor.writeFile(askpath, script, { mode: 0o700 });
      await executor.writeFile(tokpath, cred.secret, { mode: 0o600 });
      cleanup.push(askpath, tokpath);
      envPrefix += `GIT_ASKPASS=${quoteArg(askpath)} `;
    } else if (cred?.cred.type === "ssh") {
      const keypath = `/tmp/lxp-gitkey-${id}`;
      const keyData = cred.secret.endsWith("\n") ? cred.secret : `${cred.secret}\n`;
      // 0600 at creation — ssh refuses group/world-readable keys anyway.
      await executor.writeFile(keypath, keyData, { mode: 0o600 });
      cleanup.push(keypath);
      envPrefix += `GIT_SSH_COMMAND=${quoteArg(`ssh -i ${keypath} -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes`)} `;
    }
    const cmd = `${envPrefix}${gitCmd(gitArgs)}`;
    const out = await executor.exec(cmd, { timeoutMs: NETWORK_TIMEOUT_MS });
    return { ok: out.exitCode === 0, message: (out.stderr || out.stdout || "").trim() };
  } finally {
    if (cleanup.length > 0) {
      try { await executor.exec(quoteCmd("rm", ["-f", ...cleanup])); } catch { /* best effort */ }
    }
  }
}

export const gitService = {
  /** Cheap check: is `target` (or an ancestor) inside a git work-tree? One
   *  `rev-parse --show-toplevel`. Used to enable/disable the Git toolbar button
   *  on navigation without paying for a full status. Fail-open → not a repo. */
  async inRepo(executor: Executor, target: string): Promise<{ inRepo: boolean; root: string | null }> {
    const root = await resolveRoot(executor, target);
    return { inRepo: !!root, root };
  },

  async status(executor: Executor, target: string): Promise<GitStatus> {
    const root = await resolveRoot(executor, target);
    if (!root) {
      return { isRepo: false, root: null, branch: null, head: null, ahead: 0, behind: 0, files: [], branches: [] };
    }
    const [statusOut, headOut, branchesOut] = await Promise.all([
      executor.exec(gitCmd(["-C", root, "status", "--porcelain=v1", "-b"]), { timeoutMs: GIT_TIMEOUT_MS }),
      executor.exec(gitCmd(["-C", root, "rev-parse", "HEAD"]), { timeoutMs: 8_000 }).catch(() => null),
      executor.exec(gitCmd(["-C", root, "branch", "--format=%(refname:short)"]), { timeoutMs: 8_000 }).catch(() => null),
    ]);

    let branch: string | null = null;
    let ahead = 0;
    let behind = 0;
    const files: GitFileChange[] = [];
    for (const line of statusOut.stdout.split("\n")) {
      if (!line) continue;
      if (line.startsWith("##")) {
        const parsed = parseBranchLine(line);
        branch = parsed.branch;
        ahead = parsed.ahead;
        behind = parsed.behind;
        continue;
      }
      const x = line[0] ?? " ";
      const y = line[1] ?? " ";
      let p = line.slice(3);
      // Renames look like "old -> new"; keep the new path.
      const arrow = p.indexOf(" -> ");
      if (arrow >= 0) p = p.slice(arrow + 4);
      files.push({ path: p, x, y, staged: x !== " " && x !== "?", untracked: x === "?" });
    }

    const head = headOut && headOut.exitCode === 0 ? headOut.stdout.trim() : null;
    const branches = branchesOut && branchesOut.exitCode === 0
      ? branchesOut.stdout.split("\n").map((b) => b.trim()).filter(Boolean)
      : [];

    return { isRepo: true, root, branch, head, ahead, behind, files, branches };
  },

  async commit(executor: Executor, target: string, message: string, all: boolean, author: GitAuthor): Promise<{ ok: boolean; message: string }> {
    const root = await resolveRoot(executor, target);
    if (!root) return { ok: false, message: "No es un repositorio Git" };
    if (!message.trim()) return { ok: false, message: "El mensaje del commit es obligatorio" };
    if (all) {
      const add = await run(executor, root, ["add", "-A"]);
      if (!add.ok) return add;
    }
    const out = await executor.exec(
      gitCmd([
        "-C", root,
        "-c", `user.name=${author.name}`,
        "-c", `user.email=${author.email}`,
        "commit", "-m", message,
      ]),
      { timeoutMs: GIT_TIMEOUT_MS },
    );
    return { ok: out.exitCode === 0, message: (out.stdout || out.stderr || "").trim() };
  },

  /** Discard work-tree changes (checkout). Optionally remove untracked files. */
  async discard(executor: Executor, target: string, paths: string[] | undefined, clean: boolean): Promise<{ ok: boolean; message: string }> {
    const root = await resolveRoot(executor, target);
    if (!root) return { ok: false, message: "No es un repositorio Git" };
    const co = paths && paths.length > 0
      ? await run(executor, root, ["checkout", "--", ...paths])
      : await run(executor, root, ["checkout", "--", "."]);
    if (!co.ok) return co;
    if (clean) return run(executor, root, ["clean", "-fd"]);
    return co;
  },

  async switchBranch(executor: Executor, target: string, branch: string): Promise<{ ok: boolean; message: string }> {
    if (!BRANCH_RE.test(branch)) return { ok: false, message: "Nombre de rama inválido" };
    const root = await resolveRoot(executor, target);
    if (!root) return { ok: false, message: "No es un repositorio Git" };
    return run(executor, root, ["checkout", branch]);
  },

  async createBranch(executor: Executor, target: string, branch: string): Promise<{ ok: boolean; message: string }> {
    if (!BRANCH_RE.test(branch)) return { ok: false, message: "Nombre de rama inválido" };
    const root = await resolveRoot(executor, target);
    if (!root) return { ok: false, message: "No es un repositorio Git" };
    return run(executor, root, ["checkout", "-b", branch]);
  },

  /** Origin remote URL + host (null when there's no origin). */
  async remote(executor: Executor, target: string): Promise<{ url: string; host: string | null } | null> {
    const root = await resolveRoot(executor, target);
    if (!root) return null;
    const out = await run(executor, root, ["remote", "get-url", "origin"]);
    if (!out.ok || !out.message) return null;
    const url = out.message.trim();
    return { url, host: hostFromRemote(url) };
  },

  /** Pull (fast-forward only) using a matching credential when present. */
  async pull(executor: Executor, target: string, credentialId?: string): Promise<{ ok: boolean; message: string }> {
    const root = await resolveRoot(executor, target);
    if (!root) return { ok: false, message: "No es un repositorio Git" };
    const rem = await this.remote(executor, target);
    const cred = rem && gitCredentialsService.enabled()
      ? await gitCredentialsService.resolveForRemote(executor, rem.url, credentialId).catch(() => null)
      : null;
    return runWithCreds(executor, ["-C", root, "pull", "--ff-only"], cred);
  },

  /** Refresh the current branch only, then compare actual commits. No checkout
   * or work-tree change is performed; callers must authorize the repo root. */
  async checkRemote(executor: Executor, target: string, credentialId?: string): Promise<{ ok: boolean; message: string; ahead: number; behind: number; dirty: boolean; branch: string | null }> {
    const status = await this.status(executor, target);
    const branch = status.branch;
    if (!status.root || !branch || branch === "HEAD") return { ok: false, message: "No hay rama activa", ahead: 0, behind: 0, dirty: false, branch: null };
    const root = status.root;
    const upstream = await executor.exec(gitCmd(["-C", root, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]), { timeoutMs: 8_000 });
    if (upstream.exitCode !== 0 || upstream.stdout.trim() !== `origin/${branch}`) {
      return { ok: false, message: "La rama actual no sigue origin/" + branch, ahead: 0, behind: 0, dirty: status.files.length > 0, branch };
    }
    const remote = await this.remote(executor, root);
    const cred = remote && gitCredentialsService.enabled()
      ? await gitCredentialsService.resolveForRemote(executor, remote.url, credentialId).catch(() => null)
      : null;
    const fetched = await runWithCreds(executor, ["-C", root, "fetch", "--no-tags", "origin", branch], cred);
    if (!fetched.ok) return { ok: false, message: fetched.message || "No se pudo consultar origin", ahead: 0, behind: 0, dirty: status.files.length > 0, branch };
    const counts = await executor.exec(gitCmd(["-C", root, "rev-list", "--left-right", "--count", "HEAD...FETCH_HEAD"]), { timeoutMs: 8_000 });
    const match = counts.stdout.trim().match(/^(\d+)\s+(\d+)$/);
    if (counts.exitCode !== 0 || !match) return { ok: false, message: "No se pudo comparar HEAD con origin", ahead: 0, behind: 0, dirty: status.files.length > 0, branch };
    return { ok: true, message: "", ahead: Number(match[1]), behind: Number(match[2]), dirty: status.files.length > 0, branch };
  },

  /** Push the current branch using a matching credential when present. */
  async push(executor: Executor, target: string, credentialId?: string): Promise<{ ok: boolean; message: string }> {
    const root = await resolveRoot(executor, target);
    if (!root) return { ok: false, message: "No es un repositorio Git" };
    const rem = await this.remote(executor, target);
    const cred = rem && gitCredentialsService.enabled()
      ? await gitCredentialsService.resolveForRemote(executor, rem.url, credentialId).catch(() => null)
      : null;
    return runWithCreds(executor, ["-C", root, "push"], cred);
  },

  /**
   * Clone a repository into `dest` (which must not exist yet). Resolves a
   * credential by the URL's host. Validates url/dest to block arg injection.
   */
  async clone(executor: Executor, url: string, dest: string, branch?: string, credentialId?: string): Promise<{ ok: boolean; message: string; dest?: string }> {
    const u = url.trim();
    if (u.startsWith("-")) return { ok: false, message: "URL inválida" };
    if (!/^(https?:\/\/|ssh:\/\/|[^@\s]+@[^:\s]+:)/i.test(u)) {
      return { ok: false, message: "URL de repositorio no válida (usa https://, ssh:// o git@host:…)" };
    }
    if (branch && !BRANCH_RE.test(branch)) return { ok: false, message: "Nombre de rama inválido" };
    let safeDest: string;
    try {
      safeDest = safePath(dest);
    } catch {
      return { ok: false, message: "Destino fuera de las rutas permitidas" };
    }
    if (safeDest.includes("/-")) return { ok: false, message: "Destino inválido" };

    const cred = gitCredentialsService.enabled()
      ? await gitCredentialsService.resolveForRemote(executor, u, credentialId).catch(() => null)
      : null;
    const args = ["clone"];
    if (branch) args.push("--branch", branch);
    args.push("--", u, safeDest);
    const res = await runWithCreds(executor, args, cred);
    if (res.ok) void invalidateDir(executor, safeDest);
    return { ...res, dest: res.ok ? safeDest : undefined };
  },

  /** Deploy from a branch: switch to it, then fast-forward pull. */
  async deploy(executor: Executor, target: string, branch: string, credentialId?: string): Promise<{ ok: boolean; message: string }> {
    if (!BRANCH_RE.test(branch)) return { ok: false, message: "Nombre de rama inválido" };
    const root = await resolveRoot(executor, target);
    if (!root) return { ok: false, message: "No es un repositorio Git" };
    const co = await run(executor, root, ["checkout", branch]);
    if (!co.ok) return co;
    const pull = await this.pull(executor, target, credentialId);
    return { ok: pull.ok, message: `${co.message}\n${pull.message}`.trim() };
  },
};

export type { GitStatus as GitStatusResult };
export const _internal = { parseBranchLine, dirOf };
