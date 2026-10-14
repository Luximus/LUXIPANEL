// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Manages a project's on-disk provider structure on the connected target.
 *
 * The source of truth is the real filesystem at `project.path` (the same files
 * the provider CLIs read). This service:
 *   - scans which recommended nodes already exist (1 SSH round-trip),
 *   - scaffolds selected missing nodes (never overwrites),
 *   - reads/writes the content of declared structure files (path-guarded).
 *
 * Writes use SFTP and fall back to a staged `sudo cp` when the project dir is
 * root-owned, mirroring modules/mail's writeRootOwnedFile.
 */

import * as posix from "node:path/posix";
import type { Executor } from "../../../../shared/executor/index.js";
import { quoteCmd, quoteArg } from "../../../../shared/executor/quote.js";
import { ValidationError } from "../../../../shared/errors/index.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import type { AssistantProject, StructureProviderId } from "../../repositories/projects.repository.js";
import type { AssistantConfig, AssistantProviderId } from "../../models/assistant-config.types.js";
import { aiComplete } from "../translation/ai-translator.js";
import { runCliOnce } from "../providers/cli-bridge.provider.js";
import { marketplaceLinkRepository } from "../../../../shared/marketplace-link/index.js";
import { SDK_VERSION } from "../../../../shared/module-sdk/index.js";
import {
  getProviderStructure,
  findStructureNode,
  type StructureNode,
  type StructureOptions,
  type TemplateContext,
} from "./structure-templates.js";

const log = createModuleLogger("project-structure");

export interface StructureNodeStatus {
  rel: string;
  type: "file" | "dir";
  description: string;
  core: boolean;
  present: boolean;
  /** File nodes carry a default template, so they're editable in the panel. */
  editable: boolean;
}

export interface StructureScan {
  provider: StructureProviderId;
  label: string;
  rootDoc: string;
  hint: string;
  path: string;
  nodes: StructureNodeStatus[];
}

/**
 * Architecture pack marketplace: cuando el proyecto está vinculado a un módulo
 * del marketplace (shared/marketplace-link), la estructura del provider se
 * amplía con los nodos del módulo (manifest borrador, esqueleto SDK, reglas).
 * Fallo de lectura del sidecar → estructura base (nunca rompe scan/scaffold).
 */
async function marketplaceOptsFor(
  executor: Executor,
  project: AssistantProject,
): Promise<StructureOptions | undefined> {
  if (!project.id) return undefined;
  try {
    const link = await marketplaceLinkRepository.getByProjectId(executor, String(project.id));
    return link ? { marketplace: { moduleSlug: link.moduleId } } : undefined;
  } catch (err) {
    log.warn({ err, projectId: project.id }, "marketplace link lookup failed — base structure");
    return undefined;
  }
}

/** Contexto de plantillas; enriquecido con slug/nombre/SDK si hay vínculo marketplace. */
function templateCtx(
  project: AssistantProject,
  base: string,
  opts?: StructureOptions,
): TemplateContext {
  return {
    title: project.title,
    path: base,
    ...(opts?.marketplace
      ? {
          moduleSlug: opts.marketplace.moduleSlug,
          moduleName: project.title,
          sdkVersion: SDK_VERSION,
        }
      : {}),
  };
}

function requirePath(project: AssistantProject): string {
  const p = (project.path || "").trim();
  if (!p || !p.startsWith("/")) {
    throw new ValidationError(
      "El proyecto necesita un directorio de trabajo absoluto para gestionar su estructura.",
    );
  }
  return p.replace(/\/+$/, "");
}

/** Resolve a structure-relative path to an absolute target path, guarding against traversal. */
function resolveRel(base: string, rel: string): string {
  const clean = rel.replace(/^\/+/, "");
  const abs = posix.normalize(posix.join(base, clean));
  if (abs !== base && !abs.startsWith(base + "/")) {
    throw new ValidationError(`Ruta fuera del proyecto: ${rel}`);
  }
  return abs;
}

