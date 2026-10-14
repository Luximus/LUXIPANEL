// Floating terminal — embedded Monaco snippet-command editor + shell syntax
// highlight. Bundles monaco-editor (npm) via esbuild by design.
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/min/vs/editor/editor.main.css";
import "monaco-editor/esm/vs/basic-languages/shell/shell.contribution";
import { escapeHtml } from "./state";
import { I18N } from "./i18n";
import { DEFAULT_CUSTOM_LAYOUT_COLOR } from "@/lib/layout-palettes";
import { THEME_CHANGE_EVENT } from "@/lib/theme-storage-keys";

type SnippetCommandEditorApi = {
  setValue(value: string): void;
  getValue(): string;
  focus(): void;
  layout(): void;
  dispose(): void;
};

declare global {
  interface Window {
    __lxpTerminalCommandEditor?: SnippetCommandEditorApi;
  }
}

let commandEditor: monaco.editor.IStandaloneCodeEditor | null = null;
let commandEditorTheme = "";
let commandEditorThemeSyncSetupDone = false;
let commandEditorPendingValue = "";
const shellHighlightCache = new Map<string, string>();

function getEditorThemeName(): string {
  return document.documentElement.classList.contains("dark") ? "lxp-terminal-dark" : "lxp-terminal-light";
}

function defineEditorThemes(): void {
  monaco.editor.defineTheme("lxp-terminal-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "", foreground: "0f172a" },
      { token: "comment", foreground: "64748b" },
      { token: "keyword", foreground: "7c3aed" },
      { token: "string", foreground: "0f766e" },
      { token: "delimiter", foreground: "475569" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#0f172a",
      "editor.lineHighlightBackground": "#f8fafc",
      "editorLineNumber.foreground": "#94a3b8",
      "editorLineNumber.activeForeground": "#475569",
      "editor.selectionBackground": "#c4b5fd55",
      "editor.inactiveSelectionBackground": "#e2e8f044",
      "editorCursor.foreground": DEFAULT_CUSTOM_LAYOUT_COLOR,
      "editorGutter.background": "#f8fafc",
      "editorGutter.border": "#e2e8f0",
      "editorWidget.background": "#ffffff",
      "editorWidget.foreground": "#0f172a",
      "editorWidget.border": "#e2e8f0",
      "scrollbarSlider.background": "#cbd5e1aa",
      "scrollbarSlider.hoverBackground": "#cbd5e1aa",
      "scrollbarSlider.activeBackground": "#cbd5e1aa",
    },
  });

  monaco.editor.defineTheme("lxp-terminal-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "e5e7eb" },
      { token: "comment", foreground: "737373" },
      { token: "keyword", foreground: "c084fc" },
      { token: "string", foreground: "34d399" },
      { token: "delimiter", foreground: "a1a1aa" },
    ],
    colors: {
      "editor.background": "#111111",
      "editor.foreground": "#e5e7eb",
      "editor.lineHighlightBackground": "#1f1f1f",
      "editorLineNumber.foreground": "#71717a",
      "editorLineNumber.activeForeground": "#d4d4d8",
      "editor.selectionBackground": "#7c3aed55",
      "editor.inactiveSelectionBackground": "#3f3f4670",
      "editorCursor.foreground": "#c084fc",
      "editorGutter.background": "#111111",
      "editorGutter.border": "#27272a",
      "editorWidget.background": "#111111",
      "editorWidget.foreground": "#e5e7eb",
      "editorWidget.border": "#27272a",
      "scrollbarSlider.background": "#52525b99",
      "scrollbarSlider.hoverBackground": "#52525b99",
      "scrollbarSlider.activeBackground": "#52525b99",
    },
  });
}

function syncEditorTheme(): void {
  if (!commandEditor) return;
  const nextTheme = getEditorThemeName();
  if (nextTheme === commandEditorTheme) return;
  commandEditorTheme = nextTheme;
  monaco.editor.setTheme(nextTheme);
}

function ensureEditorThemeSync(): void {
  if (commandEditorThemeSyncSetupDone) return;
  commandEditorThemeSyncSetupDone = true;
  const observer = new MutationObserver(() => syncEditorTheme());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener(THEME_CHANGE_EVENT, syncEditorTheme as EventListener);
  document.addEventListener("astro:after-swap", syncEditorTheme);
}

async function colorizeShellCommand(text: string): Promise<string> {
  const cached = shellHighlightCache.get(text);
  if (cached) return cached;

  try {
    const html = await monaco.editor.colorize(text, "shell", { tabSize: 2 });
    shellHighlightCache.set(text, html);
    return html;
  } catch {
    return escapeHtml(text);
  }
}

function applyShellHighlight(root: ParentNode): void {
  const nodes = root.querySelectorAll<HTMLElement>("[data-shell-highlight]");
  for (const node of nodes) {
    const text = node.dataset.shellHighlight ?? "";
    if (!text) continue;

    void colorizeShellCommand(text).then((html) => {
      if (!node.isConnected || node.dataset.shellHighlight !== text) return;
      node.innerHTML = html;
    });
  }
}

function initSnippetCommandEditor(hostId = "snippet-cmd-editor"): void {
  const host = document.getElementById(hostId);
  if (!host) return;

  const hidden = document.getElementById("snippet-cmd") as HTMLTextAreaElement | null;

  if (!window.__lxpTerminalCommandEditor) {
    window.__lxpTerminalCommandEditor = {
      setValue(value: string) {
        commandEditorPendingValue = value;
        if (hidden) hidden.value = value;
        if (commandEditor) commandEditor.setValue(value);
      },
      getValue() {
        return commandEditor?.getValue() ?? commandEditorPendingValue ?? hidden?.value ?? "";
      },
      focus() {
        commandEditor?.focus();
      },
      layout() {
        commandEditor?.layout();
      },
      dispose() {
        commandEditor?.dispose();
        commandEditor = null;
        commandEditorPendingValue = hidden?.value ?? "";
      },
    };
  }

  if (!commandEditor) {
    defineEditorThemes();
    commandEditorTheme = getEditorThemeName();
    commandEditor = monaco.editor.create(host, {
      value: hidden?.value ?? "",
      language: "shell",
      theme: commandEditorTheme,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      fontFamily: '"LXP Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
      fontSize: 13,
      lineHeight: 21,
      tabSize: 2,
      insertSpaces: true,
      renderWhitespace: "selection",
      smoothScrolling: true,
      cursorSmoothCaretAnimation: "on",
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
    });

    commandEditor.onDidChangeModelContent(() => {
      const value = commandEditor?.getValue() ?? "";
      if (hidden) hidden.value = value;
    });

    commandEditor.addAction({
      id: "lxp-terminal-snippet-save",
      label: I18N.dialog.saveSnippetAction,
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        const form = document.getElementById("form-snippet") as HTMLFormElement | null;
        form?.requestSubmit();
        return;
      },
    });

    if (commandEditorPendingValue) {
      const nextValue = commandEditorPendingValue;
      commandEditorPendingValue = "";
      commandEditor.setValue(nextValue);
      if (hidden) hidden.value = nextValue;
    }
  } else if (commandEditor.getDomNode() !== host) {
    commandEditor.dispose();
    commandEditor = null;
    initSnippetCommandEditor(hostId);
    return;
  }

  syncEditorTheme();
  ensureEditorThemeSync();
}

export { initSnippetCommandEditor, applyShellHighlight };
