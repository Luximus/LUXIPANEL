// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Codebase-graph indexing for assistant projects.
 *
 * Wraps the `codebase-memory-mcp` binary installed ON THE TARGET (same binary
 * the community `codebase-graph` module shells out to). This service owns:
 *   - availability probe (does the target ship the binary?), TTL-cached
 *   - per-project indexing (`index_repository`) launched with nohup +
 *     exit-file polling (a full index can take minutes — a single blocking
 *     exec would be cut by the LP proxy's HTTP timeout)
 *   - status reconciliation after a panel restart (in-memory job lost)
 *   - sweep of ephemeral `/tmp/lxp-cli-*` projects the graph's auto_index
 *     keeps picking up from per-conversation CLI cwds
 *
 * Deliberately does NOT reuse the community module's `reindex` agent tool:
 * that handler is agent-facing (ModuleCtx) and blocking, and the requirement
 * gates on the BINARY being present — the panel module may not be installed.
 */

import { randomUUID } from "node:crypto";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import { ValidationError, ConflictError } from "../../../shared/errors/index.js";
import { agentCapabilityRegistry } from "../../../shared/agent-capability/index.js";
import {
  projectsRepository,
  type AssistantProject,
  type AssistantProjectGraphIndex,
} from "../repositories/projects.repository.js";
import { loginShell, buildNohupLaunch, sleep } from "./providers/cli/shell.js";
import { isCliTempPath } from "./providers/cli/cli-tmp-paths.js";
import { AVAILABILITY_TTL_MS } from "../shared/constants.js";

const log = createModuleLogger("assistant-graph-index");

const GRAPH_BIN = "codebase-memory-mcp";
const INDEX_TIMEOUT_MS = 8 * 60 * 1000;
const INDEX_POLL_MS = 5_000;
const GRAPH_INDEX_JOB_TTL_MS = 30 * 60 * 1000;

export interface GraphAvailability {
  available: boolean;
  /** Absolute path of the binary on the target (probe result). */
  binPath?: string;
  version?: string;
  /** Info-only: the community codebase-graph module is registered in the panel. */
  moduleInstalled: boolean;
  checkedAt: number;
}

interface GraphJob {
  jobId: string;
  projectId: string;
  startedAt: number;
}

/** Per-target availability cache (same keying as the MiniMax auth cache). */
const availabilityCache = new Map<string, GraphAvailability>();
/** In-flight index jobs, keyed by projectId. */
const jobs = new Map<string, GraphJob>();

function targetKey(executor: Executor): string {
  return executor.target.id || executor.target.name || "default";
}

function pruneJobs(): void {
  const now = Date.now();
  for (const [k, j] of jobs) if (now - j.startedAt > GRAPH_INDEX_JOB_TTL_MS) jobs.delete(k);
}

/** Normalize a root path for comparison (the graph returns "//var/…" at times). */
function normPath(p: string): string {
  return p.replace(/\/+/g, "/").replace(/\/$/, "");
}

/** Run one graph CLI tool on the target and parse the trailing JSON line.
 *  Exported so `graph-tools.ts` (the scoped MCP surface) drives the binary
 *  through the SAME invocation path — one place that knows how to call it. */
export async function runGraphCli<T>(
  executor: Executor,
  bin: string,
  tool: string,
  args: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<T> {
  const cmd = `${quoteArg(bin)} cli ${quoteArg(tool)} ${quoteArg(JSON.stringify(args))}`;
  const r = await executor.exec(loginShell(cmd), { timeoutMs });
  // The CLI prints `level=info` log lines first; the payload is the last line
  // that parses as JSON.
  const lines = (r.stdout ?? "").trim().split("\n").reverse();
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("{") && !t.startsWith("[")) continue;
    try {
      return JSON.parse(t) as T;
    } catch {
      /* keep scanning */
    }
  }
  throw new Error(
    `graph cli ${tool}: sin JSON en la salida (exit ${r.exitCode}): ${(r.stderr || r.stdout || "").slice(0, 200)}`,
  );
}

