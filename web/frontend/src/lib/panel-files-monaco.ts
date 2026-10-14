// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// IMPORTANTE: NO importar `monaco-editor` (ni sus CSS / basic-languages /
// language services) en el top-level del módulo. `AssistantFileEditorModal`
// hace `await import("@/lib/panel-files-monaco")`, y Vite incluye este módulo
// en el bundle SSR del PanelLayout. En SSR Node intenta resolver la cadena
// `editor.api` → `standaloneEditor` → `standalone-tokens.css` y revienta con
// ERR_UNKNOWN_FILE_EXTENSION → unhandled rejection durante el render de
// /panel/* → nginx devuelve 502.
//
// `monaco` se carga perezosamente vía `loadMonaco()` (solo cliente) y la API
// global `__lxpFilesMonacoEditor` solo se publica en `window` DESPUÉS de que
// la promesa resuelve. Los consumidores (`AssistantFileEditorModal`,
// `ensureMonaco` de nginx, `ensureEditor` de files) deben `await
// initFilesMonacoEditor(...)` antes de tocar `__lxpFilesMonacoEditor`.
import type * as Monaco from "monaco-editor";
import { DEFAULT_CUSTOM_LAYOUT_COLOR } from "@/lib/layout-palettes";
import { THEME_CHANGE_EVENT } from "@/lib/theme-storage-keys";

const MONACO_CSS_URL =
  "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/editor/editor.main.css";

let monaco!: typeof Monaco;
let monacoLoadPromise: Promise<typeof Monaco> | null = null;

/**
 * Carga perezosa de monaco-editor (cliente only). Inyecta el CSS de Monaco vía
 * `<link>` (los `import "...css"` romperían SSR) y registra las contribuciones
 * de lenguaje. Memoiza la promesa para que llamadas concurrentes compartan la
 * misma carga.
 */
