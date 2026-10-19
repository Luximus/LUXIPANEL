/**
 * Obsidian service — every operation runs on the CONNECTED server through the
 * Executor, never on the panel host. Vault files belong to the SSH user, so
 * nothing here needs sudo: filesystem work goes through the executor's SFTP
 * primitives (readFile/writeFile/mkdir/rename/unlink/stat) and read-only
 * shell helpers (`find`, `grep`, `date`) with `quoteArg` on EVERY argument.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { execShell, quoteArg, statOrNull } from "../../../shared/executor/index.js";
import { parseGrepLine } from "../../../shared/utils/grep.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { vaultsRepository } from "../repositories/vaults.repository.js";
import type {
  AssistantContextResult,
  CreateVaultInput,
  NoteLinks,
  ObsidianVault,
  SearchHit,
  TreeNote,
  VaultInfo,
  VaultTree,
} from "../models/index.js";
import {
  assertNoteExtension,
  normalizedVaultPath,
  parentDir,
  relFromAbs,
  resolveRel,
} from "./path-util.js";

const log = createModuleLogger("obsidian-service");

const DEFAULT_TIMEOUT_MS = 20_000;
/** Read/append cap for a single note (mirrors the write schema's max). */
const MAX_NOTE_BYTES = 2_000_000;
/** Hard cap on search/backlink results shipped back. */
const SEARCH_RESULT_CAP = 200;
/** Per-hit text snippet cap (keeps payloads and prompts sane). */
const SNIPPET_MAX_CHARS = 500;

type RegisteredVault = ObsidianVault & { id: string };

/** Run a read-only shell snippet on the target (no sudo — user-owned files). */
async function sh(executor: Executor, body: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return execShell(executor, body, { timeoutMs });
}

// `statOrNull` lives in `shared/executor/fs-probe.ts` (same try/catch shape the
// module used twice and `module-dev` a third time).

