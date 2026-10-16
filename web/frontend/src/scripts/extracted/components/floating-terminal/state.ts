// Floating terminal — shared module-level state hub.
// LEAF module: imports NOTHING from the other floating-terminal submodules, so
// every submodule can import it without cycles. Reassignable cross-module state
// lives on the exported object `S` (importers read a live `S.foo`; the owner
// writes `S.foo = …` — a plain `export let` can't be reassigned by an importer).
// Shared types, pure config constants, the `escapeHtml` helper and the
// per-tab `sessions` map (mutated in place, never reassigned) also live here.

// ── Terminal theme types (xterm palette + monaco editor themes) ─────────────
export type TerminalThemePreset = "default" | "xterm" | "custom";
export type TerminalThemePalette = {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selection?: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
};
export type TerminalThemeConfig = {
  preset: TerminalThemePreset;
  colors: Partial<TerminalThemePalette>;
};

export const DEFAULT_TERMINAL_THEME_CONFIG: TerminalThemeConfig = {
  preset: "default",
  colors: {},
};

// ── History (shared page size, needed by the S initializer) ─────────────────
export const HISTORY_PAGE_SIZE = 10;

// ── Snippets (database-backed) ──────────────────────────────────────────────
export interface SnippetCategory { id: number; name: string; }
export interface SnippetTag { id: number; name: string; categoryId: number; }
export interface SnippetItem { id: number; name: string; categoryId: number; command: string; tagIds: number[]; }
export interface SnippetState { categories: SnippetCategory[]; tags: SnippetTag[]; snippets: SnippetItem[]; }

// ── Per-tab session shape. The local xterm packages are bundled into the
// terminal entry; these legacy `any` fields can be typed in a later cleanup. ─
export type TerminalSession = {
  term: any;
  ws: WebSocket | null;
  fitAddon: any;
  container: HTMLElement;
  label: string;
  targetScope: string;
  accentClass: string;
  lineBuffer: string;
  cursorPos: number;
  cwd: string;
  historyIdx: number;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  connecting?: boolean;
  outputTail?: string;
  cdOnConnect: string | null;
  initialCommand: string | null;
  startupCommand: string | null;
  sessionStorageKey?: string;
  suppressConnectedBanner: boolean;
  // Id estable por pestaña para reattach: se manda como `?sessionId=` en CADA
  // conexión (inicial + reconexiones). El backend lo usa para re-adjuntar la
  // misma sesión tmux (DirectSSH no-hosting) → el shell sobrevive a cortes del WS.
  persistentSessionId?: string;
  // Reactivación tras suspensión del WebView (cambio de app en móvil): al volver
  // a primer plano el socket puede quedar "zombi" (OPEN pero muerto, `onclose`
  // nunca dispara). `awaitingPong` marca un sondeo de liveness en curso; si no
  // llega `pong` a tiempo, forzamos reconexión (el backend re-adjunta el tmux).
  // `endedNormally` = el PTY salió a propósito (`process-exit`): NO revivir
  // en la reactivación (re-adjuntar crearía una sesión tmux nueva, no deseada).
  awaitingPong?: boolean;
  endedNormally?: boolean;
  // ── Visibilidad diferida: la terminal se mantiene oculta hasta que opencode
  // termina su bootstrap (instalación + arranque del TUI). El handler de
  // mensajes WS va escaneando `bootstrapBuffer` en busca del marker
  // `__LXP_TUI_READY__` o del escape \x1b[?1049h (alternate screen buffer
  // del TUI). Cuando uno aparece, la sesión deja de estar `pendingVisibility`
  // y mostramos la consola al usuario.
  pendingVisibility: boolean;
  bootstrapBuffer: string;
};

// Per-tab sessions. `const`: the map is mutated in place (set/delete/clear),
// never reassigned, so importers share the same instance.
export const sessions: Map<number, TerminalSession> = new Map();

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ── Reassignable cross-module state hub ─────────────────────────────────────
export const S = {
  // tabs / sessions
  tabCount: 1,
  activeTabId: 1,
  fontSize: 13,
  // xterm theme (read in theme.ts, reassigned in the preferences loaders)
  terminalThemeConfig: structuredClone(DEFAULT_TERMINAL_THEME_CONFIG) as TerminalThemeConfig,
  // history
  commandHistoryVisibleCount: HISTORY_PAGE_SIZE * 2,
  // mobile sticky modifiers
  mobileKeyPendingCtrl: false,
  mobileKeyPendingAlt: false,
  // snippets
  snippetState: { categories: [], tags: [], snippets: [] } as SnippetState,
  snippetFilterTagIds: [] as number[],
  snippetDialogTagIds: [] as number[],
  snippetPage: 0,
};
