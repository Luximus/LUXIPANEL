// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Module-first navigation for the compact workspace rail.
 * Selecting a module only changes this menu. A view is loaded in the existing
 * drawer after its submenu is chosen, so opening the menu makes no API
 * request. The selected page then activates its own tab or scroll landmark.
 */
type View = { id: string; es: string; en: string; target: string; mode?: "scroll" | "command"; adminOnly?: boolean; href?: string };
type ModuleNav = { show: (link: HTMLAnchorElement) => boolean; reset: () => void; opened: (link: HTMLAnchorElement) => void; activateRoot: (doc: Document, url: URL, moduleWindow?: Window) => void };
const v = (id: string, es: string, en: string, target: string, mode?: View["mode"], adminOnly = false, href?: string): View => ({ id, es, en, target, mode, adminOnly, href });
const VIEWS: Record<string, View[]> = {
  assistant: [v("chat", "Conversaciones", "Conversations", "[data-panel-content]", "scroll")],
  users: [v("users", "Usuarios", "Users", "[data-panel-content] #tab-users"), v("roles", "Grupos", "Groups", "[data-panel-content] #tab-roles")],
  monitor: [v("history", "Historial", "History", "[data-panel-content] #monitor-tab-history"), v("processes", "Procesos", "Processes", "[data-panel-content] #monitor-tab-processes")],
  files: [v("browser", "Explorador", "Browser", "[data-panel-content] #files-pane", "scroll"), v("editor", "Editor", "Editor", "files-editor", "command")],
  firewall: [v("audit", "Auditoría", "Audit", "[data-panel-content] #security-audit-section", "scroll"), v("rules", "Reglas UFW", "UFW rules", "[data-panel-content] #fw-rules-panel", "scroll"), v("fail2ban", "Fail2ban", "Fail2ban", "[data-panel-content] #fw-fail2ban-panel", "scroll")],
  bitninja: [v("status", "Estado", "Status", "[data-panel-content] #bitninja-root", "scroll"), v("components", "Componentes", "Components", "[data-panel-content] #bn-components", "scroll"), v("logs", "Registro", "Log", "heading:0", "scroll")],
  mail: [v("emails", "Correos", "Mail", "[data-panel-content] [data-mail-main-tab='emails']"), v("spam-filters", "Antispam", "Spam filters", "[data-panel-content] [data-mail-main-tab='spam-filters']"), v("track-delivery", "Entrega", "Delivery", "[data-panel-content] [data-mail-main-tab='track-delivery']"), v("global-filters", "Filtros", "Filters", "[data-panel-content] [data-mail-main-tab='global-filters']")],
  dns: [v("overview", "Estado", "Overview", "[data-panel-content] #tab-overview"), v("sites", "Sitios y HTTPS", "Sites and HTTPS", "[data-panel-content] #tab-sites"), v("proxy", "Tráfico", "Traffic", "[data-panel-content] #tab-proxy", undefined, true), v("perf", "Rendimiento", "Performance", "[data-panel-content] #tab-perf", undefined, true), v("logs", "Registros", "Logs", "[data-panel-content] #tab-logs"), v("status", "Servicio", "Service", "[data-panel-content] #tab-status", undefined, true)],
  nginx: [v("overview", "Estado", "Overview", "[data-panel-content] #tab-overview"), v("sites", "Sitios y HTTPS", "Sites and HTTPS", "[data-panel-content] #tab-sites"), v("proxy", "Tráfico", "Traffic", "[data-panel-content] #tab-proxy", undefined, true), v("perf", "Rendimiento", "Performance", "[data-panel-content] #tab-perf", undefined, true), v("logs", "Registros", "Logs", "[data-panel-content] #tab-logs"), v("status", "Servicio", "Service", "[data-panel-content] #tab-status", undefined, true)],
  backups: [v("overview", "Estado", "Overview", "[data-panel-content] #backup-summary-panel", "scroll"), v("schedules", "Programaciones", "Schedules", "[data-panel-content] #backup-schedules-panel", "scroll"), v("history", "Historial", "History", "[data-panel-content] #backup-history-panel", "scroll")],
  cron: [v("jobs", "Tareas", "Jobs", "[data-panel-content] #cron-tab-jobs"), v("agents", "Agentes IA", "AI agents", "[data-panel-content] #cron-tab-agents")],
  databases: [v("databases", "Bases de datos", "Databases", "[data-panel-content] #db-databases", "scroll"), v("tables", "Tablas", "Tables", "[data-panel-content] #db-tables", "scroll"), v("console", "Consola SQL", "SQL console", "[data-panel-content] .db-tab[data-tab='console']")],
  obsidian: [v("vaults", "Bóvedas y notas", "Vaults and notes", "[data-panel-content] #obs-toolbar", "scroll"), v("editor", "Editor", "Editor", "[data-panel-content] #obs-editor-pane", "scroll")],
  cloudflare: [v("dns", "DNS", "DNS", "[data-panel-content] .cf-tab[data-tab='dns']"), v("cache", "Caché", "Cache", "[data-panel-content] .cf-tab[data-tab='cache']"), v("security", "Seguridad", "Security", "[data-panel-content] .cf-tab[data-tab='security']"), v("access", "Acceso", "Access", "[data-panel-content] .cf-tab[data-tab='access']"), v("config", "Configuración", "Settings", "[data-panel-content] .cf-tab[data-tab='config']")],
  "server-alerts": [v("prefs", "Preferencias", "Preferences", "[data-panel-content] .tab-btn[data-tab='prefs']"), v("send", "Enviar", "Send", "[data-panel-content] .tab-btn[data-tab='send']"), v("scheduled", "Programadas", "Scheduled", "[data-panel-content] .tab-btn[data-tab='scheduled']"), v("rules", "Reglas", "Rules", "[data-panel-content] .tab-btn[data-tab='rules']"), v("history", "Historial", "History", "[data-panel-content] .tab-btn[data-tab='history']")],
  expo: [v("account", "Cuenta", "Account", "[data-panel-content] #expo-root", "scroll"), v("projects", "Proyectos", "Projects", "[data-panel-content] #expo-projects", "scroll"), v("builds", "Builds", "Builds", "[data-panel-content] #expo-history-refresh", "scroll"), v("store", "Tiendas", "Stores", "[data-panel-content] #expo-apple-save", "scroll"), v("environment", "Variables", "Environment", "[data-panel-content] #expo-env-table", "scroll")],
  "module-dev": [v("my-modules", "Mis módulos", "My modules", "", undefined, false, "/module-dev"), v("project-map", "Mapa proyecto", "Project map", "", undefined, false, "/project-map"), v("logs", "LOG", "LOG", "", undefined, true, "/module-dev/logs")],
  terminal: [v("terminal", "Terminal", "Terminal", "[data-panel-content]", "scroll")],
  "repository-store": [v("all", "Explorar", "Explore", "[data-panel-content] .repo-tab-btn[data-tab='all']"), v("saved", "Guardados", "Saved", "[data-panel-content] .repo-tab-btn[data-tab='saved']"), v("cloned", "Clonados", "Cloned", "[data-panel-content] .repo-tab-btn[data-tab='cloned']"), v("update", "Actualizar", "Updates", "[data-panel-content] .repo-tab-btn[data-tab='update']")],
  webhooks: [v("receive", "Recibir", "Receive", "[data-panel-content] [data-tab='receive']"), v("webhooks", "Webhooks", "Webhooks", "[data-panel-content] [data-tab='webhooks']"), v("keys", "Claves", "Keys", "[data-panel-content] [data-tab='keys']"), v("discovered", "Detectados", "Discovered", "[data-panel-content] [data-tab='discovered']")],
  openclaw: [v("assistant", "Asistente", "Assistant", "[data-panel-content]", "scroll")],
  hosting: [v("accounts", "Cuentas", "Accounts", "[data-panel-content]", "scroll"), v("new", "Nueva cuenta", "New account", "[data-panel-content] #btn-new")],
  "codebase-graph": [v("graph", "Grafo visual", "Visual graph", "[data-panel-content] #cg-show-original", undefined, true), v("symbols", "Símbolos", "Symbols", "[data-panel-content] #cg-show-explorer")],
  preferences: [v("profile", "Perfil", "Profile", "[data-panel-content] #pref-profile", "scroll"), v("security", "Seguridad", "Security", "[data-panel-content] #pref-password", "scroll"), v("audit", "Actividad", "Activity", "[data-panel-content] #pref-audit", "scroll")],
  settings: [v("settings", "Configuración", "Settings", "[data-panel-content]", "scroll")],
  modules: [v("catalog", "Catálogo", "Catalog", "[data-panel-content]", "scroll")],
  chat: [v("chat", "Chat", "Chat", "[data-panel-content]", "scroll")],
};
const DEFAULT_VIEWS = [v("overview", "Vista general", "Overview", "[data-panel-content]", "scroll")];
// A submenu is only useful when it opens an independently rendered view or a
// lazy editor. These modules currently reuse one document or scroll landmarks.
// Keep their main action direct until their pages expose focused views.
const DIRECT_ONLY_MODULES = new Set([
  "bitninja", "databases", "obsidian", "expo",
  "hosting", "repository-store",
  "monitor",
]);
const VIEW_ICONS: Record<string, string[]> = {
  users: ["ti-users", "ti-users-group"],
  monitor: ["ti-chart-line", "ti-cpu"],
  files: ["ti-folder", "ti-code"],
  firewall: ["ti-shield-check", "ti-list-check", "ti-ban"],
  bitninja: ["ti-activity", "ti-components", "ti-file-text"],
  mail: ["ti-mail", "ti-shield-check", "ti-route", "ti-filter"],
  dns: ["ti-activity", "ti-world-www", "ti-arrows-exchange", "ti-rocket", "ti-file-text", "ti-server"],
  nginx: ["ti-activity", "ti-world-www", "ti-arrows-exchange", "ti-rocket", "ti-file-text", "ti-server"],
  backups: ["ti-chart-bar", "ti-calendar-time", "ti-history"],
  cron: ["ti-clock", "ti-robot"],
  databases: ["ti-database", "ti-table", "ti-terminal-2"],
  obsidian: ["ti-notebook", "ti-edit"],
  cloudflare: ["ti-world", "ti-bolt", "ti-shield", "ti-lock", "ti-settings"],
  "server-alerts": ["ti-adjustments", "ti-send", "ti-calendar", "ti-list-check", "ti-history"],
  expo: ["ti-user", "ti-folders", "ti-hammer", "ti-building-store", "ti-variable"],
  "module-dev": ["ti-packages", "ti-sitemap", "ti-report-analytics"],
  "repository-store": ["ti-search", "ti-bookmark", "ti-git-branch", "ti-refresh"],
  webhooks: ["ti-inbox", "ti-webhook", "ti-key", "ti-radar"],
  hosting: ["ti-building", "ti-plus"],
  "codebase-graph": ["ti-git-branch", "ti-code"],
  preferences: ["ti-user", "ti-lock", "ti-activity"],
};
const workspaceViewLabels = (() => {
  try {
    return JSON.parse(document.getElementById("workspace-views-i18n")?.textContent || "{}") as Record<string, Record<string, string>>;
  } catch {
    return {} as Record<string, Record<string, string>>;
  }
})();
const isSpanish = () => (document.documentElement.lang || "en").toLowerCase().startsWith("es");
const label = (moduleId: string, view: View) =>
  workspaceViewLabels[moduleId]?.[view.id]
  || workspaceViewLabels._default?.[view.id]
  || (isSpanish() ? view.es : view.en);
