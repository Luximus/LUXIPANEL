// Cron list presentation is local UI state; changing it never reloads jobs.
import { $ } from "./dom";

type CronPane = "jobs" | "agents";
type ListView = "grid" | "list";

export function wireListView(pane: CronPane, render: () => void) {
  const controls = $(`${pane}-view-controls`);
  const list = $(`${pane}-list`);
  if (!controls || !list || controls.dataset.viewBound) return;
  controls.dataset.viewBound = "true";
  const storageKey = `lxp:cron:${pane}:view`;
  const apply = (view: ListView) => {
    list.dataset.view = view;
    controls.querySelectorAll<HTMLButtonElement>("[data-cron-view]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.cronView === view));
    });
  };
  let initial: ListView = "grid";
  try { if (window.localStorage.getItem(storageKey) === "list") initial = "list"; } catch { /* Storage is optional. */ }
  apply(initial);
  controls.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-cron-view]");
    const view = button?.dataset.cronView;
    if ((view !== "list" && view !== "grid") || view === list.dataset.view) return;
    apply(view);
    try { window.localStorage.setItem(storageKey, view); } catch { /* Keep working without storage. */ }
    render();
  });
}

/** Shared card/row structure keeps selection, pagination and actions identical. */
export function listClasses(pane: CronPane) {
  const compact = $(`${pane}-list`)?.dataset.view === "list";
  return {
    collection: compact ? "divide-y divide-border" : "grid gap-4 p-5 @3xl:grid-cols-2 @6xl:grid-cols-3",
    entry: compact
      ? "grid min-w-0 gap-3 px-5 py-3 transition-colors hover:bg-muted/20 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] @3xl:items-center"
      : "flex h-full min-w-0 flex-col rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/10 p-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/20",
    schedule: `${compact ? "mt-1.5" : "mt-3"} flex flex-wrap items-center gap-2 text-xs`,
    body: compact ? "min-w-0 ps-7 @3xl:ps-0" : "mt-4 min-w-0 flex-1 rounded-xl border border-border/70 bg-muted/20 p-3",
    label: compact ? "sr-only" : "mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground",
    text: compact ? "line-clamp-1 break-all text-xs leading-5 text-foreground/90" : "block max-h-16 overflow-hidden break-all text-sm leading-5 text-foreground/90",
    metadata: `${compact ? "mt-1.5" : "mt-3"} flex flex-wrap items-center gap-x-3 gap-y-1 text-xs`,
    actions: compact ? "flex items-center justify-end gap-1" : "mt-4 flex items-center justify-end gap-1 border-t border-border/60 pt-3",
  };
}
