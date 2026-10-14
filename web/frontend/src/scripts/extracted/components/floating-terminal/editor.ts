// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Monaco is only needed for the snippet editor. Keep it out of the terminal
// bootstrap so opening a terminal does not download or parse the editor.
type MonacoEditor = typeof import("/scripts/extracted/components/floating-terminal/terminal-monaco.js");
let editorModule: MonacoEditor | null = null;
let editorPromise: Promise<MonacoEditor> | null = null;

function loadEditor(): Promise<MonacoEditor> {
  if (editorModule) return Promise.resolve(editorModule);
  if (editorPromise) return editorPromise;
  editorPromise = Promise.all([
    import("/scripts/extracted/components/floating-terminal/terminal-monaco.js?v=20260929-drawer-speed"),
    new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLLinkElement>('link[data-lxp-terminal-monaco-css]');
      if (existing?.dataset.loaded === "true") { resolve(); return; }
      const link = existing ?? document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/scripts/extracted/components/floating-terminal/terminal-monaco.css?v=20260929-drawer-speed";
      link.dataset.lxpTerminalMonacoCss = "";
      link.addEventListener("load", () => { link.dataset.loaded = "true"; resolve(); }, { once: true });
      link.addEventListener("error", () => { link.remove(); reject(new Error("Terminal Monaco CSS failed to load")); }, { once: true });
      if (!existing) document.head.appendChild(link);
    }),
  ]).then(([module]) => {
    editorModule = module;
    return module;
  }).catch((error) => { editorPromise = null; throw error; });
  return editorPromise;
}

export async function initSnippetCommandEditor(hostId = "snippet-cmd-editor"): Promise<void> {
  const module = await loadEditor();
  document.getElementById(hostId)?.classList.remove("hidden");
  document.getElementById("snippet-cmd")?.classList.add("hidden");
  module.initSnippetCommandEditor(hostId);
  const list = document.getElementById("snippet-list");
  if (list) module.applyShellHighlight(list);
}

export function applyShellHighlight(root: ParentNode): void {
  editorModule?.applyShellHighlight(root);
}