const selectedClass = "lxp-module-subnav-selected";
let activeModule = "";
let activeView = "";
let previousScroll = 0;
let frameActivationToken = 0;
let lastSourceLink: HTMLAnchorElement | null = null;
let indicatorObserver: MutationObserver | null = null;

function getViews(moduleId: string): View[] {
  if (DIRECT_ONLY_MODULES.has(moduleId)) return DEFAULT_VIEWS;
  const shell = document.querySelector<HTMLElement>("[data-workspace-shell]");
  const isAdmin = shell?.dataset.workspaceAdmin === "true";
  const local = shell?.dataset.workspaceLocal === "true";
  return (VIEWS[moduleId] ?? DEFAULT_VIEWS).filter((view) =>
    (!view.adminOnly || (isAdmin && (moduleId !== "codebase-graph" || local)))
    && !(moduleId === "firewall" && view.id === "audit" && shell?.dataset.workspaceSecurityAudit !== "true"));
}
function menuRoots(): Array<{ nav: HTMLElement; sidebar: HTMLElement }> {
  return ["sidebar", "sidebar-mobile"].flatMap((id) => {
    const sidebar = document.getElementById(id);
    const nav = sidebar?.querySelector<HTMLElement>("nav");
    return sidebar && nav ? [{ nav, sidebar }] : [];
  });
}
function syncRootIndicators(): void {
  for (const { sidebar } of menuRoots()) {
    sidebar.querySelectorAll<HTMLAnchorElement>("a[data-module]:not([data-lxp-module-view])").forEach((link) => {
      const hasSubmenu = getViews(link.dataset.module || "").length > 1;
      link.toggleAttribute("data-lxp-has-submenu", hasSubmenu);
      const arrow = link.querySelector<HTMLElement>(":scope > .lxp-module-nav-chevron");
      if (hasSubmenu && !arrow) {
        const icon = document.createElement("i");
        icon.className = "ti ti-chevron-right lxp-module-nav-chevron";
        icon.setAttribute("aria-hidden", "true");
        link.append(icon);
      } else if (!hasSubmenu) arrow?.remove();
      if (hasSubmenu) link.setAttribute("aria-expanded", String(activeModule === link.dataset.module));
      else link.removeAttribute("aria-expanded");
    });
  }
}
function observeMenu(): void {
  indicatorObserver?.disconnect();
  indicatorObserver = new MutationObserver(() => { syncRootIndicators(); syncDirectRoute(); });
  for (const { sidebar } of menuRoots()) indicatorObserver.observe(sidebar, { childList: true, subtree: true });
  syncRootIndicators();
}
function renderSubnav(nav: HTMLElement, source: HTMLAnchorElement, moduleId: string): void {
  nav.querySelector("[data-lxp-module-subnav]")?.remove();
  const box = document.createElement("div");
  box.setAttribute("data-lxp-module-subnav", "");
  box.className = "lxp-module-subnav";
  const back = document.createElement("button");
  back.type = "button";
  back.setAttribute("data-lxp-module-nav-back", "");
  back.className = "lxp-module-subnav-back";
  back.setAttribute("aria-label", isSpanish() ? "Volver a módulos" : "Back to modules");
  const backIcon = document.createElement("i");
  backIcon.className = "ti ti-arrow-left";
  backIcon.setAttribute("aria-hidden", "true");
  back.append(backIcon, document.createTextNode(isSpanish() ? "Módulos" : "Modules"));
  const heading = document.createElement("p");
  heading.className = "lxp-module-subnav-heading";
  heading.textContent = source.textContent?.trim() || source.getAttribute("title") || moduleId;
  box.append(back, heading);
  const list = document.createElement("div");
  list.className = "lxp-module-subnav-list";
  for (const view of getViews(moduleId)) {
    const link = document.createElement("a");
    const url = new URL(view.href ?? source.href, location.href);
    if (!view.href && !(moduleId === "assistant" && view.id === "chat")) url.searchParams.set("workspaceView", view.id);
    link.href = url.pathname + url.search;
    link.dataset.module = moduleId;
    link.dataset.lxpModuleView = view.id;
    link.className = "sidebar-mod-link lxp-module-subnav-link flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 text-muted-foreground hover:bg-accent hover:text-foreground";
    const iconWrap = document.createElement("span");
    iconWrap.className = "lxp-workspace-nav-icon";
    const icon = document.createElement("i");
    const iconIndex = VIEWS[moduleId]?.indexOf(view) ?? -1;
    icon.className = `ti ${VIEW_ICONS[moduleId]?.[iconIndex] || "ti-layout-dashboard"} text-base`;
    icon.setAttribute("aria-hidden", "true");
    iconWrap.append(icon);
    const name = document.createElement("span");
    name.className = "min-w-0 flex-1 truncate";
    name.textContent = label(moduleId, view);
    link.append(iconWrap, name);
    link.setAttribute("aria-label", `${heading.textContent} · ${label(moduleId, view)}`);
    list.append(link);
  }
  box.append(list);
  const previewActions = nav.querySelector("#workspace-preview-actions");
  if (previewActions) previewActions.after(box);
  else nav.prepend(box);
  nav.dataset.lxpSubnavOpen = "true";
  nav.closest<HTMLElement>("#sidebar, #sidebar-mobile")?.setAttribute("data-lxp-module-nav-open", "true");
  nav.scrollTop = 0;
  markSelected(nav);
}
function markSelected(nav?: HTMLElement): void {
  const roots = nav ? [{ nav }] : menuRoots();
  for (const root of roots) root.nav.querySelectorAll<HTMLAnchorElement>("[data-lxp-module-view]").forEach((link) => {
    const selected = link.dataset.module === activeModule && link.dataset.lxpModuleView === activeView;
    link.classList.toggle(selectedClass, selected);
    if (selected) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  });
}
function findRootLink(moduleId: string): HTMLAnchorElement | null {
  return [...document.querySelectorAll<HTMLAnchorElement>("#sidebar a[data-module], #sidebar-mobile a[data-module]")]
    .find((link) => !link.dataset.lxpModuleView && link.dataset.module === moduleId) ?? null;
}
function show(link: HTMLAnchorElement): boolean {
  if (!document.querySelector("[data-workspace-shell]")) return false;
  const moduleId = link.dataset.module;
  if (!moduleId || link.dataset.lxpModuleView || getViews(moduleId).length < 2) return false;
  if (!activeModule) previousScroll = document.querySelector<HTMLElement>("#sidebar nav")?.scrollTop ?? 0;
  lastSourceLink = link;
  activeModule = moduleId;
  activeView = "";
  for (const { nav } of menuRoots()) renderSubnav(nav, findRootLink(moduleId) ?? link, moduleId);
  syncRootIndicators();
  return true;
}
function reset(): void {
  activeModule = "";
  activeView = "";
  for (const { nav, sidebar } of menuRoots()) {
    nav.dataset.lxpSubnavOpen = "false";
    sidebar.removeAttribute("data-lxp-module-nav-open");
    nav.querySelector("[data-lxp-module-subnav]")?.remove();
    if (sidebar.id === "sidebar") nav.scrollTop = previousScroll;
  }
  if (lastSourceLink?.isConnected) lastSourceLink.focus();
  lastSourceLink = null;
  syncRootIndicators();
}
function opened(link: HTMLAnchorElement): void {
  if (!link.dataset.lxpModuleView || !link.dataset.module) return;
  activeModule = link.dataset.module;
  activeView = link.dataset.lxpModuleView;
  markSelected();
}
function findTarget(doc: Document, view: View): HTMLElement | null {
  if (view.target.startsWith("heading:")) return [...doc.querySelectorAll<HTMLElement>("[data-panel-content] h2")][Number(view.target.slice(8))] ?? null;
  return doc.querySelector<HTMLElement>(view.target);
}
function activateRoot(doc: Document, url: URL, moduleWindow: Window = window): void {
  const token = ++frameActivationToken;
  const moduleId = url.pathname.split("/")[2] || activeModule;
  const viewId = getViews(moduleId).find((entry) => entry.href && new URL(entry.href, location.href).pathname === url.pathname)?.id
    || url.searchParams.get("workspaceView") || "";
  const view = getViews(moduleId).find((entry) => entry.id === viewId);
  if (!view) return;
  activeView = viewId;
  markSelected();
  if (view.href) return;
  if (doc.querySelector(`[data-workspace-isolated-view="${viewId}"]`)) return;
  let attempt = 0;
  const activate = () => {
    if (token !== frameActivationToken) return;
    if (view.mode === "command" && view.target === "files-editor") {
      const toggleEditor = (moduleWindow as Window & { toggleEditor?: () => void }).toggleEditor;
      if (typeof toggleEditor === "function") { toggleEditor(); return; }
    } else {
      const target = findTarget(doc, view);
      if (target) {
        if (view.mode === "scroll") target.scrollIntoView({ block: "start", behavior: "instant" });
        else if (target.getAttribute("aria-selected") !== "true") target.click();
        return;
      }
    }
    if (++attempt < 25) window.setTimeout(activate, 120);
  };
  window.setTimeout(activate, 80);
  doc.addEventListener("click", (event) => {
    const target = event.target as Node | null;
    if (!target || !(target as Element).closest) return;
    const matched = getViews(moduleId).find((entry) => entry.mode !== "scroll" && entry.mode !== "command" && findTarget(doc, entry)?.contains(target));
    if (matched) { activeView = matched.id; markSelected(); }
  }, true);
}