async function writeFileMaybeSudo(
  executor: Executor,
  dest: string,
  content: string,
  mode?: string,
): Promise<void> {
  const dir = posix.dirname(dest);
  // Best-effort parent dir; ignore "exists".
  await executor.mkdir(dir, { recursive: true }).catch(async () => {
    await executor.exec(quoteCmd("sudo", ["mkdir", "-p", dir])).catch(() => undefined);
  });
  try {
    await executor.writeFile(dest, content, { encoding: "utf-8" });
    if (mode) await executor.exec(quoteCmd("chmod", [mode, dest])).catch(() => undefined);
    return;
  } catch {
    // SFTP denied (root-owned dir) — staged sudo copy.
  }
  const tmp = `/tmp/luxipanel-structure-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await executor.writeFile(tmp, content, { encoding: "utf-8" });
  try {
    const res = await executor.exec(quoteCmd("sudo", ["cp", tmp, dest]));
    if (res.exitCode !== 0) {
      throw new Error((res.stderr || res.stdout || `exit ${res.exitCode}`).trim());
    }
    if (mode) await executor.exec(quoteCmd("sudo", ["chmod", mode, dest])).catch(() => undefined);
  } finally {
    await executor.exec(quoteCmd("rm", ["-f", tmp])).catch(() => undefined);
  }
}

export const projectStructureService = {
  /** Recommended structure for a project + which nodes already exist on disk. */
  async scan(executor: Executor, project: AssistantProject): Promise<StructureScan> {
    const base = requirePath(project);
    const opts = await marketplaceOptsFor(executor, project);
    const def = getProviderStructure(project.provider, opts);

    // One round-trip: print the rel of every node that exists.
    const checks = def.nodes
      .map((n) => `if [ -e ${quoteArg(resolveRel(base, n.rel))} ]; then printf '%s\\n' ${quoteArg(n.rel)}; fi`)
      .join("; ");
    const present = new Set<string>();
    try {
      const res = await executor.exec(`sh -lc ${quoteArg(checks)}`, { timeoutMs: 20000 });
      for (const line of res.stdout.split("\n")) {
        const t = line.trim();
        if (t) present.add(t);
      }
    } catch (err) {
      log.warn({ err, path: base }, "structure scan failed");
    }

    return {
      provider: def.provider,
      label: def.label,
      rootDoc: def.rootDoc,
      hint: def.hint,
      path: base,
      nodes: def.nodes.map((n) => ({
        rel: n.rel,
        type: n.type,
        description: n.description,
        core: !!n.core,
        present: present.has(n.rel),
        editable: n.type === "file",
      })),
    };
  },

  /**
   * Create the requested missing nodes. Never overwrites existing files.
   * Returns the rels actually created.
   */
  async scaffold(
    executor: Executor,
    project: AssistantProject,
    rels: string[],
  ): Promise<{ created: string[]; skipped: string[] }> {
    const base = requirePath(project);
    const opts = await marketplaceOptsFor(executor, project);
    const def = getProviderStructure(project.provider, opts);
    const ctx = templateCtx(project, base, opts);

    // Order so parent dirs come before their children.
    const wanted = def.nodes.filter((n) => rels.includes(n.rel));
    wanted.sort((a, b) => a.rel.split("/").length - b.rel.split("/").length);

    const created: string[] = [];
    const skipped: string[] = [];
    for (const node of wanted) {
      const abs = resolveRel(base, node.rel);
      // Skip if it already exists (idempotent, never clobber).
      const exists = await pathExists(executor, abs);
      if (exists) {
        skipped.push(node.rel);
        continue;
      }
      try {
        if (node.type === "dir") {
          await ensureDir(executor, abs);
        } else {
          const content = node.template ? node.template(ctx) : "";
          const mode = node.rel.endsWith(".sh") ? "755" : undefined;
          await writeFileMaybeSudo(executor, abs, content, mode);
        }
        created.push(node.rel);
      } catch (err) {
        log.warn({ err, rel: node.rel }, "scaffold node failed");
        skipped.push(node.rel);
      }
    }
    return { created, skipped };
  },

  /** Read the content of a declared file node. */
  async readFile(executor: Executor, project: AssistantProject, rel: string): Promise<string> {
    const base = requirePath(project);
    const opts = await marketplaceOptsFor(executor, project);
    const node = requireFileNode(project.provider, rel, opts);
    const abs = resolveRel(base, node.rel);
    try {
      const data = await executor.readFile(abs, "utf-8");
      return typeof data === "string" ? data : data.toString("utf-8");
    } catch {
      const out = await executor.exec(quoteCmd("sudo", ["cat", abs])).catch(() => null);
      if (out && out.exitCode === 0) return out.stdout;
      throw new ValidationError(`No se pudo leer ${rel}. ¿Está creado?`);
    }
  },

  /** Write the content of a declared file node (creates it if missing). */
  async writeFile(
    executor: Executor,
    project: AssistantProject,
    rel: string,
    content: string,
  ): Promise<void> {
    const base = requirePath(project);
    const opts = await marketplaceOptsFor(executor, project);
    const node = requireFileNode(project.provider, rel, opts);
    const abs = resolveRel(base, node.rel);
    const mode = node.rel.endsWith(".sh") ? "755" : undefined;
    await writeFileMaybeSudo(executor, abs, content, mode);
  },

  /**
   * Improve a structure file's content with the project's AI provider. Gathers
   * light context (the provider root doc + the list of sibling structure files +
   * the project's own instructions) so the model edits in line with the project.
   * `content` is the editor's current (possibly unsaved) text; falls back to the
   * on-disk file. Returns the improved content — the caller persists it only on
   * an explicit save, so the user reviews the result first.
   */
  async improveFile(
    executor: Executor,
    project: AssistantProject,
    rel: string,
    opts: { content?: string; instruction?: string; providerId?: StructureProviderId | string; config: AssistantConfig },
  ): Promise<string> {
    const structureOpts = await marketplaceOptsFor(executor, project);
    requireFileNode(project.provider, rel, structureOpts); // validate `rel` is a declared file
    const current = opts.content ?? (await this.readFile(executor, project, rel));
    if (!current.trim()) {
      throw new ValidationError("El archivo está vacío; no hay nada que mejorar.");
    }

    // ── Context gathering ──────────────────────────────────────────────────
    const scan = await this.scan(executor, project).catch(() => null);
    const siblings = (scan?.nodes ?? [])
      .filter((n) => n.type === "file" && n.present)
      .map((n) => n.rel)
      .filter((r) => r !== rel);
    const rootDoc = scan?.rootDoc ?? "";
    let rootDocContent = "";
    if (rootDoc && rootDoc !== rel) {
      rootDocContent = await this.readFile(executor, project, rootDoc).catch(() => "");
    }

    const system =
      "You are an expert software & DevOps engineer improving ONE file inside an existing project. " +
      "Improve it: fix mistakes, clarify wording, tighten structure and readability, apply best practices, " +
      "and align it with the project's conventions and the context provided. " +
      "Hard rules: PRESERVE the file's purpose and exact format. If it is JSON, return STILL-VALID JSON; " +
      "if Markdown, keep valid Markdown; if a shell script, keep it runnable. Do NOT remove information the " +
      "project relies on. " +
      // Critical for CLI agents (claude -p / codex exec / gemini --yolo): they run
      // with write/exec permission in the project dir — forbid side effects.
      "Do NOT modify any files on disk, do NOT create files, and do NOT run any commands. " +
      "Do NOT wrap the result in code fences and do NOT add any commentary, preamble or " +
      "explanation. Output ONLY the full, final content of the improved file as your text answer.";

    const ctx: string[] = [`Project: ${project.title || "(untitled)"}`, `File path: ${rel}`];
    if ((project.instructions || "").trim()) {
      ctx.push(`Project instructions:\n${project.instructions.trim().slice(0, 1500)}`);
    }
    if (siblings.length) ctx.push(`Other files in this project's structure: ${siblings.join(", ")}`);
    if (rootDocContent.trim()) {
      ctx.push(`Root documentation (${rootDoc}) for context — do NOT edit this, only use it to align:\n${rootDocContent.slice(0, 3000)}`);
    }
    if ((opts.instruction || "").trim()) {
      ctx.push(`Additional user instruction: ${opts.instruction!.trim().slice(0, 1000)}`);
    }
    const user =
      `${ctx.join("\n\n")}\n\n` +
      `=== CURRENT CONTENT OF ${rel} (improve this) ===\n${current}`;

    // Use the explicitly chosen provider when given; else the project's own.
    const providerId = (opts.providerId || project.provider) as AssistantProviderId;
    const slot = opts.config.providers[providerId];

    let rawText: string;
    if (slot?.mode === "cli") {
      // CLI-mode provider (no API key): run the CLI once on the target, with the
      // project dir as cwd so it has the project as context.
      try {
        rawText = await runCliOnce({
          executor,
          id: providerId,
          binOverride: slot.cli?.binPath,
          model: slot.cli?.model,
          prompt: `${system}\n\n${user}`,
          cwd: project.path,
          timeoutMs: 55_000,
        });
      } catch (e) {
        const msg = (e as Error)?.message || String(e);
        throw new ValidationError(`No se pudo mejorar con IA (CLI ${providerId}): ${msg.slice(0, 300)}`);
      }
    } else {
      // API-mode provider: one-shot HTTP completion. Hard timeout BELOW the
      // gateway limit (nginx ~60s / Cloudflare ~100s) so the request always
      // returns a clean JSON error rather than letting a gateway serve an HTML
      // error page (which surfaced as "Failed to fetch" / "Unexpected token '<'").
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 45_000);
      try {
        const out = await aiComplete(opts.config, {
          providerId,
          allowFallback: !opts.providerId, // explicit choice → no silent swap
          system,
          user,
          signal: ac.signal,
        });
        rawText = out.text;
      } catch (e) {
        const msg = (e as Error)?.message || String(e);
        if (ac.signal.aborted) {
          throw new ValidationError(
            "La mejora con IA tardó demasiado (límite 45s). Prueba con otro proveedor o un archivo más pequeño.",
          );
        }
        throw new ValidationError(`No se pudo mejorar con IA: ${msg.slice(0, 300)}`);
      } finally {
        clearTimeout(timer);
      }
    }
    const improved = stripCodeFence(rawText).trim();
    return improved || current;
  },
};

/** Drop a single wrapping ```lang … ``` fence if the model wrapped the whole file. */
function stripCodeFence(s: string): string {
  const t = s.trim();
  const m = t.match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
  return m ? m[1]! : s;
}

function requireFileNode(
  provider: StructureProviderId,
  rel: string,
  opts?: StructureOptions,
): StructureNode {
  const node = findStructureNode(provider, rel, opts);
  if (!node || node.type !== "file") {
    throw new ValidationError(`Archivo de estructura no reconocido: ${rel}`);
  }
  return node;
}

async function pathExists(executor: Executor, abs: string): Promise<boolean> {
  const res = await executor
    .exec(`sh -lc ${quoteArg(`[ -e ${quoteArg(abs)} ] && echo 1 || echo 0`)}`)
    .catch(() => null);
  return !!res && res.stdout.trim() === "1";
}

async function ensureDir(executor: Executor, abs: string): Promise<void> {
  try {
    await executor.mkdir(abs, { recursive: true });
  } catch {
    const res = await executor.exec(quoteCmd("sudo", ["mkdir", "-p", abs]));
    if (res.exitCode !== 0) throw new Error((res.stderr || res.stdout || `exit ${res.exitCode}`).trim());
  }
}
