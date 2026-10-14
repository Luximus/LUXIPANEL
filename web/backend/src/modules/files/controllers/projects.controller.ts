// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Projects controller — scan and list Git projects per active target.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { CODE_SCAN_ROOTS } from "../../../shared/constants.js";
import { getExecutor, quoteArg, type Executor } from "../../../shared/executor/index.js";
import { ALLOWED_BASES, safePath } from "../services/filesystem.service.js";
import { canAccessPath } from "../../../shared/auth/role-permissions.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { apiErrorMessage } from "../../../shared/i18n/errors.js";

const log = createModuleLogger("projects");

interface Project {
  path: string;
  name: string;
  url?: string;
  branch?: string;
  lastCommit?: string;
  /** First meaningful paragraph of the project's README, if any. */
  description?: string;
}

const README_NAMES = ["README.md", "readme.md", "README.MD", "Readme.md", "README", "readme"];
const README_MAX_BYTES = 4000;
const DESCRIPTION_MAX_CHARS = 200;

/** Pull a short, plain-text description out of raw README markdown:
 *  skip headings/badges/images/HTML, take the first real prose line(s). */
function readmeToDescription(raw: string): string {
  if (!raw) return "";
  const lines = raw.replace(/\r/g, "").split("\n");
  const parts: string[] = [];
  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) { if (parts.length) break; else continue; }
    if (line.startsWith("#")) continue;                 // headings
    if (/^!\[/.test(line) || /^\[!\[/.test(line)) continue; // images / badge links
    if (/^<.*>$/.test(line)) continue;                  // standalone HTML tags
    if (/^[-=]{3,}$/.test(line)) continue;              // setext underlines / rules
    if (/^(>|\||```)/.test(line)) continue;             // quotes / tables / code fences
    parts.push(line);
    if (parts.join(" ").length >= DESCRIPTION_MAX_CHARS) break;
  }
  // Strip basic markdown emphasis/link syntax.
  let text = parts.join(" ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [text](url) → text
    .replace(/[*_`]+/g, "")
    .trim();
  if (text.length > DESCRIPTION_MAX_CHARS) text = text.slice(0, DESCRIPTION_MAX_CHARS).trimEnd() + "…";
  return text;
}

const MAX_SCAN_DEPTH = 4;
/** Hard cap on repos processed per scan: with `ALLOWED_BASES=["/"]` a `find /`
 *  can surface dozens of `.git` dirs, each costing SSH round-trips. */
const MAX_PROJECTS = 200;

function normalizeScanRoots(): string[] {
  const candidates = new Set<string>(CODE_SCAN_ROOTS);
  for (const base of ALLOWED_BASES) candidates.add(base);
  // Scan /var/www first when present, then the rest in insertion order.
  const rest = [...candidates].filter((root) => root !== "/var/www");
  return candidates.has("/var/www") ? ["/var/www", ...rest] : rest;
}

function safePushProject(map: Map<string, Project>, candidate: Project) {
  // A directory with a .git is a project even without a remote origin —
  // don't filter those out (was the cause of "no projects found").
  if (!map.has(candidate.path)) map.set(candidate.path, candidate);
}

function gitField(projectPath: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: projectPath, timeout: 5000, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function getGitInfoLocal(projectPath: string): Partial<Project> {
  // Each field is independent: a missing remote must not drop branch/commit.
  return {
    url: gitField(projectPath, ["config", "--get", "remote.origin.url"]),
    branch: gitField(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"]),
    lastCommit: gitField(projectPath, ["log", "-1", "--format=%ai"]),
  };
}

function getReadmeLocal(projectPath: string): string {
  for (const name of README_NAMES) {
    try {
      const fp = path.join(projectPath, name);
      if (fs.existsSync(fp)) {
        const raw = fs.readFileSync(fp, { encoding: "utf-8" }).slice(0, README_MAX_BYTES);
        return readmeToDescription(raw);
      }
    } catch { /* try next */ }
  }
  return "";
}

function scanLocalDir(dir: string, depth: number, projects: Map<string, Project>): void {
  if (depth > MAX_SCAN_DEPTH) return;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const fullPath = path.resolve(dir, entry.name);
    if (fs.existsSync(path.join(fullPath, ".git"))) {
      const gitInfo = getGitInfoLocal(fullPath);
      const description = getReadmeLocal(fullPath);
      safePushProject(projects, { path: fullPath, name: entry.name, ...gitInfo, description });
      continue;
    }
    scanLocalDir(fullPath, depth + 1, projects);
  }
}

function parseFindProjectsOutput(stdout: string): string[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.endsWith("/.git"))
    .map((line) => line.replace(/\/\.git$/, ""));
}

const README_SENTINEL = "__LXP_README__";

/**
 * Fetch git metadata AND the README description for one repo in a SINGLE remote
 * exec (was two sequential SSH round-trips per repo → hundreds per scan). The
 * git fields are prefixed lines; the README follows the sentinel so its content
 * can't be mistaken for a field.
 */
async function getProjectMetaRemote(executor: Executor, projectPath: string): Promise<Partial<Project>> {
  try {
    // `-c safe.directory='*'`: git runs as the SSH user, not the repo owner —
    // without it /var/www/* repos trip the "dubious ownership" guard. See
    // git.service.ts.
    const g = "git -c safe.directory='*'";
    const names = README_NAMES.map((n) => quoteArg(`${projectPath}/${n}`)).join(" ");
    const cmd = [
      `cd ${quoteArg(projectPath)}`,
      `echo "URL=$(${g} config --get remote.origin.url 2>/dev/null)"`,
      `echo "BR=$(${g} rev-parse --abbrev-ref HEAD 2>/dev/null)"`,
      `echo "CM=$(${g} log -1 --format=%ai 2>/dev/null)"`,
      `echo ${README_SENTINEL}`,
      `for f in ${names}; do if [ -f "$f" ]; then head -c ${README_MAX_BYTES} "$f"; break; fi; done`,
    ].join(" && ");
    const out = await executor.exec(cmd, { timeoutMs: 8_000 });
    const sentinelIdx = out.stdout.indexOf(`${README_SENTINEL}\n`);
    const head = sentinelIdx >= 0 ? out.stdout.slice(0, sentinelIdx) : out.stdout;
    const readme = sentinelIdx >= 0 ? out.stdout.slice(sentinelIdx + README_SENTINEL.length + 1) : "";
    const get = (prefix: string) => {
      const line = head.split("\n").find((l) => l.startsWith(prefix));
      return line ? line.slice(prefix.length).trim() : "";
    };
    return { url: get("URL="), branch: get("BR="), lastCommit: get("CM="), description: readmeToDescription(readme) };
  } catch {
    return {};
  }
}

async function scanRemote(executor: Executor, roots: string[], projects: Map<string, Project>): Promise<void> {
  for (const root of roots) {
    if (projects.size >= MAX_PROJECTS) break;
    try {
      const safeRoot = safePath(root);
      const findCmd = `find ${quoteArg(safeRoot)} -maxdepth ${MAX_SCAN_DEPTH} -type d -name .git 2>/dev/null`;
      const out = await executor.exec(findCmd);
      const paths = parseFindProjectsOutput(out.stdout);
      for (const projectPath of paths) {
        if (projects.size >= MAX_PROJECTS) break;
        if (projects.has(projectPath)) continue;
        const name = path.basename(projectPath);
        const meta = await getProjectMetaRemote(executor, projectPath);
        safePushProject(projects, { path: projectPath, name, ...meta });
      }
    } catch {
      // skip inaccessible roots silently
    }
  }
}

async function discoverProjects(req: Request, user: SessionUser | undefined): Promise<Project[]> {
  const executor = getExecutor(req);
  // Only scan roots the caller is allowed to read (the route middleware can't
  // enforce this — the roots come from CODE_SCAN_ROOTS/ALLOWED_BASES, not the
  // request body). Without an authenticated user, fail closed (no roots).
  const roots = normalizeScanRoots().filter((root) => !!user && canAccessPath(user, root, "read"));
  const projects = new Map<string, Project>();

  if (executor.target.id === "local") {
    for (const root of roots) {
      if (projects.size >= MAX_PROJECTS) break;
      try {
        const safeRoot = safePath(root);
        scanLocalDir(safeRoot, 0, projects);
      } catch {
        // skip inaccessible roots silently
      }
    }
  } else {
    await scanRemote(executor, roots, projects);
  }

  // Final per-repo filter: a scan root may be readable while a specific repo
  // under it is not (nested policy), and the local walk can descend past the
  // root granularity.
  return Array.from(projects.values())
    .filter((p) => !!user && canAccessPath(user, p.path, "read"))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export const projectsController = {
  /** POST /api/files/scan-projects — scan target server for git projects. */
  scan: asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = await discoverProjects(req, res.locals.user as SessionUser | undefined);
      log.info({ count: data.length, target: getExecutor(req).target.id }, "Project scan complete");
      res.json({ ok: true, data, count: data.length });
    } catch (err) {
      log.error({ err }, "Project scan failed");
      res.status(500).json({ ok: false, error: apiErrorMessage(res.locals.locale, "internal") });
    }
  }),

  /** GET /api/files/projects — list projects for the active target. */
  list: asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = await discoverProjects(req, res.locals.user as SessionUser | undefined);
      res.json({ ok: true, data, count: data.length });
    } catch {
      res.json({ ok: true, data: [], count: 0 });
    }
  }),
};
