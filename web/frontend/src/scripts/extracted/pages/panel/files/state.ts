// Files page — shared module-level state hub.
// LEAF module: imports NOTHING from the other files submodules, so it can be
// imported by all of them without cycles. Cross-cutting mutable state lives on
// the exported object `S` (an object so importers read a live `S.foo` and the
// owner writes `S.foo = …` — plain `export let` can't be reassigned by an
// importer). Sets/Maps/arrays that are only ever MUTATED IN PLACE (never
// reassigned) are exported as `const` and imported by name. Storage keys and
// pure config constants also live here so every submodule shares one source.
//
// Module-LOCAL state (openTabs was the exception — see below; git/tree/history/
// editor-only flags) stays in its owning submodule.

// ── localStorage keys (the 7 persisted keys — values byte-identical) ─────────
export const FILES_MANAGER_TABS_KEY = "panel-files-manager-tabs";
export const FILES_MANAGER_ACTIVE_KEY = "panel-files-manager-active";
export const FILES_LEFT_TAB_KEY = "panel-files-left-tab";
export const FILES_CLIPBOARD_KEY = "panel-files-clipboard";
export const FILES_TARGET_SCOPE_KEY = "panel-files-target-scope";
export const FILES_FAV_ROOTS_KEY = "panel-files-fav-roots";
export const SHOW_HIDDEN_KEY = "files-show-hidden";
/** Convenience view of the 7 keys above (same string values). */
export const STORAGE = {
  managerTabs: FILES_MANAGER_TABS_KEY,
  managerActive: FILES_MANAGER_ACTIVE_KEY,
  leftTab: FILES_LEFT_TAB_KEY,
  clipboard: FILES_CLIPBOARD_KEY,
  targetScope: FILES_TARGET_SCOPE_KEY,
  favRoots: FILES_FAV_ROOTS_KEY,
  showHidden: SHOW_HIDDEN_KEY,
} as const;

// ── Additional persisted keys (distinct storages; not part of STORAGE view) ──
// `files-view` = localStorage (list/grid/projects view mode).
// `files:currentPath` = sessionStorage; SHARED with the floating terminal so a
//   `cd` on connect follows the file browser's current directory.
export const FILES_VIEW_KEY = "files-view";

/**
 * Per-SERVER storage key. The manager tabs (and their last path / tree root)
 * describe directories of ONE server: reusing them on another target opened
 * the remote box at the panel host's last folder (`/var/www/luxisoft/…` → 404
 * on the target). LOCAL keeps the legacy bare key (existing data survives);
 * any remote target gets its own `<base>::<targetId>` bucket, mirroring the
 * fav-roots convention (`favRootsStorageKey`).
 */
export function scopedFilesStorageKey(base: string, scope: string | null | undefined): string {
  const s = (scope || "").trim();
  return !s || s === "local" ? base : `${base}::${s}`;
}
export const FILES_CURRENT_PATH_KEY = "files:currentPath";

// ── Shared types ─────────────────────────────────────────────────────────────
/** Las TRES vistas del módulo. `projects` faltaba en el tipo (que declaraba solo
 *  list|grid) y se colaba con un `as any` en setViewMode, así que el compilador
 *  daba por imposibles todas las comparaciones `viewMode === "projects"` — y con
 *  ellas tapaba que la vista de proyectos no se restauraba al recargar. */
export type FilesViewMode = "list" | "grid" | "projects";

export interface OpenTab {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  dirty: boolean;
  // VS Code-style preview tab: a single-click open that gets REPLACED by the
  // next single-click open (at most one preview tab at a time). Promoted to a
  // permanent tab (preview cleared) on double-click, on edit (dirty), or on
  // double-clicking the tab itself. Absent/false = permanent.
  preview?: boolean;
}