function loadMonaco(): Promise<typeof Monaco> {
  if (monaco) return Promise.resolve(monaco);
  if (monacoLoadPromise) return monacoLoadPromise;
  monacoLoadPromise = (async () => {
    if (typeof document !== "undefined" && !document.querySelector("link[data-lxp-monaco]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = MONACO_CSS_URL;
      link.dataset.lxpMonaco = "true";
      document.head.appendChild(link);
    }
    // In-file find bar match highlights (custom decorations set via
    // deltaDecorations). Injected once; theme-aware via the panel's `.dark`.
    if (typeof document !== "undefined" && !document.querySelector("style[data-lxp-monaco-find]")) {
      const style = document.createElement("style");
      style.dataset.lxpMonacoFind = "true";
      style.textContent =
        ".lxp-find-match{background-color:rgba(250,204,21,.32);border-radius:2px;}" +
        ".lxp-find-match-current{background-color:rgba(249,115,22,.55);border-radius:2px;}" +
        ".dark .lxp-find-match{background-color:rgba(250,204,21,.24);}" +
        ".dark .lxp-find-match-current{background-color:rgba(249,115,22,.6);}";
      document.head.appendChild(style);
    }
    const api = await import("monaco-editor/esm/vs/editor/editor.api");
    // Tokenizers Monarch (= coloreado de sintaxis) de HTML y CSS. Los
    // servicios ricos `vs/language/{html,css,typescript}` de abajo SOLO
    // aportan IntelliSense por worker, NO colorean; sin estos básicos,
    // etiquetas HTML y reglas CSS salían sin color. (JS/TS ya colorean por
    // basic-languages/{javascript,typescript}; JSON colorea dentro de
    // vs/language/json.)
    await Promise.all([
      import("monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution"),
      import("monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution"),
      import("monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution"),
      import("monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution"),
      import("monaco-editor/esm/vs/basic-languages/xml/xml.contribution"),
      import("monaco-editor/esm/vs/basic-languages/shell/shell.contribution"),
      import("monaco-editor/esm/vs/basic-languages/python/python.contribution"),
      import("monaco-editor/esm/vs/basic-languages/php/php.contribution"),
      import("monaco-editor/esm/vs/basic-languages/sql/sql.contribution"),
      import("monaco-editor/esm/vs/basic-languages/ini/ini.contribution"),
      import("monaco-editor/esm/vs/basic-languages/dockerfile/dockerfile.contribution"),
      import("monaco-editor/esm/vs/basic-languages/scss/scss.contribution"),
      import("monaco-editor/esm/vs/basic-languages/less/less.contribution"),
      import("monaco-editor/esm/vs/basic-languages/rust/rust.contribution"),
      import("monaco-editor/esm/vs/basic-languages/go/go.contribution"),
      import("monaco-editor/esm/vs/basic-languages/java/java.contribution"),
      import("monaco-editor/esm/vs/basic-languages/kotlin/kotlin.contribution"),
      import("monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution"),
      import("monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution"),
      import("monaco-editor/esm/vs/basic-languages/lua/lua.contribution"),
      import("monaco-editor/esm/vs/basic-languages/swift/swift.contribution"),
      import("monaco-editor/esm/vs/basic-languages/html/html.contribution"),
      import("monaco-editor/esm/vs/basic-languages/css/css.contribution"),
      import("monaco-editor/esm/vs/language/html/monaco.contribution"),
      import("monaco-editor/esm/vs/language/css/monaco.contribution"),
      import("monaco-editor/esm/vs/language/json/monaco.contribution"),
      import("monaco-editor/esm/vs/language/typescript/monaco.contribution"),
    ]);
    registerCustomLanguages(api);
    monaco = api;
    return api;
  })();
  return monacoLoadPromise;
}

let customLanguagesRegistered = false;

/**
 * Registra lenguajes que Monaco no trae de fábrica. Hoy: `.astro`.
 *
 * Astro = frontmatter TypeScript entre las cercas `---` iniciales + template
 * HTML debajo. El tokenizer Monarch embebe `typescript` mientras dura el
 * frontmatter (`nextEmbedded: 'typescript'`, cerrado con `nextEmbedded:
 * '@pop'` en el segundo `---`) y delega TODO el resto del documento a
 * `text/html` (que a su vez colorea `<script>`/`<style>` embebidos gratis).
 * Así imports/const/await del frontmatter colorean como TS y el markup como
 * HTML — antes `.astro` caía a `html` y el frontmatter salía casi todo blanco.
 */
function registerCustomLanguages(m: typeof Monaco): void {
  if (customLanguagesRegistered) return;
  customLanguagesRegistered = true;

  const already = m.languages.getLanguages().some((l) => l.id === "astro");
  if (already) return;

  m.languages.register({ id: "astro", extensions: [".astro"], aliases: ["Astro", "astro"] });

  m.languages.setLanguageConfiguration("astro", {
    comments: { blockComment: ["<!--", "-->"] },
    brackets: [
      ["<", ">"],
      ["{", "}"],
      ["(", ")"],
      ["[", "]"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: "`", close: "`" },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: "`", close: "`" },
      { open: "<", close: ">" },
    ],
  });

  m.languages.setMonarchTokensProvider("astro", {
    defaultToken: "",
    tokenizer: {
      root: [
        // Cerca de apertura del frontmatter (`---` al inicio de línea) →
        // embebe TypeScript hasta la cerca de cierre.
        [/^\s*---\s*$/, { token: "keyword", next: "@frontmatter", nextEmbedded: "typescript" }],
        // Cualquier otra cosa = template: delega el resto del documento a HTML.
        [/./, { token: "@rematch", next: "@html", nextEmbedded: "text/html" }],
      ],
      frontmatter: [
        // Cerca de cierre `---` → termina el embebido TS y vuelve a root; la
        // siguiente línea abre el embebido HTML del template.
        [/^\s*---\s*$/, { token: "keyword", next: "@pop", nextEmbedded: "@pop" }],
      ],
      html: [
        // El template embebe HTML hasta el fin del archivo. Monarch EXIGE que un
        // estado embebido tenga al menos una regla con `nextEmbedded: '@pop'` o
        // lanza al llegar al EOF ("no rule containing nextEmbedded @pop") y
        // rompe el coloreado del template. Esta regla sólo se dispararía ante
        // OTRA cerca `---` a nivel de línea (inusual en un template Astro).
        [/^\s*---\s*$/, { token: "keyword", next: "@pop", nextEmbedded: "@pop" }],
      ],
    },
  });
}