export const graphIndexService = {
  /** Does the connected target ship the graph binary? TTL-cached per target. */
  async probeAvailability(executor: Executor, opts?: { refresh?: boolean }): Promise<GraphAvailability> {
    const key = targetKey(executor);
    const cached = availabilityCache.get(key);
    if (!opts?.refresh && cached && Date.now() - cached.checkedAt < AVAILABILITY_TTL_MS) return cached;

    const moduleInstalled = agentCapabilityRegistry.list().some((c) => c.moduleId === "codebase-graph");
    let result: GraphAvailability = { available: false, moduleInstalled, checkedAt: Date.now() };
    try {
      const r = await executor.exec(
        loginShell(`command -v ${GRAPH_BIN} && ${GRAPH_BIN} --version 2>/dev/null | head -1`),
        { timeoutMs: 8_000 },
      );
      const lines = (r.stdout ?? "").trim().split("\n").map((l) => l.trim()).filter(Boolean);
      const binPath = lines.find((l) => l.startsWith("/"));
      if (binPath) {
        const version = lines.find((l) => l !== binPath && /\d/.test(l))?.replace(/^[^\d]*/, "").slice(0, 40);
        result = { available: true, binPath, version, moduleInstalled, checkedAt: Date.now() };
      }
    } catch (err) {
      // Fail-open a "no disponible": la UI simplemente oculta la opción.
      log.debug({ target: key, err: (err as Error).message }, "graph availability probe failed");
    }
    availabilityCache.set(key, result);
    if (opts?.refresh && result.available) {
      void this.sweepEphemeralProjects(executor).catch(() => undefined);
    }
    return result;
  },

  /** Resolve the graph's project name for a filesystem path (via list_projects —
   *  the slug rule stays the binary's business, we just match root_path). */
  async resolveGraphProject(executor: Executor, bin: string, path: string): Promise<{ name: string } | null> {
    try {
      const res = await runGraphCli<{ projects?: { name: string; root_path: string }[] }>(
        executor, bin, "list_projects", {},
      );
      const want = normPath(path);
      const hit = (res.projects ?? []).find((p) => normPath(p.root_path) === want);
      return hit ? { name: hit.name } : null;
    } catch {
      return null;
    }
  },

  /** Launch an index run for the project's own `path` (nohup + exit-file poll). */
  async startIndex(executor: Executor, project: AssistantProject): Promise<{ jobId: string }> {
    pruneJobs();
    const projectId = String(project.id ?? "");
    const path = (project.path ?? "").trim();
    if (!projectId) throw new ValidationError("Proyecto sin id.");
    if (!path) throw new ValidationError("Define primero el directorio de trabajo del proyecto.");
    if (jobs.has(projectId)) throw new ConflictError("Ya hay una indexación en curso para este proyecto.");

    // Never index a directory that CONTAINS other projects. Indexing
    // `/var/www` (the monorepo root, parent of LUXIPANEL, LP-LICENSE-SERVER, …)
    // builds one giant graph that mixes every project's code together — which
    // is both the memory blow-up that started all this (a ~3.4 GB index on a
    // 3.8 GB box) and a hole straight through the per-agent isolation: one
    // graph holding everyone's code cannot be scoped to anyone.
    const siblings = await projectsRepository.list(executor).catch(() => [] as AssistantProject[]);
    const root = path.replace(/\/+$/, "");
    const contained = siblings.filter((p) => {
      const other = (p.path ?? "").replace(/\/+$/, "");
      return p.id !== projectId && other && other !== root && other.startsWith(`${root}/`);
    });
    if (contained.length > 0) {
      throw new ValidationError(
        `"${root}" contiene otros proyectos (${contained.map((p) => p.title).join(", ")}). ` +
          "Indexa cada proyecto por separado: un índice de la carpeta padre mezcla el código de todos " +
          "y no se puede acotar por agente.",
      );
    }

    const avail = await this.probeAvailability(executor);
    if (!avail.available || !avail.binPath) {
      throw new ValidationError("El servidor conectado no tiene codebase-memory-mcp instalado.");
    }

    const jobId = randomUUID();
    const logFile = `/tmp/lxp-graph-${jobId}.log`;
    const exitFile = `/tmp/lxp-graph-${jobId}.exit`;
    const cliCmd = `${quoteArg(avail.binPath)} cli index_repository ${quoteArg(JSON.stringify({ repo_path: path }))}`;
    const launch = buildNohupLaunch(cliCmd, logFile, exitFile);

    jobs.set(projectId, { jobId, projectId, startedAt: Date.now() });
    await projectsRepository.setGraphIndex(executor, projectId, { enabled: true, status: "indexing" });

    try {
      await executor.exec(launch, { timeoutMs: 15_000 });
    } catch (err) {
      jobs.delete(projectId);
      await projectsRepository
        .setGraphIndex(executor, projectId, { status: "error", error: (err as Error).message.slice(0, 300) })
        .catch(() => undefined);
      throw err;
    }

    // Fire-and-forget watcher: polls the exit file with SHORT execs (no single
    // long round-trip → LP-proxy safe) and persists the terminal state. The
    // executor is captured explicitly so it survives the request ending (same
    // pattern as projectSuggestionsService.generateAndStore).
    void this.watchIndexJob(executor, projectId, avail.binPath, path, logFile, exitFile).catch((err) => {
      log.warn({ projectId, err: (err as Error).message }, "graph index watcher crashed");
    });

    // Opportunistic hygiene: drop the /tmp/lxp-cli-* junk auto_index keeps minting.
    void this.sweepEphemeralProjects(executor).catch(() => undefined);

    return { jobId };
  },

  /** @internal poll loop for one index run (exported for tests). */
  async watchIndexJob(
    executor: Executor,
    projectId: string,
    bin: string,
    path: string,
    logFile: string,
    exitFile: string,
  ): Promise<void> {
    const deadline = Date.now() + INDEX_TIMEOUT_MS;
    try {
      let exitCode: number | null = null;
      while (Date.now() < deadline) {
        await sleep(INDEX_POLL_MS);
        const r = await executor
          .exec(`cat ${quoteArg(exitFile)} 2>/dev/null`, { timeoutMs: 10_000 })
          .catch(() => null);
        const t = r?.stdout.trim() ?? "";
        if (t !== "") {
          exitCode = parseInt(t, 10);
          break;
        }
      }

      if (exitCode === 0) {
        const resolved = await this.resolveGraphProject(executor, bin, path);
        let nodes: number | undefined;
        let edges: number | undefined;
        if (resolved) {
          const status = await runGraphCli<{ nodes?: number; edges?: number }>(
            executor, bin, "index_status", { project: resolved.name },
          ).catch(() => null);
          nodes = status?.nodes;
          edges = status?.edges;
        }
        await projectsRepository.setGraphIndex(executor, projectId, {
          status: "ready",
          project: resolved?.name,
          nodes,
          edges,
          lastIndexedAt: new Date().toISOString(),
          indexedPath: path,
          error: undefined,
        });
        log.info({ projectId, graphProject: resolved?.name, nodes, edges }, "graph index completed");
      } else {
        const tail = await executor
          .exec(`tail -c 400 ${quoteArg(logFile)} 2>/dev/null`, { timeoutMs: 10_000 })
          .catch(() => null);
        const error =
          exitCode == null
            ? `Indexación no terminó en ${Math.round(INDEX_TIMEOUT_MS / 60000)} min.`
            : (tail?.stdout.trim() || `exit ${exitCode}`).slice(0, 300);
        await projectsRepository.setGraphIndex(executor, projectId, { status: "error", error });
        log.warn({ projectId, exitCode, error }, "graph index failed");
      }
    } finally {
      jobs.delete(projectId);
      void executor
        .exec(`rm -f ${quoteArg(logFile)} ${quoteArg(exitFile)}`, { timeoutMs: 5_000 })
        .catch(() => undefined);
    }
  },

  /** Current state for the modal: live job > stored state (+ restart repair). */
  async getStatus(executor: Executor, project: AssistantProject): Promise<AssistantProjectGraphIndex> {
    pruneJobs();
    const projectId = String(project.id ?? "");
    const stored = project.graphIndex ?? { enabled: false };
    if (jobs.has(projectId)) return { ...stored, status: "indexing" };
    // Stored "indexing" with no live job = the panel restarted mid-run.
    // Reconcile against the graph itself instead of lying forever.
    if (stored.status === "indexing") {
      const avail = await this.probeAvailability(executor);
      if (avail.available && avail.binPath && project.path) {
        const resolved = await this.resolveGraphProject(executor, avail.binPath, project.path);
        if (resolved) {
          const status = await runGraphCli<{ nodes?: number; edges?: number }>(
            executor, avail.binPath, "index_status", { project: resolved.name },
          ).catch(() => null);
          const repaired: Partial<AssistantProjectGraphIndex> = {
            status: "ready",
            project: resolved.name,
            nodes: status?.nodes,
            edges: status?.edges,
            lastIndexedAt: stored.lastIndexedAt ?? new Date().toISOString(),
            indexedPath: stored.indexedPath ?? project.path,
          };
          const updated = await projectsRepository.setGraphIndex(executor, projectId, repaired).catch(() => null);
          return updated?.graphIndex ?? { ...stored, ...repaired };
        }
      }
      const repaired: Partial<AssistantProjectGraphIndex> = {
        status: "error",
        error: "Indexación interrumpida (reinicio del panel). Reintenta.",
      };
      const updated = await projectsRepository.setGraphIndex(executor, projectId, repaired).catch(() => null);
      return updated?.graphIndex ?? { ...stored, ...repaired };
    }
    return stored;
  },

  /** Disable the toggle; optionally purge the graph project itself. */
  async disable(executor: Executor, project: AssistantProject, purge: boolean): Promise<void> {
    const projectId = String(project.id ?? "");
    if (purge && project.graphIndex?.project) {
      const avail = await this.probeAvailability(executor);
      if (avail.available && avail.binPath) {
        await runGraphCli(executor, avail.binPath, "delete_project", { project: project.graphIndex.project }).catch(
          () => undefined,
        );
      }
    }
    await projectsRepository.setGraphIndex(executor, projectId, {
      enabled: false,
      status: "idle",
      ...(purge ? { project: undefined, nodes: undefined, edges: undefined, indexedPath: undefined } : {}),
    });
  },

  /** Best-effort: delete the junk `tmp-lxp-cli-*` projects auto_index creates
   *  from the per-conversation CLI cwds under /tmp. */
  async sweepEphemeralProjects(executor: Executor): Promise<number> {
    const avail = await this.probeAvailability(executor);
    if (!avail.available || !avail.binPath) return 0;
    const res = await runGraphCli<{ projects?: { name: string; root_path: string }[] }>(
      executor, avail.binPath, "list_projects", {},
    ).catch(() => null);
    if (!res?.projects) return 0;
    const junk = res.projects.filter(
      (p) => p.name.startsWith("tmp-lxp-cli-") || isCliTempPath(normPath(p.root_path)),
    );
    let deleted = 0;
    for (const p of junk) {
      const ok = await runGraphCli(executor, avail.binPath, "delete_project", { project: p.name })
        .then(() => true)
        .catch(() => false);
      if (ok) deleted += 1;
    }
    if (deleted > 0) log.info({ deleted }, "swept ephemeral graph projects");
    return deleted;
  },
};
