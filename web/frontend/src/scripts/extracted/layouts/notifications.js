import { hasStartupShell } from "/scripts/extracted/lib/startup-state.js";
/**
 * Panel notifications — bell dropdown + SSE feed.
 *
 * Responsibilities:
 *   • Fetch the unread count + list on open.
 *   • Subscribe to /api/notifications/stream and push new rows live.
 *   • Mark single / all as read, delete single / all.
 *   • Filter chips: system | module | ai | security | user.
 *   • Open a notification: mark read + close the drawer + hand its `target`
 *     (same shape as the super-search `SearchTarget`) to `window.__lxpNavigate`,
 *     the shared navigation engine exposed by `layouts/super-search.ts`. Legacy
 *     rows that only carry `link` are converted with `linkToTarget`.
 *   • Chrome i18n comes from `<script type="application/json"
 *     id="notifications-i18n">` (PanelLayout.astro), same pattern as `#chat-i18n`.
 *
 * The script is idempotent: it can be loaded multiple times (Astro view
 * transitions re-import it) without doubling event listeners. The state
 * lives on `window.__lxpNotifications` so reconnects survive `astro:after-swap`.
 */

import { linkToTarget } from "/scripts/extracted/lib/search-target.js?v=20260826notif";
import { scopeHeaders, resolveTargetScope } from "/scripts/extracted/lib/api-client.js";
import { createNotificationStream } from "/scripts/extracted/lib/notification-event-stream.js";

const STATE_KEY = "__lxpNotifications";

/* ─────────────────────────────── i18n ─────────────────────────────── */

const I18N_FALLBACK = {
  filters: { all: "All", system: "System", module: "Modules", ai: "AI", security: "Security", user: "Chat" },
  sources: { system: "System", module: "Module", ai: "AI", security: "Security", user: "Chat" },
  severity: { info: "Info", success: "Success", warning: "Warning", error: "Error" },
  relative: { now: "just now", min: "{n} min ago", h: "{n} h ago", d: "{n} d ago", mo: "{n} mo ago", y: "{n} y ago" },
  loading: "Loading…",
  errorLoad: "Notifications could not be loaded.",
  empty: "No notifications.",
  emptyFiltered: "No notifications in this filter.",
  dismiss: "Delete notification",
  connecting: "Connecting…",
  live: "Live",
  retrying: "Retrying…",
  disconnected: "Disconnected",
};

let I18N = null;

function t() {
  if (I18N) return I18N;
  let parsed = null;
  try {
    const el = document.getElementById("notifications-i18n");
    if (el && el.textContent) parsed = JSON.parse(el.textContent);
  } catch { parsed = null; }
  const src = parsed && typeof parsed === "object" ? parsed : {};
  I18N = {
    ...I18N_FALLBACK,
    ...src,
    filters: { ...I18N_FALLBACK.filters, ...(src.filters || {}) },
    sources: { ...I18N_FALLBACK.sources, ...(src.sources || {}) },
    severity: { ...I18N_FALLBACK.severity, ...(src.severity || {}) },
    relative: { ...I18N_FALLBACK.relative, ...(src.relative || {}) },
  };
  return I18N;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[c]);
}

function relativeTime(iso) {
  const rel = t().relative;
  const fmt = (tpl, n) => String(tpl).replace("{n}", String(n));
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  if (diff < 0) return rel.now;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return rel.now;
  if (m < 60) return fmt(rel.min, m);
  const h = Math.floor(m / 60);
  if (h < 24) return fmt(rel.h, h);
  const d = Math.floor(h / 24);
  if (d < 30) return fmt(rel.d, d);
  const months = Math.floor(d / 30);
  if (months < 12) return fmt(rel.mo, months);
  return fmt(rel.y, Math.floor(months / 12));
}

