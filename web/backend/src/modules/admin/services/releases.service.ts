// SPDX-License-Identifier: AGPL-3.0-only
// Release management is scoped to the selected local installation.
import { repositoryRoot, applicationRoot } from "../../../shared/installation-layout.js";
import path from "node:path";
import { readFileSync } from "node:fs";
import { releaseBranches, releaseBranchDetails, verifyBranchRevision } from "./release-branches.service.js";
import { compareVersions } from "../../../shared/releases/version.js";
import { APP_VERSION } from "../../../config/version.js";
import { env } from "../../../config/env.js";
import { localExecutor as installationExecutor, quoteArg, type Executor } from "../../../shared/executor/index.js";
import type { Request } from "express";
import { AppError, ValidationError } from "../../../shared/errors/index.js";
import { sanitizePublicText } from "../../../shared/diagnostics/sanitize.js";

export interface GithubRelease {
  tag: string;
  name: string;
  notes: string;
  publishedAt: string | null;
}

// Read from the running artifact once; a later Git push/checkout is not a deployment.
const runningCommit = (() => {
  try {
    const info = JSON.parse(readFileSync(new URL("../../../build-info.json", import.meta.url), "utf8")) as { commit?: string };
    return info.commit && /^[a-f0-9]{40}$/.test(info.commit) ? info.commit : undefined;
  } catch { return undefined; }
})();
const TAG = /^v?[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
const GITHUB_API = "https://api.github.com/repos/Luxisoft/LUXIPANEL/releases?per_page=100";

export function installationRoot(): string {
  const configured = env.LUXIPANEL_INSTALL_ROOT;
  if (configured) return path.resolve(configured);
  const cwd = process.cwd();
  const marker = `${path.sep}.releases${path.sep}`;
  const index = cwd.indexOf(marker);
  return index >= 0 ? cwd.slice(0, index) : repositoryRoot(path.resolve(cwd, ".."));
}

async function readState(executor: Executor, root: string): Promise<Record<string, unknown>> {
  try {
    const raw = await executor.readFile(path.join(root, ".releases", "state.json"), "utf8");
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}

type Catalog = { releases: GithubRelease[]; error?: string };
let cachedCatalog: { until: number; value: Catalog } | null = null;
let catalogRequest: Promise<Catalog> | null = null;

async function fetchGithubReleases(): Promise<Catalog> {
  try {
    const token = env.LUXIPANEL_GITHUB_TOKEN;
    const response = await fetch(GITHUB_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "LUXIPANEL-release-manager", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { releases: [], error: response.status === 404 ? "GitHub no muestra Releases; si el repositorio es privado, configura LUXIPANEL_GITHUB_TOKEN." : `GitHub respondió ${response.status}.` };
    const rows = await response.json() as Array<{ tag_name?: string; name?: string; body?: string; published_at?: string; draft?: boolean; prerelease?: boolean }>;
    return { releases: rows.filter(row => !row.draft && !row.prerelease && /^v?\d+\.\d+\.\d+$/.test(row.tag_name ?? ""))
      .map(row => ({ tag: row.tag_name!, name: row.name || row.tag_name!, notes: (row.body || "").slice(0, 12000), publishedAt: row.published_at ?? null })).sort((a, b) => compareVersions(b.tag, a.tag)) };
  } catch { return { releases: [], error: "No se pudo consultar GitHub." }; }
}

async function githubReleases(): Promise<Catalog> {
  if (cachedCatalog && cachedCatalog.until > Date.now()) return cachedCatalog.value;
  catalogRequest ??= fetchGithubReleases().then(value => {
    cachedCatalog = { until: Date.now() + 300000, value };
    return value;
  }).finally(() => { catalogRequest = null; });
  return catalogRequest;
}

export const releasesService = {
  async publishedRelease(tag: string): Promise<GithubRelease> {
    if (!/^v?\d+\.\d+\.\d+$/.test(tag)) throw new ValidationError("Etiqueta de versión inválida.");
    const release = (await githubReleases()).releases.find(row => row.tag === tag);
    if (!release) throw new ValidationError("La versión no figura entre las Releases publicadas de GitHub.");
    return { ...release, notes: sanitizePublicText(release.notes) };
  },
  async preflight() {
    const root = installationRoot();
    const result = await installationExecutor.exec("git status --porcelain=v1 --untracked-files=all", { cwd: root, timeoutMs: 10000 });
    if (result.exitCode !== 0) throw new AppError("La instalación no es un checkout Git válido", 409);
    const changedFiles = result.stdout.split("\n").filter(Boolean).map((line) => line.slice(3)).filter((file) => !/^(?:\.releases(?:\/|$)|\.lxp(?:\/|$)|(?:web\/)?(?:backend|frontend)\/dist(?:\/|$))/.test(file));
    return { ok: changedFiles.length === 0, changedFiles };
  },
  async status(_req?: Request) {
    const executor = installationExecutor;
    const root = installationRoot();
    const [state, catalog] = await Promise.all([readState(executor, root), githubReleases()]);
    const installed = typeof state.installed === "object" && state.installed ? state.installed as { tag?: string; branch?: string; commit?: string; path?: string } : null;
    const latest = catalog.releases[0] ?? null;
    const checkoutResult = await executor.exec("git rev-parse HEAD && git branch --show-current", { cwd: root, timeoutMs: 10000 });
    const [checkoutCommit, checkoutBranch] = checkoutResult.stdout.trim().split("\n");
    const checkout = checkoutResult.exitCode === 0 && /^[a-f0-9]{40}$/.test(checkoutCommit || "") ? { commit: checkoutCommit!, branch: checkoutBranch || null } : null;
    const branchCatalog = await releaseBranches(installed?.commit || runningCommit);
    const operation = state.operation && typeof state.operation === "object" ? state.operation as { status?: string; tag?: string; branch?: string; commit?: string; stage?: string; startedAt?: number; error?: string } : null;
    return {
      checkout, comparisonKnown: !!(installed?.commit || runningCommit), branches: branchCatalog.branches, branchesError: branchCatalog.error,
      installed: installed ? { tag: installed.tag, branch: installed.branch, commit: installed.commit } : null, latest, releases: catalog.releases, error: catalog.error,
      updateAvailable: !!latest && compareVersions(latest.tag, installed?.tag || APP_VERSION) > 0,
      currentVersion: installed?.tag || APP_VERSION,
      operation: operation ? { status: operation.status, tag: operation.tag, branch: operation.branch, commit: operation.commit, stage: operation.stage, startedAt: operation.startedAt, error: operation.error ? sanitizePublicText(operation.error) : undefined } : null,
      previous: state.previous && typeof state.previous === "object" ? { tag: (state.previous as { tag?: string }).tag, commit: (state.previous as { commit?: string }).commit } : null,
    };
  },

  async start(_req: Request, tag: string, branch?: { name: string; commit: string }) {
    const executor = installationExecutor;
    if (branch) {
      await verifyBranchRevision(branch.name, branch.commit);
      const details = await releaseBranchDetails(branch.name, branch.commit);
      if (!details.installable) throw new ValidationError("Esta rama no contiene una instalación completa del panel.");
    } else {
      if (!TAG.test(tag)) throw new ValidationError("Etiqueta de versión inválida.");
      const catalog = await githubReleases();
      if (!catalog.releases.some(release => release.tag === tag)) throw new ValidationError("La versión no figura entre las Releases publicadas de GitHub.");
    }
    const root = installationRoot();
    const state = await readState(executor, root);
    const operation = state.operation as { status?: string; startedAt?: number } | undefined;
    if (operation?.status === "running" && (!operation.startedAt || Date.now() - operation.startedAt < 7200000))
      throw new AppError("Ya hay una actualización en curso.", 409);
    const preflight = await this.preflight();
    if (!preflight.ok) throw new AppError(`Conserva tus cambios locales antes de actualizar: ${preflight.changedFiles.slice(0, 12).join(", ")}`, 409);
    const script = path.join(applicationRoot(root), "scripts", "release-manager.py");
    const log = path.join(root, ".releases", "manager.log");
    const selection = branch ? `--branch ${quoteArg(branch.name)} ${quoteArg(branch.commit)}` : quoteArg(tag);
    const command = `mkdir -p ${quoteArg(path.join(root, ".releases"))} && nohup setsid -f python3 ${quoteArg(script)} ${quoteArg(root)} ${selection} > ${quoteArg(log)} 2>&1 < /dev/null &`;
    const result = await executor.exec(command, { timeoutMs: 10000 });
    if (result.exitCode !== 0) throw new AppError("No se pudo iniciar la actualización.", 503);
    return { started: true, ...(branch ? { branch: branch.name, commit: branch.commit } : { tag }) };
  },
};
