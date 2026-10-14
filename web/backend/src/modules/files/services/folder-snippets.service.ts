// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Folder → terminal-snippets analyzer.
 *
 * Inspects a directory ON THE CONNECTED SERVER (via the request's Executor) and
 * proposes a set of ready-to-run terminal commands for it: navigation (`cd`)
 * into the folder and its top-level subfolders, git commands when it is a repo,
 * GitHub (`gh`) commands when the remote is GitHub and the CLI is present, and
 * project commands (install/build/run/test) inferred from the toolchain markers
 * found in the folder (package.json + lockfile, Cargo.toml, go.mod, etc.).
 *
 * This service is READ-ONLY: it never mutates the target. The returned plan is
 * shown to the user for review and then registered as terminal snippets via the
 * terminal module's bulk-import endpoint. Every command is paired with a
 * category (the folder name) and tags so the snippets are organized on arrival.
 */

import path from "node:path";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import type { DirEntry } from "../../../shared/executor/types.js";

export interface FolderSnippetSuggestion {
  name: string;
  command: string;
  tags: string[];
}

export interface FolderSnippetPlan {
  /** Normalized folder path that was analyzed. */
  path: string;
  /** Suggested snippet category (the folder's base name, sanitized). */
  category: string;
  isGit: boolean;
  remoteUrl: string | null;
  isGitHub: boolean;
  /** Primary detected toolchain label for display ("node", "python", …) or null. */
  projectType: string | null;
  /** Top-level subfolder names that became `cd` snippets. */
  subfolders: string[];
  snippets: FolderSnippetSuggestion[];
}

/** Subfolders that are noise for a navigation menu — skipped as `cd` targets. */
const IGNORE_DIRS = new Set([
  ".git", "node_modules", ".next", ".nuxt", ".output", "dist", "build", "out",
  ".cache", ".turbo", ".parcel-cache", "vendor", "__pycache__", ".venv", "venv",
  "env", ".idea", ".vscode", "coverage", ".pnpm-store", ".gradle", "target",
  ".terraform", ".svn", ".DS_Store", "bower_components",
]);

const MAX_SUBFOLDERS = 40;
const MAX_SNIPPETS = 120;


/** Strip control chars / collapse whitespace for a clean category name. */
function sanitizeCategory(value: string): string {
  const cleaned = value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned || "Folder").slice(0, 128);
}

interface GitInfo {
  isGit: boolean;
  remoteUrl: string | null;
  branch: string | null;
  hasGh: boolean;
}

const GIT_SEP = "__LXP_SEP__";

/**
 * One round-trip git probe: is-repo / origin url / current branch / gh present.
 * Single-line compound command (no newlines), fail-open to "not a repo".
 */
async function probeGit(root: string, executor: Executor): Promise<GitInfo> {
  const fallback: GitInfo = { isGit: false, remoteUrl: null, branch: null, hasGh: false };
  try {
    const q = quoteArg(root);
    const cmd =
      `git -C ${q} rev-parse --is-inside-work-tree 2>/dev/null; echo ${GIT_SEP}; ` +
      `git -C ${q} remote get-url origin 2>/dev/null; echo ${GIT_SEP}; ` +
      `git -C ${q} rev-parse --abbrev-ref HEAD 2>/dev/null; echo ${GIT_SEP}; ` +
      `command -v gh >/dev/null 2>&1 && echo gh || true`;
    const { stdout } = await executor.exec(cmd, { timeoutMs: 8000 });
    const parts = stdout.split(GIT_SEP);
    const isGit = (parts[0] ?? "").trim() === "true";
    const remoteUrl = (parts[1] ?? "").trim() || null;
    const branch = (parts[2] ?? "").trim() || null;
    const hasGh = (parts[3] ?? "").includes("gh");
    return { isGit, remoteUrl, branch, hasGh };
  } catch {
    return fallback;
  }
}

/** Read + parse package.json scripts (best-effort). */
async function readPackageScripts(
  root: string,
  executor: Executor,
): Promise<{ scripts: string[]; name: string | null } | null> {
  try {
    const raw = await executor.readFile(path.posix.join(root, "package.json"), "utf8");
    const text = typeof raw === "string" ? raw : raw.toString("utf8");
    const pkg = JSON.parse(text) as { scripts?: Record<string, unknown>; name?: unknown };
    const scripts = pkg.scripts && typeof pkg.scripts === "object"
      ? Object.keys(pkg.scripts).filter((s) => typeof s === "string" && s.trim().length > 0)
      : [];
    const name = typeof pkg.name === "string" ? pkg.name : null;
    return { scripts, name };
  } catch {
    return null;
  }
}

