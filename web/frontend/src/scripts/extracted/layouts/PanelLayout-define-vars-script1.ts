import { startupSeed } from "/scripts/extracted/lib/startup-state.js";
import { getClientMessages } from "/scripts/extracted/lib/i18n-client.js";
import { notifyNativeTheme, notifyNativeLanguage, isAppWebView } from "/scripts/extracted/lib/native-bridge.js";
import { MODULE_ICON_SVGS } from "/scripts/extracted/lib/module-icons.generated.js";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";
import { bindLogout } from "/scripts/extracted/lib/logout.js?v=20260929-logout-spinner";
import { resolvePanelApiPath, scopeHeaders, getCsrfToken, resolveTargetScope, readTargetUiPrefs, writeTargetUiPrefs, fetchUiPreferences, putUiPreferences, CSRF_HEADER_NAME } from "/scripts/extracted/lib/api-client.js";

// Persist the chosen UI locale in the `lxp-locale` cookie. The panel is served on
// a DYNAMIC/ROTATING subdomain of luxipanel.com and the SSR resolves the locale
// ONLY from this cookie (reading the FIRST `lxp-locale` it finds in the header,
// with no way to tell host- vs parent-domain apart). A host-only cookie is lost
// when the subdomain rotates and, worse, the commercial site sets `lxp-locale` on
// the parent domain `.luxipanel.com`; that older parent-domain cookie would shadow
// the selection → the language "snapped back" to the previous one ~1s later.
// Fix: write the chosen locale to host-only AND to every registrable parent-domain
// scope (overrides the commercial one and survives subdomain rotation). Writing a
// value overrides any existing cookie on the same scope, so no separate clear is
// needed. Invalid scopes (public suffix, e.g. `com`) are rejected by the browser.
// Write `name=value` on the host-only scope AND every registrable parent-domain
// scope. A broad parent-domain scope (e.g. `.luxipanel.com`) survives the
// dynamic-subdomain rotation and overrides any stale value the commercial site
// may have set. `maxAge` is the full `; Max-Age=…` clause (use `; Max-Age=0` to
// expire). Invalid scopes (public suffix, e.g. `com`) are rejected by the browser.
function writeScopedCookie(name: string, code: string, maxAge: string): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const value = encodeURIComponent(code);
  const scopes = ["Path=/"]; // host-only
  const parts = location.hostname.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const domain = parts.slice(i).join(".");
    scopes.push(`Path=/; Domain=${domain}`);
    scopes.push(`Path=/; Domain=.${domain}`);
  }
  for (const scope of scopes) {
    document.cookie = `${name}=${value}; ${scope}${maxAge}; SameSite=Lax${secure}`;
  }
}

// Persist the chosen UI locale in the `lxp-locale` cookie (the SSR reads ONLY
// this cookie to pick the render language). See writeScopedCookie for why every
// parent-domain scope is written.
function persistLocaleCookie(code: string): void {
  // MUST match i18n/config.ts localeCookieName; "; Max-Age=31536000" = 1-year
  // cookie Max-Age (31536000s).
  writeScopedCookie("lxp-locale", code, "; Max-Age=31536000");
}

// Anti-flash theme cache read by the early inline `theme-init.js` before paint.
// Written on parent-domain scopes so it survives subdomain rotation (localStorage
// does not). Cleared for the "system" preference so theme-init falls back to the
// OS setting.
// MUST match lib/theme-storage-keys.ts LXP_THEME_KEY / LXP_THEME_USER_SET_KEY
// (bundle:false extracted module resolving only runtime-URL shared libs;
// theme-storage-keys.ts is not a runtime lib entry, so keep the literals).
function persistThemeCookie(theme: "light" | "dark"): void {
  // "; Max-Age=31536000" = 1-year cookie Max-Age (31536000s).
  writeScopedCookie("lxp-theme", theme, "; Max-Age=31536000");
}
function clearThemeCookie(): void {
  writeScopedCookie("lxp-theme", "", "; Max-Age=0");
}

function readLocaleCookie(): string {
  const raw = document.cookie
    .split("; ")
    .find((item) => item.startsWith("lxp-locale="))
    ?.split("=")[1];
  return raw ? decodeURIComponent(raw) : "";
}

type InitArgs = {
  locale: string;
  canLoadInstalledModules: any;
  canAccessSettings: any;
  canAccessUsers?: any;
  sidebarPermissions?: any;
  isAdminUser?: any;
  directSession?: any;
};

