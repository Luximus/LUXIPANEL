// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Project context-vault bridge (read + auto-capture) for the assistant.
 *
 * The Obsidian module auto-provisions a "context vault" per assistant project
 * (refKey `project:<id>`) holding Contexto.md / Decisiones.md / Comandos.md /
 * Errores.md / Reglas.md. This helper lets the assistant:
 *
 *   - B1: READ that vault's Contexto.md + Errores.md to enrich the system
 *     prompt of a run scoped to the project.
 *
 * (B2 auto-capture lives in the obsidian module's listener — that's the write
 * side and it's owned there to keep the dependency one-way.)
 *
 * Dependency rule (managed isolation): ai-assistant must NOT import the
 * obsidian module's services/repos. So we resolve the container index through
 * the SHARED `dataStore` (same per-server `obsidian/containers.json` sidecar
 * the module owns) and read the note files DIRECTLY via the Executor —
 * no obsidian-module code on this path. The container sidecar is the only
 * coupling, by stable on-disk contract, not by import.
 *
 * Everything runs on the CONNECTED server through the request's Executor
 * (per-server isolation). Fail-open everywhere: a missing container/note, or
 * any read/write error, leaves the run untouched.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import { CACHE_KEYS } from "../../../shared/cache/cacheable-modules.js";
import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("ai-project-context-vault");

/** Mirror of the obsidian module's container shape — only the fields we read.
 *  Intentionally NOT imported from the obsidian module (one-way dependency). */
interface ContainerRecord {
  id?: string;
  kind?: string;
  refKey?: string;
  path?: string; // absolute vault directory on the client server
}

/** Total context budget injected into the prompt (always-on, so kept tight;
 *  the agent fetches more on demand via `obsidian.search_notes` — the system
 *  prompt hint already instructs this). */
const MAX_CONTEXT_BYTES = 2000;
/** Per-note read cap so one huge note can't starve the other. */
const MAX_NOTE_READ_BYTES = 8192;

function containersStore(executor?: Executor | null) {
  // Same sidecar the obsidian module writes to: obsidian/containers.json.
  return dataStore<ContainerRecord>(executor, CACHE_KEYS.obsidian.containers.module, CACHE_KEYS.obsidian.containers.collection);
}

/** Resolve the project's context-vault directory (absolute) or null. */
async function resolveVaultDir(
  executor: Executor,
  projectId: string,
): Promise<string | null> {
  try {
    const refKey = `project:${projectId}`;
    const container = await containersStore(executor).find((c) => c.refKey === refKey);
    return container?.path ?? null;
  } catch (err) {
    log.warn({ err: (err as Error).message, projectId }, "vault container lookup failed");
    return null;
  }
}

/** Read one note (≤MAX_NOTE_READ_BYTES). Returns "" on any failure. */
async function readNoteText(executor: Executor, vaultDir: string, file: string): Promise<string> {
  try {
    const raw = await executor.readFile(`${vaultDir}/${file}`, "utf8");
    const text = typeof raw === "string" ? raw : raw.toString("utf8");
    return text.slice(0, MAX_NOTE_READ_BYTES);
  } catch {
    return ""; // note missing / unreadable → silently skip
  }
}

/**
 * Strip the seeded note scaffolding (front-matter, the `# Title`, the
 * `> Fuente:` line and the italic placeholder description) so we only inject
 * REAL content the user/assistant added. Returns "" when nothing meaningful
 * remains (a freshly-seeded note carries only an empty `- ` bullet).
 */
function meaningfulNoteBody(text: string): string {
  const lines = text
    .replace(/\r\n/g, "\n") // normalize CRLF first (Windows-edited vaults)
    .replace(/^---\n[\s\S]*?\n---\n?/, "") // YAML front-matter
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (t.startsWith("# ")) return false; // the note title
      if (t.startsWith("> Fuente:")) return false; // seed source line
      if (t.startsWith("_") && t.endsWith("_")) return false; // italic placeholder
      if (t === "-" || t === "- ") return false; // empty seed bullet
      if (t === "```sh" || t === "```") return false; // empty seed code fence
      return true;
    });
  return lines.join("\n").trim();
}

export const projectContextVaultService = {
  /**
   * B1 — build a system-prompt block from the project's context vault
   * (Contexto.md + Errores.md). Capped at MAX_CONTEXT_BYTES total. Returns ""
   * when there's no container or no meaningful content (fail-open).
   */
  async buildContextBlock(executor: Executor, projectId: string): Promise<string> {
    const vaultDir = await resolveVaultDir(executor, projectId);
    if (!vaultDir) return "";

    const [contexto, errores] = await Promise.all([
      readNoteText(executor, vaultDir, "Contexto.md"),
      readNoteText(executor, vaultDir, "Errores.md"),
    ]);

    const sections: string[] = [];
    const ctxBody = meaningfulNoteBody(contexto);
    if (ctxBody) sections.push(`### Contexto del proyecto\n${ctxBody}`);
    const errBody = meaningfulNoteBody(errores);
    if (errBody) sections.push(`### Errores conocidos\n${errBody}`);
    if (sections.length === 0) return "";

    let block =
      "## Vault de contexto (Obsidian)\n" +
      "Notas que el usuario mantiene para este proyecto. Tenlas en cuenta:\n\n" +
      sections.join("\n\n");
    // Hard byte cap (plan: ≤4KB). Truncate visibly so the model knows it's cut.
    if (Buffer.byteLength(block, "utf8") > MAX_CONTEXT_BYTES) {
      // Slice on chars then trim down until under the byte budget (UTF-8 safe-ish).
      let cut = block.slice(0, MAX_CONTEXT_BYTES);
      while (Buffer.byteLength(cut, "utf8") > MAX_CONTEXT_BYTES - 16) cut = cut.slice(0, -16);
      block = `${cut}\n… (truncado)`;
    }
    return block;
  },
};
