// Obsidian page — vault full-text search.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { state, vaultApi } from "./state";
import type { SearchHit } from "./state";
import { t, fmt, esc, $ } from "./dom";

// ── Search ───────────────────────────────────────────────────────────────────
export let searchTimer: number | undefined;

export function hideSearchResults() {
  state.searchSeq++;
  $("obs-search-results")?.classList.add("hidden");
  $("obs-tree")?.classList.remove("hidden");
  const input = $("obs-search") as HTMLInputElement | null;
  if (input) input.value = "";
}

export function scheduleSearch() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void runSearch(), 400);
}

export async function runSearch() {
  const input = $("obs-search") as HTMLInputElement | null;
  const wrap = $("obs-search-results");
  const list = $("obs-search-list");
  if (!input || !wrap || !list) return;
  const q = input.value.trim();
  if (!q || !state.vaultId) {
    wrap.classList.add("hidden");
    $("obs-tree")?.classList.remove("hidden");
    return;
  }
  const seq = ++state.searchSeq;
  wrap.classList.remove("hidden");
  $("obs-tree")?.classList.add("hidden");
  list.innerHTML = `<p class="px-3 py-3 text-xs text-muted-foreground">${t("labels.searching", "Buscando…")}</p>`;
  const res = await api.get<SearchHit[]>(vaultApi(`/search?q=${encodeURIComponent(q)}`));
  if (seq !== state.searchSeq) return; // a newer search superseded this one
  if (!res.ok) {
    list.innerHTML = `<p class="px-3 py-3 text-xs text-destructive">${esc(res.error ?? t("errors.search", "Error en la búsqueda"))}</p>`;
    return;
  }
  const hits: SearchHit[] = res.data ?? [];
  if (hits.length === 0) {
    list.innerHTML = `<p class="px-3 py-3 text-xs text-muted-foreground">${fmt(t("empty.searchNoResults", "Sin resultados para \"{q}\"."), { q: esc(q) })}</p>`;
    return;
  }
  const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mark = (text: string) =>
    esc(text).replace(new RegExp(safeQ.replace(/[&<>"]/g, (c) => esc(c)), "gi"), (m) => `<mark class="rounded bg-amber-400/30 px-0.5 text-inherit">${m}</mark>`);
  list.innerHTML = hits
    .map(
      (h) => `<button data-open-note="${esc(h.path)}" data-open-line="${h.line}"
        class="obs-search-hit flex w-full items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-accent">
        <i class="ti ti-file-search mt-0.5 text-sm text-muted-foreground"></i>
        <span class="min-w-0">
          <span class="block truncate font-mono text-xs font-medium">${esc(h.path)}:${h.line}</span>
          <span class="block truncate text-xs text-muted-foreground">${mark(h.text)}</span>
        </span>
      </button>`,
    )
    .join("");
}
