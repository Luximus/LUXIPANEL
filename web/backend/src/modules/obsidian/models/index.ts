/**
 * Obsidian module — domain types and request schemas.
 *
 * A "vault" is a plain directory on the CONNECTED server that holds Obsidian
 * notes (`*.md` / `*.canvas`). The panel only persists vault REGISTRATIONS
 * (name + absolute path) in the per-server sidecar
 * `${LUXIPANEL_CONFIG_DIR}/obsidian/vaults.json`; the notes themselves live
 * (and stay) in the vault directory on the client server. Deleting a vault
 * here only deregisters it — files are never removed.
 */

import { z } from "zod";

/** Vault registration document persisted in the per-server sidecar. */
export interface ObsidianVault {
  id?: string;
  name: string;
  /** Absolute Unix path of the vault directory on the client server. */
  path: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Vault as returned by the list endpoint (live filesystem facts attached). */
export interface VaultInfo extends ObsidianVault {
  id: string;
  /** Whether the directory currently exists on the target. */
  exists: boolean;
  /** Number of `*.md` notes, or null when counting failed. */
  noteCount: number | null;
}

export interface TreeNote {
  /** Path relative to the vault root. */
  path: string;
  /** Basename (with extension). */
  name: string;
  sizeBytes: number;
  /** ISO timestamp of the last modification. */
  modifiedAt: string;
}

export interface VaultTree {
  /** Folder paths relative to the vault root (no `.obsidian`, no hidden). */
  folders: string[];
  notes: TreeNote[];
}

export interface SearchHit {
  /** Note path relative to the vault root. */
  path: string;
  line: number;
  text: string;
}

export interface NoteLinks {
  /** Wikilink targets referenced by this note (`[[Target]]`). */
  outgoing: string[];
  /** Notes that reference this note. */
  backlinks: SearchHit[];
}

export interface AssistantContextResult {
  written: string[];
  skipped: string[];
}

// ── Field schemas ────────────────────────────────────────────────────────────

/** Vault display name: 1..80 chars, no NUL. */
export const vaultNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((v) => !v.includes("\0"), "Invalid vault name");

/**
 * Absolute Unix path of a vault. Must start with `/`, contain no NUL and not
 * be the bare filesystem root. Traversal is re-checked when the path is used.
 */
export const vaultPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .regex(/^\//, "Vault path must be absolute")
  .refine((v) => !v.includes("\0"), "Invalid vault path")
  .refine((v) => v.replace(/\/+$/, "") !== "", "Vault path cannot be the filesystem root");

/**
 * Path relative to the vault root. Deep validation (traversal, leading `/`,
 * extension) happens in `resolveRel` — this is the cheap first gate.
 */
export const relPathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((v) => !v.includes("\0"), "Invalid path");

// ── Request schemas ──────────────────────────────────────────────────────────

export const createVaultSchema = z.object({
  name: vaultNameSchema,
  path: vaultPathSchema,
  /** "create" = mkdir + seed `.obsidian/app.json`; "register" = existing dir. */
  mode: z.enum(["create", "register"]),
});

export type CreateVaultInput = z.infer<typeof createVaultSchema>;

/** `?path=` query for note reads/deletes and the links endpoint. */
export const noteParamSchema = z.object({
  path: relPathSchema,
});

export const writeNoteSchema = z.object({
  path: relPathSchema,
  content: z.string().max(2_000_000),
});

/** Append body to a note (path + content), creating it when missing. */
export const appendNoteSchema = z.object({
  path: relPathSchema,
  content: z.string().min(1).max(2_000_000),
});

/** Append to the daily note `Daily/YYYY-MM-DD.md`; date defaults to the
 *  connected server's current date. */
export const dailyNoteSchema = z.object({
  content: z.string().min(1).max(2_000_000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida — usa YYYY-MM-DD").optional(),
});

export const renameSchema = z.object({
  from: relPathSchema,
  to: relPathSchema,
});

export const createFolderSchema = z.object({
  path: relPathSchema,
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(256),
});

export const assistantContextSchema = z.object({
  overwrite: z.boolean().optional().default(false),
});
