// Files page — in-file find bar (VS Code-style), sibling of editor.ts.
// Lives in the editor panel header (left of the Save button). Drives Monaco's
// search through the `find/findNext/findPrev/clearFind` methods added to the
// `__lxpFilesMonacoEditor` API (see lib/panel-files-monaco.ts): the heavy
// findMatches/deltaDecorations work stays in that bundle; here we only own the
// DOM wiring (input + toggles + counter + keyboard). The native Ctrl+F widget
// is untouched — this bar is additive and always visible.
import { getActiveTab, getEditorApi } from "./editor";
import { fmt, t } from "./i18n";

const FIND_DEBOUNCE_MS = 200;

interface FindEls {
  input: HTMLInputElement;
  count: HTMLElement | null;
  prev: HTMLButtonElement | null;
  next: HTMLButtonElement | null;
  caseBtn: HTMLButtonElement | null;
  wordBtn: HTMLButtonElement | null;
  regexBtn: HTMLButtonElement | null;
}

let els: FindEls | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
// Active path the bar last searched, so tab switches re-run the query against
// the new buffer (Monaco's openFile cleared the old highlights).
let lastFindPath = "";

function toggled(btn: HTMLButtonElement | null): boolean {
  return btn?.getAttribute("aria-pressed") === "true";
}

function currentOpts() {
  if (!els) return {};
  return {
    matchCase: toggled(els.caseBtn),
    wholeWord: toggled(els.wordBtn),
    isRegex: toggled(els.regexBtn),
  };
}

/** Paint the "n de m" counter (or the no-results / empty states). */
function renderCounter(result: { total: number; index: number } | null): void {
  if (!els?.count) return;
  const query = els.input.value;
  if (!query || !result) { els.count.textContent = ""; return; }
  if (result.total === 0) {
    els.count.textContent = t("workspace.findNoResults", "Sin resultados");
    return;
  }
  els.count.textContent = fmt(t("workspace.findCounter", "{current} de {total}"), {
    current: result.index,
    total: result.total,
  });
}

/** Enable/disable prev/next by whether there's anything to step through. */
function syncNavDisabled(total: number): void {
  const disabled = total <= 0;
  for (const btn of [els?.prev, els?.next]) {
    if (!btn) continue;
    btn.disabled = disabled;
    btn.classList.toggle("opacity-40", disabled);
    btn.classList.toggle("pointer-events-none", disabled);
  }
}

/** Run the search for the current input/toggles and reflect the result. */
function runFind(): void {
  if (!els) return;
  const api = getEditorApi();
  const query = els.input.value;
  els.input.removeAttribute("aria-invalid");
  els.input.classList.remove("border-destructive", "text-destructive");
  if (!api || !getActiveTab()) { api?.clearFind(); renderCounter(null); syncNavDisabled(0); return; }
  if (!query) { api.clearFind(); renderCounter(null); syncNavDisabled(0); return; }
  const result = api.find(query, currentOpts());
  if (result.error) {
    // Invalid regex — flag the input red, empty the counter, don't throw.
    els.input.setAttribute("aria-invalid", "true");
    els.input.classList.add("border-destructive", "text-destructive");
    renderCounter(null);
    syncNavDisabled(0);
    return;
  }
  lastFindPath = getActiveTab()?.path ?? "";
  renderCounter(result);
  syncNavDisabled(result.total);
}

function step(dir: "next" | "prev"): void {
  const api = getEditorApi();
  if (!api || !els || !getActiveTab() || !els.input.value) return;
  const result = dir === "next" ? api.findNext() : api.findPrev();
  renderCounter(result);
  syncNavDisabled(result.total);
}

function scheduleFind(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runFind, FIND_DEBOUNCE_MS);
}

/** Enable/disable the whole bar and re-run (or clear) as the active tab
 *  changes. Exposed on window so editor.ts can call it from syncToolbarState
 *  without a hard import cycle. */
function refreshFindAvailability(): void {
  if (!els) return;
  const tab = getActiveTab();
  const enabled = Boolean(tab);
  const controls: Array<HTMLElement | null> = [els.input, els.prev, els.next, els.caseBtn, els.wordBtn, els.regexBtn];
  for (const el of controls) {
    if (!el) continue;
    (el as HTMLInputElement | HTMLButtonElement).disabled = !enabled;
    el.classList.toggle("opacity-50", !enabled);
  }
  if (!enabled) {
    getEditorApi()?.clearFind();
    renderCounter(null);
    lastFindPath = "";
    return;
  }
  // Re-run the query against the newly-active buffer (its highlights were
  // cleared when Monaco re-opened the file). Skip when the path is unchanged
  // (avoids moving the selection on unrelated syncToolbarState calls, e.g. save).
  if (tab && tab.path !== lastFindPath && els.input.value) runFind();
}

function toggleFilter(btn: HTMLButtonElement | null): void {
  if (!btn) return;
  btn.setAttribute("aria-pressed", String(!toggled(btn)));
  btn.classList.toggle("bg-accent", toggled(btn));
  btn.classList.toggle("text-foreground", toggled(btn));
  runFind();
}

/** Wire the find bar. Called from bindEditor (re-runs per fresh SPA DOM). */
export function bindEditorFind(): void {
  const input = document.getElementById("files-editor-find-input") as HTMLInputElement | null;
  if (!input) return;
  els = {
    input,
    count: document.getElementById("files-editor-find-count"),
    prev: document.getElementById("files-editor-find-prev") as HTMLButtonElement | null,
    next: document.getElementById("files-editor-find-next") as HTMLButtonElement | null,
    caseBtn: document.getElementById("files-editor-find-case") as HTMLButtonElement | null,
    wordBtn: document.getElementById("files-editor-find-word") as HTMLButtonElement | null,
    regexBtn: document.getElementById("files-editor-find-regex") as HTMLButtonElement | null,
  };

  input.addEventListener("input", scheduleFind);
  input.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
      // First Enter with a pending query commits the search; subsequent Enters step.
      step(ev.shiftKey ? "prev" : "next");
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      getEditorApi()?.clearFind(true); // clears decorations + returns focus to editor
      renderCounter(null);
      syncNavDisabled(0);
    }
  });
  els.prev?.addEventListener("click", () => step("prev"));
  els.next?.addEventListener("click", () => step("next"));
  els.caseBtn?.addEventListener("click", () => toggleFilter(els?.caseBtn ?? null));
  els.wordBtn?.addEventListener("click", () => toggleFilter(els?.wordBtn ?? null));
  els.regexBtn?.addEventListener("click", () => toggleFilter(els?.regexBtn ?? null));

  (window as any).__lxpFilesFindRefresh = refreshFindAvailability;
  refreshFindAvailability();
}
