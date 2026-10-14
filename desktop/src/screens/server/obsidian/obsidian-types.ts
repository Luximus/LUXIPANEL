/**
 * obsidian-types — tipos compartidos del módulo Obsidian de desktop.
 * Extraídos de `ObsidianModule.tsx` (split conservador, sin cambios de forma).
 */

export type VaultInfo = { id: string; name: string; path: string; exists?: boolean; noteCount?: number | null };
export type NoteItem = { path: string; name: string; sizeBytes?: number; modifiedAt?: string };
export type SearchHit = { path: string; line?: number; text?: string };
export type EditorState = { mode: "edit" | "create"; path?: string };

/** Contenedor de contexto (repo/proyecto/chat) que devuelve `GET /containers`. */
export type ContainerItem = { id?: string; kind?: string; refKey?: string; name?: string; path?: string; vaultId?: string; repoPath?: string; createdAt?: string };
/** Resumen del backfill idempotente (`POST /containers/sync`). */
export type ContainerSyncSummary = { baseDir?: string; created?: number; existing?: number; repos?: number; projects?: number; chats?: number; containers?: Array<{ kind?: string; name?: string; path?: string }> };
/** Grafo de wikilinks alrededor de una nota (`GET /vaults/:id/links`). */
export type NoteLinks = { outgoing: string[]; backlinks: Array<{ path: string; line?: number; text?: string }> };
/** Resultado de sembrar los ficheros de contexto IA (CLAUDE/AGENTS/GEMINI.md). */
export type AssistantContextResult = { written?: string[]; skipped?: string[] };

/** Fila plana para el DataTable de desktop (accessorKeys ordenables/filtrables). */
export type VaultRow = {
  id: string;
  name: string;
  path: string;
  noteCount: number;
  exists: boolean;
  stateLabel: string;
  haystack: string;
};
export type NoteRow = {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  haystack: string;
};
