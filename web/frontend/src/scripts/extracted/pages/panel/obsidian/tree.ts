// Obsidian page — vault note tree (build / render / collapse).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { state, vaultApi } from "./state";
import type { VaultTree, TreeNote } from "./state";
import { t, esc, $ } from "./dom";

// ── Tree ─────────────────────────────────────────────────────────────────────
export interface DirNode {
  path: string;
  name: string;
  dirs: Map<string, DirNode>;
  notes: TreeNote[];
}

export async function loadTree() {
  const el = $("obs-tree");
  if (!el || !state.vaultId) return;
  const vaultId = state.vaultId;
  const scopeSeq = state.scopeSeq;
  el.innerHTML = `<p class="px-3 py-3 text-xs text-muted-foreground">${t("labels.loading", "Cargando…")}</p>`;
  const res = await api.get<VaultTree>(vaultApi("/tree"));
  if (vaultId !== state.vaultId || scopeSeq !== state.scopeSeq) return;
  if (!res.ok) {
    el.innerHTML = `<p class="px-3 py-3 text-xs text-destructive">${esc(res.error ?? t("errors.loadTree", "Error al cargar el árbol"))}</p>`;
    return;
  }
  state.tree = res.data ?? { folders: [], notes: [] };
  renderTree();
}

export function buildTree(): DirNode {
  const root: DirNode = { path: "", name: "", dirs: new Map(), notes: [] };
  const ensureDir = (rel: string): DirNode => {
    let node = root;
    if (!rel) return node;
    let acc = "";
    for (const part of rel.split("/").filter(Boolean)) {
      acc = acc ? `${acc}/${part}` : part;
      let child = node.dirs.get(part);
      if (!child) {
        child = { path: acc, name: part, dirs: new Map(), notes: [] };
        node.dirs.set(part, child);
      }
      node = child;
    }
    return node;
  };
  for (const folder of state.tree.folders) ensureDir(folder);
  for (const note of state.tree.notes) {
    const idx = note.path.lastIndexOf("/");
    const parent = idx >= 0 ? note.path.slice(0, idx) : "";
    ensureDir(parent).notes.push(note);
  }
  return root;
}

export function renderDir(node: DirNode, depth: number): string {
  const pad = 8 + depth * 14;
  const dirs = [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name));
  const notes = [...node.notes].sort((a, b) => a.name.localeCompare(b.name));
  let html = "";
  for (const dir of dirs) {
    const isCollapsed = state.collapsed.has(dir.path);
    html += `<div>
      <button data-folder="${esc(dir.path)}" style="padding-left:${pad}px"
        aria-expanded="${!isCollapsed}" class="obs-folder group flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary">
        <i class="ti ${isCollapsed ? "ti-chevron-right" : "ti-chevron-down"} text-xs text-muted-foreground"></i>
        <i class="ti ti-folder text-sm text-amber-500/80"></i>
        <span class="truncate font-medium">${esc(dir.name)}</span>
      </button>`;
    if (!isCollapsed) html += renderDir(dir, depth + 1);
    html += `</div>`;
  }
  for (const note of notes) {
    const active = note.path === state.notePath;
    const isCanvas = note.name.toLowerCase().endsWith(".canvas");
    html += `<div class="obs-note group flex w-full items-center rounded-md ${active ? "bg-accent font-medium" : "hover:bg-accent"}">
      <button type="button" data-note="${esc(note.path)}" style="padding-left:${pad}px" aria-current="${active ? "page" : "false"}"
        class="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-primary">
      <i class="ti ${isCanvas ? "ti-layout-board" : "ti-file-text"} text-sm text-muted-foreground"></i>
      <span class="min-w-0 flex-1 truncate" title="${esc(note.path)}">${esc(note.name)}</span></button>
      ${note.canWrite ? `<span class="flex shrink-0 items-center gap-0.5 opacity-70 group-hover:opacity-100 group-focus-within:opacity-100">
        <button data-rename="${esc(note.path)}" title="${t("actions.rename", "Renombrar")}"
          aria-label="${t("actions.rename", "Renombrar")}: ${esc(note.name)}" class="obs-note-rename rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
          <i class="ti ti-pencil text-xs"></i>
        </button>
        <button data-delete="${esc(note.path)}" title="${t("actions.delete", "Eliminar")}"
          aria-label="${t("actions.delete", "Eliminar")}: ${esc(note.name)}" class="obs-note-delete rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-primary">
          <i class="ti ti-trash text-xs"></i>
        </button>
      </span>` : ""}
    </div>`;
  }
  return html;
}

export function renderTree() {
  const el = $("obs-tree");
  if (!el) return;
  if (state.tree.notes.length === 0 && state.tree.folders.length === 0) {
    el.innerHTML = `<div class="px-3 py-8 text-center">
      <p class="mb-3 text-xs text-muted-foreground">${t("empty.treeNoNotes", "El vault no tiene notas todavía.")}</p>
      <button id="obs-tree-empty-cta"
        class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
        <i class="ti ti-file-plus text-sm"></i> ${t("tree.newNote", "Nueva nota")}
      </button>
    </div>`;
    return;
  }
  el.innerHTML = renderDir(buildTree(), 0);
}