type FilePayload = {
  path: string;
  name: string;
  content: string;
  originalContent?: string;
  /** Left-hand side of the diff view, INDEPENDENT of the saved/dirty baseline.
   *  The assistant modal passes the file's git-HEAD content here so `openDiff()`
   *  shows "how it was (HEAD) → how it is now" without marking the file dirty
   *  (dirty still compares against `originalContent` = the loaded content).
   *  Omitted by the Files page → diff falls back to `originalContent`. */
  diffBaseline?: string;
};

/** Options for the in-file find bar (VS Code-style, driven from editor.ts). */
export interface FindOptions {
  isRegex?: boolean;
  matchCase?: boolean;
  wholeWord?: boolean;
}
/** Result of a find/findNext/findPrev call. `error` = invalid regex (the
 *  caller marks the input red); `index` is 1-based (0 = no current match). */
export interface FindResult {
  total: number;
  index: number;
  error?: boolean;
}

/** A 1-based Monaco range (line/column), used by the AI editor bar for
 *  selections and `replaceRange` edits. */
export interface EditorRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/** Current non-empty selection returned by `getSelection` (range + its text). */
export interface EditorSelection extends EditorRange {
  text: string;
}

/** An assistant edit applied to the live model (see `applyEdit`). Mirrors the
 *  backend `/api/ai/files/editor-chat` `edit` field. */
export type EditorApplyEdit =
  | { mode: "replaceAll"; content: string }
  | { mode: "replaceRange"; range: EditorRange; content: string };

export interface FilesMonacoEditorApi {
  openFile(payload: FilePayload): void;
  getValue(): string;
  setValue(value: string): void;
  closeFile(): void;
  markSaved(value?: string): void;
  openDiff(): void;
  closeDiff(): void;
  isDirty(): boolean;
  /** Reveal and place the cursor on a 1-based line (used by content search). */
  gotoLine(line: number): void;
  /** Current non-empty selection (1-based coords) + its text, or null. Used by
   *  the AI editor bar to send `selection` context to the backend. */
  getSelection(): EditorSelection | null;
  /** Apply an assistant edit UNDOABLY (Monaco `executeEdits`, never `setValue`,
   *  so Ctrl+Z reverts it) and mark the buffer dirty through the normal change
   *  path. `replaceAll` swaps the whole model; `replaceRange` uses the given
   *  range. Returns false when there's no editor/model. */
  applyEdit(edit: EditorApplyEdit): boolean;
  /** Return keyboard focus to the code editor (the AI bar's Escape handler). */
  focus(): void;
  /** Recompute matches for `query` (highlighting all + the current one) and
   *  return the count. The current match is the first at/after the cursor. */
  find(query: string, opts?: FindOptions): FindResult;
  /** Advance to the next match (wraps), revealing + selecting it. */
  findNext(): FindResult;
  /** Go to the previous match (wraps), revealing + selecting it. */
  findPrev(): FindResult;
  /** Clear all find decorations + state and return focus to the editor. */
  clearFind(returnFocus?: boolean): void;
  layout(): void;
  dispose(): void;
}

declare global {
  interface Window {
    __lxpFilesMonacoEditor?: FilesMonacoEditorApi;
  }
}

let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
let diffEditor: Monaco.editor.IStandaloneDiffEditor | null = null;
let currentTheme = "";
let syncSetupDone = false;
let pendingFile: FilePayload | null = null;
let pendingLayout = false;
let originalContent = "";
let activeFile: FilePayload | null = null;
let isDirty = false;
let diffVisible = false;
let suppressDirtyTracking = false;
let editorHostId = "";
let diffHostId = "";
// Element id of the wrapper Monaco shows/hides for the diff view. Parameterized
// so a second host (the assistant file modal) can drive its OWN diff panel
// instead of colliding with the Files page's hardcoded `#file-diff-panel`.
let diffPanelId = "file-diff-panel";
let diffOriginalModel: Monaco.editor.ITextModel | null = null;
let diffModifiedModel: Monaco.editor.ITextModel | null = null;
// Explicit diff baseline (left side). When null the diff falls back to
// `originalContent`; see `FilePayload.diffBaseline`.
let diffBaselineContent: string | null = null;

// ── In-file find bar state (VS Code-style, driven by the header find bar) ────
// The decorations Monaco assigned to the highlighted matches (owned so we can
// replace/clear them with deltaDecorations). `findMatches` are the ranges; the
// current one (0-based) is `findCurrentIndex`. Cleared on file open/close and
// tab switch so a stale highlight never survives.
let findDecorations: string[] = [];
let findMatches: Monaco.editor.FindMatch[] = [];
let findCurrentIndex = -1;