export default async function initScript({
  locale,
  canLoadInstalledModules,
  canAccessSettings,
  canAccessUsers,
  sidebarPermissions,
  isAdminUser,
}: InitArgs) {
  // An already-open SPA can retain listeners from an older layout bundle.
  // Reload once when this bundle first reaches that tab so the old title
  // updater cannot keep rewriting the freshly rendered page title.
  const runtime = window as any;
  const runtimeVersion = "20261013-dev-fixed";
  if (runtime.__lxp_panel_init_done && runtime.__lxp_panel_runtime_version !== runtimeVersion) {
    runtime.__lxp_panel_runtime_version = runtimeVersion;
    window.location.reload();
    return;
  }
  runtime.__lxp_panel_runtime_version = runtimeVersion;
  const { panelLayout: i18nPanel } = await getClientMessages(locale, ["panelLayout"]) as { panelLayout: any };
  // LUXIPANEL is standalone: logout always returns to this panel's own /login.
  const postLogoutTarget = "/login?logout=1";
  // The workspace relocates its footer and SPA navigation can replace buttons.
  // Bind session actions independently of the optional module UI.
  function bindSessionLogout() {
    bindLogout(document.getElementById("logout-btn"), {
      label: i18nPanel.actions.closingSession,
      url: resolvePanelApiPath("/api/logout"),
      csrfToken: getCsrfToken,
      csrfHeader: CSRF_HEADER_NAME,
      target: postLogoutTarget,
    });
  }
  bindSessionLogout();

  // ── SPA navigation safety net ─────────────────────────────────────────
  // Module init scripts rely on `astro:page-load` / `astro:after-swap`
  // firing after every SPA transition. In practice ClientRouter sometimes
  // dedupes inline `<script type="module">` blocks and the cached module
  // never re-runs its top-level init. This helper watches for URL changes
  // (popstate + MutationObserver on body) and re-fires the events when
  // ClientRouter forgot to, so init listeners always run on the new page.
  if (!(window as any).__lxp_spa_dispatcher_started && !document.querySelector("[data-workspace-shell]")) {
    (window as any).__lxp_spa_dispatcher_started = true;
    let lastPath = location.pathname;
    let lastFire = 0;
    let checkPending = false;

    const fireReady = () => {
      const now = Date.now();
      if (now - lastFire < 80) return; // dedupe rapid bursts
      lastFire = now;
      lastPath = location.pathname;
      document.dispatchEvent(new CustomEvent("astro:page-load"));
      document.dispatchEvent(new CustomEvent("astro:after-swap"));
    };

    const scheduleCheck = () => {
      if (checkPending) return;
      checkPending = true;
      requestAnimationFrame(() => {
        checkPending = false;
        if (location.pathname !== lastPath) requestAnimationFrame(fireReady);
      });
    };

    document.addEventListener("astro:page-load", () => { lastPath = location.pathname; lastFire = Date.now(); });
    document.addEventListener("astro:after-swap", () => { lastPath = location.pathname; lastFire = Date.now(); });
    window.addEventListener("popstate", scheduleCheck);
    const observer = new MutationObserver(scheduleCheck);
    observer.observe(document.body, { childList: true, subtree: false });
  }

  // ── Permissions helper ────────────────────────────────────────────────
  const sidebarAllowed = Array.isArray(sidebarPermissions) ? sidebarPermissions.map((item) => String(item)) : [];
  const canSeeSidebar = (item: string): boolean =>
    Boolean(isAdminUser) || sidebarAllowed.includes("*") || sidebarAllowed.includes(item);

  // ── syncPanelVersionBadge ─────────────────────────────────────────────
  async function syncPanelVersionBadge() {
    const badge = document.querySelector("[data-panel-version-badge]");
    if (!badge) return;
    try {
      const res = await fetch(resolvePanelApiPath("/api/health"), { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json() as { version?: string };
      if (!json.version) return;
      badge.textContent = json.version.startsWith("v") ? json.version : `v${json.version}`;
    } catch { /* fallback */ }
  }

  // ── Installed module metadata ─────────────────────────────────────────
  const accessLabel: Record<string, string> = {
    es: "Accesos", en: "Access", pt: "Acessos", fr: "Accès", de: "Zugänge",
    it: "Accessi", ja: "アクセス", ko: "접근", ru: "Доступ", hi: "पहुँच", bn: "অ্যাক্সেস", ar: "الوصول",
  };
  const MODULE_META: Record<string, { icon: string; label: string; href: string; sub: string }> = {
    users: { icon: "ti-users", label: accessLabel[locale.toLowerCase().split("-")[0]] ?? "Access", href: "/panel/users", sub: i18nPanel.groups.modules },
    monitor: { icon: "ti-activity", label: i18nPanel.nav.monitor, href: "/panel/monitor", sub: i18nPanel.groups.modules },
    files: { icon: "ti-folder", label: i18nPanel.nav.files, href: "/panel/files", sub: i18nPanel.groups.modules },
    firewall: { icon: "ti-shield-lock", label: i18nPanel.nav.firewall, href: "/panel/firewall", sub: i18nPanel.groups.modules },
    bitninja: { icon: "ti-shield-check", label: i18nPanel.nav.bitninja, href: "/panel/bitninja", sub: i18nPanel.groups.modules },
    mail: { icon: "ti-mail", label: i18nPanel.nav.mail, href: "/panel/mail", sub: i18nPanel.groups.modules },
    dns: { icon: "ti-server", label: i18nPanel.nav.dns, href: "/panel/nginx", sub: i18nPanel.groups.modules },
    backups: { icon: "ti-archive", label: i18nPanel.nav.backups, href: "/panel/backups", sub: i18nPanel.groups.modules },
    cron: { icon: "ti-clock", label: i18nPanel.nav.cron, href: "/panel/cron", sub: i18nPanel.groups.modules },
    databases: { icon: "ti-database", label: i18nPanel.nav.databases, href: "/panel/databases", sub: i18nPanel.groups.modules },
    obsidian: { icon: "ti-notebook", label: i18nPanel.nav.obsidian, href: "/panel/obsidian", sub: i18nPanel.groups.modules },
    cloudflare: { icon: "ti-brand-cloudflare", label: i18nPanel.nav.cloudflare, href: "/panel/cloudflare", sub: i18nPanel.groups.modules },
    "server-alerts": { icon: "ti-bell-ringing", label: i18nPanel.nav.serverAlerts, href: "/panel/server-alerts", sub: i18nPanel.groups.modules },
    expo: { icon: "ti-brand-expo", label: i18nPanel.nav.expo, href: "/panel/expo", sub: i18nPanel.groups.modules },
    "module-dev": { icon: "ti-packages", label: locale.toLowerCase().startsWith("es") ? "Dev" : "Dev", href: "/panel/module-dev", sub: i18nPanel.groups.modules },
    "project-map": { icon: "ti-sitemap", label: locale.toLowerCase().startsWith("es") ? "Mapa proyecto" : "Project map", href: "/panel/project-map", sub: i18nPanel.groups.modules },
    // Agentes IA ES la página de inicio del panel (`/` público == `/panel`):
    // se rinde SIEMPRE como primer ítem del grupo de módulos, sin depender de
    // `showInSidebar` ni del listado de instalados (ver HOME_MODULE_ID).
    assistant: { icon: "ti-robot", label: i18nPanel.nav.assistant, href: "/panel", sub: i18nPanel.groups.modules },
    // Terminal puede aparecer en el sidebar como cualquier otro módulo — se
    // rinde aquí SÓLO si su flag `showInSidebar` está activo (consultado desde
    // `/api/modules/installed`). Mientras el flag esté en false sigue viviendo
    // como FAB (gating independiente en el Drawer).
    terminal: { icon: "ti-terminal-2", label: i18nPanel.nav.terminal, href: "/panel/terminal", sub: i18nPanel.groups.modules },
    "repository-store": { icon: "ti-brand-github", label: i18nPanel.nav.githubStore, href: "/panel/repository-store", sub: i18nPanel.groups.modules },
    webhooks: { icon: "ti-webhook", label: i18nPanel.nav.webhooks, href: "/panel/webhooks", sub: i18nPanel.groups.modules },
    openclaw: { icon: "ti-brain", label: i18nPanel.nav.openclaw, href: "/panel/openclaw", sub: i18nPanel.groups.modules },
    hosting: { icon: "ti-building", label: i18nPanel.nav.hosting, href: "/panel/hosting", sub: i18nPanel.groups.modules },
    "codebase-graph": { icon: "ti-binary-tree", label: i18nPanel.nav.codebaseGraph, href: "/panel/codebase-graph", sub: i18nPanel.groups.modules },
  };

  // ── CMD_ITEMS (persisted across re-runs via window so loadInstalledModules
  //    always extends the same array the command palette reads) ──────────
  type CmdItem = { icon: string; label: string; sub: string; href?: string; action?: () => void };
  /** Módulo que es la página de inicio del panel (`/`). */
  const HOME_MODULE_ID = "assistant";
  const CMD_ITEMS_BASE: CmdItem[] = [
    { icon: MODULE_META[HOME_MODULE_ID].icon, label: MODULE_META[HOME_MODULE_ID].label, sub: i18nPanel.commandSub.main, href: "/panel" },
    ...(canAccessUsers ? [{ icon: "ti-users", label: i18nPanel.nav.users, sub: i18nPanel.commandSub.admin, href: "/panel/users" }] : []),
    { icon: "ti-puzzle", label: i18nPanel.nav.modules, sub: i18nPanel.commandSub.tools, href: "/panel/modules" },
    ...(canAccessSettings ? [{ icon: "ti-settings", label: i18nPanel.nav.settings, sub: i18nPanel.commandSub.tools, href: "/panel/settings" }] : []),
    { icon: "ti-user-circle", label: i18nPanel.nav.preferences, sub: i18nPanel.commandSub.account, href: "/panel/preferences" },
    { icon: "ti-sun",    label: i18nPanel.actions.lightMode,    sub: i18nPanel.commandSub.action, action: () => applyTheme(false, true) },
    { icon: "ti-moon",   label: i18nPanel.actions.darkMode,     sub: i18nPanel.commandSub.action, action: () => applyTheme(true, true) },
    { icon: "ti-logout", label: i18nPanel.actions.closeSession, sub: i18nPanel.commandSub.account, action: () => document.getElementById("logout-btn")?.click() },
  ];
  if (!(window as any).__lxp_cmd_items) {
    (window as any).__lxp_cmd_items = [...CMD_ITEMS_BASE];
  }
  const CMD_ITEMS: CmdItem[] = (window as any).__lxp_cmd_items;

  // MUST match lib/api-routes.ts MODULES_INSTALLED_PATH / ADMIN_MODULES_PATH
  // (bundle:false extracted module; api-routes.ts is not a runtime lib entry, so
  // keep the literals in lockstep).
  async function fetchInstalledModules(): Promise<Array<{ id?: string; name?: string; development?: boolean; showInSidebar?: boolean; showFloatingButton?: boolean }>> {
    try {
      const res = await fetch(resolvePanelApiPath("/api/modules/installed"), {
        credentials: "include", cache: "no-store", headers: { ...scopeHeaders(), accept: "application/json" },
      });
      if (res.ok) {
        const json = await res.json();
        return Array.isArray(json.data) ? json.data : [];
      }
    } catch { /* Fall through */ }
    try {
      const res = await fetch(resolvePanelApiPath("/api/admin/modules"), {
        credentials: "include", cache: "no-store", headers: { ...scopeHeaders(), accept: "application/json" },
      });
      if (!res.ok) return [];
      const json = await res.json() as { ok?: boolean; data?: Array<{ id: string; installed?: boolean; enabled?: boolean; name?: string; showInSidebar?: boolean; showFloatingButton?: boolean }> };
      const modules = Array.isArray(json.data) ? json.data : [];
      return modules.filter((m) => Boolean(m.enabled ?? m.installed)).map((m) => ({
        id: m.id,
        name: m.name,
        showInSidebar: m.showInSidebar,
        showFloatingButton: m.showFloatingButton,
      }));
    } catch { return []; }
  }

  async function loadInstalledModules() {
    if (!canLoadInstalledModules) return;
    const targetScope = resolveTargetScope();
    const installed = (startupSeed()?.modules as Awaited<ReturnType<typeof fetchInstalledModules>> | undefined) ?? await fetchInstalledModules();
    if (targetScope !== resolveTargetScope()) return;
    const isWorkspaceShell = Boolean(document.querySelector("[data-workspace-shell]"));

    // Conservar el grupo SSR y sustituir solo los enlaces inyectados. En el
    // workspace el chat ya ocupa el centro y no necesita un enlace Agentes IA.
    for (const sidebarId of ["sidebar", "sidebar-mobile"]) {
      const sidebar = document.getElementById(sidebarId);
      sidebar?.querySelectorAll('.lxp-workspace-tools a[data-module="module-dev"][data-injected]').forEach((link) => link.remove());
      sidebar?.querySelector("[data-dev-tools]")?.remove();
      const nav = sidebar?.querySelector("nav");
      const group = nav?.querySelector("#nav-modules-group");
      if (!group) continue;
      if (group.querySelector("a[data-home-link]") || isWorkspaceShell) {
        group.querySelectorAll("a[data-injected]").forEach((a) => a.remove());
      } else {
        group.remove();
      }
    }
    // Drop stale module entries from CMD_ITEMS before rebuilding.
    const moduleHrefs = new Set(Object.values(MODULE_META).map((m) => m.href));
    for (let i = CMD_ITEMS.length - 1; i >= 0; i -= 1) {
      const item = CMD_ITEMS[i];
      if (item?.href && moduleHrefs.has(item.href) && !CMD_ITEMS_BASE.some((b) => b.href === item.href)) {
        CMD_ITEMS.splice(i, 1);
      }
    }

    // El módulo de inicio sigue disponible fuera del workspace y en la paleta
    // de comandos, sin duplicar su botón en el menú derecho del workspace.
    const buildLinks = (mods: typeof installed) => mods.map((m) => {
      const moduleId = m.id ?? m.name;
      const meta = MODULE_META[moduleId ?? ""];
      if (!meta) return "";
      const isHome = moduleId === HOME_MODULE_ID;
      if (!isHome && !canSeeSidebar(moduleId ?? "")) return "";
      // Módulos en estado 'development': ocultos salvo a administradores del panel.
      if (m.development && !isAdminUser) return "";
      // Gate de visibilidad por módulo (opt-in para terminal).
      // Si el backend antiguo no devuelve el flag, no ocultamos nada
      // (`undefined !== false`) — preserva la UX previa al feature.
      if (!isHome && m.showInSidebar === false) return "";
      const isActive = isActiveHref(meta.href);
      // Core modules (los que tienen entrada en MODULE_META) muestran su nombre
      // TRADUCIDO desde i18n (`meta.label`, namespace panelLayout.nav). El
      // endpoint /api/modules/installed devuelve `m.name` SIN localizar (nombre
      // semilla en español), así que sólo lo usamos como fallback cuando falte
      // label (módulo de comunidad/renombrado sin clave i18n en MODULE_META).
      const label = (meta.label && meta.label.trim().length > 0) ? meta.label : (m.name ?? "");
      // Módulos que SON una marca (nginx/dns, cloudflare, obsidian) llevan su
      // logo simple-icons inline; el resto, su icono Tabler.
      const brandSvg = MODULE_ICON_SVGS[moduleId ?? ""];
      const iconHtml = brandSvg
        ? `<span class="lxp-workspace-nav-icon" aria-hidden="true">${brandSvg}</span>`
        : `<span class="lxp-workspace-nav-icon" aria-hidden="true"><i class="ti ${meta.icon} text-base"></i></span>`;
      const primary = `<a href="${meta.href}" data-module="${moduleId}"${isHome ? " data-home-link" : ' data-injected="1"'}
        class="sidebar-mod-link flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}">
        ${iconHtml}<span class="min-w-0 flex-1 truncate">${escapeHtml(label)}</span></a>`;
      return primary;
    }).join("");

    const rest = installed.filter((m) => (m.id ?? m.name) !== HOME_MODULE_ID);
    const links = buildLinks(rest);

    for (const sidebarId of ["sidebar", "sidebar-mobile"]) {
      const nav = document.querySelector(`#${sidebarId} nav`);
      if (!nav) continue;
      // Contenedor de enlaces = el <div> del grupo (no usar ".space-y-0.5"
      // como selector: el punto lo rompe). Lo localizamos por el home SSR.
      const homeLinkEl = nav.querySelector("#nav-modules-group a[data-home-link]");
      const container = homeLinkEl?.parentElement
        ?? (isWorkspaceShell ? nav.querySelector("#nav-modules-group > div") : null);
      if (container) {
      // Grupo SSR presente: añadir los módulos tras el home si existe.
        if (links.trim()) container.insertAdjacentHTML("beforeend", links);
        continue;
      }
      // Fallback sin grupo SSR: home solo en el panel convencional.
      const homeLink = isWorkspaceShell ? "" : buildLinks([{ id: HOME_MODULE_ID, name: MODULE_META[HOME_MODULE_ID].label }]);
      const groupHtml = `<div id="nav-modules-group">
        ${document.querySelector('[data-workspace-shell]') ? '' : `<p class="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">${i18nPanel.groups.modules}</p>`}
        <div class="space-y-0.5">${homeLink}${links}</div></div>`;
      const groups = nav.querySelectorAll(":scope > div");
      const lastGroup = groups[groups.length - 1];
      if (lastGroup) lastGroup.insertAdjacentHTML("beforebegin", groupHtml);
      else nav.insertAdjacentHTML("beforeend", groupHtml);
    }

    // Dev belongs to the fixed tools section. Move the authorized catalog link
    // so its visibility gates, submenu and navigation handlers stay intact.
    if (isWorkspaceShell) {
      for (const sidebarId of ["sidebar", "sidebar-mobile"]) {
        const sidebar = document.getElementById(sidebarId);
        const devLink = sidebar?.querySelector<HTMLAnchorElement>('#nav-modules-group a[data-module="module-dev"]');
        if (!sidebar || !devLink) continue;
        let tools = sidebar.querySelector<HTMLElement>(".lxp-workspace-tools");
        if (!tools) {
          tools = document.createElement("section");
          tools.className = "lxp-workspace-tools";
          tools.dataset.devTools = "";
          tools.setAttribute("aria-label", i18nPanel.groups.tools);
          const links = document.createElement("div");
          links.className = "space-y-0.5";
          tools.append(links);
          if (sidebarId === "sidebar-mobile") sidebar.querySelector("nav")?.append(tools);
          else sidebar.insertBefore(tools, sidebar.querySelector(":scope > #workspace-relocatable-footer"));
        }
        const modulesLink = tools.querySelector('a[href="/modules"], a[href="/panel/modules"]');
        if (modulesLink) modulesLink.before(devLink);
        else tools.querySelector(":scope > div")?.prepend(devLink);
      }
    }

    for (const m of installed) {
      const moduleId = m.id ?? m.name;
      const meta = MODULE_META[moduleId ?? ""];
      if (meta && canSeeSidebar(moduleId ?? "") && !CMD_ITEMS.find((i) => i.href === meta.href)) {
        // Mismo criterio que el sidebar: nombre traducido (i18n) para core.
        const label = (meta.label && meta.label.trim().length > 0) ? meta.label : (m.name ?? "");
        CMD_ITEMS.push({ icon: meta.icon, label, sub: meta.sub, href: meta.href });
      }
      if (moduleId === "module-dev" && m.showInSidebar !== false && canSeeSidebar("module-dev") && !CMD_ITEMS.find((i) => i.href === MODULE_META["project-map"].href)) {
        const mapMeta = MODULE_META["project-map"];
        CMD_ITEMS.push({ icon: mapMeta.icon, label: mapMeta.label, sub: mapMeta.sub, href: mapMeta.href });
      }
    }
  }

  // ── Active nav highlight ──────────────────────────────────────────────
  // El panel se sirve en dos formas de URL (ver middleware.normalizePanelPublicPath):
  // pública (`/mail`, `/modules`) y prefijada (`/panel/mail`). Las herramientas
  // enlazan a la forma pública y los módulos (MODULE_META) a la prefijada, así
  // que comparar `href` crudo contra `location.pathname` solo casa una de las
  // dos familias. Normalizamos ambos lados a la forma pública antes de comparar.
  function normalizeNavPath(raw: string): string {
    let p = (raw || "").split(/[?#]/)[0];
    if (p === "/panel" || p === "/panel/") return "/";
    if (p.startsWith("/panel/")) p = p.slice("/panel".length);
    if (!p.startsWith("/")) p = `/${p}`;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p;
  }
  function isActiveHref(href: string): boolean {
    const target = normalizeNavPath(href);
    const path = normalizeNavPath(window.location.pathname);
    if (target === "/") return path === "/";
    return path === target || path.startsWith(`${target}/`);
  }

  function updateActiveNav() {
    document.querySelectorAll("#sidebar a, #sidebar-mobile a").forEach((a) => {
      const active = isActiveHref(a.getAttribute("href") ?? "");
      a.classList.toggle("bg-primary/10", active);
      a.classList.toggle("text-primary", active);
      a.classList.toggle("text-muted-foreground", !active);
      a.classList.toggle("hover:bg-accent", !active);
      a.classList.toggle("hover:text-foreground", !active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  // ── Files editor toggle (sub-action under the "Archivos" module link) ──
  // Only on /panel/files: injects a <button data-files-editor-toggle> right
  // after the Files link in #nav-modules-group (desktop + mobile). Clicking it
  // calls window.toggleEditor (defined by the files page script) to swap the
  // right-hand pane between the browser and the editor. Removed off /files.
  function isFilesRoute(): boolean {
    const p = normalizeNavPath(window.location.pathname);
    return p === "/files" || p.startsWith("/files/");
  }

  function syncFilesEditorSidebarAction(): void {
    const onFiles = isFilesRoute();
    for (const sidebarId of ["sidebar", "sidebar-mobile"]) {
      const group = document.querySelector(`#${sidebarId} #nav-modules-group`);
      if (!group) continue;
      const existing = group.querySelector("[data-files-editor-toggle]");
      if (!onFiles) { existing?.remove(); continue; }
      if (existing) continue;
      const filesLink = group.querySelector('a[data-module="files"]');
      if (!filesLink) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-files-editor-toggle", "");
      btn.setAttribute("aria-controls", "files-editor-panel");
      btn.setAttribute("aria-pressed", "false");
      btn.className =
        "sidebar-mod-subaction flex w-full items-center gap-2.5 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground";
      btn.innerHTML = `<i class="ti ti-code text-sm shrink-0" aria-hidden="true"></i><span>${escapeHtml(i18nPanel.actions.toggleFilesEditor)}</span>`;
      filesLink.insertAdjacentElement("afterend", btn);
    }
  }

  // ── Mobile sidebar refs (persisted elements) ──────────────────────────
  const DESKTOP_SIDEBAR_STORAGE_KEY = "lxp-panel-sidebar-collapsed";
  const mobileSidebar = document.getElementById("sidebar-mobile");
  const overlay = document.getElementById("sidebar-overlay");
  const desktopSidebar = document.getElementById("sidebar");

  function isDesktopSidebarCollapsed(): boolean {
    return document.documentElement.dataset.panelSidebarCollapsed === "true";
  }

  function syncDesktopSidebarToggle(): void {
    const collapseIcon = document.getElementById("sidebar-desktop-icon-collapse");
    const expandIcon = document.getElementById("sidebar-desktop-icon-expand");
    const desktopToggle = document.getElementById("sidebar-desktop-toggle");
    const collapsed = isDesktopSidebarCollapsed();
    collapseIcon?.classList.toggle("hidden", collapsed);
    expandIcon?.classList.toggle("hidden", !collapsed);
    collapseIcon?.classList.toggle("inline-flex", !collapsed);
    expandIcon?.classList.toggle("inline-flex", collapsed);
    if (desktopToggle instanceof HTMLButtonElement) {
      desktopToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      desktopToggle.setAttribute("title", collapsed ? i18nPanel.actions.openMenu : i18nPanel.actions.close);
      desktopToggle.setAttribute("aria-label", collapsed ? i18nPanel.actions.openMenu : i18nPanel.actions.close);
    }
    if (desktopSidebar) {
      desktopSidebar.setAttribute("aria-hidden", collapsed ? "true" : "false");
    }
  }

  function applyDesktopSidebarCollapsed(collapsed: boolean, persist = false): void {
    document.documentElement.dataset.panelSidebarCollapsed = collapsed ? "true" : "false";
    if (persist) {
      try {
        localStorage.setItem(DESKTOP_SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
      } catch {
        // Ignore storage issues.
      }
    }
    syncDesktopSidebarToggle();
  }

  function initializeDesktopSidebar(): void {
    let collapsed = false;
    try {
      collapsed = localStorage.getItem(DESKTOP_SIDEBAR_STORAGE_KEY) === "1";
    } catch {
      collapsed = false;
    }
    applyDesktopSidebarCollapsed(collapsed);
  }

  function toggleDesktopSidebar(): void {
    applyDesktopSidebarCollapsed(!isDesktopSidebarCollapsed(), true);
  }

  // Sidebar móvil: misma animación que el colapso de escritorio (tokens de
  // motion.css): el panel entra/sale deslizándose desde la izquierda
  // (`.lxp-slide-x[data-open]`) y el overlay se funde (`.lxp-fade`). `hidden`
  // se quita ANTES de abrir y se vuelve a poner SOLO al terminar la salida
  // (transitionend o timeout de seguridad) para que no interfiera con la
  // transición. Un contador de secuencia evita que un cierre viejo oculte un
  // panel que se reabrió entre medias.
  let mobileSidebarSeq = 0;
  const MOBILE_SIDEBAR_SAFETY_MS = 260;
  function setMobileSidebarOpen(open: boolean): void {
    const seq = ++mobileSidebarSeq;
    const targets: Array<HTMLElement | null> = [mobileSidebar, overlay];
    if (open) {
      for (const el of targets) {
        if (!el) continue;
        el.classList.remove("hidden");
        if (el === mobileSidebar) el.classList.add("flex");
        el.removeAttribute("inert");
      }
      document.body.style.overflow = "hidden";
      // Dos frames: el primero aplica `display`, el segundo arranca la transición.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (seq !== mobileSidebarSeq) return;
        for (const el of targets) el?.setAttribute("data-open", "true");
      }));
      return;
    }
    document.body.style.overflow = "";
    for (const el of targets) {
      if (!el) continue;
      el.setAttribute("data-open", "false");
      el.setAttribute("inert", "");
    }
    const hideAll = () => {
      if (seq !== mobileSidebarSeq) return;
      mobileSidebar?.classList.add("hidden");
      mobileSidebar?.classList.remove("flex");
      overlay?.classList.add("hidden");
    };
    let done = false;
    const once = () => { if (done) return; done = true; mobileSidebar?.removeEventListener("transitionend", onEnd); hideAll(); };
    const onEnd = (event: Event) => { if (event.target === mobileSidebar) once(); };
    if (mobileSidebar && !mobileSidebar.classList.contains("hidden")) {
      mobileSidebar.addEventListener("transitionend", onEnd);
      window.setTimeout(once, MOBILE_SIDEBAR_SAFETY_MS);
    } else {
      once();
    }
  }

  function openSidebar() {
    setMobileSidebarOpen(true);
  }

  function closeSidebar() {
    setMobileSidebarOpen(false);
  }

  // ── Theme ─────────────────────────────────────────────────────────────
  const html = document.documentElement;
  const currentTargetScope = (): string => resolveTargetScope();
  const currentTheme = (): "light" | "dark" => (html.classList.contains("dark") ? "dark" : "light");
  const syncCurrentTargetUiPrefs = (nextLocale = readLocaleCookie() || locale): void => {
    writeTargetUiPrefs(currentTargetScope(), { locale: nextLocale, theme: currentTheme() });
  };

  function syncThemeIcons(dark: boolean) {
    const sun = document.getElementById("icon-sun");
    const moon = document.getElementById("icon-moon");
    if (sun)  { sun.style.display  = dark ? "none" : "inline-flex"; sun.classList.toggle("hidden", dark); }
    if (moon) { moon.style.display = dark ? "inline-flex" : "none"; moon.classList.toggle("hidden", !dark); }
  }

  function applyTheme(dark: boolean, persist = false) {
    html.classList.toggle("dark", dark);
    if (persist) {
      // MUST match lib/theme-storage-keys.ts LXP_THEME_KEY / LXP_THEME_USER_SET_KEY
      // (bundle:false extracted module; keep the literals in lockstep).
      localStorage.setItem("lxp-theme", dark ? "dark" : "light");
      // Mark this as an explicit user choice. The early inline `theme-init.js`
      // (and `restoreTheme`) only honor a stored theme when this flag is "1";
      // without it they force light on every load/SPA-swap and overwrite
      // `lxp-theme` back to "light", so the toggle wouldn't persist.
      localStorage.setItem("lxp-theme-user-set", "1");
      // En el WebView de la app móvil, propaga la elección a la app nativa para
      // que cambie también su tema (chrome nativo, otras pantallas). Solo en
      // `persist` = acción explícita del usuario (no en initializeTheme ni en la
      // inyección app→web), así no hay bucle. No-op fuera del WebView.
      notifyNativeTheme(dark);
      writeTargetUiPrefs(currentTargetScope(), { theme: dark ? "dark" : "light" });
      // Backend is the source of truth: mirror the choice to the anti-flash
      // cookie (survives subdomain rotation) and persist it server-side
      // (per-user+per-server). Fire-and-forget; the local effect already applied.
      persistThemeCookie(dark ? "dark" : "light");
      putUiPreferences({ theme: dark ? "dark" : "light" });
    }
    syncThemeIcons(dark);
  }

  function initializeTheme() {
    const targetTheme = readTargetUiPrefs(currentTargetScope())?.theme;
    const stored = targetTheme || localStorage.getItem("lxp-theme");
    if (targetTheme) {
      localStorage.setItem("lxp-theme", targetTheme);
      localStorage.setItem("lxp-theme-user-set", "1");
    }
    applyTheme(stored === "dark");
    if (!stored) localStorage.setItem("lxp-theme", "light");
  }

  function restoreTargetUiPrefsOnLoad(): boolean {
    const prefs = readTargetUiPrefs(currentTargetScope());
    if (!prefs) return false;

    if (prefs.theme === "dark" || prefs.theme === "light") {
      localStorage.setItem("lxp-theme", prefs.theme);
      localStorage.setItem("lxp-theme-user-set", "1");
      html.classList.toggle("dark", prefs.theme === "dark");
    }

    const targetLocale = typeof prefs.locale === "string" ? prefs.locale.trim() : "";
    if (!targetLocale || isAppWebView()) return false;

    const currentLocale = readLocaleCookie() || locale;
    if (targetLocale === currentLocale) {
      try {
        sessionStorage.removeItem(`lxp-target-locale-restore:${currentTargetScope()}`);
      } catch {
        // Ignore session storage issues.
      }
      return false;
    }

    const restoreKey = `lxp-target-locale-restore:${currentTargetScope()}`;
    try {
      if (sessionStorage.getItem(restoreKey) === targetLocale) return false;
      sessionStorage.setItem(restoreKey, targetLocale);
    } catch {
      // Ignore session storage issues and still try to recover the locale once.
    }

    persistLocaleCookie(targetLocale);
    window.location.reload();
    return true;
  }

  // ── Backend reconcile (source of truth) ───────────────────────────────
  // The cookies/localStorage are only an anti-flash cache; the authoritative
  // theme+language live in a per-user+per-server sidecar behind
  // GET /api/preferences/ui. On load we fetch it and, if it disagrees with the
  // local cache, the BACKEND WINS: we refresh the cache and apply it (theme =
  // instant class swap; language = one reload so the SSR re-renders). Runs once
  // per full page load, browser-only (in the native app the OS/app drives both
  // theme and language, so we must not fight the native sync).
  async function reconcileUiPreferencesFromBackend(): Promise<void> {
    if (isAppWebView()) return;
    const prefs = await fetchUiPreferences();
    if (!prefs) return; // no session / unreachable / endpoint missing → keep cache

    // Theme.
    if (prefs.theme === "dark" || prefs.theme === "light") {
      persistThemeCookie(prefs.theme);
      writeTargetUiPrefs(currentTargetScope(), { theme: prefs.theme });
      applyTheme(prefs.theme === "dark"); // no persist → does not re-PUT
    } else if (prefs.theme === "system") {
      clearThemeCookie();
      const sysDark = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
      applyTheme(sysDark);
    }

    // Language. `null` means "frontend decides" → leave the current locale.
    const backendLocale = typeof prefs.language === "string" ? prefs.language.trim() : "";
    if (backendLocale && backendLocale !== (readLocaleCookie() || locale)) {
      writeTargetUiPrefs(currentTargetScope(), { locale: backendLocale });
      persistLocaleCookie(backendLocale);
      if (document.documentElement.lang === backendLocale) return;
      // One-time reload guard (mirrors restoreTargetUiPrefsOnLoad). Normally the
      // post-reload SSR renders `backendLocale`, so the guard above is false on
      // the next run and there is no loop. BUT if the reload does NOT make
      // `readLocaleCookie()` equal `backendLocale` — e.g. a broader-scoped
      // `lxp-locale` cookie the commercial site set on `.luxipanel.com` shadows
      // ours, or the backend returns a locale variant the SSR normalizes
      // differently — the guard stays true and the page reloads forever. Record
      // that we already reloaded for this locale in sessionStorage so a second
      // pass bails instead of looping. Legitimate reconciliation still happens
      // exactly once per session per backend locale.
      const reloadKey = `lxp-ui-reconcile-reload:${currentTargetScope()}`;
      try {
        if (sessionStorage.getItem(reloadKey) === backendLocale) return;
        sessionStorage.setItem(reloadKey, backendLocale);
      } catch {
        // sessionStorage unavailable (private mode): fall through and still
        // reload once — the worst case degrades to prior behaviour.
      }
      window.location.reload();
    }
  }

  async function toggleThemeWithTransition() {
    const toDark = !html.classList.contains("dark");
    const workspaceButton = Array.from(document.querySelectorAll<HTMLElement>(".lxp-modules-theme-control")).find((item) => item.getClientRects().length > 0);
    const btn = workspaceButton ?? document.getElementById("theme-btn") ?? document.getElementById("theme-toggle");
    if (!document.startViewTransition || !btn) { applyTheme(toDark, true); return; }
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
    const transition = document.startViewTransition(() => applyTheme(toDark, true));
    await transition.ready;
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${radius}px at ${cx}px ${cy}px)`] },
      { duration: 380, easing: "ease-in", pseudoElement: "::view-transition-new(root)" },
    );
  }

  // ── Focus trap ────────────────────────────────────────────────────────
  const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function trapFocus(dialog: HTMLDialogElement) {
    const nodes = Array.from(dialog.querySelectorAll(FOCUSABLE)) as HTMLElement[];
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    function handler(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    }
    dialog.addEventListener("keydown", handler);
    dialog.addEventListener("close", () => dialog.removeEventListener("keydown", handler), { once: true });
    first.focus();
  }

  // ── Always run on each navigation ─────────────────────────────────────
  if (restoreTargetUiPrefsOnLoad()) return;

  syncPanelVersionBadge();
  initializeTheme();
  initializeDesktopSidebar();
  syncCurrentTargetUiPrefs();
  // updateActiveNav runs AFTER loadInstalledModules so module links are
  // already in the sidebar when we try to highlight the active one.
  void loadInstalledModules().then(() => { updateActiveNav(); syncFilesEditorSidebarAction(); });

  // ── One-time event listener setup ─────────────────────────────────────
  // Guard prevents duplicate listeners when initScript re-runs on SPA
  // navigation (define:vars scripts re-execute on every page swap).
  if (!(window as any).__lxp_panel_init_done) {
    (window as any).__lxp_panel_init_done = true;
    document.addEventListener("astro:after-swap", bindSessionLogout);
    document.addEventListener("astro:page-load", bindSessionLogout);

    // Reconcile the local theme/language cache against the authoritative backend
    // once per full page load (SPA navigations reuse the reconciled cache).
    void reconcileUiPreferencesFromBackend();

    // Per-navigation callbacks — registered once, fire on every swap.
    document.addEventListener("astro:after-swap", syncPanelVersionBadge);
    document.addEventListener("astro:after-swap", initializeTheme);
    document.addEventListener("astro:after-swap", syncDesktopSidebarToggle);
    document.addEventListener("astro:after-swap", async () => {
      await loadInstalledModules();
      updateActiveNav();
      syncFilesEditorSidebarAction();
    });
    document.addEventListener("astro:after-swap", closeSidebar);
    window.addEventListener("lxp:sidebar:close", closeSidebar);
    // MUST match lib/use-module-gate.ts MODULES_CHANGED_EVENT (bundle:false
    // extracted module; keep the literal in lockstep).
    window.addEventListener("luxipanel:modules-changed", async () => {
      await loadInstalledModules();
      updateActiveNav();
      syncFilesEditorSidebarAction();
    });
    window.addEventListener("luxipanel:target-changed", async () => {
      await loadInstalledModules();
      updateActiveNav();
      syncFilesEditorSidebarAction();
    });

    // ── Theme button ──────────────────────────────────────────────────
    // sidebar-toggle lives in the per-module topbar (persist key changes per
    // route), so theme-btn can be a fresh element after visiting a new module.
    // Re-bind on astro:after-swap with data-bound to avoid double-binding on
    // cached topbars restored by View Transitions.
    function bindThemeButton() {
      const btn = document.getElementById("theme-btn") ?? document.getElementById("theme-toggle");
      if (btn && !btn.dataset.bound) {
        btn.dataset.bound = "true";
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopImmediatePropagation();
          void toggleThemeWithTransition();
        }, { capture: true });
      }
    }
    bindThemeButton();
    document.addEventListener("astro:after-swap", bindThemeButton);
    document.addEventListener("click", (e) => {
      if ((e.target as Element)?.closest?.(".lxp-modules-theme-control")) void toggleThemeWithTransition();
    });

    // ── Language selector ────────────────────────────────────────────
    // #language-select lives in the per-module topbar (re-rendered per route),
    // so use event delegation on document. Persist the choice in the lxp-locale
    // cookie and reload so the server re-renders in the chosen language.
    document.addEventListener("change", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLSelectElement) || !["language-select", "workspace-language-select", "workspace-mobile-language-select"].includes(target.id)) return;
      const nextLocale = target.value;
      // En el WebView de la app móvil la APP es el ÚNICO conductor del cambio de
      // idioma: solo le notificamos. Si la web además fijara la cookie y recargara,
      // competiría con la re-inyección de la app (buildLanguageSyncScript con un
      // languageRef todavía viejo) que reescribe la cookie al idioma anterior tras
      // onLoadEnd → la UI "vuelve" al idioma previo ~1s después. La app actualiza su
      // estado y su propio efecto navega al idioma nuevo (y ya sin revertir).
      if (isAppWebView()) {
        writeTargetUiPrefs(currentTargetScope(), { locale: nextLocale });
        notifyNativeLanguage(nextLocale);
        return;
      }
      // Demás dispositivos (navegador): flujo normal. Clear any lxp-locale set on
      // the host OR a parent domain first, so a broader-scoped stale cookie (e.g.
      // one written by the commercial site on .luxipanel.com) can't shadow the new
      // choice; then set it fresh host-only and reload so the server re-renders.
      writeTargetUiPrefs(currentTargetScope(), { locale: nextLocale });
      persistLocaleCookie(nextLocale);
      // Backend is the source of truth. `putUiPreferences` uses keepalive so the
      // PUT survives the reload below (per-user+per-server persistence).
      putUiPreferences({ language: nextLocale });
      window.location.reload();
    });

    // ── Mobile sidebar + topbar elements (event delegation) ──────────
    // sidebar-toggle and cmd-trigger live inside the per-module topbar whose
    // transition:persist key changes per route, so these elements can be
    // freshly rendered after each navigation. Event delegation on document
    // avoids re-binding after each swap.
    document.addEventListener("click", (e) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (t.closest?.("[data-files-editor-toggle]")) {
        (window as any).toggleEditor?.();
        // On mobile the sidebar overlays the content: close it so the toggled
        // editor is actually visible.
        if (mobileSidebar && !mobileSidebar.classList.contains("hidden")) closeSidebar();
        return;
      }
      if (t.closest?.("#sidebar-desktop-toggle")) { toggleDesktopSidebar(); return; }
      if (t.closest?.("#sidebar-toggle")) { openSidebar(); return; }
      if (t.id === "sidebar-overlay")     { closeSidebar(); return; }
    });

    // ── Focus trap for <dialog> elements ─────────────────────────────
    document.querySelectorAll("dialog").forEach((d) => {
      const orig = (d as HTMLDialogElement).showModal.bind(d);
      (d as HTMLDialogElement).showModal = () => { orig(); trapFocus(d as HTMLDialogElement); };
    });
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLDialogElement) {
            const orig = node.showModal.bind(node);
            node.showModal = () => { orig(); trapFocus(node); };
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });

    // ── Light-dismiss global de <dialog> nativos ─────────────────────
    // Los drawers React (ModalShell) ya cierran al clicar fuera; los <dialog>
    // nativos no. Clic en el backdrop de cualquier <dialog> abierto lo cierra.
    // El target del clic sobre ::backdrop es el propio <dialog>; el chequeo de
    // rect distingue backdrop de un clic sobre padding interno del dialog.
    document.addEventListener("click", (e) => {
      const dlg = e.target;
      if (!(dlg instanceof HTMLDialogElement) || !dlg.open) return;
      const r = dlg.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (inside) return;
      // Emular Escape: `cancel` cancelable, para respetar los guards existentes
      // (editor de Files con pestañas sucias, tiptap, server-switcher, mail).
      if (dlg.dispatchEvent(new Event("cancel", { cancelable: true }))) dlg.close();
    });

    // ── Command Palette → super buscador ─────────────────────────────
    // La paleta vive ahora en `layouts/super-search.ts` (drawer derecho,
    // catálogo SSOT + ranking + fallback IA). Aquí solo se mantiene
    // `window.__lxp_cmd_items` como fuente de los módulos instalados
    // (comunidad) que el super buscador muestra como vistas.
  }
}
