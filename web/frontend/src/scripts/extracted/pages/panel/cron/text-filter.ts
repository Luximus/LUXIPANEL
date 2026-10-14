// Cron page — shared free-text filter state (the single crossing between the
// jobs and agents lists). To avoid a direct jobs<->agents import cycle, this
// module owns the value and exposes an onFilterChange() registry: jobs.ts and
// agents.ts each subscribe a callback, and setTextFilter() fires them. The
// per-list page reset lives in those callbacks (was inline in setTextFilter).
import { $ } from "./dom";

  let textFilter = "";
  const filterListeners: Array<() => void> = [];

  export const getTextFilter = () => textFilter;

  /** Subscribe a callback fired (in registration order) after every filter change. */
  export function onFilterChange(fn: () => void) { filterListeners.push(fn); }

  export function setTextFilter(next: string) {
    textFilter = next.trim().toLowerCase();
    syncTextFilterState();
    for (const fn of filterListeners) fn();
  }

  export function syncTextFilterState() {
    const input = $("cron-text-filter") as HTMLInputElement | null;
    if (input && input.value !== textFilter) input.value = textFilter;
    const clear = $("cron-text-clear") as HTMLButtonElement | null;
    if (!clear) return;
    clear.disabled = !textFilter;
    clear.classList.toggle("opacity-60", !textFilter);
    clear.classList.toggle("cursor-default", !textFilter);
  }
