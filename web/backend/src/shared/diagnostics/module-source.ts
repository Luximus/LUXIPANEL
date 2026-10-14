import path from "node:path";
import type { Executor } from "../executor/types.js";
import type { SessionUser } from "../types/index.js";
import { dataStore } from "../data-store/index.js";
import { marketplaceLinkRepository } from "../marketplace-link/index.js";
import { canAccessPath } from "../auth/role-permissions.js";
import { pathInFileJail } from "../executor/context.js";
import { quoteArg } from "../executor/index.js";
import { assertPublishableSource } from "./publication-check.js";
export interface ModuleSource { files: Record<string, string> }
/** Read only a verified owned project's module through its selected Executor. */
export async function snapshotModuleSource(executor: Executor, user: SessionUser, id: string): Promise<ModuleSource | undefined> {
  if (!/^[a-z][a-z0-9-]{2,38}$/.test(id)) throw new Error("Módulo inválido");
  const link = await marketplaceLinkRepository.getByModuleId(executor, id); if (!link) return;
  const project = await dataStore<{ ownerId?: number; path?: string }>(executor, "assistant", "projects", { idStrategy: "uuid" }).get(link.projectId);
  if ((project?.ownerId ?? link.ownerUserId) !== user.userId) return;
  const directory = path.join(link.projectPath, "modules", id);
  if (!canAccessPath(user, directory, "read") || !pathInFileJail(directory)) throw new Error("Proyecto fuera del acceso autorizado");
  const real = await executor.exec(`realpath -e -- ${quoteArg(directory)}`, { timeoutMs: 5000 });
  if (real.exitCode !== 0) return;
  if (real.stdout.trim() !== directory) throw new Error("El módulo contiene un enlace fuera del proyecto");
  const files: Record<string, string> = {}; let bytes = 0;
  async function walk(dir: string, prefix = ""): Promise<void> {
    for (const entry of await executor.readdir(dir)) {
      if (entry.name.startsWith(".") || /^(?:\.env(?:\.|$)|\.git|node_modules|dist|\.cache)|\.(?:pem|key|log|ndjson|sqlite|db)$/i.test(entry.name)) continue;
      if (entry.type === "symlink") throw new Error("El código del módulo contiene enlaces");
      const name = prefix + entry.name;
      if (entry.isDir) { await walk(path.join(dir, entry.name), name + "/"); continue; }
      if (entry.size > 2 * 1024 * 1024 || bytes + entry.size > 8 * 1024 * 1024 || Object.keys(files).length >= 500) throw new Error("El código del módulo supera el tamaño permitido");
      const content = String(await executor.readFile(path.join(dir, entry.name), "utf8"));
      if (content.includes("\0")) throw new Error("El aporte debe contener archivos de texto");
      assertPublishableSource(content); files[name] = content; bytes += Buffer.byteLength(content);
    }
  }
  await walk(directory);
  if (JSON.parse(files["module.manifest.json"] || "{}").id !== id) throw new Error("Manifiesto del proyecto incompatible");
  return { files };
}
