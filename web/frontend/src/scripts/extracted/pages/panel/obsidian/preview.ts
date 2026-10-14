import { state } from "./state";
import { $, t } from "./dom";

let renderSeq = 0;
const MARKDOWN_RENDERER_URL = "/scripts/extracted/vendor/markdown.js";

export function linkWikilinks(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.textContent?.includes("[[") && !node.parentElement?.closest("a,code,pre,button")) nodes.push(node);
  }
  for (const node of nodes) {
    const text = node.textContent ?? "";
    const re = /\[\[([^\]]+)\]\]/g;
    const fragment = document.createDocumentFragment();
    let start = 0;
    for (const match of text.matchAll(re)) {
      const index = match.index ?? 0;
      fragment.append(document.createTextNode(text.slice(start, index)));
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.wikilink = (match[1] ?? "").split("|")[0]?.split("#")[0]?.trim() ?? "";
      button.className = "font-medium text-primary underline underline-offset-2 hover:opacity-70";
      button.textContent = match[1] ?? "";
      fragment.append(button);
      start = index + match[0].length;
    }
    if (start) {
      fragment.append(document.createTextNode(text.slice(start)));
      node.replaceWith(fragment);
    }
  }
}

export async function renderPreview(): Promise<void> {
  const preview = $("obs-preview");
  const editor = $("obs-editor") as HTMLTextAreaElement | null;
  if (!preview || !editor || !state.notePath?.toLowerCase().endsWith(".md")) return;
  const seq = ++renderSeq;
  let renderMarkdown: (source: string) => string;
  try {
    ({ renderMarkdown } = await import(/* @vite-ignore */ MARKDOWN_RENDERER_URL));
  } catch {
    if (seq === renderSeq && preview.isConnected) preview.textContent = t("workspace.previewError", "No se pudo cargar la vista previa");
    return;
  }
  if (seq !== renderSeq || !preview.isConnected) return;
  preview.innerHTML = renderMarkdown(editor.value);
  linkWikilinks(preview);
}

export function applyEditorMode(): void {
  const editor = $("obs-editor") as HTMLTextAreaElement | null;
  const preview = $("obs-preview");
  const tabs = $("obs-mode-tabs");
  if (!editor || !preview || !tabs) return;
  const isMarkdown = !!state.notePath?.toLowerCase().endsWith(".md");
  tabs.classList.toggle("hidden", !isMarkdown);
  const mode = isMarkdown ? state.editorMode : "edit";
  editor.classList.toggle("hidden", !state.notePath || mode === "preview");
  preview.classList.toggle("hidden", !state.notePath || mode === "edit");
  editor.classList.toggle("lg:w-1/2", mode === "split");
  preview.classList.toggle("lg:w-1/2", mode === "split");
  preview.classList.toggle("max-lg:hidden", mode === "split");
  editor.style.fontSize = `${state.fontSize}px`;
  preview.style.fontSize = `${state.fontSize}px`;
  for (const button of tabs.querySelectorAll<HTMLButtonElement>("[data-obs-mode]")) {
    const active = button.dataset.obsMode === mode;
    button.classList.toggle("bg-primary/10", active);
    button.classList.toggle("text-primary", active);
    button.classList.toggle("text-muted-foreground", !active);
    button.setAttribute("aria-pressed", String(active));
  }
  if (mode !== "edit" && state.notePath) void renderPreview();
}

export function showMobilePane(pane: "tree" | "editor"): void {
  state.mobilePane = pane;
  const tree = $("obs-tree-pane");
  const editor = $("obs-editor-pane");
  tree?.classList.toggle("hidden", pane === "editor");
  tree?.classList.toggle("flex", pane === "tree");
  editor?.classList.toggle("hidden", pane === "tree");
  editor?.classList.toggle("flex", pane === "editor");
  // Desktop keeps both panes visible regardless of the mobile selection.
  tree?.classList.add("lg:flex");
  editor?.classList.add("lg:flex");
  for (const [id, active] of [["obs-mobile-tree", pane === "tree"], ["obs-mobile-editor", pane === "editor"]] as const) {
    const button = $(id);
    button?.setAttribute("aria-pressed", String(active));
    button?.classList.toggle("bg-card", active);
    button?.classList.toggle("shadow-sm", active);
    button?.classList.toggle("text-muted-foreground", !active);
  }
}