/** Decode an Executor.readFile result (string or Buffer) to UTF-8 text. */
function toText(raw: string | Buffer): string {
  return typeof raw === "string" ? raw : raw.toString("utf8");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip the vault prefix and split a `path:line:text` grep line. */
function parseVaultGrepLine(base: string, line: string): SearchHit | null {
  let rest = line;
  const prefix = `${base}/`;
  if (rest.startsWith(prefix)) rest = rest.slice(prefix.length);
  const parts = parseGrepLine(rest);
  if (!parts) return null;
  return {
    path: parts.file,
    line: Number(parts.lineNo),
    text: parts.content.slice(0, SNIPPET_MAX_CHARS),
  };
}

/**
 * Literal grep over a vault's notes; returns the raw `path:line:text` lines.
 *
 * Files are enumerated with `find -mindepth 1` (hidden entries pruned below
 * the root, so a vault whose OWN directory is hidden still searches — grep's
 * `--exclude-dir='.*'` also drops hidden command-line directories) and fed to
 * grep via `xargs -0`. `head` caps the transport size, which makes the
 * pipeline's exit status useless (POSIX sh reports `head`'s, always 0), so
 * find's real status travels out-of-band through an stderr marker: a genuine
 * failure (missing dir, permissions) with no output raises instead of
 * masquerading as "no matches". grep finding nothing is a normal empty result.
 */
async function grepNotes(executor: Executor, base: string, needle: string, shallow = false): Promise<string[]> {
  const body =
    `{ find ${quoteArg(base)} ${shallow ? "-maxdepth 1 " : ""}-mindepth 1 -name '.*' -prune -o ` +
    `-type f \\( -name '*.md' -o -name '*.canvas' \\) -print0 2>/dev/null; ` +
    `echo "__lxp_find_rc=$?" >&2; } ` +
    `| xargs -0 -r grep -inF -m 5 -e ${quoteArg(needle)} /dev/null 2>/dev/null ` +
    `| head -${SEARCH_RESULT_CAP}`;
  const r = await sh(executor, body, 30_000);
  const findRc = Number(/__lxp_find_rc=(\d+)/.exec(r.stderr)?.[1] ?? "0");
  if (findRc !== 0 && !r.stdout.trim()) {
    throw new ValidationError("La búsqueda falló en el servidor");
  }
  return r.stdout.split("\n");
}

/** Shared body for the per-provider agent context files. */
function assistantContextTemplate(vault: RegisteredVault): string {
  return `# ${vault.name} — Obsidian vault

This directory is an Obsidian vault managed through the LUXIPANEL Obsidian
module. Follow these conventions whenever you read, create or edit notes here.

## Conventions

- Notes are Markdown files (\`.md\`); Obsidian canvases are \`.canvas\` (JSON).
- Internal links use wikilinks: \`[[Note name]]\`, optionally with an alias
  (\`[[Note name|alias]]\`) or a heading anchor (\`[[Note name#Heading]]\`).
  The link target is the note's filename without the \`.md\` extension.
- Folders group notes by topic. Daily notes live in \`Daily/YYYY-MM-DD.md\`.
- Notes may start with YAML frontmatter (a \`---\` block) carrying metadata
  such as tags and dates — preserve it when editing.
- NEVER modify the \`.obsidian/\` directory: it holds the Obsidian app
  configuration, not content.

## How to work in this vault

- Search for existing notes before creating new ones; prefer linking
  (\`[[...]]\`) over duplicating content.
- When you create a note, give it a clear, descriptive filename — that name
  IS its wikilink target — and link it from/to the related notes.
- Append to daily notes instead of overwriting them.
- Keep edits surgical: do not reformat or rewrite parts of a note you were
  not asked to touch.
`;
}

const ASSISTANT_CONTEXT_FILES = ["CLAUDE.md", "AGENTS.md", "GEMINI.md"] as const;

export const obsidianService = {
  // ── Vault registry ────────────────────────────────────────────────────────

  /**
   * List registered vaults with live facts from the target: whether the
   * directory exists and how many `*.md` notes it holds.
   *
   * All probes run in a SINGLE `sh -lc` round trip — one `find` per vault, but
   * chained on the box so the SSH latency is paid once, not once-per-vault.
   * This matters because context containers register one vault per git repo /
   * assistant project / loose chat, so a server can easily accumulate dozens of
   * vaults; the old one-round-trip-per-vault loop made the page hang for
   * seconds. Each vault emits a tab-delimited line `<idx>\t<yes|no>\t<count>`;
   * a missing/failed line is tolerated (exists=false, noteCount=null) so a
   * broken vault never hides the rest, and a total failure degrades the same
   * way instead of throwing.
   */
  async listVaults(executor: Executor): Promise<VaultInfo[]> {
    const vaults = await vaultsRepository.list(executor);
    if (vaults.length === 0) return [];

    // -mindepth 1: only prune hidden entries BELOW the vault root — without it
    // a vault whose own directory is hidden (/home/u/.notes) matches
    // `-name '.*'`, gets pruned and counts 0 notes.
    const body = vaults
      .map((vault, idx) => {
        const p = quoteArg(normalizedVaultPath(vault.path));
        return (
          `p=${p}; if [ -d "$p" ]; then ` +
          `c=$(find "$p" ${vault.shallow ? "-maxdepth 1 " : ""}-mindepth 1 -name '.*' -prune -o -type f -name '*.md' -print 2>/dev/null | wc -l | tr -d ' '); ` +
          `printf '%s\\t%s\\t%s\\n' ${idx} yes "$c"; ` +
          `else printf '%s\\t%s\\t%s\\n' ${idx} no 0; fi`
        );
      })
      .join("; ");

    const probed = new Map<number, { exists: boolean; noteCount: number | null }>();
    try {
      // Scale the timeout with vault count (find can be slow on big trees) but
      // keep it bounded so a single hung vault can't wedge the whole listing.
      const timeoutMs = Math.min(120_000, 20_000 + vaults.length * 1_000);
      const r = await sh(executor, body, timeoutMs);
      for (const line of r.stdout.split("\n")) {
        if (!line) continue;
        const [idxStr, existsStr, countStr] = line.split("\t");
        const idx = Number(idxStr);
        if (!Number.isInteger(idx)) continue;
        const exists = existsStr?.trim() === "yes";
        let noteCount: number | null = null;
        if (exists) {
          const count = Number(countStr?.trim());
          noteCount = Number.isFinite(count) ? count : null;
        }
        probed.set(idx, { exists, noteCount });
      }
    } catch (err) {
      log.warn({ err: (err as Error).message }, "vault probe batch failed");
    }

    return vaults.map((vault, idx) => {
      const p = probed.get(idx);
      return { ...vault, exists: p?.exists ?? false, noteCount: p?.noteCount ?? null };
    });
  },

  /** Fetch one registered vault or throw 404. */
  async getVault(executor: Executor, id: string): Promise<RegisteredVault> {
    const vault = await vaultsRepository.get(executor, id);
    if (!vault) throw new NotFoundError("Vault");
    return vault;
  },

  /**
   * Resolve a vault reference coming from an agent tool: by id first, then by
   * name (case-insensitive). Throws 404 when nothing matches.
   */
  async resolveVaultRef(executor: Executor, ref: string): Promise<RegisteredVault> {
    const trimmed = ref.trim();
    if (!trimmed) throw new ValidationError("Se requiere el vault (id o nombre)");
    const byId = await vaultsRepository.get(executor, trimmed);
    if (byId) return byId;
    const all = await vaultsRepository.list(executor);
    const lower = trimmed.toLowerCase();
    const byName = all.find((v) => (v.name || "").toLowerCase() === lower);
    if (!byName) throw new NotFoundError(`Vault '${trimmed}'`);
    return byName;
  },

  /**
   * Register a vault. mode="create" builds the directory (plus a minimal
   * `.obsidian/app.json` so the Obsidian app recognizes it); mode="register"
   * requires the directory to already exist on the target.
   */
  async createVault(executor: Executor, input: CreateVaultInput, options: { shallow?: boolean } = {}): Promise<RegisteredVault> {
    const path = normalizedVaultPath(input.path);
    const duplicate = await vaultsRepository.findByPath(executor, path);
    if (duplicate) throw new ConflictError(`Ya hay un vault registrado en '${path}'`);

    if (input.mode === "create") {
      try {
        await executor.mkdir(`${path}/.obsidian`, { recursive: true });
        const appJson = `${path}/.obsidian/app.json`;
        if (!(await statOrNull(executor, appJson))) {
          await executor.writeFile(appJson, "{}");
        }
      } catch (err) {
        // Surface FS failures (permissions, ruta inválida…) as an actionable
        // 4xx for the toast instead of a generic "Unhandled error" 500.
        const reason = errMessage(err);
        throw new ValidationError(`No se pudo crear la carpeta '${path}': ${reason}`);
      }
    } else {
      const r = await sh(executor, `test -d ${quoteArg(path)} && echo yes || echo no`, 10_000);
      if (r.stdout.trim() !== "yes") {
        throw new ValidationError(`La carpeta '${path}' no existe en el servidor`);
      }
    }

    const vault = await vaultsRepository.create(executor, { name: input.name, path, shallow: options.shallow });
    log.info({ vaultId: vault.id, path, mode: input.mode }, "vault registered");
    return vault;
  },

  /** Deregister a vault from the sidecar. NEVER deletes files on disk. */
  async deleteVault(executor: Executor, id: string): Promise<void> {
    const vault = await this.getVault(executor, id);
    await vaultsRepository.remove(executor, vault.id);
    log.info({ vaultId: vault.id }, "vault deregistered");
  },

  // ── Tree / notes ──────────────────────────────────────────────────────────

  /**
   * Folder + note tree in a SINGLE `find` round trip. Hidden entries
   * (including `.obsidian/`) are pruned; only `*.md` / `*.canvas` files are
   * emitted. `-printf` gives us type, relative path, size and mtime at once.
   */
  async getTree(executor: Executor, vault: RegisteredVault): Promise<VaultTree> {
    const base = normalizedVaultPath(vault.path);
    const body =
      `find ${quoteArg(base)} ${vault.shallow ? "-maxdepth 1 " : ""}-mindepth 1 -name '.*' -prune -o ` +
      `\\( -type d -printf 'd\\t%P\\t0\\t0\\n' \\) -o ` +
      `\\( -type f \\( -name '*.md' -o -name '*.canvas' \\) -printf 'f\\t%P\\t%s\\t%T@\\n' \\) ` +
      `2>/dev/null`;
    const r = await sh(executor, body, 30_000);

    const folders: string[] = [];
    const notes: TreeNote[] = [];
    for (const line of r.stdout.split("\n")) {
      if (!line) continue;
      const [type, rel, size, mtime] = line.split("\t");
      if (!type || !rel) continue;
      if (type === "d") {
        if (!vault.shallow) folders.push(rel);
      } else if (type === "f") {
        const epoch = Number(mtime);
        notes.push({
          path: rel,
          name: rel.split("/").pop() ?? rel,
          sizeBytes: Number(size) || 0,
          modifiedAt: Number.isFinite(epoch)
            ? new Date(epoch * 1000).toISOString()
            : new Date(0).toISOString(),
        });
      }
    }
    folders.sort((a, b) => a.localeCompare(b));
    notes.sort((a, b) => a.path.localeCompare(b.path));
    return { folders, notes };
  },

  /** Read one note (≤2MB, checked against `stat` BEFORE pulling the bytes). */
  async readNote(
    executor: Executor,
    vault: RegisteredVault,
    rel: string,
  ): Promise<{ path: string; content: string }> {
    const abs = resolveRel(vault.path, rel);
    assertNoteExtension(rel);
    const st = await statOrNull(executor, abs);
    if (!st) throw new NotFoundError("Nota");
    if (st.size > MAX_NOTE_BYTES) {
      throw new ValidationError("La nota supera el límite de lectura de 2MB");
    }
    const raw = await executor.readFile(abs, "utf8");
    const content = toText(raw);
    return { path: relFromAbs(vault.path, abs), content };
  },

  /** Create or update a note (parent folders are created as needed). */
  async writeNote(
    executor: Executor,
    vault: RegisteredVault,
    rel: string,
    content: string,
  ): Promise<{ path: string }> {
    const abs = resolveRel(vault.path, rel);
    assertNoteExtension(rel);
    await executor.mkdir(parentDir(abs), { recursive: true });
    await executor.writeFile(abs, content);
    return { path: relFromAbs(vault.path, abs) };
  },

  /** Append content to a note, creating it when missing. */
  async appendNote(
    executor: Executor,
    vault: RegisteredVault,
    rel: string,
    content: string,
  ): Promise<{ path: string; created: boolean }> {
    const abs = resolveRel(vault.path, rel);
    assertNoteExtension(rel);
    const st = await statOrNull(executor, abs);
    let next = content;
    let created = true;
    if (st) {
      if (st.size > MAX_NOTE_BYTES) {
        throw new ValidationError("La nota supera el límite de 2MB; no se puede anexar");
      }
      const raw = await executor.readFile(abs, "utf8");
      const existing = toText(raw);
      next = `${existing}\n${content}`;
      created = false;
    }
    await executor.mkdir(parentDir(abs), { recursive: true });
    await executor.writeFile(abs, next);
    return { path: relFromAbs(vault.path, abs), created };
  },

  /** Rename/move a note inside the vault (destination folder auto-created). */
  async renameNote(
    executor: Executor,
    vault: RegisteredVault,
    from: string,
    to: string,
  ): Promise<{ from: string; to: string }> {
    const absFrom = resolveRel(vault.path, from);
    const absTo = resolveRel(vault.path, to);
    assertNoteExtension(from);
    assertNoteExtension(to);
    if (!(await statOrNull(executor, absFrom))) throw new NotFoundError("Nota");
    if (await statOrNull(executor, absTo)) {
      throw new ConflictError(`Ya existe '${relFromAbs(vault.path, absTo)}'`);
    }
    await executor.mkdir(parentDir(absTo), { recursive: true });
    await executor.rename(absFrom, absTo);
    return { from: relFromAbs(vault.path, absFrom), to: relFromAbs(vault.path, absTo) };
  },

  /** Delete a single note file. */
  async deleteNote(executor: Executor, vault: RegisteredVault, rel: string): Promise<void> {
    const abs = resolveRel(vault.path, rel);
    assertNoteExtension(rel);
    if (!(await statOrNull(executor, abs))) throw new NotFoundError("Nota");
    await executor.unlink(abs);
  },

  /** Create a folder (mkdir -p) inside the vault. */
  async createFolder(
    executor: Executor,
    vault: RegisteredVault,
    rel: string,
  ): Promise<{ path: string }> {
    const abs = resolveRel(vault.path, rel);
    await executor.mkdir(abs, { recursive: true });
    return { path: relFromAbs(vault.path, abs) };
  },

  // ── Search / links ────────────────────────────────────────────────────────

  /**
   * Literal (fixed-string) content search across `*.md` / `*.canvas`, capped
   * at 200 hits with ≤5 matches per file. No matches is a normal empty
   * result; a real failure with no output raises (see `grepNotes`).
   */
  async search(executor: Executor, vault: RegisteredVault, query: string): Promise<SearchHit[]> {
    const base = normalizedVaultPath(vault.path);
    const lines = await grepNotes(executor, base, query, vault.shallow);
    const hits: SearchHit[] = [];
    for (const line of lines) {
      if (!line) continue;
      const hit = parseVaultGrepLine(base, line);
      if (hit) hits.push(hit);
      if (hits.length >= SEARCH_RESULT_CAP) break;
    }
    return hits;
  },

  /**
   * Wikilink graph around one note: outgoing `[[Target]]` references parsed
   * from its content, plus backlinks found by grepping the vault for the
   * note's name wrapped in `[[ ]]` (alias/heading forms included).
   */
  async links(executor: Executor, vault: RegisteredVault, rel: string): Promise<NoteLinks> {
    const { content } = await this.readNote(executor, vault, rel);

    const outgoing: string[] = [];
    const seen = new Set<string>();
    for (const m of content.matchAll(/\[\[([^\]|#]+)/g)) {
      const target = (m[1] ?? "").trim();
      if (!target || seen.has(target.toLowerCase())) continue;
      seen.add(target.toLowerCase());
      outgoing.push(target);
      if (outgoing.length >= 500) break;
    }

    const noteName = (rel.split("/").pop() ?? rel).replace(/\.[^.]+$/, "");
    const base = normalizedVaultPath(vault.path);
    const lines = await grepNotes(executor, base, `[[${noteName}`, vault.shallow);

    // Post-filter: the grep needle is a loose prefix; confirm a real wikilink
    // to THIS note (closed, aliased or anchored) and drop self-references.
    const linkRe = new RegExp(`\\[\\[\\s*${escapeRegExp(noteName)}\\s*(\\]\\]|\\||#)`, "i");
    const selfRel = relFromAbs(vault.path, resolveRel(vault.path, rel));
    const backlinks: SearchHit[] = [];
    for (const line of lines) {
      if (!line) continue;
      const hit = parseVaultGrepLine(base, line);
      if (!hit || hit.path === selfRel || !linkRe.test(hit.text)) continue;
      backlinks.push(hit);
      if (backlinks.length >= SEARCH_RESULT_CAP) break;
    }
    return { outgoing, backlinks };
  },

  // ── Assistant context files ───────────────────────────────────────────────

  /**
   * Seed the vault root with the context files every CLI provider reads
   * (CLAUDE.md, AGENTS.md, GEMINI.md) sharing the same conventions body.
   * Idempotent: existing files are skipped unless `overwrite` is set.
   */
  async writeAssistantContext(
    executor: Executor,
    vault: RegisteredVault,
    overwrite: boolean,
  ): Promise<AssistantContextResult> {
    const base = normalizedVaultPath(vault.path);
    const content = assistantContextTemplate(vault);
    const written: string[] = [];
    const skipped: string[] = [];
    for (const file of ASSISTANT_CONTEXT_FILES) {
      const abs = `${base}/${file}`;
      if (!overwrite && (await statOrNull(executor, abs))) {
        skipped.push(file);
        continue;
      }
      await executor.writeFile(abs, content);
      written.push(file);
    }
    return { written, skipped };
  },

  // ── Agent helpers ─────────────────────────────────────────────────────────

  /** Notes of a vault, optionally restricted to one folder (recursive). */
  async listNotes(
    executor: Executor,
    vault: RegisteredVault,
    folder?: string,
  ): Promise<TreeNote[]> {
    const tree = await this.getTree(executor, vault);
    if (!folder) return tree.notes;
    const folderRel = relFromAbs(vault.path, resolveRel(vault.path, folder));
    return tree.notes.filter(
      (n) => n.path === folderRel || n.path.startsWith(`${folderRel}/`),
    );
  },

  /**
   * Resolve the effective daily-note date: validates an explicit `date` or
   * falls back to the CLIENT server's current date (`date +%F` over the
   * executor — the vault's timezone), then to UTC. Exposed separately so
   * callers (agent path gate) can know the EXACT `Daily/<date>.md` target
   * before any write happens.
   */
  async resolveDailyDate(executor: Executor, date?: string): Promise<string> {
    let day = (date ?? "").trim();
    if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      throw new ValidationError("Fecha inválida — usa el formato YYYY-MM-DD");
    }
    if (!day) {
      try {
        const r = await sh(executor, "date +%F", 8_000);
        const out = r.stdout.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(out)) day = out;
      } catch {
        /* fall through to UTC below */
      }
      if (!day) day = new Date().toISOString().slice(0, 10);
    }
    return day;
  },

  /**
   * Append to the daily note `Daily/YYYY-MM-DD.md`. The default date is the
   * CLIENT server's current date (`date +%F` over the executor), so the note
   * matches the timezone where the vault lives.
   */
  async dailyNote(
    executor: Executor,
    vault: RegisteredVault,
    content: string,
    date?: string,
  ): Promise<{ path: string; created: boolean }> {
    const day = await this.resolveDailyDate(executor, date);
    return this.appendNote(executor, vault, `Daily/${day}.md`, content);
  },
};