const SEVERITY_META = {
  info:    { dot: "bg-sky-500",     text: "text-sky-500",     chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400",         icon: "ti-info-circle" },
  success: { dot: "bg-emerald-500", text: "text-emerald-500", chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: "ti-circle-check" },
  warning: { dot: "bg-amber-500",   text: "text-amber-500",   chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",     icon: "ti-alert-triangle" },
  error:   { dot: "bg-destructive", text: "text-destructive", chip: "bg-destructive/10 text-destructive",                     icon: "ti-alert-octagon" },
};

/** Icono por módulo emisor. Mapa LOCAL (el catálogo del buscador no cubre
 *  emisores internos como `cola-escritura` o `cache-engine`). */
const MODULE_ICON = {
  "ai-assistant": "ti-robot",
  chat: "ti-message",
  ssl: "ti-certificate",
  firewall: "ti-shield-lock",
  backups: "ti-database-export",
  cloudflare: "ti-cloud",
  auth: "ti-lock",
  monitor: "ti-activity",
  mail: "ti-mail",
  hosting: "ti-server",
  webhooks: "ti-webhook",
  "cola-escritura": "ti-stack-2",
  "cache-engine": "ti-stack-2",
  "module-dev": "ti-code",
  nginx: "ti-server",
};

function moduleIcon(mod) {
  return MODULE_ICON[String(mod || "").toLowerCase()] || "ti-puzzle";
}

function sourceLabel(source) {
  return t().sources[source] || source || "";
}

function severityFor(s) {
  return SEVERITY_META[s] || SEVERITY_META.info;
}

function resolveApiPath(path) {
  if (!path.startsWith("/api/")) return path;
  const pn = window.location.pathname;
  const host = window.location.hostname.toLowerCase();
  if (host === "api.luxisoft.com" || pn === "/__luxipanel" || pn.startsWith("/__luxipanel/")) {
    return `/__luxipanel${path}`;
  }
  if (pn === "/panel" || pn.startsWith("/panel/")) {
    return `/panel${path}`;
  }
  return path;
}

async function api(method, path, body) {
  const scope = notificationScope();
  const resolvedPath = resolveApiPath(path);
  const headers = { ...scopeHeaders(method !== "GET" && method !== "HEAD"), accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(resolvedPath, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let json = null;
  try { json = await res.json(); } catch { /* not json */ }
  if (scope !== notificationScope()) return { ok: false, stale: true, status: res.status, json: null };
  return { ok: res.ok && (json?.ok !== false), status: res.status, json };
}

function notificationScope() {
  return JSON.stringify([resolveTargetScope(), scopeHeaders()]);
}

function ensureState() {
  let state = window[STATE_KEY];
  if (state) return state;
  state = {
    scope: notificationScope(),
    items: [],
    unread: 0,
    filter: "all",
    open: false,
    sse: null,
    sseRetry: 0,
    sseTimer: null,
    initialLoaded: false,
    listeners: false,
  };
  window[STATE_KEY] = state;
  return state;
}

function syncNotificationScope() {
  const state = ensureState();
  const scope = notificationScope();
  if (state.scope === scope) return;
  disconnectSse();
  state.scope = scope;
  state.items = [];
  state.unread = 0;
  state.initialLoaded = false;
  state.sseRetry = 0;
  setBadge(0);
  renderList();
}

function setBadge(count) {
  const badge = document.getElementById("notifications-badge");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.classList.remove("hidden");
    badge.classList.add("inline-flex");
  } else {
    badge.textContent = "0";
    badge.classList.add("hidden");
    badge.classList.remove("inline-flex");
  }
}

function setConnState(label, tone) {
  const el = document.getElementById("notifications-conn");
  if (!el) return;
  const cls = tone === "ok"
    ? "text-emerald-500"
    : tone === "warn"
      ? "text-amber-500"
      : "text-muted-foreground";
  el.className = `text-[11px] ${cls}`;
  el.innerHTML = `<i class="ti ti-plug text-xs"></i> ${escapeHtml(label)}`;
}

function renderList() {
  const state = ensureState();
  const list = document.getElementById("notifications-list");
  if (!list) return;
  const i18n = t();

  const filtered = state.filter === "all"
    ? state.items
    : state.items.filter((n) => n.source === state.filter);

  if (filtered.length === 0) {
    list.innerHTML = `
      <li class="px-4 py-8 text-center text-xs text-muted-foreground">
        <i class="ti ti-bell-off text-2xl block mx-auto mb-2"></i>
        ${escapeHtml(state.filter === "all" ? i18n.empty : i18n.emptyFiltered)}
      </li>`;
    return;
  }

  list.innerHTML = filtered.map((n) => {
    const sev = severityFor(n.severity);
    const wrapClass = n.read ? "opacity-70 hover:opacity-100" : "bg-primary/[0.04]";
    const moduleChip = n.module
      ? `<span class="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
           <i class="ti ${escapeHtml(moduleIcon(n.module))} text-[11px]"></i>${escapeHtml(n.module)}
         </span>`
      : "";
    const sevChip = `<span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${sev.chip}">
        <i class="ti ${escapeHtml(sev.icon)} text-[11px]"></i>${escapeHtml(i18n.severity[n.severity] || n.severity || "")}
      </span>`;
    const unreadDot = n.read
      ? ""
      : `<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full ${sev.dot}" aria-hidden="true"></span>`;
    return `
      <li class="notification-row group relative flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none ${wrapClass}"
          data-id="${escapeHtml(n.id)}" role="button" tabindex="0" aria-label="${escapeHtml(n.title)}">
        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${sev.dot}/15">
          <i class="ti ${escapeHtml(sev.icon)} text-sm ${sev.text}"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold leading-tight text-foreground">${escapeHtml(n.title)}</p>
          <p class="mt-0.5 whitespace-pre-line text-xs text-muted-foreground line-clamp-3">${escapeHtml(n.message)}</p>
          <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground/80">
            ${sevChip}
            ${moduleChip}
            <span>${escapeHtml(sourceLabel(n.source))}</span>
            <span aria-hidden="true">·</span>
            <time datetime="${escapeHtml(n.createdAt || "")}">${escapeHtml(relativeTime(n.createdAt))}</time>
          </div>
        </div>
        ${unreadDot}
        <button
          type="button"
          class="notification-dismiss invisible group-hover:visible self-start rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
          aria-label="${escapeHtml(i18n.dismiss)}"
        >
          <i class="ti ti-x text-xs"></i>
        </button>
      </li>`;
  }).join("");
}

function setItems(items) {
  const state = ensureState();
  state.items = Array.isArray(items) ? items : [];
  state.unread = state.items.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
  setBadge(state.unread);
  renderList();
}

function upsertItem(row) {
  const state = ensureState();
  const idx = state.items.findIndex((n) => n.id === row.id);
  if (idx >= 0) state.items[idx] = row;
  else state.items.unshift(row);
  state.items = state.items.slice(0, 200);
  state.unread = state.items.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
  setBadge(state.unread);
  renderList();
}

function markLocalRead(id) {
  const state = ensureState();
  const target = state.items.find((n) => n.id === id);
  if (!target || target.read) return;
  target.read = true;
  target.readAt = new Date().toISOString();
  state.unread = Math.max(0, state.unread - 1);
  setBadge(state.unread);
  renderList();
}

function removeLocal(id) {
  const state = ensureState();
  const before = state.items.length;
  state.items = state.items.filter((n) => n.id !== id);
  if (state.items.length !== before) {
    state.unread = state.items.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
    setBadge(state.unread);
    renderList();
  }
}

async function refreshUnreadCount() {
  if (hasStartupShell()) return;
  const res = await api("GET", "/api/notifications/unread-count");
  if (res.ok && res.json && typeof res.json.count === "number") {
    setBadge(res.json.count);
    ensureState().unread = res.json.count;
  }
}

async function loadList() {
  const list = document.getElementById("notifications-list");
  if (list) {
    list.innerHTML = `<li class="px-4 py-6 text-center text-xs text-muted-foreground"><i class="ti ti-loader-2 animate-spin"></i> ${escapeHtml(t().loading)}</li>`;
  }
  const res = await api("GET", "/api/notifications?pageSize=50");
  if (res.stale) return;
  if (!res.ok || !res.json || !Array.isArray(res.json.data)) {
    if (list) {
      list.innerHTML = `<li class="px-4 py-6 text-center text-xs text-destructive">${escapeHtml(t().errorLoad)}</li>`;
    }
    return;
  }
  setItems(res.json.data);
  if (typeof res.json.unread === "number") {
    setBadge(res.json.unread);
    ensureState().unread = res.json.unread;
  }
  ensureState().initialLoaded = true;
}

function connectSse() {
  if (hasStartupShell()) return;
  syncNotificationScope();
  const state = ensureState();
  if (state.sse) return;
  setConnState(t().connecting, "warn");
  let es;
  try {
    es = createNotificationStream();
  } catch {
    setConnState(t().disconnected, "warn");
    return;
  }
  state.sse = es;
  const scope = state.scope;
  const isCurrent = () => state.sse === es && scope === notificationScope();

  es.addEventListener("open", () => {
    if (!isCurrent()) return;
    state.sseRetry = 0;
    setConnState(t().live, "ok");
  });

  es.addEventListener("notification:created", (event) => {
    if (!isCurrent()) return;
    try {
      const row = JSON.parse(event.data);
      upsertItem(row);
    } catch { /* ignore malformed payloads */ }
  });

  es.addEventListener("notification:read", (event) => {
    if (!isCurrent()) return;
    try {
      const data = JSON.parse(event.data);
      if (data && data.id) markLocalRead(data.id);
      else if (data && data.all) {
        const s = ensureState();
        for (const n of s.items) { n.read = true; n.readAt = n.readAt || new Date().toISOString(); }
        s.unread = 0;
        setBadge(0);
        renderList();
      }
    } catch { /* ignore */ }
  });

  es.addEventListener("notification:cleared", (event) => {
    if (!isCurrent()) return;
    try {
      const data = JSON.parse(event.data);
      if (data && data.id) removeLocal(data.id);
      else if (data && data.all) {
        const s = ensureState();
        s.items = [];
        s.unread = 0;
        setBadge(0);
        renderList();
      }
    } catch { /* ignore */ }
  });

  es.addEventListener("error", () => {
    if (!isCurrent()) return;
    setConnState(t().retrying, "warn");
    try { es.close(); } catch {}
    state.sse = null;
    const delay = Math.min(30_000, 1000 * Math.pow(2, state.sseRetry++));
    if (state.sseTimer) clearTimeout(state.sseTimer);
    state.sseTimer = setTimeout(connectSse, delay);
  });
}

function disconnectSse() {
  const state = ensureState();
  if (state.sseTimer) { clearTimeout(state.sseTimer); state.sseTimer = null; }
  if (state.sse) {
    try { state.sse.close(); } catch {}
    state.sse = null;
  }
  setConnState(t().disconnected);
}

function setFilter(filter) {
  const state = ensureState();
  state.filter = filter;
  for (const btn of document.querySelectorAll(".notifications-filter")) {
    const active = btn.getAttribute("data-filter") === filter;
    btn.className = active
      ? "notifications-filter rounded-md px-2.5 py-1 text-[11px] font-medium text-primary border-b-2 border-primary"
      : "notifications-filter rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground border-b-2 border-transparent hover:text-foreground";
  }
  renderList();
}

/**
 * The panel is a native <dialog id="notifications-drawer"> rendered as a RIGHT
 * drawer by modal-drawer.css (slide-in) and closed with the shared exit
 * animation by dialog-motion.ts (which patches `close()`). Escape is handled by
 * dialog-motion too (`cancel` → animated close). We only open/close here.
 */
function getDrawer() {
  const el = document.getElementById("notifications-drawer");
  return el instanceof HTMLDialogElement ? el : null;
}

function isOpen() {
  const drawer = getDrawer();
  return !!drawer && drawer.open && !drawer.hasAttribute("data-lxp-closing");
}

function togglePanel(force) {
  const state = ensureState();
  const drawer = getDrawer();
  const btn = document.getElementById("notifications-btn");
  if (!drawer || !btn) return;
  const next = typeof force === "boolean" ? force : !isOpen();
  state.open = next;
  if (next) {
    if (!drawer.open) drawer.showModal();
    btn.setAttribute("aria-expanded", "true");
    loadList();
  } else {
    if (drawer.open) drawer.close();
    btn.setAttribute("aria-expanded", "false");
  }
}

/**
 * Abrir una notificación: marcarla leída (local + PATCH), cerrar el drawer y
 * ejecutar su `target` con el motor compartido del super buscador
 * (`window.__lxpNavigate`, ver `layouts/super-search.ts`), que valida
 * fail-closed y sabe clicar tabs / aplicar hash / despachar eventos con ack.
 *
 * El drawer cierra ANIMADO; `__lxpNavigate` espera a que no quede
 * `dialog[open]` antes de aplicar los pasos, así que se cierra primero.
 * Fallback: si el motor no está cargado o el destino no es seguro, se navega
 * al `link` legado.
 */
function openRow(id) {
  if (!id) return;
  const state = ensureState();
  const item = state.items.find((n) => n.id === id) || null;
  markLocalRead(id);
  void api("PATCH", `/api/notifications/${encodeURIComponent(id)}/read`);

  const target = (item && item.target) || linkToTarget(item && item.link);
  if (!target) return;

  togglePanel(false);
  const navigate = window.__lxpNavigate;
  if (typeof navigate === "function" && navigate(target) === true) return;
  const link = item && typeof item.link === "string" ? item.link : null;
  if (link) window.location.href = link;
}

function bindOnce() {
  const state = ensureState();
  if (state.listeners) return;
  state.listeners = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // Bell button toggles the panel.
    if (target.closest("#notifications-btn")) {
      event.preventDefault();
      togglePanel();
      return;
    }

    // ✕ in the drawer header.
    if (target.closest("#notifications-close")) {
      event.preventDefault();
      togglePanel(false);
      return;
    }

    // Click on the backdrop (the <dialog> element itself, outside its box).
    if (target instanceof HTMLDialogElement && target.id === "notifications-drawer") {
      togglePanel(false);
      return;
    }

    // Filter chips.
    const filterBtn = target.closest(".notifications-filter");
    if (filterBtn instanceof HTMLElement) {
      setFilter(filterBtn.getAttribute("data-filter") || "all");
      return;
    }

    // Mark-all-read shortcut.
    if (target.closest("#notifications-mark-all")) {
      event.preventDefault();
      void api("POST", "/api/notifications/read-all").then((res) => {
        if (res.ok) {
          const s = ensureState();
          for (const n of s.items) { n.read = true; n.readAt = n.readAt || new Date().toISOString(); }
          s.unread = 0;
          setBadge(0);
          renderList();
        }
      });
      return;
    }

    // Clear-all.
    if (target.closest("#notifications-clear-all")) {
      event.preventDefault();
      void api("DELETE", "/api/notifications").then((res) => {
        if (res.ok) {
          const s = ensureState();
          s.items = [];
          s.unread = 0;
          setBadge(0);
          renderList();
        }
      });
      return;
    }

    // Dismiss a single notification (X icon).
    const dismissBtn = target.closest(".notification-dismiss");
    if (dismissBtn instanceof HTMLElement) {
      event.stopPropagation();
      event.preventDefault();
      const row = dismissBtn.closest(".notification-row");
      const id = row?.getAttribute("data-id");
      if (!id) return;
      removeLocal(id);
      void api("DELETE", `/api/notifications/${encodeURIComponent(id)}`);
      return;
    }

    // Click on a row marks it read + navigates to its target.
    const row = target.closest(".notification-row");
    if (row instanceof HTMLElement) {
      openRow(row.getAttribute("data-id"));
    }
  });

  // Teclado: la fila es `role="button"` → Enter y Espacio la activan.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".notification-dismiss")) return;
    const row = target.closest(".notification-row");
    if (!(row instanceof HTMLElement)) return;
    event.preventDefault();
    openRow(row.getAttribute("data-id"));
  });

  // Escape: handled natively by <dialog> (+ dialog-motion's animated close).
  // Keep the button state in sync whenever the drawer closes for any reason.
  document.addEventListener("close", (event) => {
    if (event.target instanceof HTMLDialogElement && event.target.id === "notifications-drawer") {
      ensureState().open = false;
      document.getElementById("notifications-btn")?.setAttribute("aria-expanded", "false");
    }
  }, true);

  // Reconnect / pause SSE based on tab visibility — saves backend cycles
  // on users who leave the panel open in a background tab all day.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      connectSse();
      refreshUnreadCount();
    }
  });

  // Astro view transitions: tear down SSE on swap-out and rebuild on
  // swap-in to avoid keeping stale connections.
  document.addEventListener("astro:before-swap", () => {
    disconnectSse();
  });
  window.addEventListener("luxipanel:target-changed", () => {
    syncNotificationScope();
    refreshUnreadCount();
    connectSse();
    if (isOpen()) loadList();
  });
}

export function initNotifications() {
  const btn = document.getElementById("notifications-btn");
  if (!btn) return;
  bindOnce();
  syncNotificationScope();
  // Initial paint + connection. Refresh the count even before the user
  // opens the panel so the badge is accurate on the first render.
  refreshUnreadCount();
  connectSse();
}

// Auto-init when imported directly. Safe to call multiple times — the
// state guards prevent duplicate listeners / connections.
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNotifications, { once: true });
  } else {
    initNotifications();
  }
  document.addEventListener("astro:after-swap", initNotifications);
}

window.addEventListener("lxp:ui:status", (event) => { const n = event.detail?.notifications; if (typeof n === "number") { ensureState().unread = n; setBadge(n); } });
window.addEventListener("lxp:ui:notifications-changed", () => { if (isOpen()) void loadList(); });
