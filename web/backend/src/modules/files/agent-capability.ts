// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Files — AI agent capability.
 *
 * Read + write tools on the target's filesystem via the request's executor.
 * Reuses the Files module's services (content search, project detection,
 * malware scan, permissions) and the same executor mutations the HTTP
 * controllers perform (snapshot capture + cache invalidation), so the
 * assistant manipulates files exactly like the panel UI does.
 *
 * Permission model — every tool declares the SAME `files.*` action slug its
 * HTTP route requires. `assistantModulesService.allowedTools` only exposes a
 * tool to a non-admin whose Linux groups actually grant that action, so the
 * assistant's toolbox matches the user's group permissions. On top of that,
 * each handler re-checks the per-group PATH policy (`canAccessPath`) against
 * the pinned request user — the agent can't read/write outside the user's
 * allowed paths even if the model is asked to. Admin / internal runs (no user
 * in context) are unrestricted, matching the HTTP layer.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { getContextUser, pathInFileJail, quoteCmd, type Executor } from "../../shared/executor/index.js";
import { dirOf, isAbsoluteUnixPath, normalizeAbsPath } from "../../shared/utils/posix-path.js";
import { canAccessPath } from "../../shared/auth/role-permissions.js";
import { invalidateDir, invalidateFile, invalidateStat } from "../../shared/files-cache/index.js";
import {
  contentSearchService,
  projectTypeService,
  malwareService,
  permissionsService,
  snapshotService,
} from "./services/index.js";

const READ_MAX_BYTES = 65_536; // 64 KiB
const WRITE_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB — mirrors the editor's read cap

/** Fire-and-forget cache invalidation for a path's dir entry, file, and stat. */
function invalidateAround(executor: Executor, path: string): void {
  void invalidateDir(executor, path);
  void invalidateFile(executor, path);
  void invalidateStat(executor, path);
}

/**
 * Enforce the pinned request user's per-group path policy. Returns a denial
 * message to surface to the model, or `null` when allowed. No user in context
 * (admin / internal run) → unrestricted, matching the HTTP middleware and the
 * pre-existing read tools.
 */
function pathDenied(path: string, op: "read" | "write"): string | null {
  // File jail (agent/project working dirs) — applies to EVERYONE, including
  // admins, and only ever narrows access. Set for assistant runs bound to an
  // agent/project that declares working directories.
  if (!pathInFileJail(path)) {
    return `Acceso denegado: este agente sólo puede acceder a archivos dentro de sus rutas de trabajo configuradas ('${path}' queda fuera).`;
  }
  const user = getContextUser();
  if (!user) return null;
  if (canAccessPath(user, path, op)) return null;
  return `Acceso denegado: la política de tu grupo no permite ${
    op === "write" ? "escribir" : "leer"
  } en '${path}'.`;
}

