// Files page — bind-controls submodule (code-move; no behavior change): editable
// path bar + smart autocomplete (breadcrumb → input, suggestions, keyboard nav)
// and breadcrumb context menu.
import { completeWithSuggestion, enterPathEdit, exitPathEdit, fetchPathSuggest, normalizePathInput, renderPathSuggest, suggestItems } from "./navigation";
import { S } from "./state";

export function bindNavigation() {
    // ── Editable path bar + smart autocomplete ──────────────────
    // Clicking the breadcrumb background (not a segment) turns it into an
    // editable input with folder suggestions ranked by visit count.
    document.getElementById("breadcrumb")?.addEventListener("click", (event) => {
      const segment = (event.target as HTMLElement)?.closest<HTMLElement>("[data-breadcrumb-path]");
      if (segment) {
        const path = segment.getAttribute("data-breadcrumb-path");
        if (path) (window as any).navigate(path);
        return;
      }
      enterPathEdit();
    });

    const pathInputEl = document.getElementById("path-edit-input") as HTMLInputElement | null;
    pathInputEl?.addEventListener("input", () => {
      void fetchPathSuggest(pathInputEl.value);
    });
    pathInputEl?.addEventListener("keydown", (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === "Escape") {
        event.preventDefault();
        exitPathEdit();
      } else if (key === "Enter") {
        event.preventDefault();
        const raw = pathInputEl.value.trim();
        const target = normalizePathInput(raw);
        if (target) {
          (window as any).navigate(target);
          exitPathEdit();
        }
      } else if (key === "Tab") {
        // Tab completes to the highlighted suggestion (no navigation).
        if (suggestItems.length > 0) {
          event.preventDefault();
          completeWithSuggestion(Math.max(0, S.suggestActive));
        }
      } else if (key === "ArrowDown") {
        event.preventDefault();
        if (suggestItems.length) { S.suggestActive = (S.suggestActive + 1) % suggestItems.length; renderPathSuggest(); }
      } else if (key === "ArrowUp") {
        event.preventDefault();
        if (suggestItems.length) { S.suggestActive = (S.suggestActive - 1 + suggestItems.length) % suggestItems.length; renderPathSuggest(); }
      }
    });
    // Blur exits edit mode, with a small delay so a suggestion click registers.
    pathInputEl?.addEventListener("blur", () => {
      window.setTimeout(() => {
        const box = document.getElementById("path-suggest-list");
        if (box && box.matches(":hover")) return; // clicking inside the list
        exitPathEdit();
      }, 150);
    });
    // Click a suggestion → navigate into it.
    document.getElementById("path-suggest-list")?.addEventListener("mousedown", (event) => {
      const btn = (event.target as HTMLElement)?.closest<HTMLElement>("[data-suggest-path]");
      if (!btn) return;
      event.preventDefault();
      const p = btn.getAttribute("data-suggest-path");
      if (p) { (window as any).navigate(p); exitPathEdit(); }
    });

    document.getElementById("breadcrumb")?.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      (window as any).showRouteContextMenu(event, S.currentPath || "/");
    });
}