// ── Pure config constants ────────────────────────────────────────────────────
export const FILE_SHORTCUT_SETTING_KEYS = {
  // Files
  newFile: "files_shortcut_new_file",
  newFolder: "files_shortcut_new_folder",
  upload: "files_shortcut_upload",
  paste: "files_shortcut_paste",
  save: "files_shortcut_save",
  delete: "files_shortcut_delete",
  // Navigation
  back: "files_shortcut_back",
  refresh: "files_shortcut_refresh",
  search: "files_shortcut_search",
  newTab: "files_shortcut_new_tab",
  clearSelection: "files_shortcut_clear_selection",
  openFiles: "files_shortcut_open_files",
  toggleEditor: "files_shortcut_toggle_editor",
  // View & tools
  viewList: "files_shortcut_view_list",
  viewGrid: "files_shortcut_view_grid",
  projects: "files_shortcut_projects",
  rescanProjects: "files_shortcut_rescan_projects",
  projectMap: "files_shortcut_project_map",
  compare: "files_shortcut_compare",
  git: "files_shortcut_git",
  copyPath: "files_shortcut_copy_path",
  download: "files_shortcut_download",
} as const;

export const DEFAULT_FILE_SHORTCUTS: Record<keyof typeof FILE_SHORTCUT_SETTING_KEYS, string> = {
  newFile: "Ctrl+Alt+N",
  newFolder: "Ctrl+Alt+Shift+N",
  upload: "Ctrl+Alt+U",
  paste: "Ctrl+Alt+Shift+V",
  save: "Ctrl+Alt+S",
  delete: "Ctrl+Alt+Shift+D",
  back: "Ctrl+Alt+B",
  refresh: "Ctrl+Alt+R",
  search: "Ctrl+Alt+F",
  newTab: "Ctrl+Alt+T",
  clearSelection: "Ctrl+Alt+Shift+C",
  openFiles: "Ctrl+Alt+O",
  toggleEditor: "Ctrl+Alt+E",
  viewList: "Ctrl+Alt+1",
  viewGrid: "Ctrl+Alt+2",
  projects: "Ctrl+Alt+P",
  rescanProjects: "Ctrl+Alt+Shift+R",
  projectMap: "Ctrl+Alt+M",
  compare: "Ctrl+Alt+K",
  git: "Ctrl+Alt+G",
  copyPath: "Ctrl+Alt+Y",
  download: "Ctrl+Alt+D",
};

// Advanced controls hidden in client mode (desktop buttons + mobile menu items).
export const CLIENT_HIDDEN_BTNS = [
  "btn-git-d", "btn-compare-d", "btn-project-map-d", "btn-exposure-d", "btn-malware-d", "btn-history-d",
  "btn-git", "btn-compare", "btn-project-map", "btn-exposure", "btn-malware", "btn-history",
];

// ── Mutated-in-place collections (imported by name, never reassigned) ────────
export const selected = new Set<string>(); // selected paths
export const aiSelectedEntries: { path: string; isDir: boolean }[] = [];
// Recursive folder sizes resolved this session (path -> bytes). Cleared on
// navigate so re-entering a directory re-reads the (TTL-bounded) Redis cache.
export const dirSizeKnown = new Map<string, number>();
// Per-path cache of "is this dir inside a git work-tree?" so the Git button
// enable-check costs at most one cheap SSH `rev-parse` per directory visited.
export const gitRepoCache = new Map<string, boolean>();
// History stack for the "back" button.
export const navHistory: string[] = [];

