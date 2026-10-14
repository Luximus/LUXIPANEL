// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Context containers — auto-provisioned Obsidian vaults that hold the
 * summarized context, decisions, commands, errors and rules for each source
 * the assistant works with: a GitHub repository on the client server, an
 * assistant project, or a loose chat.
 *
 * Layout (central, per SSH user — keeps the repos themselves clean):
 *
 *   ~/luxipanel-context/
 *     projects/<repo>/        ← one vault per discovered git repo
 *     assistant/<project>/    ← one vault per assistant project
 *     chats/<chat>/           ← one vault per loose chat
 *
 * Each vault is a real Obsidian vault (registered in vaults.json) seeded with
 * five working notes plus the per-provider CLI context files (CLAUDE.md,
 * AGENTS.md, GEMINI.md) so `claude` / `codex` / `gemini` know how to use it.
 * For repos we also drop a pointer block into the repo's own CLAUDE.md /
 * AGENTS.md / GEMINI.md so a CLI launched inside the repo finds the vault.
 *
 * Everything runs on the CONNECTED server through the Executor — never the
 * panel host. Creation is idempotent: the per-source `refKey` in
 * containers.json guarantees one container per source across renames.
 *
 * Dependency direction: ai-assistant EMITS lifecycle events and obsidian
 * listens (see listeners.ts) — obsidian never imports assistant code at the
 * write path. The read-only enumeration in `syncAll` is the one bounded
 * exception (it reads the assistant's per-server sidecars to back-fill
 * containers for sources that already existed before the module was enabled).
 */

import type { Executor } from "../../../shared/executor/index.js";
import { execShell, pathExists, quoteArg } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { CODE_SCAN_ROOTS } from "../../../shared/constants.js";
import { vaultsRepository } from "../repositories/vaults.repository.js";
import { containersRepository, type ContainerKind } from "../repositories/containers.repository.js";
import type { ContextContainer } from "../repositories/containers.repository.js";
import type { ObsidianVault } from "../models/index.js";
import { obsidianService } from "./obsidian.service.js";
import { projectsRepository } from "../../ai-assistant/repositories/projects.repository.js";
import { conversationsRepository } from "../../ai-assistant/repositories/conversations.repository.js";

const log = createModuleLogger("obsidian-context-container");

const BASE_FOLDER = "luxipanel-context";
const REPO_SCAN_DEPTH = 4;
/** Provider context files seeded in every vault AND used for the repo pointer. */
const PROVIDER_FILES = ["CLAUDE.md", "AGENTS.md", "GEMINI.md"] as const;
const POINTER_START = "<!-- luxipanel-context:start -->";
const POINTER_END = "<!-- luxipanel-context:end -->";

interface SyncSummary {
  baseDir: string;
  created: number;
  existing: number;
  repos: number;
  projects: number;
  chats: number;
  containers: Array<{ kind: ContainerKind; name: string; path: string }>;
}

interface BuildSpec {
  kind: ContainerKind;
  refKey: string;
  /** Vault display name (≤80). */
  name: string;
  /** Sub-folder under the base dir: projects | assistant | chats. */
  subdir: string;
  /** Slug used as the leaf folder name. */
  slug: string;
  /** Source description seeded into the notes. */
  source: string;
  /** For repos: absolute repo path (pointer target). */
  repoPath?: string;
}

interface Ctx {
  baseDir: string;
  usedPaths: Set<string>;
  byRefKey: Map<string, ContextContainer & { id: string }>;
}

// ── small helpers ────────────────────────────────────────────────────────────

async function sh(executor: Executor, body: string, timeoutMs = 20_000) {
  return execShell(executor, body, { timeoutMs });
}

