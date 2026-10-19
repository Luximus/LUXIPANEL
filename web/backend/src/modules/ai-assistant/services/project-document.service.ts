// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { createHash } from "node:crypto";
import { posix } from "node:path";
import type { Executor } from "../../../shared/executor/index.js";
import { ConflictError, ValidationError } from "../../../shared/errors/index.js";
import { projectsRepository, type AssistantProject } from "../repositories/projects.repository.js";
import { PROJECT_DOCUMENTS, projectStorageOperation } from "./project-storage.service.js";
export { PROJECT_DOCUMENTS } from "./project-storage.service.js";
const pending = new Map<string, Promise<unknown>>();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function mergeProjectContext(document: string, instructions: string, _title: string): string {
  const extra = instructions.trim();
  return !extra || document.includes(extra) ? document : `${extra}\n\n${document}`;
}

/** Compatibility contract for Obsidian: callers migrate explicitly before registering. */
export async function projectDocumentPath(executor: Executor, project: AssistantProject, _op: "read" | "write") {
  const snapshot = await projectStorageOperation(executor, project, "read");
  const rel = PROJECT_DOCUMENTS[project.provider];
  return { root: snapshot.root, rel, target: posix.join(snapshot.root, rel) };
}

export const projectDocumentService = {
  async read(executor: Executor, project: AssistantProject) {
    const snapshot = await projectStorageOperation(executor, project, "read");
    const rel = PROJECT_DOCUMENTS[project.provider];
    const content = mergeProjectContext(snapshot.content, project.instructions, project.title);
    const revision = hash(JSON.stringify([executor.target.id, project.id, project.path, project.provider, snapshot.managed, snapshot.content, project.instructions]));
    return { rel, content, needsMigration: !snapshot.managed || !!project.instructions.trim(), revision,
      path: project.path, storagePath: snapshot.storagePath, documentPath: posix.join(snapshot.root || snapshot.storagePath, rel),
      managed: snapshot.managed, contentHash: hash(snapshot.content), provider: project.provider };
  },
  async save(executor: Executor, project: AssistantProject, content: string, revision: string) {
    if (Buffer.byteLength(content) > 512 * 1024) throw new ValidationError("El documento supera el límite de 512 KB.");
    const key = `${executor.target.id}:${project.id}`;
    const previous = pending.get(key) ?? Promise.resolve();
    const work = previous.catch(() => undefined).then(async () => {
      const fresh = await projectsRepository.get(executor, project.id!);
      if (!fresh) throw new ConflictError("El proyecto ya no existe.");
      const current = await this.read(executor, fresh);
      if (current.revision !== revision) throw new ConflictError("El contexto cambió. Vuelve a abrirlo y revisa los cambios antes de guardar.");
      await projectStorageOperation(executor, fresh, "write", current.rel, {
        content, expectedHash: current.managed ? current.contentHash : hash(current.content),
      });
      await projectsRepository.update(executor, project.id!, { instructions: "" });
      return this.read(executor, { ...fresh, instructions: "" });
    });
    pending.set(key, work);
    try { return await work; } finally { if (pending.get(key) === work) pending.delete(key); }
  },
  async prompt(executor: Executor | undefined, project: AssistantProject): Promise<string> {
    if (!executor) return project.instructions;
    const document = await this.read(executor, project);
    return `Documento de contexto: ${document.documentPath}. Consulta el archivo completo si el extracto está truncado.\n\n${document.content}`;
  },
};