const api: ModuleNav = { show, reset, opened, activateRoot };
(window as Window & { __lxpModuleNav?: ModuleNav }).__lxpModuleNav = api;
document.addEventListener("click", (event) => {
  const back = (event.target as Element | null)?.closest?.("[data-lxp-module-nav-back]");
  if (back) { event.preventDefault(); reset(); }
});
const syncDirectRoute = () => {
  const current = document.querySelector<HTMLElement>('[data-module-drawer="open"]');
  if (!current) return;
  const isDevLogs = location.pathname.replace(/\/$/, "").endsWith("/module-dev/logs");
  const pathModuleId = location.pathname.split("/").filter(Boolean).at(-1) ?? "";
  const moduleId = pathModuleId === "nginx" ? "dns" : pathModuleId === "project-map" || isDevLogs ? "module-dev" : pathModuleId;
  const link = findRootLink(moduleId);
  if (link && (activeModule !== moduleId || !document.querySelector("#sidebar [data-lxp-module-subnav]"))) show(link);
  const viewId = moduleId === "module-dev" ? (isDevLogs ? "logs" : pathModuleId === "project-map" ? "project-map" : "my-modules")
    : new URL(location.href).searchParams.get("workspaceView");
  if (viewId) {
    activeView = viewId;
    markSelected();
    const view = getViews(moduleId).find((entry) => entry.id === viewId);
    if (view && !view.href) window.setTimeout(() => {
      const doc = document;
      const target = findTarget(doc, view);
      if (target) view.mode === "scroll" ? target.scrollIntoView({ block: "start", behavior: "instant" }) : target.getAttribute("aria-selected") !== "true" && target.click();
    }, 120);
  }
};
document.addEventListener("astro:page-load", syncDirectRoute);
document.addEventListener("astro:after-swap", syncDirectRoute);
document.addEventListener("astro:page-load", observeMenu);
document.addEventListener("astro:after-swap", observeMenu);
observeMenu();
syncDirectRoute();