export const filesAgentCapability: AgentCapability = {
  moduleId: "files",
  version: 1,
  tools: [
    {
      name: "files.read",
      title: "Leer archivo",
      description:
        "Read up to 64KB of a file on the connected target by absolute path. " +
        "Larger files are truncated.",
      kind: "read",
      permission: "files.read",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path of the file to read" },
        },
        required: ["path"],
      },
      handler: async (input) => {
        const raw = String((input as { path?: unknown })?.path ?? "");
        if (!isAbsoluteUnixPath(raw)) return { ok: false, output: "Ruta inválida" };
        const path = normalizeAbsPath(raw);
        const denied = pathDenied(path, "read");
        if (denied) return { ok: false, output: denied };
        const executor = requireExecutor();
        try {
          const r = await executor.readFile(path, "utf8");
          const text = typeof r === "string" ? r : r.toString("utf8");
          const truncated = text.length > READ_MAX_BYTES;
          return {
            ok: true,
            output: truncated ? text.slice(0, READ_MAX_BYTES) + "\n…(truncated)" : text,
          };
        } catch (err) {
          return { ok: false, output: (err as Error).message };
        }
      },
    },
    {
      name: "files.list_dir",
      title: "Listar directorio",
      description:
        "List entries of a directory on the target. Returns names with type (file/dir/symlink).",
      kind: "read",
      permission: "files.view",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute directory path" },
        },
        required: ["path"],
      },
      handler: async (input) => {
        const raw = String((input as { path?: unknown })?.path ?? "");
        if (!isAbsoluteUnixPath(raw)) return { ok: false, output: "Ruta inválida" };
        const path = normalizeAbsPath(raw);
        const denied = pathDenied(path, "read");
        if (denied) return { ok: false, output: denied };
        const executor = requireExecutor();
        try {
          const entries = await executor.readdir(path);
          const compact = entries.map((e) => ({
            name: e.name,
            type: e.type,
            size: e.size,
            mode: e.mode,
          }));
          return { ok: true, output: compact };
        } catch (err) {
          return { ok: false, output: (err as Error).message };
        }
      },
    },
    {
      name: "files.grep",
      title: "Buscar en archivos",
      description:
        "Search file CONTENTS recursively under an absolute path. mode='text' (literal, default) " +
        "or 'regex' (POSIX ERE). Returns matches grouped by file with line numbers. Use it to find " +
        "hardcoded keys, old domains, function/variable usages, TODOs, etc.",
      kind: "read",
      permission: "files.search",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute directory to search under" },
          query: { type: "string", description: "Text or regex to search for" },
          mode: { type: "string", enum: ["text", "regex"], description: "Match mode (default text)" },
        },
        required: ["path", "query"],
      },
      handler: async (input) => {
        const i = (input ?? {}) as { path?: unknown; query?: unknown; mode?: unknown };
        const raw = String(i.path ?? "");
        if (!isAbsoluteUnixPath(raw)) return { ok: false, output: "Ruta inválida" };
        const path = normalizeAbsPath(raw);
        const denied = pathDenied(path, "read");
        if (denied) return { ok: false, output: denied };
        const executor = requireExecutor();
        try {
          const res = await contentSearchService.search(executor, {
            path,
            query: String(i.query ?? ""),
            mode: i.mode === "regex" ? "regex" : "text",
            maxResults: 200,
          });
          return { ok: true, output: { totalMatches: res.totalMatches, truncated: res.truncated, files: res.files } };
        } catch (err) {
          return { ok: false, output: (err as Error).message };
        }
      },
    },
    {
      name: "files.project_info",
      title: "Detectar tipo de proyecto",
      description:
        "Detect the stack of a directory (Laravel/WordPress/Next/Nuxt/Vue/React/Node/Django/Python/PHP) " +
        "and return a logical map (public root, config, routes, views, logs, deps…). Use it to orient " +
        "before reviewing or refactoring a project.",
      kind: "read",
      permission: "files.projects",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "Absolute directory of the project" } },
        required: ["path"],
      },
      handler: async (input) => {
        const raw = String((input as { path?: unknown })?.path ?? "");
        if (!isAbsoluteUnixPath(raw)) return { ok: false, output: "Ruta inválida" };
        const path = normalizeAbsPath(raw);
        const denied = pathDenied(path, "read");
        if (denied) return { ok: false, output: denied };
        try {
          return { ok: true, output: await projectTypeService.detect(requireExecutor(), path) };
        } catch (err) {
          return { ok: false, output: (err as Error).message };
        }
      },
    },
    {
      name: "files.security_scan",
      title: "Escaneo heurístico de seguridad",
      description:
        "Heuristic malware/suspicious-code scan of a path: flags eval/base64/webshell patterns, " +
        "command execution, PHP inside upload dirs, etc., with a reason and risk per finding. " +
        "Read-only — quarantine/delete are separate actions.",
      kind: "read",
      permission: "files.security",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "Absolute file or directory to scan" } },
        required: ["path"],
      },
      handler: async (input) => {
        const raw = String((input as { path?: unknown })?.path ?? "");
        if (!isAbsoluteUnixPath(raw)) return { ok: false, output: "Ruta inválida" };
        const path = normalizeAbsPath(raw);
        const denied = pathDenied(path, "read");
        if (denied) return { ok: false, output: denied };
        try {
          return { ok: true, output: await malwareService.scan(requireExecutor(), path) };
        } catch (err) {
          return { ok: false, output: (err as Error).message };
        }
      },
    },

    // ──────────────────────────── Mutations ────────────────────────────
    // Each mirrors the matching files HTTP controller: pre-mutation snapshot
    // (non-fatal, restorable) + executor mutation + cache invalidation so the
    // file manager UI reflects the change. `kind: "action"` ⇒ dangerous ⇒ the
    // chat asks the user to confirm before the call runs.
    {
      name: "files.write",
      title: "Escribir archivo",
      description:
        "Write (create or overwrite) a text file on the target by absolute path. The previous " +
        "state is snapshotted first so the change is restorable. Max 2MB of content.",
      kind: "action",
      permission: "files.write",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path of the file to write" },
          content: { type: "string", description: "Full new text content of the file" },
        },
        required: ["path", "content"],
      },
      handler: async (input) => {
        const i = (input ?? {}) as { path?: unknown; content?: unknown };
        const raw = String(i.path ?? "");
        const content = String(i.content ?? "");
        if (!isAbsoluteUnixPath(raw)) return { ok: false, output: "Ruta inválida" };
        const path = normalizeAbsPath(raw);
        if (content.length > WRITE_MAX_BYTES) return { ok: false, output: "Contenido demasiado grande (máx 2MB)" };
        const denied = pathDenied(path, "write");
        if (denied) return { ok: false, output: denied };
        const executor = requireExecutor();
        try {
          await snapshotService.capture(executor, path, "edit");
          await executor.writeFile(path, content, { encoding: "utf8" });
          invalidateAround(executor, path);
          return { ok: true, output: `Escrito ${content.length} bytes en ${path}` };
        } catch (err) {
          return { ok: false, output: (err as Error).message };
        }
      },
    },
    {
      name: "files.mkdir",
      title: "Crear carpeta",
      description: "Create a directory (and any missing parents) on the target by absolute path.",
      kind: "action",
      permission: "files.create",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "Absolute directory path to create" } },
        required: ["path"],
      },
      handler: async (input) => {
        const raw = String((input as { path?: unknown })?.path ?? "");
        if (!isAbsoluteUnixPath(raw)) return { ok: false, output: "Ruta inválida" };
        const path = normalizeAbsPath(raw);
        const denied = pathDenied(path, "write");
        if (denied) return { ok: false, output: denied };
        const executor = requireExecutor();
        try {
          await executor.mkdir(path, { recursive: true });
          void invalidateDir(executor, path);
          return { ok: true, output: `Carpeta creada: ${path}` };
        } catch (err) {
          return { ok: false, output: (err as Error).message };
        }
      },
    },
    {
      name: "files.delete",
      title: "Eliminar archivo o carpeta",
      description:
        "Delete a file or directory on the target by absolute path. Set recursive=true to remove a " +
        "non-empty directory. The path is snapshotted first so the deletion is restorable.",
      kind: "action",
      permission: "files.delete",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path to delete" },
          recursive: { type: "boolean", description: "Remove directory contents recursively (default false)" },
        },
        required: ["path"],
      },
      handler: async (input) => {
        const i = (input ?? {}) as { path?: unknown; recursive?: unknown };
        const raw = String(i.path ?? "");
        const recursive = i.recursive === true;
        if (!isAbsoluteUnixPath(raw)) return { ok: false, output: "Ruta inválida" };
        const path = normalizeAbsPath(raw);
        const denied = pathDenied(path, "write");
        if (denied) return { ok: false, output: denied };
        const executor = requireExecutor();
        try {
          await snapshotService.capture(executor, path, "delete");
          if (recursive) {
            await executor.exec(quoteCmd("rm", ["-rf", path]));
          } else {
            await executor.unlink(path);
          }
          invalidateAround(executor, path);
          return { ok: true, output: `Eliminado: ${path}` };
        } catch (err) {
          return { ok: false, output: (err as Error).message };
        }
      },
    },
    {
      name: "files.rename",
      title: "Renombrar o mover",
      description:
        "Rename or move a path on the target within the filesystem. The source is snapshotted first.",
      kind: "action",
      permission: "files.rename",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string", description: "Absolute source path" },
          to: { type: "string", description: "Absolute destination path" },
        },
        required: ["from", "to"],
      },
      handler: async (input) => {
        const i = (input ?? {}) as { from?: unknown; to?: unknown };
        const rawFrom = String(i.from ?? "");
        const rawTo = String(i.to ?? "");
        if (!isAbsoluteUnixPath(rawFrom) || !isAbsoluteUnixPath(rawTo)) return { ok: false, output: "Ruta inválida" };
        const from = normalizeAbsPath(rawFrom);
        const to = normalizeAbsPath(rawTo);
        const deniedFrom = pathDenied(from, "write");
        if (deniedFrom) return { ok: false, output: deniedFrom };
        const deniedTo = pathDenied(to, "write");
        if (deniedTo) return { ok: false, output: deniedTo };
        const executor = requireExecutor();
        try {
          await snapshotService.capture(executor, from, "move");
          await executor.rename(from, to);
          void invalidateDir(executor, from);
          if (dirOf(from) !== dirOf(to)) void invalidateDir(executor, to);
          void invalidateFile(executor, from);
          void invalidateFile(executor, to);
          void invalidateStat(executor, from);
          void invalidateStat(executor, to);
          return { ok: true, output: `Movido ${from} → ${to}` };
        } catch (err) {
          return { ok: false, output: (err as Error).message };
        }
      },
    },
    {
      name: "files.copy",
      title: "Copiar archivo",
      description:
        "Copy a file on the target to a new absolute path. The destination is snapshotted first " +
        "in case it is overwritten.",
      kind: "action",
      permission: "files.copy",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string", description: "Absolute source file path" },
          to: { type: "string", description: "Absolute destination path" },
        },
        required: ["from", "to"],
      },
      handler: async (input) => {
        const i = (input ?? {}) as { from?: unknown; to?: unknown };
        const rawFrom = String(i.from ?? "");
        const rawTo = String(i.to ?? "");
        if (!isAbsoluteUnixPath(rawFrom) || !isAbsoluteUnixPath(rawTo)) return { ok: false, output: "Ruta inválida" };
        const from = normalizeAbsPath(rawFrom);
        const to = normalizeAbsPath(rawTo);
        const deniedFrom = pathDenied(from, "read");
        if (deniedFrom) return { ok: false, output: deniedFrom };
        const deniedTo = pathDenied(to, "write");
        if (deniedTo) return { ok: false, output: deniedTo };
        const executor = requireExecutor();
        try {
          await snapshotService.capture(executor, to, "copy");
          const content = await executor.readFile(from);
          await executor.writeFile(to, content);
          invalidateAround(executor, to);
          return { ok: true, output: `Copiado ${from} → ${to}` };
        } catch (err) {
          return { ok: false, output: (err as Error).message };
        }
      },
    },
    {
      name: "files.chmod",
      title: "Cambiar permisos (chmod)",
      description:
        "Change a path's Unix permission bits on the target. mode is an octal string like '644' or '755'. " +
        "The previous mode is snapshotted first.",
      kind: "action",
      permission: "files.chmod",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path" },
          mode: { type: "string", description: "Octal mode, e.g. '644' or '0755'" },
        },
        required: ["path", "mode"],
      },
      handler: async (input) => {
        const i = (input ?? {}) as { path?: unknown; mode?: unknown };
        const raw = String(i.path ?? "");
        const mode = String(i.mode ?? "");
        if (!isAbsoluteUnixPath(raw)) return { ok: false, output: "Ruta inválida" };
        const path = normalizeAbsPath(raw);
        if (!/^[0-7]{3,4}$/.test(mode)) return { ok: false, output: "Modo inválido (usa octal, p.ej. 644)" };
        const denied = pathDenied(path, "write");
        if (denied) return { ok: false, output: denied };
        const executor = requireExecutor();
        try {
          await snapshotService.capture(executor, path, "chmod");
          await permissionsService.chmodWithExecutor(path, mode, executor);
          void invalidateDir(executor, path);
          void invalidateStat(executor, path);
          return { ok: true, output: `chmod ${mode} ${path}` };
        } catch (err) {
          return { ok: false, output: (err as Error).message };
        }
      },
    },
    {
      name: "files.chown",
      title: "Cambiar propietario (chown)",
      description:
        "Change a path's owner (and optionally group) on the target. Runs with sudo. " +
        "owner is a username; group is optional.",
      kind: "action",
      permission: "files.chown",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path" },
          owner: { type: "string", description: "New owner username" },
          group: { type: "string", description: "New group name (optional)" },
        },
        required: ["path", "owner"],
      },
      handler: async (input) => {
        const i = (input ?? {}) as { path?: unknown; owner?: unknown; group?: unknown };
        const raw = String(i.path ?? "");
        const owner = String(i.owner ?? "");
        const group = i.group != null && String(i.group).length > 0 ? String(i.group) : undefined;
        if (!isAbsoluteUnixPath(raw)) return { ok: false, output: "Ruta inválida" };
        const path = normalizeAbsPath(raw);
        if (!/^[A-Za-z0-9._-]+$/.test(owner)) return { ok: false, output: "Propietario inválido" };
        if (group && !/^[A-Za-z0-9._-]+$/.test(group)) return { ok: false, output: "Grupo inválido" };
        const denied = pathDenied(path, "write");
        if (denied) return { ok: false, output: denied };
        const executor = requireExecutor();
        try {
          await permissionsService.chownWithExecutor(path, owner, group, executor);
          void invalidateDir(executor, path);
          void invalidateStat(executor, path);
          return { ok: true, output: `chown ${owner}${group ? ":" + group : ""} ${path}` };
        } catch (err) {
          return { ok: false, output: (err as Error).message };
        }
      },
    },
  ],
  suggestedPrompts: [
    "Revisa la estructura del proyecto en esta carpeta",
    "Busca claves o tokens quemados en el código",
    "¿Hay archivos sospechosos o webshells aquí?",
  ],
};
