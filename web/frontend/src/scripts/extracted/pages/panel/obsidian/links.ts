// Obsidian page — links panel (outgoing wikilinks + backlinks) + wikilink open.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { state, vaultApi } from "./state";
import type { NoteLinks } from "./state";
import { t, fmt, esc, showToast, $ } from "./dom";
import { openNote } from "./editor";

// ── Links panel (outgoing wikilinks + backlinks) ─────────────────────────────
export function setLinksChevron(open: boolean) {
  const chev = $("obs-links-chevron");
  if (!chev) return;
  chev.classList.toggle("ti-chevron-down", !open);
  chev.classList.toggle("ti-chevron-up", open);
}

export async function toggleLinksPanel() {
  const panel = $("obs-links-panel");
  if (!panel || !state.notePath) return;
  state.linksOpen = !state.linksOpen;
  panel.classList.toggle("hidden", !state.linksOpen);
  setLinksChevron(state.linksOpen);
  if (state.linksOpen) await loadLinks();
}

export async function loadLinks() {
  const panel = $("obs-links-panel");
  if (!panel || !state.vaultId || !state.notePath) return;
  const vaultId = state.vaultId;
  const notePath = state.notePath;
  const scopeSeq = state.scopeSeq;
  panel.innerHTML = `<p class="text-xs text-muted-foreground">${t("labels.loadingLinks", "Cargando enlaces…")}</p>`;
  const res = await api.get<NoteLinks>(vaultApi(`/links?path=${encodeURIComponent(notePath)}`));
  if (vaultId !== state.vaultId || notePath !== state.notePath || scopeSeq !== state.scopeSeq) return;
  if (!res.ok) {
    panel.innerHTML = `<p class="text-xs text-destructive">${esc(res.error ?? t("errors.loadLinks", "Error al cargar enlaces"))}</p>`;
    return;
  }
  const links: NoteLinks = res.data ?? { outgoing: [], backlinks: [] };
  const outgoing = links.outgoing.length
    ? links.outgoing
        .map(
          (target) => `<button data-wikilink="${esc(target)}"
            class="obs-wikilink inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-accent">
            <i class="ti ti-arrow-up-right text-xs text-muted-foreground"></i> ${esc(target)}
          </button>`,
        )
        .join(" ")
    : `<span class="text-xs text-muted-foreground">${t("labels.noOutgoingLinks", "Sin enlaces salientes.")}</span>`;
  const backlinks = links.backlinks.length
    ? links.backlinks
        .map(
          (b) => `<button data-open-note="${esc(b.path)}" data-open-line="${b.line}"
            class="obs-backlink flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent">
            <i class="ti ti-arrow-back-up mt-0.5 text-xs text-muted-foreground"></i>
            <span class="min-w-0">
              <span class="block truncate font-mono text-xs font-medium">${esc(b.path)}:${b.line}</span>
              <span class="block truncate text-xs text-muted-foreground">${esc(b.text)}</span>
            </span>
          </button>`,
        )
        .join("")
    : `<p class="text-xs text-muted-foreground">${t("labels.noBacklinks", "Sin backlinks.")}</p>`;
  panel.innerHTML = `
    <div class="mb-3">
      <p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">${t("labels.outgoing", "Salientes")}</p>
      <div class="flex flex-wrap gap-1.5">${outgoing}</div>
    </div>
    <div>
      <p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">${t("labels.backlinks", "Backlinks")}</p>
      ${backlinks}
    </div>`;
}

/** Resolve a [[wikilink]] target to a tree note and open it. */
export function openWikilink(target: string) {
  // Strip alias ([[Note|Alias]]) and heading/block refs ([[Note#Heading]]).
  const clean = target.split("|")[0]!.split("#")[0]!.trim();
  if (!clean) return;
  const lower = clean.toLowerCase();
  const note =
    state.tree.notes.find((n) => n.path.toLowerCase() === lower || n.path.toLowerCase() === `${lower}.md`) ??
    state.tree.notes.find((n) => n.name.replace(/\.(md|canvas)$/i, "").toLowerCase() === lower);
  if (!note) {
    showToast(fmt(t("errors.wikilinkNotFound", "Nota \"{name}\" no encontrada en el vault"), { name: clean }), false);
    return;
  }
  void openNote(note.path);
}
