// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

const TAB_SELECTOR = "[data-repo-settings-tab]";
const PANEL_SELECTOR = "[data-repo-settings-panel]";

export function initRepositorySettingsTabs(): void {
  const root = document.querySelector<HTMLElement>("[data-repo-settings-tabs]");
  if (!root || root.dataset.tabsBound === "true") return;
  root.dataset.tabsBound = "true";

  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>(TAB_SELECTOR));
  const panels = Array.from(root.querySelectorAll<HTMLElement>(PANEL_SELECTOR));
  const save = root.querySelector<HTMLElement>("[data-repo-settings-save]");

  function activate(id: string, focus = false): void {
    if (!tabs.some((tab) => tab.dataset.repoSettingsTab === id)) return;
    for (const tab of tabs) {
      const selected = tab.dataset.repoSettingsTab === id;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.classList.toggle("bg-primary/10", selected);
      tab.classList.toggle("text-primary", selected);
      tab.classList.toggle("text-muted-foreground", !selected);
      tab.classList.toggle("hover:bg-accent", !selected);
      tab.classList.toggle("hover:text-foreground", !selected);
      if (selected && focus) tab.focus();
    }
    for (const panel of panels) {
      panel.classList.toggle("hidden", panel.dataset.repoSettingsPanel !== id);
    }
    save?.classList.toggle("hidden", id === "connection");
  }

  for (const tab of tabs) {
    tab.addEventListener("click", () => activate(tab.dataset.repoSettingsTab || "catalog"));
    tab.addEventListener("keydown", (event) => {
      const index = tabs.indexOf(tab);
      const next = event.key === "ArrowDown" ? (index + 1) % tabs.length
        : event.key === "ArrowUp" ? (index - 1 + tabs.length) % tabs.length
        : event.key === "Home" ? 0
        : event.key === "End" ? tabs.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault();
      activate(tabs[next].dataset.repoSettingsTab || "catalog", true);
    });
  }
}