export function slug(value: string): string {
  const s = (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "item";
}

function shortId(id: string): string {
  return (id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "x";
}

function cap(name: string): string {
  return name.length > 80 ? `${name.slice(0, 79)}…` : name;
}

/** @see shared/executor/fs-probe.ts */
const exists = pathExists;

async function writeIfMissing(executor: Executor, abs: string, content: string): Promise<void> {
  if (await exists(executor, abs)) return;
  await executor.writeFile(abs, content);
}

/** Resolve the SSH user's home dir, then anchor the central context folder. */
async function resolveBaseDir(executor: Executor): Promise<string> {
  let home = "";
  try {
    const r = await sh(executor, 'printf %s "$HOME"', 8_000);
    home = r.stdout.trim();
  } catch {
    /* fall through */
  }
  if (!home.startsWith("/")) {
    const user = executor.sshUsername;
    home = user && user !== "root" ? `/home/${user}` : "/root";
  }
  return `${home.replace(/\/+$/, "")}/${BASE_FOLDER}`;
}

// ── note templates ───────────────────────────────────────────────────────────

function noteHeader(title: string, source: string): string {
  return `---\ntags: [luxipanel-context]\n---\n\n# ${title}\n\n> Fuente: ${source}\n`;
}

function seedFiles(spec: BuildSpec): Record<string, string> {
  const s = spec.source;
  return {
    "README.md":
      `---\ntags: [luxipanel-context]\n---\n\n# ${spec.name}\n\n` +
      `> Fuente: ${s}\n\n` +
      `Vault de **contexto** gestionado por el módulo Obsidian de LUXIPANEL. ` +
      `Guarda aquí lo importante de este ${spec.kind === "repo" ? "repositorio" : spec.kind === "project" ? "proyecto" : "chat"} ` +
      `y referéncialo cuando el asistente lo necesite:\n\n` +
      `- [[Contexto]] — resumen del estado y el objetivo actual.\n` +
      `- [[Decisiones]] — decisiones tomadas y su porqué.\n` +
      `- [[Comandos]] — comandos útiles y cómo ejecutarlos.\n` +
      `- [[Errores]] — errores conocidos y su solución.\n` +
      `- [[Reglas]] — convenciones y reglas a respetar.\n\n` +
      `Mantén estas notas breves y actualizadas: son la memoria que el ` +
      `asistente IA (y los CLIs Claude/Codex/Gemini) consultan antes de actuar.\n`,
    "Contexto.md":
      noteHeader("Contexto", s) +
      `\n_Resumen del estado actual, el objetivo y lo que conviene recordar._\n\n- \n`,
    "Decisiones.md":
      noteHeader("Decisiones", s) +
      `\n_Decisiones tomadas, con fecha y motivo (qué se eligió y por qué)._\n\n- \n`,
    "Comandos.md":
      noteHeader("Comandos", s) +
      `\n_Comandos útiles para este contexto (build, deploy, pruebas, etc.)._\n\n` +
      "```sh\n\n```\n",
    "Errores.md":
      noteHeader("Errores", s) +
      `\n_Errores conocidos y cómo se resolvieron (síntoma → causa → arreglo)._\n\n- \n`,
    "Reglas.md":
      noteHeader("Reglas", s) +
      `\n_Convenciones y reglas a respetar al trabajar aquí._\n\n- \n`,
  };
}

function pointerBlock(vaultPath: string): string {
  return (
    `${POINTER_START}\n` +
    `## Contexto LUXIPANEL (Obsidian)\n\n` +
    `Este proyecto tiene un **vault de contexto** en \`${vaultPath}\`, gestionado ` +
    `por el módulo Obsidian de LUXIPANEL. Antes de trabajar, consulta y mantén ` +
    `actualizadas estas notas:\n\n` +
    `- \`${vaultPath}/Contexto.md\` — resumen del estado y objetivo.\n` +
    `- \`${vaultPath}/Decisiones.md\` — decisiones y su porqué.\n` +
    `- \`${vaultPath}/Comandos.md\` — comandos útiles.\n` +
    `- \`${vaultPath}/Errores.md\` — errores conocidos y soluciones.\n` +
    `- \`${vaultPath}/Reglas.md\` — convenciones y reglas.\n\n` +
    `Puedes leer/editar estos archivos directamente o pedírselo al asistente IA ` +
    `del panel (herramientas \`obsidian.*\`). Resume aquí lo aprendido en cada sesión.\n` +
    `${POINTER_END}\n`
  );
}

// ── core ─────────────────────────────────────────────────────────────────────

async function buildCtx(executor: Executor): Promise<Ctx> {
  const baseDir = await resolveBaseDir(executor);
  const containers = await containersRepository.list(executor);
  return {
    baseDir,
    usedPaths: new Set(containers.map((c) => c.path)),
    byRefKey: new Map(containers.map((c) => [c.refKey, c])),
  };
}

/** Append the context pointer to each provider file in the repo (idempotent). */
async function writeRepoPointer(executor: Executor, repoPath: string, vaultPath: string): Promise<void> {
  const block = pointerBlock(vaultPath);
  for (const file of PROVIDER_FILES) {
    const abs = `${repoPath}/${file}`;
    try {
      let current = "";
      if (await exists(executor, abs)) {
        const raw = await executor.readFile(abs, "utf8");
        current = typeof raw === "string" ? raw : raw.toString("utf8");
        if (current.includes(POINTER_START)) continue; // already pointed
      }
      const next = current.trim() ? `${current.replace(/\s*$/, "")}\n\n${block}` : block;
      await executor.writeFile(abs, next);
    } catch (err) {
      log.warn({ file: abs, err: (err as Error).message }, "repo pointer write failed");
    }
  }
}

async function seedVault(
  executor: Executor,
  vault: ObsidianVault & { id: string },
  spec: BuildSpec,
): Promise<void> {
  const files = seedFiles(spec);
  for (const [name, content] of Object.entries(files)) {
    await writeIfMissing(executor, `${vault.path}/${name}`, content);
  }
  // Per-provider context files so a CLI opened IN the vault behaves well.
  await obsidianService.writeAssistantContext(executor, vault, false);
}

/** Idempotently ensure a container exists for one source. */
async function ensureOne(
  executor: Executor,
  ctx: Ctx,
  spec: BuildSpec,
): Promise<{ container: ContextContainer & { id: string }; created: boolean }> {
  const existing = ctx.byRefKey.get(spec.refKey);
  if (existing) return { container: existing, created: false };

  // Compute a collision-free vault path under the base dir.
  let path = `${ctx.baseDir}/${spec.subdir}/${spec.slug}`;
  if (ctx.usedPaths.has(path)) {
    let n = 2;
    while (ctx.usedPaths.has(`${path}-${n}`)) n++;
    path = `${path}-${n}`;
  }

  // Reuse an already-registered vault at that path, else create + register one.
  let vault = await vaultsRepository.findByPath(executor, path);
  if (!vault) {
    vault = await obsidianService.createVault(executor, {
      name: cap(spec.name),
      path,
      mode: "create",
    });
  }

  await seedVault(executor, vault, spec);
  if (spec.kind === "repo" && spec.repoPath) {
    await writeRepoPointer(executor, spec.repoPath, vault.path);
  }

  const container = await containersRepository.create(executor, {
    kind: spec.kind,
    refKey: spec.refKey,
    name: cap(spec.name),
    path: vault.path,
    vaultId: vault.id,
    ...(spec.repoPath ? { repoPath: spec.repoPath } : {}),
  });

  ctx.usedPaths.add(vault.path);
  ctx.byRefKey.set(spec.refKey, container);
  log.info({ kind: spec.kind, name: spec.name, path: vault.path }, "context container created");
  return { container, created: true };
}

// ── spec builders ────────────────────────────────────────────────────────────

export function repoSpec(repoPath: string): BuildSpec {
  const base = repoPath.split("/").filter(Boolean).pop() ?? "repo";
  return {
    kind: "repo",
    refKey: `repo:${repoPath}`,
    name: `Repo: ${base}`,
    subdir: "projects",
    slug: slug(base),
    source: `Repositorio Git \`${repoPath}\``,
    repoPath,
  };
}

export function projectSpec(project: { id?: string; title?: string; path?: string }): BuildSpec | null {
  const id = String(project.id ?? "");
  if (!id) return null;
  const title = (project.title ?? "Proyecto").trim() || "Proyecto";
  return {
    kind: "project",
    refKey: `project:${id}`,
    name: `Proyecto: ${title}`,
    subdir: "assistant",
    slug: `${slug(title)}-${shortId(id)}`,
    source: `Proyecto del asistente «${title}»${project.path ? ` (dir \`${project.path}\`)` : ""}`,
  };
}

export function chatSpec(conv: { id?: string; title?: string; projectId?: string | null }): BuildSpec | null {
  const id = String(conv.id ?? "");
  if (!id) return null;
  // Only LOOSE chats get their own container; project chats live under their
  // project's container.
  if (conv.projectId) return null;
  const title = (conv.title ?? "Chat").trim() || "Chat";
  return {
    kind: "chat",
    refKey: `chat:${id}`,
    name: `Chat: ${title}`,
    subdir: "chats",
    slug: `${slug(title)}-${shortId(id)}`,
    source: `Chat suelto del asistente «${title}»`,
  };
}

// ── repo discovery (filesystem, no Files-module import) ───────────────────────

async function scanRepoPaths(executor: Executor): Promise<string[]> {
  const found = new Set<string>();
  for (const root of CODE_SCAN_ROOTS) {
    try {
      const r = await sh(
        executor,
        `find ${quoteArg(root)} -maxdepth ${REPO_SCAN_DEPTH} -type d -name .git 2>/dev/null`,
        30_000,
      );
      for (const line of r.stdout.split("\n")) {
        const t = line.trim();
        if (t.endsWith("/.git")) found.add(t.replace(/\/\.git$/, ""));
      }
    } catch {
      /* skip inaccessible root */
    }
  }
  return [...found];
}

// ── public API ───────────────────────────────────────────────────────────────

export const contextContainerService = {
  /** Ensure a container for a discovered git repository. */
  async ensureRepoContainer(executor: Executor, repoPath: string) {
    const ctx = await buildCtx(executor);
    return ensureOne(executor, ctx, repoSpec(repoPath));
  },

  /** Ensure a container for an assistant project (from the create event). */
  async ensureProjectContainer(
    executor: Executor,
    project: { id?: string; title?: string; path?: string },
  ) {
    const spec = projectSpec(project);
    if (!spec) return null;
    const ctx = await buildCtx(executor);
    return ensureOne(executor, ctx, spec);
  },

  /** Ensure a container for a loose chat (from the create event). No-op for
   *  conversations attached to a project. */
  async ensureChatContainer(
    executor: Executor,
    conv: { id?: string; title?: string; projectId?: string | null },
  ) {
    const spec = chatSpec(conv);
    if (!spec) return null;
    const ctx = await buildCtx(executor);
    return ensureOne(executor, ctx, spec);
  },

  /**
   * Back-fill containers for everything that already exists: every git repo on
   * the server, every assistant project, and (when `includeChats`) every loose
   * chat of the current user. Idempotent — existing containers are left alone.
   */
  async syncAll(
    executor: Executor,
    opts: { includeChats?: boolean } = {},
  ): Promise<SyncSummary> {
    const ctx = await buildCtx(executor);
    const summary: SyncSummary = {
      baseDir: ctx.baseDir,
      created: 0,
      existing: 0,
      repos: 0,
      projects: 0,
      chats: 0,
      containers: [],
    };

    const run = async (spec: BuildSpec | null) => {
      if (!spec) return;
      try {
        const { container, created } = await ensureOne(executor, ctx, spec);
        summary[created ? "created" : "existing"]++;
        if (created) {
          summary.containers.push({ kind: container.kind, name: container.name, path: container.path });
        }
      } catch (err) {
        log.warn({ refKey: spec.refKey, err: (err as Error).message }, "container ensure failed");
      }
    };

    const repos = await scanRepoPaths(executor);
    summary.repos = repos.length;
    for (const repo of repos) await run(repoSpec(repo));

    const projects = await projectsRepository.list(executor);
    summary.projects = projects.length;
    for (const project of projects) await run(projectSpec(project));

    if (opts.includeChats) {
      try {
        const { items } = await conversationsRepository.list(executor, { projectId: null, limit: 200 });
        summary.chats = items.length;
        for (const conv of items) await run(chatSpec(conv));
      } catch (err) {
        log.warn({ err: (err as Error).message }, "loose-chat enumeration failed");
      }
    }

    log.info(
      { baseDir: summary.baseDir, created: summary.created, existing: summary.existing },
      "context container sync complete",
    );
    return summary;
  },

  /** List the registered containers (for the assistant / panel). */
  async listContainers(executor: Executor) {
    return containersRepository.list(executor);
  },

  /**
   * B2 — auto-capture: append a concise dated block to the project vault's
   * Decisiones.md after a project-scoped conversation turn. v1 stores only an
   * excerpt (NO extra LLM call). Idempotent: skips when the same excerpt is
   * already present. Fail-open: returns false when there's no container/vault
   * or any read/write fails — never throws (the listener is detached anyway).
   */
  async captureProjectTurn(
    executor: Executor,
    projectId: string,
    args: { title: string; excerpt: string; ts?: string },
  ): Promise<boolean> {
    const excerpt = (args.excerpt || "").replace(/\s+/g, " ").trim().slice(0, 500);
    if (!excerpt) return false;

    const container = await containersRepository.findByRefKey(executor, `project:${projectId}`);
    if (!container) return false;
    let vault: (ObsidianVault & { id: string }) | null = null;
    try {
      vault = await vaultsRepository.get(executor, container.vaultId);
    } catch {
      vault = null;
    }
    if (!vault) return false;

    const date = (args.ts ?? new Date().toISOString()).slice(0, 10);
    const title = (args.title || "Conversación").replace(/\s+/g, " ").trim().slice(0, 120);
    const block = `## [${date}] — ${title}\n${excerpt}\n`;

    // Idempotency: don't re-append if this exact excerpt is already in the note.
    try {
      const existing = await obsidianService.readNote(executor, vault, "Decisiones.md");
      if (existing.content.includes(excerpt)) return false;
    } catch {
      /* nota ausente/ilegible → appendNote la crea */
    }

    try {
      await obsidianService.appendNote(executor, vault, "Decisiones.md", `\n${block}`);
      return true;
    } catch (err) {
      log.warn({ err: (err as Error).message, projectId }, "auto-capture append failed");
      return false;
    }
  },
};
