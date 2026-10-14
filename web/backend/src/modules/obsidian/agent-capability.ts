/**
 * Obsidian — AI agent capability.
 *
 * Read tools for vault/note discovery plus guarded write tools so the
 * assistant can capture knowledge straight into the user's vault. Every tool
 * name is prefixed `obsidian.` (the registry throws otherwise). Handlers run
 * inside the assistant request scope; the target executor is implicit via
 * `requireExecutor()`.
 *
 * Path gate — same double-gate as the Files module: on top of the assistant's
 * own permission model, each handler re-checks the pinned request user's
 * per-group PATH policy (`canAccessPath`) against the absolute path being
 * touched. Admin / internal runs (no user in context) are unrestricted,
 * matching the HTTP layer.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { getContextUser } from "../../shared/executor/index.js";
import { canAccessPath } from "../../shared/auth/role-permissions.js";
import { obsidianService } from "./services/obsidian.service.js";
import { contextContainerService } from "./services/context-container.service.js";
import { resolveRel } from "./services/path-util.js";
import { physicalNotePath } from "./services/physical-path.js";

/**
 * Enforce the pinned request user's per-group path policy. Returns a denial
 * message to surface to the model, or `null` when allowed. No user in context
 * (admin / internal run) → unrestricted, matching the HTTP middleware.
 */
function pathDenied(path: string, op: "read" | "write"): string | null {
  const user = getContextUser();
  if (!user) return null;
  if (canAccessPath(user, path, op)) return null;
  return `Acceso denegado: la política de tu grupo no permite ${
    op === "write" ? "escribir" : "leer"
  } en '${path}'.`;
}

/**
 * Wrap a tool body so a thrown error becomes `{ ok: false, output: message }`
 * and a returned value becomes `{ ok: true, output }` — the contract every
 * handler shares.
 */
function toolResult(
  fn: (input: unknown) => Promise<unknown>,
): (input: unknown) => Promise<{ ok: boolean; output: unknown }> {
  return async (input) => {
    try {
      return { ok: true, output: await fn(input) };
    } catch (err) {
      return { ok: false, output: (err as Error).message };
    }
  };
}

function str(input: unknown, key: string): string {
  return String((input as Record<string, unknown>)?.[key] ?? "").trim();
}

function optStr(input: unknown, key: string): string | undefined {
  const v = (input as Record<string, unknown>)?.[key];
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}

/**
 * Resolve the `vault` tool argument (id or case-insensitive name) and gate
 * the path the tool is about to touch. `rel` narrows the gate to the exact
 * note path; without it the vault root is checked.
 */
async function resolveGatedVault(input: unknown, op: "read" | "write", rel?: string) {
  const ref = str(input, "vault");
  if (!ref) throw new Error("Falta el parámetro 'vault' (id o nombre del vault).");
  const executor = requireExecutor();
  const vault = await obsidianService.resolveVaultRef(executor, ref);
  const gatePath = rel ? resolveRel(vault.path, rel) : vault.path;
  const denied = pathDenied(gatePath, op);
  if (denied) throw new Error(denied);
  if (rel) {
    const physical = await physicalNotePath(executor, vault.path, rel);
    const physicalDenied = pathDenied(physical.root, op) ?? pathDenied(physical.target, op);
    if (physicalDenied) throw new Error(physicalDenied);
  }
  return { executor, vault };
}