/** Map a Node lockfile present in the folder to its package manager. */
function detectPackageManager(names: Set<string>): "pnpm" | "yarn" | "bun" | "npm" {
  if (names.has("pnpm-lock.yaml")) return "pnpm";
  if (names.has("yarn.lock")) return "yarn";
  if (names.has("bun.lockb")) return "bun";
  return "npm";
}

/** Tag a Node script by intent so the imported snippets sort sensibly. */
function nodeScriptTags(script: string): string[] {
  const s = script.toLowerCase();
  if (/(^|[:_-])(dev|start|serve|preview|watch)([:_-]|$)/.test(s)) return ["node", "run"];
  if (/(^|[:_-])build([:_-]|$)/.test(s)) return ["node", "build"];
  if (/(^|[:_-])(test|e2e|spec)([:_-]|$)/.test(s)) return ["node", "test"];
  if (/(^|[:_-])(lint|typecheck|format|check)([:_-]|$)/.test(s)) return ["node", "check"];
  return ["node"];
}

export async function suggestFolderSnippets(
  folderPath: string,
  executor: Executor,
): Promise<FolderSnippetPlan> {
  const root = (folderPath.replace(/\/+$/, "") || "/");
  const base = path.posix.basename(root) || root;
  const category = sanitizeCategory(base);

  // 1) Immediate entries (one SFTP readdir), fail-open to empty.
  let entries: DirEntry[] = [];
  try {
    entries = await executor.readdir(root);
  } catch {
    entries = [];
  }
  const names = new Set(entries.map((e) => e.name));
  const subfolders = entries
    .filter((e) => e.isDir && !e.name.startsWith(".") && !IGNORE_DIRS.has(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, MAX_SUBFOLDERS);

  // 2) Git / remote / gh probe (one exec), and package.json read in parallel.
  const [git, pkg] = await Promise.all([
    probeGit(root, executor),
    names.has("package.json") ? readPackageScripts(root, executor) : Promise.resolve(null),
  ]);
  const isGitHub = !!git.remoteUrl && /(^|@|\/\/)github\.com[/:]/i.test(git.remoteUrl);

  const snippets: FolderSnippetSuggestion[] = [];
  const seen = new Set<string>();
  const add = (name: string, command: string, tags: string[]) => {
    if (snippets.length >= MAX_SNIPPETS) return;
    if (seen.has(name)) return;
    seen.add(name);
    snippets.push({ name, command, tags });
  };

  // ── Navigation: root + each top-level subfolder ──────────────
  add(`cd → ${base}`, `cd ${quoteArg(root)}`, ["navigate"]);
  for (const sub of subfolders) {
    add(`cd → ${base}/${sub}`, `cd ${quoteArg(path.posix.join(root, sub))}`, ["navigate"]);
  }

  // ── Inspect (read-only) ──────────────────────────────────────
  add(`List ${base}`, `ls -lah ${quoteArg(root)}`, ["inspect"]);
  add(`Disk usage of ${base}`, `du -sh ${quoteArg(root)}`, ["inspect"]);
  add(`Top-level sizes of ${base}`, `du -sh ${quoteArg(root)}/* 2>/dev/null`, ["inspect"]);

  // ── Git ──────────────────────────────────────────────────────
  if (git.isGit) {
    const q = quoteArg(root);
    add(`Git status (${base})`, `git -C ${q} status`, ["git"]);
    add(`Git fetch (${base})`, `git -C ${q} fetch --all --prune`, ["git"]);
    add(`Git pull (${base})`, `git -C ${q} pull`, ["git"]);
    add(`Git push (${base})`, `git -C ${q} push`, ["git"]);
    add(`Git log (${base})`, `git -C ${q} log --oneline --graph --decorate -20`, ["git"]);
    add(`Git branches (${base})`, `git -C ${q} branch -avv`, ["git"]);
    add(`Git remotes (${base})`, `git -C ${q} remote -v`, ["git"]);
    add(`Git diff (${base})`, `git -C ${q} diff`, ["git"]);
  }

  // ── GitHub (only when remote is GitHub AND the gh CLI exists) ──
  if (isGitHub && git.hasGh) {
    const cdq = `cd ${quoteArg(root)} && `;
    add(`GitHub repo view (${base})`, `${cdq}gh repo view`, ["github"]);
    add(`GitHub open in browser (${base})`, `${cdq}gh repo view --web`, ["github"]);
    add(`GitHub PR list (${base})`, `${cdq}gh pr list`, ["github"]);
    add(`GitHub PR status (${base})`, `${cdq}gh pr status`, ["github"]);
    add(`GitHub Actions runs (${base})`, `${cdq}gh run list`, ["github"]);
  }

  // ── Project toolchains ───────────────────────────────────────
  let projectType: string | null = null;
  const cdq = `cd ${quoteArg(root)} && `;

  if (pkg) {
    projectType = "node";
    const pm = detectPackageManager(names);
    add(`Install deps (${base})`, `${cdq}${pm} install`, ["node"]);
    for (const script of pkg.scripts.slice(0, 40)) {
      const label = script.charAt(0).toUpperCase() + script.slice(1);
      add(`${label} (${base})`, `${cdq}${pm} run ${script}`, nodeScriptTags(script));
    }
  }

  if (names.has("requirements.txt") || names.has("pyproject.toml") || names.has("manage.py")) {
    projectType ??= "python";
    if (names.has("requirements.txt")) {
      add(`Pip install (${base})`, `${cdq}pip install -r requirements.txt`, ["python"]);
    }
    if (names.has("pyproject.toml")) {
      add(`Pip install editable (${base})`, `${cdq}pip install -e .`, ["python"]);
    }
    if (names.has("manage.py")) {
      add(`Django runserver (${base})`, `${cdq}python3 manage.py runserver`, ["python", "run"]);
      add(`Django migrate (${base})`, `${cdq}python3 manage.py migrate`, ["python"]);
    }
  }

  if (names.has("composer.json")) {
    projectType ??= "php";
    add(`Composer install (${base})`, `${cdq}composer install`, ["php"]);
    add(`Composer update (${base})`, `${cdq}composer update`, ["php"]);
  }

  if (names.has("Cargo.toml")) {
    projectType ??= "rust";
    add(`Cargo build (${base})`, `${cdq}cargo build`, ["rust", "build"]);
    add(`Cargo run (${base})`, `${cdq}cargo run`, ["rust", "run"]);
    add(`Cargo test (${base})`, `${cdq}cargo test`, ["rust", "test"]);
  }

  if (names.has("go.mod")) {
    projectType ??= "go";
    add(`Go build (${base})`, `${cdq}go build ./...`, ["go", "build"]);
    add(`Go run (${base})`, `${cdq}go run .`, ["go", "run"]);
    add(`Go test (${base})`, `${cdq}go test ./...`, ["go", "test"]);
  }

  if (names.has("Makefile") || names.has("makefile")) {
    projectType ??= projectType ?? "make";
    add(`Make (${base})`, `${cdq}make`, ["make"]);
  }

  if (
    names.has("docker-compose.yml") || names.has("docker-compose.yaml") ||
    names.has("compose.yml") || names.has("compose.yaml") || names.has("Dockerfile")
  ) {
    projectType ??= "docker";
    if (names.has("Dockerfile") &&
        !(names.has("docker-compose.yml") || names.has("docker-compose.yaml") ||
          names.has("compose.yml") || names.has("compose.yaml"))) {
      add(`Docker build (${base})`, `${cdq}docker build -t ${base.toLowerCase()} .`, ["docker", "build"]);
    } else {
      add(`Docker compose up (${base})`, `${cdq}docker compose up -d`, ["docker", "run"]);
      add(`Docker compose logs (${base})`, `${cdq}docker compose logs -f --tail=100`, ["docker"]);
      add(`Docker compose down (${base})`, `${cdq}docker compose down`, ["docker"]);
      add(`Docker compose ps (${base})`, `${cdq}docker compose ps`, ["docker"]);
    }
  }

  return {
    path: root,
    category,
    isGit: git.isGit,
    remoteUrl: git.remoteUrl,
    isGitHub,
    projectType,
    subfolders,
    snippets,
  };
}
