// Obsidian page — shared module-level state hub + row/vault helpers.
// LEAF module: imports NOTHING from the other obsidian submodules, so every
// submodule can import it without cycles. Cross-submodule reassignable state
// lives on the exported `state` object (importers read live `state.foo`; the
// owner writes `state.foo = …`). Shared types also live here.

// ── Types (mirror backend models — see modules/obsidian contract) ────────────
export interface Vault {
  id: string;
  name: string;
  path: string;
  exists: boolean;
  noteCount: number | null;
  createdAt: string;
  updatedAt: string;
  canWrite: boolean;
}
export interface TreeNote {
  path: string;
  name: string;
  sizeBytes: number;
  modifiedAt: string;
  canWrite: boolean;
}
export interface VaultTree {
  folders: string[];
  notes: TreeNote[];
}
export interface SearchHit {
  path: string;
  line: number;
  text: string;
}
export interface NoteLinks {
  outgoing: string[];
  backlinks: { path: string; line: number; text: string }[];
}
export interface AssistantContextResult {
  written: string[];
  skipped: string[];
}
export interface ContainersSyncResult {
  baseDir: string;
  created: number;
  existing: number;
  repos: number;
  projects: number;
  chats: number;
  containers: { kind: string; name: string; path: string }[];
}

export const state = {
  vaults: [] as Vault[],
  vaultId: null as string | null,
  tree: { folders: [], notes: [] } as VaultTree,
  // Collapsed folder rel-paths, kept per vault so toggling survives re-renders.
  collapsed: new Set<string>(),
  notePath: null as string | null,
  dirty: false,
  linksOpen: false,
  searchSeq: 0,
  editorMode: "edit" as "edit" | "preview" | "split",
  fontSize: 14,
  lastVaultId: null as string | null,
  noteCanWrite: false,
  draftNew: false,
  mobilePane: "tree" as "tree" | "editor",
  scopeSeq: 0,
};

export function currentVault(): Vault | null {
  return state.vaults.find((v) => v.id === state.vaultId) ?? null;
}

export function vaultApi(suffix = ""): string {
  return `/api/obsidian/vaults/${encodeURIComponent(state.vaultId ?? "")}${suffix}`;
}