/** Drop every find decoration + reset the match list (does NOT touch the input;
 *  that's the caller's job). */
function resetFindState(): void {
  if (editor && findDecorations.length) {
    findDecorations = editor.deltaDecorations(findDecorations, []);
  }
  findDecorations = [];
  findMatches = [];
  findCurrentIndex = -1;
}

/** Re-apply decorations for the current match set, styling the active match
 *  distinctly from the rest. */
function applyFindDecorations(): void {
  if (!editor) return;
  const next = findMatches.map((m, i) => ({
    range: m.range,
    options: {
      className: i === findCurrentIndex ? "lxp-find-match-current" : "lxp-find-match",
      stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
    },
  }));
  findDecorations = editor.deltaDecorations(findDecorations, next);
}

/** Reveal + select the current match WITHOUT stealing DOM focus from the find
 *  input (revealRangeInCenterIfOutsideViewport + setSelection, never focus). */
function revealFindCurrent(): void {
  if (!editor || findCurrentIndex < 0) return;
  const m = findMatches[findCurrentIndex];
  if (!m) return;
  editor.revealRangeInCenterIfOutsideViewport(m.range);
  editor.setSelection(m.range);
}

/** Text the diff's ORIGINAL (left) pane shows: the explicit `diffBaseline`
 *  when one was provided, else the saved/loaded content. */
function diffOriginalText(): string {
  return diffBaselineContent ?? originalContent;
}

const themePalette = {
  light: {
    background: "#ffffff",
    foreground: "#0f172a",
    lineHighlight: "#f8fafc",
    lineNumber: "#94a3b8",
    lineNumberActive: "#475569",
    selection: "#c4b5fd55",
    inactiveSelection: "#e2e8f044",
    cursor: DEFAULT_CUSTOM_LAYOUT_COLOR,
    gutterBackground: "#f8fafc",
    border: "#e2e8f0",
    widgetBackground: "#ffffff",
    widgetForeground: "#0f172a",
    scrollbar: "#cbd5e1aa",
  },
  dark: {
    background: "#0f0f0f",
    foreground: "#e5e7eb",
    lineHighlight: "#1f1f1f",
    lineNumber: "#71717a",
    lineNumberActive: "#d4d4d8",
    selection: "#7c3aed55",
    inactiveSelection: "#3f3f4670",
    cursor: "#c084fc",
    gutterBackground: "#0a0a0a",
    border: "#27272a",
    widgetBackground: "#111111",
    widgetForeground: "#e5e7eb",
    scrollbar: "#52525b99",
  },
} as const;