// ── Cross-cutting reassignable state (live object) ───────────────────────────
export const S = {
  currentPath: "",
  filesManagers: [] as Array<{ id: string; label: string; path: string; treeRoot?: string }>,
  activeFilesManagerId: "",
  // Effective file-access policy (from /api/files/allowed-bases). Drives the path
  // the module opens to so a path-restricted user never starts at "/" (denied).
  filesDefaultBase: "/",
  // FAIL-CLOSED: assume restricted until /api/files/allowed-bases confirms.
  filesAllowAll: false,
  // Allowed path prefixes when !filesAllowAll.
  filesAllowPaths: [] as string[],
  // Effective file action permissions (files.*). null = not loaded yet.
  filesActions: null as Set<string> | null,
  renameFrom: "",
  bases: [] as string[],
  viewMode: "list" as FilesViewMode,
  // Show dotfiles. User preference; only effective with `files.hidden` perm.
  showHidden: false,
  treeExpansionMode: "multiple" as "multiple" | "single",
  searchQuery: "",
  currentEntries: [] as any[],
  listingVersion: 0,
  // List-view column sorting.
  sortKey: "name" as "name" | "type" | "size" | "modified",
  sortDir: 1 as 1 | -1, // 1 = asc, -1 = desc
  currentProjects: [] as any[],
  // Cancels in-flight size hydration when the user navigates/re-renders.
  dirSizeNav: 0,
  isSearchMode: false,
  searchDebounce: null as ReturnType<typeof setTimeout> | null,
  // Search box mode: "name" = filter by name (live), "content" = grep (Enter).
  searchMode: "name" as "name" | "content",
  searchCaseSensitive: false,
  contentResultsActive: false,
  gitRepoNav: 0,
  permissionTargetPath: "",
  permissionTargetName: "",
  permissionTargetIsDir: false,
  pendingValidate: null as { path: string; content: string; validator: string; errors: Array<{ line?: number; column?: number; message: string }> } | null,
  compressTargetPaths: [] as string[],
  compressTargetLabel: "",
  fileShortcutConfig: { ...DEFAULT_FILE_SHORTCUTS } as Record<keyof typeof FILE_SHORTCUT_SETTING_KEYS, string>,
  fileShortcutSaveTimer: null as ReturnType<typeof setTimeout> | null,
  fileShortcutSaveInFlight: false,
  fileShortcutSaveQueued: false,
  activeTargetScope: "",
  targetScopeSyncInFlight: false,
  // `filesManagerBound` guarda SOLO el window listener (window persiste
  // cross-nav SPA; re-bindearlo cada init duplicaría handlers).
  filesManagerBound: false,
  sessionRefreshBound: false,
  mediaObjectUrl: "",
  // Visor de imágenes tipo carrusel: galería ordenada de la carpeta actual,
  // índice activo, caché de prefetch de vecinas (path→objectURL) y guardas de
  // ciclo de vida (token anti-carreras + listener de teclado + swipe táctil).
  mediaGallery: [] as Array<{ path: string; name: string; kind: "image" | "video" | "audio" }>,
  mediaIndex: -1,
  mediaPrefetch: {} as Record<string, string>,
  mediaLoadToken: 0,
  mediaTouchStartX: null as number | null,
  // Guarda única: listeners del visor (click/close/swipe/teclas) delegados en
  // `document` y bindeados una sola vez (persisten cross-nav SPA).
  mediaNavBound: false,
  leftPanelResizerBound: false,
  activeLeftSidebarTab: "files" as "files" | "snippets" | "history",
  // #25 client/dev UI mode (guardrail, not access control).
  filesClientMode: false,
  favoriteRoots: [] as string[],
  preferencesLoadedScope: "",
  preferencesListenerBound: false,

  // ── binding guards (DOM listeners re-bound per fresh SPA DOM) ──
  controlsBound: false,
  searchBound: false,
  shortcutsBound: false,
  fileSettingsBound: false,
  saveBtn: null as HTMLButtonElement | null,
  diffBtn: null as HTMLButtonElement | null,

  // ── editor tab state (cross-written by resetStateForTargetSwitch) ──
  openTabs: [] as OpenTab[],
  activeTabPath: "",
  editingPath: "",
  // Whether the editor occupies the right-hand workspace (exclusive with the
  // file browser). Toggled by showEditorView/hideEditorView; reset on target
  // switch. Persists across SPA nav within a target (see syncEditorWorkspaceView).
  editorVisible: false,

  // ── path-bar autocomplete active index (written by bindControls too) ──
  suggestActive: -1,

  // ── folder picker state (wired by bindControls, driven by picker fns) ──
  folderPickerTarget: "",
  folderPickerCurrent: "/",
  folderPickerOnSelect: null as ((path: string) => void) | null,

  // ── file-access policy load guard (reset by entry on session refresh) ──
  fileAccessPolicyLoaded: false,
};
