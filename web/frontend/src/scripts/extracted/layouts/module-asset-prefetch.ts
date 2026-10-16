// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Only static module entry assets are warmed. The authenticated HTML and API
// stay on demand, and a hovered module never starts a hidden iframe.
const page = (name: string, version: string) => `/scripts/extracted/pages/panel/${name}/index-script1.js?v=${version}`;
const ASSETS: Record<string, readonly string[]> = {
  backups: [page("backups", "20260929-progressive-load")],
  bitninja: [page("bitninja", "20260928a")],
  cloudflare: [page("cloudflare", "20260928-focused-views")],
  "codebase-graph": [page("codebase-graph", "20260928-focused-views-b")],
  cron: [page("cron", "20260928-focused-views")],
  databases: [page("databases", "20260928a")],
  expo: [page("expo", "20260929-progressive-load")],
  files: [page("files", "20260930-editor-drawer")],
  firewall: [page("firewall", "20260928-focused-views-b")],
  hosting: [page("hosting", "20260928a")],
  mail: [page("mail", "20260930-mail-refresh")],
  "module-dev": [page("module-dev", "20260929-modules4")],
  "project-map": [page("project-map", "20260929-explorer1")],
  modules: [page("modules", "20260628row2")],
  monitor: [
    "/scripts/extracted/pages/panel/monitor/monitor-v2.js?b=20260927-settings",
    "/scripts/extracted/pages/panel/monitor/charts.js?b=20260929-progressive-load",
  ],
  dns: [page("nginx", "20260929-progressive-load")],
  nginx: [page("nginx", "20260929-progressive-load")],
  obsidian: [page("obsidian", "20260929-progressive-load")],
  openclaw: ["/scripts/extracted/pages/panel/openclaw/index-script1.js"],
  preferences: [page("preferences", "20260928-focused-views-b")],
  "repository-store": [page("repository-store", "20260927github1")],
  "server-alerts": [page("server-alerts", "20260928-focused-views")],
  settings: [page("settings", "20260929-progressive-load")],
  terminal: [
    "/scripts/extracted/components/floating-terminal/floating-terminal.js?v=20261015-tmux-scroll",
    "/scripts/extracted/components/floating-terminal/floating-terminal.css?v=20261014-header-scroll",
  ],
  users: [page("users", "20260929-progressive-load")],
  webhooks: [page("webhooks", "20260928-focused-views")],
};

let pending: number | undefined;
let pendingLink: HTMLElement | null = null;
const warmed = new Set<string>();
const MAX_MODULES = 4;
function eligible(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return document.visibilityState === "visible" && !connection?.saveData && connection?.effectiveType !== "2g" && connection?.effectiveType !== "slow-2g";
}
function moduleId(link: HTMLElement): string {
  if (link instanceof HTMLAnchorElement) {
    const path = new URL(link.href, location.href).pathname;
    if (path === "/project-map" || path === "/panel/project-map") return "project-map";
  }
  return link.dataset.module || "";
}
function warm(link: HTMLElement): void {
  if (!eligible() || warmed.size >= MAX_MODULES) return;
  const id = moduleId(link);
  if (!ASSETS[id] || warmed.has(id)) return;
  warmed.add(id);
  for (const href of ASSETS[id]) {
    if (document.querySelector(`link[data-lxp-prefetch-url="${href}"]`)) continue;
    const hint = document.createElement("link");
    hint.rel = "prefetch";
    hint.href = href;
    hint.as = href.includes(".css") ? "style" : "script";
    hint.dataset.lxpPrefetchUrl = href;
    document.head.appendChild(hint);
  }
}
function findLink(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>("#sidebar a[data-module], #sidebar-mobile a[data-module], #server-rail-footer a[data-module], button[data-module=terminal]");
}
function queue(link: HTMLElement, delay: number): void {
  window.clearTimeout(pending);
  pendingLink = link;
  pending = window.setTimeout(() => { pendingLink = null; warm(link); }, delay);
}
document.addEventListener("pointerover", (event) => {
  const link = findLink(event.target);
  if (link && !link.contains(event.relatedTarget as Node | null)) queue(link, 140);
}, true);
document.addEventListener("pointerout", (event) => {
  if (!pendingLink || !pendingLink.contains(event.target as Node)) return;
  if (pendingLink.contains(event.relatedTarget as Node | null)) return;
  window.clearTimeout(pending);
  pendingLink = null;
}, true);
document.addEventListener("focusin", (event) => {
  const link = findLink(event.target);
  if (link) queue(link, 0);
}, true);