export const obsidianAgentCapability: AgentCapability = {
  moduleId: "obsidian",
  version: 1,
  tools: [
    {
      name: "obsidian.list_vaults",
      title: "Listar vaults",
      description:
        "List the Obsidian vaults registered on the connected server, with their absolute path, whether the directory exists and the markdown note count.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: toolResult(async () => {
        const executor = requireExecutor();
        const user = getContextUser();
        const vaults = await obsidianService.listVaults(executor);
        return user ? vaults.filter((v) => canAccessPath(user, v.path, "read")) : vaults;
      }),
    },
    {
      name: "obsidian.list_notes",
      title: "Listar notas",
      description:
        "List the notes (*.md, *.canvas) of a vault with size and last-modified time. Pass vault by name or id; optionally restrict to one folder (vault-relative path).",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: {
          vault: { type: "string", description: "Vault name or id" },
          folder: {
            type: "string",
            description: "Optional vault-relative folder to list (recursive)",
          },
        },
        required: ["vault"],
      },
      handler: toolResult(async (input) => {
        const { executor, vault } = await resolveGatedVault(input, "read");
        const user = getContextUser();
        const folder = optStr(input, "folder");
        if (folder) {
          const denied = pathDenied(resolveRel(vault.path, folder), "read");
          if (denied) throw new Error(denied);
        }
        const notes = await obsidianService.listNotes(executor, vault, folder);
        return user ? notes.filter((n) => canAccessPath(user, resolveRel(vault.path, n.path), "read")) : notes;
      }),
    },
    {
      name: "obsidian.read_note",
      title: "Leer nota",
      description:
        "Read the full content of one note. Pass the vault (name or id) and the note path relative to the vault root, e.g. 'Proyectos/servidor.md'.",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: {
          vault: { type: "string", description: "Vault name or id" },
          path: { type: "string", description: "Note path relative to the vault root" },
        },
        required: ["vault", "path"],
      },
      handler: toolResult(async (input) => {
        const path = str(input, "path");
        const { executor, vault } = await resolveGatedVault(input, "read", path);
        return obsidianService.readNote(executor, vault, path);
      }),
    },
    {
      name: "obsidian.search_notes",
      title: "Buscar en notas",
      description:
        "Search the vault's notes for a literal text and return matches with note path, line number and the matching line. Use it to find existing notes before creating new ones.",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: {
          vault: { type: "string", description: "Vault name or id" },
          query: { type: "string", description: "Literal text to search for" },
        },
        required: ["vault", "query"],
      },
      handler: toolResult(async (input) => {
        const query = str(input, "query");
        if (!query) throw new Error("Falta el parámetro 'query'.");
        const { executor, vault } = await resolveGatedVault(input, "read");
        const hits = await obsidianService.search(executor, vault, query.slice(0, 256));
        const user = getContextUser();
        return user ? hits.filter((h) => canAccessPath(user, resolveRel(vault.path, h.path), "read")) : hits;
      }),
    },
    {
      name: "obsidian.backlinks",
      title: "Backlinks de una nota",
      description:
        "Get the wikilink graph around one note: the [[targets]] it references (outgoing) and the notes that link back to it (backlinks).",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: {
          vault: { type: "string", description: "Vault name or id" },
          path: { type: "string", description: "Note path relative to the vault root" },
        },
        required: ["vault", "path"],
      },
      handler: toolResult(async (input) => {
        const path = str(input, "path");
        const { executor, vault } = await resolveGatedVault(input, "read", path);
        const links = await obsidianService.links(executor, vault, path);
        const user = getContextUser();
        return user ? { ...links, backlinks: links.backlinks.filter((h) => canAccessPath(user, resolveRel(vault.path, h.path), "read")) } : links;
      }),
    },
    {
      name: "obsidian.write_note",
      // Gate writes by the same action grant as the Files module (the vault
      // lives on the filesystem); path policy still re-checks per-vault access.
      permission: "files.write",
      title: "Escribir nota",
      description:
        "Create or OVERWRITE a note with the given markdown content. Parent folders are created automatically. Allowed extensions: .md, .canvas, .txt. Prefer obsidian.append_note when adding to an existing note.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          vault: { type: "string", description: "Vault name or id" },
          path: { type: "string", description: "Note path relative to the vault root" },
          content: { type: "string", description: "Full note content (markdown)" },
        },
        required: ["vault", "path", "content"],
      },
      handler: toolResult(async (input) => {
        const path = str(input, "path");
        const content = String((input as Record<string, unknown>)?.content ?? "");
        const { executor, vault } = await resolveGatedVault(input, "write", path);
        return obsidianService.writeNote(executor, vault, path, content);
      }),
    },
    {
      name: "obsidian.append_note",
      permission: "files.write",
      title: "Anexar a nota",
      description:
        "Append content to the end of a note (a newline is inserted before it). Creates the note when it does not exist. Non-destructive — existing content is preserved.",
      kind: "action",
      dangerous: false,
      inputSchema: {
        type: "object",
        properties: {
          vault: { type: "string", description: "Vault name or id" },
          path: { type: "string", description: "Note path relative to the vault root" },
          content: { type: "string", description: "Content to append (markdown)" },
        },
        required: ["vault", "path", "content"],
      },
      handler: toolResult(async (input) => {
        const path = str(input, "path");
        const content = String((input as Record<string, unknown>)?.content ?? "");
        const { executor, vault } = await resolveGatedVault(input, "write", path);
        return obsidianService.appendNote(executor, vault, path, content);
      }),
    },
    {
      name: "obsidian.daily_note",
      permission: "files.write",
      title: "Nota diaria",
      description:
        "Append content to the vault's daily note 'Daily/YYYY-MM-DD.md', creating it when missing. Defaults to TODAY on the connected server; pass date='YYYY-MM-DD' for another day.",
      kind: "action",
      dangerous: false,
      inputSchema: {
        type: "object",
        properties: {
          vault: { type: "string", description: "Vault name or id" },
          content: { type: "string", description: "Content to append (markdown)" },
          date: {
            type: "string",
            description: "Optional date YYYY-MM-DD; defaults to the server's current date",
          },
        },
        required: ["vault", "content"],
      },
      handler: toolResult(async (input) => {
        const content = String((input as Record<string, unknown>)?.content ?? "");
        // Resolve the effective date FIRST (explicit arg or the client
        // server's today) so the path gate checks the EXACT
        // `Daily/<date>.md` target — never the vault root, where a
        // more-specific per-group deny/read-only rule on Daily/ would be
        // bypassed by prefix matching.
        const day = await obsidianService.resolveDailyDate(requireExecutor(), optStr(input, "date"));
        const { executor, vault } = await resolveGatedVault(input, "write", `Daily/${day}.md`);
        return obsidianService.dailyNote(executor, vault, content, day);
      }),
    },
    {
      name: "obsidian.delete_note",
      permission: "files.delete",
      title: "Eliminar nota",
      description:
        "Delete one note file from the vault. Irreversible — confirm the exact path first with obsidian.list_notes or obsidian.search_notes.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          vault: { type: "string", description: "Vault name or id" },
          path: { type: "string", description: "Note path relative to the vault root" },
        },
        required: ["vault", "path"],
      },
      handler: toolResult(async (input) => {
        const path = str(input, "path");
        const { executor, vault } = await resolveGatedVault(input, "write", path);
        await obsidianService.deleteNote(executor, vault, path);
        return { deleted: path };
      }),
    },
    {
      name: "obsidian.list_containers",
      title: "Listar contenedores de contexto",
      description:
        "List the auto-provisioned context containers (one per GitHub repo, assistant project and loose chat). Each item gives kind, name, refKey, the vault id/name to use with the other obsidian.* tools, and the absolute vault path. Use it to find WHERE to read/write the context (Contexto/Decisiones/Comandos/Errores/Reglas notes) for a given repo, project or chat.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: toolResult(async () => {
        const executor = requireExecutor();
        const user = getContextUser();
        const containers = await contextContainerService.listContainers(executor);
        return user ? containers.filter((c) => canAccessPath(user, c.path, "read")) : containers;
      }),
    },
    {
      name: "obsidian.sync_containers",
      permission: "files.write",
      title: "Sincronizar contenedores de contexto",
      description:
        "Create a context container (a notes vault under ~/luxipanel-context) for every GitHub repo on the server, every assistant project and every loose chat that doesn't have one yet. Seeds the Contexto/Decisiones/Comandos/Errores/Reglas notes and, for repos, a pointer in the repo's CLAUDE.md/AGENTS.md/GEMINI.md. Idempotent — existing containers are left untouched. Returns a summary with counts.",
      kind: "action",
      dangerous: false,
      inputSchema: { type: "object", properties: {} },
      handler: toolResult(async () => {
        const user = getContextUser();
        if (user && user.kind !== "admin") throw new Error("Solo un administrador puede sincronizar contenedores.");
        const executor = requireExecutor();
        return contextContainerService.syncAll(executor, { includeChats: true });
      }),
    },
  ],
  dataPanels: [
    {
      name: "obsidian.vaults_summary",
      title: "Resumen de vaults",
      description:
        "Registered Obsidian vaults on the connected server with their path, existence and markdown note count.",
      ttlSeconds: 300,
      collect: async () => {
        const executor = requireExecutor();
        const vaults = await obsidianService.listVaults(executor);
        return { vaults };
      },
    },
  ],
  suggestedPrompts: [
    "Crea una nota en mi vault con el resumen del estado del servidor",
    "Busca en mis notas qué documenté sobre nginx y dame los enlaces",
    "Añade a la nota diaria de hoy lo que acabamos de hacer en el servidor",
  ],
};
