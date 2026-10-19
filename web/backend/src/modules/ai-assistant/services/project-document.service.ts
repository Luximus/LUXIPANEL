// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { createHash } from "node:crypto";
import { posix } from "node:path";
import { getContextUser, pathInFileJail, quoteArg, type Executor } from "../../../shared/executor/index.js";
import { canAccessPath } from "../../../shared/auth/role-permissions.js";
import { ConflictError, ForbiddenError, ValidationError } from "../../../shared/errors/index.js";
import { projectsRepository, type AssistantProject } from "../repositories/projects.repository.js";

export const PROJECT_DOCUMENTS = { claude: "CLAUDE.md", codex: "AGENTS.md", gemini: "GEMINI.md" } as const;
const MAX_BYTES = 512 * 1024;
const pending = new Map<string, Promise<unknown>>();

/** A read never migrates files. Legacy context is included in the editor until
 * the user saves it into the document; clearing the sidecar happens LAST. */
export function mergeProjectContext(document: string, instructions: string, title: string): string {
  const extra = instructions.trim();
  if (!extra || document.includes(extra)) return document;
  return document.trim() ? `## Contexto del proyecto: ${title.replace(/[\r\n]/g, " ")}\n\n${extra}\n\n${document}` : instructions;
}

export async function projectDocumentPath(executor: Executor, project: AssistantProject, op: "read" | "write") {
  const base = project.path.trim();
  if (!base.startsWith("/") || base.includes("\0")) throw new ValidationError("Guarda un directorio de trabajo absoluto antes de editar el documento.");
  const rel = PROJECT_DOCUMENTS[project.provider] ?? PROJECT_DOCUMENTS.claude;
  const requested = posix.join(base, rel);
  const result = await executor.exec(`realpath -zm -- ${quoteArg(base)} ${quoteArg(requested)}`, { timeoutMs: 10000 });
  const [root, target] = result.stdout.split("\0");
  if (result.exitCode !== 0 || !root?.startsWith("/") || !target?.startsWith("/") || !(target.startsWith(root === "/" ? "/" : root + "/"))) {
    throw new ForbiddenError("No se pudo verificar que el documento esté dentro del proyecto.");
  }
  const user = getContextUser();
  if (![requested, target].every(p => pathInFileJail(p) && (!user || canAccessPath(user, p, op)))) {
    throw new ForbiddenError("No tienes acceso al documento del proyecto.");
  }
  return { rel, target, root };
}

async function readDocument(executor: Executor, target: string): Promise<string> {
  // Distinguish a missing file from unreadable files / transport failures.
  const probe = await executor.exec(`if [ -f ${quoteArg(target)} ]; then wc -c < ${quoteArg(target)}; elif [ ! -e ${quoteArg(target)} ] && [ -d ${quoteArg(posix.dirname(target))} ] && [ -x ${quoteArg(posix.dirname(target))} ]; then printf missing; else exit 1; fi`, { timeoutMs: 10000 });
  if (probe.exitCode !== 0) throw new ValidationError("No se pudo leer el documento del proyecto.");
  if (probe.stdout === "missing") return "";
  if (!/^\s*\d+\s*$/.test(probe.stdout) || Number(probe.stdout) > MAX_BYTES) throw new ValidationError("El documento supera el límite de 512 KB.");
  return String(await executor.readFile(target, "utf8"));
}

export const projectDocumentService = {
  async read(executor: Executor, project: AssistantProject) {
    const { rel, target } = await projectDocumentPath(executor, project, "read");
    const document = await readDocument(executor, target);
    const revision = createHash("sha256").update(JSON.stringify([executor.target.id, project.id, project.path, project.provider, target, document, project.instructions])).digest("hex");
    return { rel, content: mergeProjectContext(document, project.instructions, project.title), needsMigration: !document || !!project.instructions.trim(), revision, path: project.path, provider: project.provider };
  },

  async save(executor: Executor, project: AssistantProject, content: string, revision: string) {
    if (Buffer.byteLength(content, "utf8") > MAX_BYTES) throw new ValidationError("El documento supera el límite de 512 KB.");
    const { target } = await projectDocumentPath(executor, project, "write");
    const key = `${executor.target.id}:${target}`;
    const previous = pending.get(key) ?? Promise.resolve();
    const work = previous.catch(() => undefined).then(async () => {
      const fresh = await projectsRepository.get(executor, project.id!);
      if (!fresh) throw new ConflictError("El proyecto ya no existe.");
      const current = await this.read(executor, fresh);
      if (current.revision !== revision) throw new ConflictError("El contexto cambió. Vuelve a abrirlo y revisa los cambios antes de guardar.");
      await projectDocumentPath(executor, fresh, "write");
      const { projectStructureService } = await import("./project-structure/project-structure.service.js");
      await projectStructureService.writeFile(executor, fresh, current.rel, content);
      // No shadow copy: subsequent edits in CLI, Structure or Obsidian are read live.
      await projectsRepository.update(executor, project.id!, { instructions: "" });
      return this.read(executor, { ...fresh, instructions: "" });
    });
    pending.set(key, work);
    try { return await work; } finally { if (pending.get(key) === work) pending.delete(key); }
  },

  async prompt(executor: Executor | undefined, project: AssistantProject): Promise<string> {
    if (!executor || !project.path) return project.instructions;
    const document = await this.read(executor, project);
    return `Documento de contexto: ${posix.join(project.path, document.rel)}. Consulta el archivo completo si el extracto está truncado.\n\n${document.content}`;
  },
};