// Opciones compartidas entre el editor principal y el diff editor. Las claves
// específicas de cada uno (value/language del principal; readOnly/diff del
// comparador) se añaden por spread en cada sitio de creación.
const BASE_EDITOR_OPTIONS = {
  automaticLayout: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontFamily: '"LXP Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  fontSize: 13,
  lineHeight: 21,
  tabSize: 2,
  insertSpaces: true,
  smoothScrolling: true,
  wordWrap: "on",
  renderWhitespace: "selection",
  cursorSmoothCaretAnimation: "on",
  scrollbar: {
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
} as const;

const languageMap: Array<[RegExp, string]> = [
  [/^(dockerfile|docker\.file|containerfile)$/, "dockerfile"],
  [/^makefile$/, "plaintext"],
  // .astro = lenguaje propio (frontmatter TS embebido + template HTML). Ver
  // registerCustomLanguages(). Debe ir ANTES que la regla de html.
  [/\.astro$/, "astro"],
  [/\.(ts|mts|cts)$/, "typescript"],
  // .tsx → typescript: el servicio `typescript` de Monaco tokeniza TSX/JSX
  // correctamente (keywords, tipos y el markup embebido).
  [/\.tsx$/, "typescript"],
  [/\.(js|jsx|mjs|cjs)$/, "javascript"],
  [/\.(json|jsonc|json5)$/, "json"],
  // vue/svelte → html como aproximación razonable (no hay lenguaje dedicado en
  // el bundle basic-languages).
  [/\.(html|htm|vue|svelte)$/, "html"],
  [/\.(css)$/, "css"],
  [/\.(scss|sass)$/, "scss"],
  [/\.(less)$/, "less"],
  [/\.(md|markdown|mdx)$/, "markdown"],
  [/\.(yaml|yml)$/, "yaml"],
  [/\.(xml|svg)$/, "xml"],
  [/\.(sh|bash|zsh)$/, "shell"],
  [/\.(py|pyw)$/, "python"],
  [/\.(php)$/, "php"],
  [/\.(sql)$/, "sql"],
  // toml no tiene tokenizer dedicado en el bundle → ini es una aproximación
  // (clave=valor, [secciones], `#` comentarios).
  [/\.(ini|conf|cfg|toml)$/, "ini"],
  [/\.(rs)$/, "rust"],
  [/\.(go)$/, "go"],
  [/\.(java)$/, "java"],
  [/\.(kt|kts)$/, "kotlin"],
  [/\.(cpp|cc|cxx|hpp|hxx|h)$/, "cpp"],
  [/\.(cs)$/, "csharp"],
  [/\.(lua)$/, "lua"],
  [/\.(swift)$/, "swift"],
];

function getThemeName(): string {
  return document.documentElement.classList.contains("dark") ? "lxp-dark" : "lxp-light";
}

function buildColors(p: Record<keyof (typeof themePalette)["light"], string>): Record<string, string> {
  return {
    "editor.background": p.background,
    "editor.foreground": p.foreground,
    "editor.lineHighlightBackground": p.lineHighlight,
    "editorLineNumber.foreground": p.lineNumber,
    "editorLineNumber.activeForeground": p.lineNumberActive,
    "editor.selectionBackground": p.selection,
    "editor.inactiveSelectionBackground": p.inactiveSelection,
    "editorCursor.foreground": p.cursor,
    "editorGutter.background": p.gutterBackground,
    "editorGutter.border": p.border,
    "editorWidget.background": p.widgetBackground,
    "editorWidget.foreground": p.widgetForeground,
    "editorWidget.border": p.border,
    "scrollbarSlider.background": p.scrollbar,
    "scrollbarSlider.hoverBackground": p.scrollbar,
    "scrollbarSlider.activeBackground": p.scrollbar,
  };
}

function defineThemes(): void {
  monaco.editor.defineTheme("lxp-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "", foreground: "0f172a" },
    ],
    colors: buildColors(themePalette.light),
  });

  monaco.editor.defineTheme("lxp-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "e5e7eb" },
    ],
    colors: buildColors(themePalette.dark),
  });
}

function inferLanguage(filePath: string, content = ""): string {
  const normalized = filePath.split("/").pop()?.toLowerCase() ?? filePath.toLowerCase();

  for (const [pattern, language] of languageMap) {
    if (pattern.test(normalized)) return language;
  }

  if (normalized === ".env" || normalized.startsWith(".env.")) return "ini";
  if (normalized === ".gitignore" || normalized === ".dockerignore") return "ini";
  if (normalized === "procfile") return "ini";

  const firstLine = content.split("\n", 1)[0] ?? "";
  if (firstLine.startsWith("#!")) {
    if (/(bash|sh|zsh)/i.test(firstLine)) return "shell";
    if (/python/i.test(firstLine)) return "python";
    if (/node/i.test(firstLine)) return "javascript";
  }

  return "plaintext";
}

function syncTheme(): void {
  const nextTheme = getThemeName();
  if (nextTheme === currentTheme) return;
  currentTheme = nextTheme;
  monaco.editor.setTheme(nextTheme);
}

function syncDirtyState(force = false): void {
  if (suppressDirtyTracking && !force) return;
  const nextDirty = Boolean(activeFile && editor && editor.getValue() !== originalContent);
  if (nextDirty === isDirty && !force) return;
  isDirty = nextDirty;
  window.dispatchEvent(new CustomEvent("lxp-files-editor-dirty-change", { detail: { dirty: isDirty } }));
}

function emitContentChange(): void {
  if (!editor) return;
  window.dispatchEvent(
    new CustomEvent("lxp-files-editor-content-change", {
      detail: {
        content: editor.getValue(),
        dirty: isDirty,
      },
    }),
  );
}

