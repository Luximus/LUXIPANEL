// Cloudflare page — tab switching + on-demand tab data load.
import { state } from "./state";
import type { Tab } from "./state";
import { highlightPillTabs, setPaneVisibilityById } from "/scripts/extracted/lib/tabs.js";
import { tabDirection } from "/scripts/extracted/lib/dom.js";
import { loadDns } from "./dns";
import { loadSettings } from "./settings";
import { loadAccessRules } from "./access";

// ── Tabs (E-03: estilo "pill" compartido en /scripts/extracted/lib/tabs.js) ──
export function highlightTabs() {
  highlightPillTabs(".cf-tab", (b) => b.dataset.tab === state.tab);
  document.querySelectorAll<HTMLButtonElement>(".cf-tab[data-tab]").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.tab === state.tab));
  });
}

/** Switch the visible pane WITHOUT loading data (deep links load via selectZone). */
export function showTab(tab: Tab) {
  const order = ["dns", "cache", "security", "access", "config"] as const;
  const direction = tabDirection(order.indexOf(state.tab as typeof order[number]), order.indexOf(tab as typeof order[number]));
  state.tab = tab;
  highlightTabs();
  setPaneVisibilityById(order, tab, {
    idFor: (id) => `cf-pane-${id}`,
    flexIds: ["cache", "security"],
    direction,
  });
}

export function setTab(tab: Tab) {
  showTab(tab);
  loadTab(tab);
}

/** Load the active tab's data on demand (token + zone required). */
export function loadTab(tab: Tab) {
  if (tab === "config") return;
  if (!state.tokenSet || !state.zoneId) return;
  if (tab === "dns") void loadDns();
  else if (tab === "cache" || tab === "security") void loadSettings();
  else if (tab === "access") void loadAccessRules();
}