function setEditorVisible(visible: boolean): void {
  const editorEl = document.getElementById(editorHostId);
  const diffPanel = document.getElementById(diffPanelId);
  if (editorEl) editorEl.classList.toggle("hidden", !visible);
  if (diffPanel) {
    // The panel has `flex-col` but NOT `flex` (display). `hidden` alone, when
    // removed, leaves it as display:block → the diff editor's `flex-1` height
    // collapses (Monaco shows ~1 line / blank, header overlaps). Toggle the
    // actual `flex` display on so flex-col + flex-1 size the editor correctly.
    diffPanel.classList.toggle("hidden", visible);
    diffPanel.classList.toggle("flex", !visible);
  }
}

function ensureDiffEditor(): Monaco.editor.IStandaloneDiffEditor | null {
  const host = document.getElementById(diffHostId);
  if (!host) return null;

  if (!diffEditor) {
    diffEditor = monaco.editor.createDiffEditor(host, {
      ...BASE_EDITOR_OPTIONS,
      theme: currentTheme,
      readOnly: true,
      renderSideBySide: true,
      useInlineViewWhenSpaceIsLimited: true,
      ignoreTrimWhitespace: false,
      originalEditable: false,
    });
  }

  return diffEditor;
}

function disposeDiffModels(): void {
  diffOriginalModel?.dispose();
  diffModifiedModel?.dispose();
  diffOriginalModel = null;
  diffModifiedModel = null;
}

function closeDiffView(): void {
  diffVisible = false;
  const diff = diffEditor;
  if (diff) {
    diff.setModel(null);
  }
  disposeDiffModels();
  setEditorVisible(true);
  syncTheme();
  window.dispatchEvent(new CustomEvent("lxp-files-editor-diff-change", { detail: { open: false } }));
  editor?.layout();
}

function openDiffView(): void {
  if (!editor || !activeFile) return;

  // Show the diff panel BEFORE creating/laying out the Monaco diff editor.
  // Creating it (or calling layout) while its host is `display:none` (0×0)
  // makes the line-by-line comparison render blank/misaligned. With the host
  // sized first, the diff computes and aligns correctly.
  setEditorVisible(false);
  const diff = ensureDiffEditor();
  if (!diff) { setEditorVisible(true); return; }

  const baseline = diffOriginalText();
  const language = inferLanguage(activeFile.path || activeFile.name, baseline);
  disposeDiffModels();
  diffOriginalModel = monaco.editor.createModel(baseline, language);
  diffModifiedModel = monaco.editor.createModel(editor.getValue(), language);
  diff.setModel({
    original: diffOriginalModel,
    modified: diffModifiedModel,
  });
  diffVisible = true;
  syncTheme();
  window.dispatchEvent(new CustomEvent("lxp-files-editor-diff-change", { detail: { open: true } }));
  // Lay out on the next frame, once the panel is actually painted with size.
  requestAnimationFrame(() => { try { diff.layout(); } catch { /* noop */ } });
}

function refreshDiffView(): void {
  if (!diffVisible || !diffEditor || !activeFile) return;
  const baseline = diffOriginalText();
  const language = inferLanguage(activeFile.path || activeFile.name, baseline);
  if (!diffOriginalModel || !diffModifiedModel) return;
  diffOriginalModel.setValue(baseline);
  diffModifiedModel.setValue(editor?.getValue() ?? "");
  monaco.editor.setModelLanguage(diffOriginalModel, language);
  monaco.editor.setModelLanguage(diffModifiedModel, language);
  diffEditor.layout();
}

function ensureThemeSync(): void {
  if (syncSetupDone) return;
  syncSetupDone = true;
  const observer = new MutationObserver(() => syncTheme());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener(THEME_CHANGE_EVENT, syncTheme as EventListener);
  document.addEventListener("astro:after-swap", syncTheme);
}

export async function initFilesMonacoEditor(options: { hostId: string; diffHostId?: string; diffPanelId?: string }): Promise<void> {
  const m = await loadMonaco();
  monaco = m; // sync module-level ref para closures y helpers (defineThemes, openDiffView, …)
  const host = document.getElementById(options.hostId);
  if (!host) return;
  editorHostId = options.hostId;
  diffHostId = options.diffHostId ?? diffHostId;
  diffPanelId = options.diffPanelId ?? diffPanelId;

  if (!window.__lxpFilesMonacoEditor) {
    window.__lxpFilesMonacoEditor = {
      openFile(payload: FilePayload) {
        pendingFile = payload;
        if (!editor) return;
        // A new file (or a tab switch, which re-opens) invalidates any find
        // highlight from the previous buffer.
        resetFindState();
        activeFile = payload;
        originalContent = payload.originalContent ?? payload.content;
        diffBaselineContent = payload.diffBaseline ?? null;
        suppressDirtyTracking = true;
        const language = inferLanguage(payload.path || payload.name, payload.content);
        editor.setValue(payload.content);
        const model = editor.getModel();
        if (model) {
          monaco.editor.setModelLanguage(model, language);
        }
        suppressDirtyTracking = false;
        editor.updateOptions({ readOnly: false });
        editor.focus();
        editor.setPosition({ lineNumber: 1, column: 1 });
        editor.revealLine(1);
        closeDiffView();
        syncDirtyState(true);
      },
      getValue() {
        return editor?.getValue() ?? pendingFile?.content ?? "";
      },
      setValue(value: string) {
        if (editor) {
          suppressDirtyTracking = true;
          editor.setValue(value);
          suppressDirtyTracking = false;
          syncDirtyState(true);
          return;
        }
        pendingFile = pendingFile ? { ...pendingFile, content: value } : { path: "", name: "", content: value };
      },
      closeFile() {
        resetFindState();
        activeFile = null;
        originalContent = "";
        diffBaselineContent = null;
        pendingFile = null;
        suppressDirtyTracking = true;
        editor?.setValue("");
        suppressDirtyTracking = false;
        closeDiffView();
        isDirty = false;
        window.dispatchEvent(new CustomEvent("lxp-files-editor-dirty-change", { detail: { dirty: false } }));
      },
      markSaved(value?: string) {
        if (!editor) return;
        if (typeof value === "string") {
          originalContent = value;
        } else {
          originalContent = editor.getValue();
        }
        suppressDirtyTracking = false;
        syncDirtyState(true);
        closeDiffView();
      },
      openDiff() {
        openDiffView();
      },
      closeDiff() {
        closeDiffView();
      },
      isDirty() {
        return isDirty;
      },
      gotoLine(line: number) {
        if (!editor || !Number.isFinite(line) || line < 1) return;
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column: 1 });
        editor.focus();
      },
      getSelection(): EditorSelection | null {
        if (!editor) return null;
        const sel = editor.getSelection();
        const model = editor.getModel();
        if (!sel || !model || sel.isEmpty()) return null;
        return {
          startLineNumber: sel.startLineNumber,
          startColumn: sel.startColumn,
          endLineNumber: sel.endLineNumber,
          endColumn: sel.endColumn,
          text: model.getValueInRange(sel),
        };
      },
      applyEdit(edit: EditorApplyEdit): boolean {
        if (!editor) return false;
        const model = editor.getModel();
        if (!model) return false;
        const range =
          edit.mode === "replaceAll"
            ? model.getFullModelRange()
            : new monaco.Range(
                edit.range.startLineNumber,
                edit.range.startColumn,
                edit.range.endLineNumber,
                edit.range.endColumn,
              );
        // executeEdits (with surrounding undo stops) keeps the change on
        // Monaco's undo stack — Ctrl+Z reverts it — and fires
        // onDidChangeModelContent, so dirty tracking + the diff view update
        // through the normal edit path. NEVER setValue (that wipes undo).
        editor.pushUndoStop();
        const ok = editor.executeEdits("lxp-ai-edit", [
          { range, text: edit.content, forceMoveMarkers: true },
        ]);
        editor.pushUndoStop();
        // Bring the first edited zone into view so the user sees the applied
        // change on return to the code. `revealRangeInCenterIfOutsideViewport`
        // is a no-op when the spot is already visible, so a reader who was
        // looking at the edited region keeps their scroll. For a whole-file
        // rewrite the "first zone" is the top of the file.
        if (ok) {
          const line = edit.mode === "replaceAll" ? 1 : edit.range.startLineNumber;
          const column = edit.mode === "replaceAll" ? 1 : edit.range.startColumn;
          try {
            editor.revealRangeInCenterIfOutsideViewport(new monaco.Range(line, column, line, column));
          } catch { /* reveal is best-effort */ }
        }
        return ok;
      },
      focus() {
        editor?.focus();
      },
      find(query: string, opts?: FindOptions): FindResult {
        if (!editor) return { total: 0, index: 0 };
        const model = editor.getModel();
        if (!model || !query) {
          resetFindState();
          return { total: 0, index: 0 };
        }
        let matches: Monaco.editor.FindMatch[];
        try {
          matches = model.findMatches(
            query,
            /* searchOnlyEditableRange */ false,
            /* isRegex */ Boolean(opts?.isRegex),
            /* matchCase */ Boolean(opts?.matchCase),
            /* wordSeparators */ opts?.wholeWord ? editor.getOption(monaco.editor.EditorOption.wordSeparators) : null,
            /* captureMatches */ false,
          );
        } catch {
          // Invalid regex — don't throw; signal the caller to flag the input.
          resetFindState();
          return { total: 0, index: 0, error: true };
        }
        findMatches = matches;
        if (!matches.length) {
          findCurrentIndex = -1;
          applyFindDecorations();
          return { total: 0, index: 0 };
        }
        // Current = first match at/after the cursor, else the first one.
        const pos = editor.getPosition();
        let idx = 0;
        if (pos) {
          const found = matches.findIndex((m) => {
            const r = m.range;
            return r.startLineNumber > pos.lineNumber || (r.startLineNumber === pos.lineNumber && r.startColumn >= pos.column);
          });
          idx = found >= 0 ? found : 0;
        }
        findCurrentIndex = idx;
        applyFindDecorations();
        revealFindCurrent();
        return { total: matches.length, index: idx + 1 };
      },
      findNext(): FindResult {
        if (!editor || !findMatches.length) return { total: findMatches.length, index: 0 };
        findCurrentIndex = (findCurrentIndex + 1) % findMatches.length;
        applyFindDecorations();
        revealFindCurrent();
        return { total: findMatches.length, index: findCurrentIndex + 1 };
      },
      findPrev(): FindResult {
        if (!editor || !findMatches.length) return { total: findMatches.length, index: 0 };
        findCurrentIndex = (findCurrentIndex - 1 + findMatches.length) % findMatches.length;
        applyFindDecorations();
        revealFindCurrent();
        return { total: findMatches.length, index: findCurrentIndex + 1 };
      },
      clearFind(returnFocus?: boolean) {
        resetFindState();
        if (returnFocus) editor?.focus();
      },
      layout() {
        if (diffVisible && diffEditor) {
          diffEditor.layout();
          return;
        }
        if (editor) {
          editor.layout();
          return;
        }
        pendingLayout = true;
      },
      dispose() {
        resetFindState();
        editor?.dispose();
        diffEditor?.dispose();
        editor = null;
        diffEditor = null;
        pendingFile = null;
        pendingLayout = false;
        disposeDiffModels();
        originalContent = "";
        diffBaselineContent = null;
        activeFile = null;
        isDirty = false;
        diffVisible = false;
        suppressDirtyTracking = false;
      },
    };
  }

  if (!editor) {
    defineThemes();
    currentTheme = getThemeName();
    editor = monaco.editor.create(host, {
      ...BASE_EDITOR_OPTIONS,
      value: "",
      language: "plaintext",
      theme: currentTheme,
    });

    editor.onDidChangeModelContent(() => {
      if (suppressDirtyTracking) return;
      syncDirtyState();
      refreshDiffView();
      emitContentChange();
    });

    if (pendingFile) {
      const file = pendingFile;
      pendingFile = null;
      window.__lxpFilesMonacoEditor.openFile(file);
    }
    if (pendingLayout) {
      pendingLayout = false;
      editor.layout();
    }

    editor.addAction({
      id: "lxp-files-save",
      label: "Guardar archivo",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => {
        window.dispatchEvent(new CustomEvent("lxp-files-editor-save"));
      },
    });
  } else if (editor.getDomNode() !== host) {
    // The Monaco host was swapped (SPA nav re-rendered #file-editor). Dispose and
    // re-create on the fresh host, AWAITING the re-init so callers (ensureEditor /
    // showEditorView) don't sync/layout before Monaco is anchored to the new node.
    editor.dispose();
    editor = null;
    await initFilesMonacoEditor(options);
    return;
  }

  syncTheme();
  ensureThemeSync();
}
