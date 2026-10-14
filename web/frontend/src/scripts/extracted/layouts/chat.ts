import { hasStartupShell } from "/scripts/extracted/lib/startup-state.js";
import { acquireChatStream } from "/scripts/extracted/lib/chat-event-stream.js";
/**
 * Panel internal chat — direct messenger link + SSE feed.
 *
 * Migrated from the hand-written `public/scripts/extracted/layouts/chat.js`
 * (bloque E): the source of truth is now this TypeScript file, compiled by
 * `scripts/build-extracted.mjs`.
 *
 * Mirrors notifications.js: idempotent (Astro view transitions re-import it),
 * state lives on `window.__lxpChat` so reconnects survive `astro:after-swap`.
 *
 *   • Open the full messenger directly from the topbar.
 *   • Subscribe to /api/chat/stream and keep the unread badge live.
 *   • Bloque E — on an incoming message that is NOT mine and NOT in the
 *     conversation currently open on /panel/chat (`window.__lxpChatActive`):
 *     a 150 ms `AudioContext` beep (`general.soundOnNewMessage`) and a desktop
 *     `Notification` (`general.desktopNotifications`, permission granted and
 *     `document.hidden`), with or without the message preview according to
 *     `general.previewInBell`.
 *   • Bloque B — the preview never prints a Linux username: it resolves the
 *     author through `conversation.memberNames`.
 *   • Bloque F — a GLOBAL incoming-call banner on `chat:call:ring`, with a
 *     synthesized ring tone. It is the fallback path: while /panel/chat is open
 *     the React island sets `documentElement.dataset.lxpCallUi="react"` and
 *     draws its own (SDK) banner, so this one stays hidden — two banners are
 *     the only way Accept and Decline could ever disagree. "No molestar" and
 *     "sin tono" (`calls.dnd` / `calls.ringtone`) suppress it.
 *
 * i18n strings come from `<script id="chat-i18n">`; the current username from
 * the `data-me` attribute on `#messenger-link`.
 */

const STATE_KEY = "__lxpChat";
const PREFS_KEY = "lxp.chat.prefs";
const BEEP_MS = 150;

interface ChatI18n {
  title: string;
  newConversation: string;
  seeMore: string;
  loading: string;
  empty: string;
  errorLoad: string;
  connecting: string;
  live: string;
  retrying: string;
  disconnected: string;
  you: string;
  attachment: string;
  newMessage: string;
  newMessageIn: string;
  unknownUser: string;
  callIncoming: string;
  callIncomingHint: string;
  callAccept: string;
  callReject: string;
}

interface ChatConversation {
  id: string;
  kind: string;
  displayTitle: string;
  online?: boolean;
  unread?: boolean;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  lastMessageFrom?: string | null;
  memberNames?: Record<string, string> | null;
}

interface ChatMessagePayload {
  id: string;
  from: string;
  fromDisplayName?: string | null;
  body?: string;
  createdAt?: string;
  attachments?: Array<{ name?: string }>;
}

interface ChatEventPayload {
  conversation?: ChatConversation;
  message?: ChatMessagePayload;
}

interface ChatState {
  conversations: ChatConversation[];
  unread: number;
  sse: EventSource | null;
  sseRetry: number;
  sseTimer: ReturnType<typeof setTimeout> | null;
  listeners: boolean;
  audio: AudioContext | null;
  /** Bloque F — la llamada que el banner global está mostrando. */
  call: { callId: string; convId: string } | null;
  /** Nodos del tono de llamada, para poder pararlo. */
  ring: { osc: OscillatorNode; gain: GainNode; timer: number } | null;
}

/** Lo que el topbar necesita del `ChatCallView` que viaja en `chat:call:*`. */
interface ChatCallPayload {
  id: string;
  convId: string;
  state: string;
  startedBy: string;
  participants?: Array<{ id: string; displayName?: string; state?: string }>;
}

/** Only the fields the topbar needs from `lxp.chat.prefs` (bloque E). */
interface TopbarChatPrefs {
  soundOnNewMessage: boolean;
  desktopNotifications: boolean;
  previewInBell: boolean;
}

const PREF_DEFAULTS: TopbarChatPrefs = {
  soundOnNewMessage: true,
  desktopNotifications: false,
  previewInBell: true,
};

declare global {
  interface Window {
    __lxpChat?: ChatState;
    __lxpChatI18n?: ChatI18n;
    __lxpChatActive?: { convId: string | null };
  }
}

function i18n(): ChatI18n {
  if (window.__lxpChatI18n) return window.__lxpChatI18n;
  let data: Partial<ChatI18n> = {};
  try {
    const el = document.getElementById("chat-i18n");
    if (el) data = JSON.parse(el.textContent || "{}") as Partial<ChatI18n>;
  } catch { /* fall back to defaults */ }
  const t: ChatI18n = {
    title: "Mensajes",
    newConversation: "Nueva conversación",
    seeMore: "Ver más",
    loading: "Cargando…",
    empty: "No tienes conversaciones todavía.",
    errorLoad: "No se pudieron cargar los chats.",
    connecting: "Conectando…",
    live: "En vivo",
    retrying: "Reintentando…",
    disconnected: "Desconectado",
    you: "Tú",
    attachment: "Adjunto",
    newMessage: "Nuevo mensaje",
    newMessageIn: "Nuevo mensaje en {title}",
    unknownUser: "Usuario",
    callIncoming: "Llamada entrante",
    callIncomingHint: "Audio con traducción en tiempo real",
    callAccept: "Aceptar",
    callReject: "Rechazar",
    ...data,
  };
  window.__lxpChatI18n = t;
  return t;
}

/** `{key}` interpolation (same contract as the panel's formatMessage). */
function fmt(template: string, values: Record<string, string | number>): string {
  return String(template ?? "").replace(/\{(\w+)\}/g, (m, k: string) =>
    Object.prototype.hasOwnProperty.call(values, k) ? String(values[k]) : m,
  );
}

function escapeHtml(s: unknown): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  return String(s ?? "").replace(/[&<>"']/g, (c) => map[c]!);
}

function lang(): string {
  return (document.documentElement.getAttribute("lang") || "es").split("-")[0]!;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const sec = Math.round((Date.now() - ts) / 1000);
  let rtf: Intl.RelativeTimeFormat | null = null;
  try { rtf = new Intl.RelativeTimeFormat(lang(), { numeric: "auto" }); } catch { rtf = null; }
  const f = (v: number, unit: Intl.RelativeTimeFormatUnit) => (rtf ? rtf.format(v, unit) : `${Math.abs(v)} ${unit}`);
  if (sec < 60) return f(-Math.max(1, sec), "second");
  const min = Math.round(sec / 60);
  if (min < 60) return f(-min, "minute");
  const h = Math.round(min / 60);
  if (h < 24) return f(-h, "hour");
  const d = Math.round(h / 24);
  if (d < 30) return f(-d, "day");
  const mo = Math.round(d / 30);
  if (mo < 12) return f(-mo, "month");
  return f(-Math.round(mo / 12), "year");
}

function initialsOf(name: unknown): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function getCsrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)luxipanel_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]!) : "";
}

function isLpMount(): boolean {
  const pn = window.location.pathname;
  const host = window.location.hostname.toLowerCase();
  return host === "api.luxisoft.com" || pn === "/__luxipanel" || pn.startsWith("/__luxipanel/");
}

function resolveApiPath(path: string): string {
  if (!path.startsWith("/api/")) return path;
  if (isLpMount()) return `/__luxipanel${path}`;
  const pn = window.location.pathname;
  if (pn === "/panel" || pn.startsWith("/panel/")) return `/panel${path}`;
  return path;
}

/** Panel page path honoring the LP `/__luxipanel` mount. */
function resolvePanelPath(path: string): string {
  return isLpMount() ? `/__luxipanel${path}` : path;
}

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; json: any }> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET" && method !== "HEAD") headers["x-csrf-token"] = getCsrfToken();
  const res = await fetch(resolveApiPath(path), {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* not json */ }
  return { ok: res.ok && json?.ok !== false, status: res.status, json };
}

function me(): string {
  const btn = document.getElementById("messenger-link");
  return btn?.getAttribute("data-me") || "";
}

function ensureState(): ChatState {
  let state = window[STATE_KEY];
  if (state) return state;
  state = {
    conversations: [],
    unread: 0,
    sse: null,
    sseRetry: 0,
    sseTimer: null,
    listeners: false,
    audio: null,
    call: null,
    ring: null,
  };
  window[STATE_KEY] = state;
  return state;
}

// ── Preferencias (bloque E) ─────────────────────────────────────────────────

/**
 * Read the localStorage mirror written by `messenger/chat-prefs.ts`. Validated
 * field by field so a corrupt blob degrades to the defaults instead of
 * silencing the notifications.
 */
function prefs(): TopbarChatPrefs {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}");
    const g = raw && typeof raw === "object" ? raw.general : null;
    if (!g || typeof g !== "object") return PREF_DEFAULTS;
    return {
      soundOnNewMessage: typeof g.soundOnNewMessage === "boolean" ? g.soundOnNewMessage : PREF_DEFAULTS.soundOnNewMessage,
      desktopNotifications: typeof g.desktopNotifications === "boolean" ? g.desktopNotifications : PREF_DEFAULTS.desktopNotifications,
      previewInBell: typeof g.previewInBell === "boolean" ? g.previewInBell : PREF_DEFAULTS.previewInBell,
    };
  } catch {
    return PREF_DEFAULTS;
  }
}

/** Short beep (150 ms) with the Web Audio API — no asset to ship. */
function beep(): void {
  const state = ensureState();
  try {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return;
    if (!state.audio) state.audio = new Ctor();
    const ctx = state.audio;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    // Tiny fade-out so it does not click at the end.
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + BEEP_MS / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + BEEP_MS / 1000);
  } catch { /* audio blocked / unsupported */ }
}

// ── Bloque F — banner GLOBAL de llamada entrante ────────────────────────────
//
// El banner del topbar es el camino de respaldo: cuando el usuario está en
// /panel/chat, la isla React marca `documentElement.dataset.lxpCallUi="react"`
// y dibuja SU banner (con el SDK), así que aquí no se pinta nada — dos banners
// simultáneos serían la única forma de que Aceptar y Rechazar se contradigan.

/** Los ajustes de llamada que necesita el topbar (espejo de `chat.calls`). */
interface TopbarCallPrefs {
  ringtone: "default" | "off";
  dnd: boolean;
}

function callPrefs(): TopbarCallPrefs {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}");
    const c = raw && typeof raw === "object" ? raw.calls : null;
    if (!c || typeof c !== "object") return { ringtone: "default", dnd: false };
    return {
      ringtone: c.ringtone === "off" ? "off" : "default",
      dnd: typeof c.dnd === "boolean" ? c.dnd : false,
    };
  } catch {
    return { ringtone: "default", dnd: false };
  }
}

/** ¿Debe sonar una llamada entrante? "No molestar" y "sin tono" la callan. */
function shouldRing(): boolean {
  const p = callPrefs();
  return !p.dnd && p.ringtone !== "off";
}

/**
 * Tono de llamada sintetizado (dos pulsos por segundo, 440/554 Hz).
 *
 * Un `OscillatorNode` en vez de un `<audio>`: no hay asset que servir, no hay
 * fetch que pueda fallar y se corta en el acto. Idempotente: llamar `startRing`
 * dos veces no apila osciladores.
 */
function startRing(): void {
  const state = ensureState();
  if (state.ring || !shouldRing()) return;
  try {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return;
    if (!state.audio) state.audio = new Ctor();
    const ctx = state.audio;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 440;
    osc.connect(gain);
    osc.start();
    let high = false;
    const pulse = window.setInterval(() => {
      high = !high;
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(high ? 554 : 440, now);
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    }, 500);
    state.ring = { osc, gain, timer: pulse };
  } catch {
    /* audio bloqueado o no soportado — el banner sigue siendo visible */
  }
}

function stopRing(): void {
  const state = ensureState();
  const ring = state.ring;
  if (!ring) return;
  state.ring = null;
  try {
    clearInterval(ring.timer);
    ring.osc.stop();
    ring.osc.disconnect();
    ring.gain.disconnect();
  } catch {
    /* ya parado */
  }
}

/** El banner vive fuera del drawer: una llamada entra aunque no haya nada abierto. */
function callBannerEl(): HTMLElement {
  let el = document.getElementById("chat-call-banner");
  if (el) return el;
  el = document.createElement("div");
  el.id = "chat-call-banner";
  el.className =
    "fixed left-1/2 top-4 z-[70] hidden w-[min(94vw,26rem)] -translate-x-1/2 rounded-2xl border border-border bg-card p-3 text-foreground shadow-xl";
  el.setAttribute("role", "alert");
  document.body.appendChild(el);
  return el;
}

function hideCallBanner(): void {
  stopRing();
  ensureState().call = null;
  const el = document.getElementById("chat-call-banner");
  if (el) {
    el.classList.add("hidden");
    el.innerHTML = "";
  }
}

/**
 * Pinta el banner para una llamada entrante. `call` es el `ChatCallView` del
 * evento SSE: `startedBy` es un login, así que el nombre SIEMPRE sale de
 * `participants[].displayName` (bloque B), nunca del id.
 */
function showCallBanner(call: ChatCallPayload): void {
  // La vista /panel/chat ya dibuja su propio banner con el SDK.
  if (document.documentElement.dataset.lxpCallUi === "react") return;
  const t = i18n();
  const state = ensureState();
  if (state.call?.callId === call.id) return;
  const host =
    (call.participants ?? []).find((p) => p.id === call.startedBy) ?? (call.participants ?? [])[0];
  const name = (host?.displayName ?? "").trim() || t.unknownUser;
  state.call = { callId: call.id, convId: call.convId };

  const el = callBannerEl();
  el.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">${escapeHtml(initialsOf(name))}</span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-[10px] uppercase tracking-wide text-muted-foreground">${escapeHtml(t.callIncoming)}</p>
        <p class="truncate text-sm font-medium">${escapeHtml(name)}</p>
        <p class="truncate text-[11px] text-muted-foreground">${escapeHtml(t.callIncomingHint)}</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button type="button" id="chat-call-reject" class="inline-flex h-9 items-center rounded-full bg-destructive px-3 text-xs text-destructive-foreground hover:bg-destructive/90">${escapeHtml(t.callReject)}</button>
        <button type="button" id="chat-call-accept" class="inline-flex h-9 items-center rounded-full bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700">${escapeHtml(t.callAccept)}</button>
      </div>
    </div>`;
  el.classList.remove("hidden");
  startRing();
}

/** Aplica un evento `chat:call:*` al banner global. */
function applyCallEvent(name: string, raw: string): void {
  let payload: { event?: string; call?: ChatCallPayload };
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  const call = payload?.call;
  if (!call?.id || !call.convId) return;
  const state = ensureState();
  if (name === "end" || call.state === "ended") {
    if (state.call?.callId === call.id) hideCallBanner();
    return;
  }
  if (name !== "ring") return;
  if (call.startedBy === me()) return;
  // "No molestar" no suena Y no interrumpe: Tolqia la marcará como perdida.
  if (callPrefs().dnd) return;
  const mine = (call.participants ?? []).find((p) => p.id === me());
  if (mine && mine.state !== "ringing") return;
  showCallBanner(call);
}

/** Display name of a message author — NEVER the Linux username (bloque B). */
function authorName(conv: ChatConversation | undefined, msg: ChatMessagePayload | undefined): string {
  const t = i18n();
  const explicit = (msg?.fromDisplayName ?? "").trim();
  if (explicit) return explicit;
  const user = (msg?.from ?? "").trim();
  const mapped = user ? (conv?.memberNames?.[user] ?? "").trim() : "";
  if (mapped) return mapped;
  if (conv?.kind === "dm" && (conv.displayTitle ?? "").trim()) return conv.displayTitle.trim();
  return t.unknownUser;
}

/** Desktop notification for a message in another conversation. */
function notifyDesktop(conv: ChatConversation, msg: ChatMessagePayload): void {
  const t = i18n();
  const p = prefs();
  if (!p.desktopNotifications) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!document.hidden) return;
  const who = authorName(conv, msg);
  const title = conv.kind === "dm" ? who : fmt(t.newMessageIn, { title: conv.displayTitle || t.newMessage });
  const preview = (msg.body || "").trim() || (msg.attachments?.length ? t.attachment : "");
  const bodyText = p.previewInBell ? preview : t.newMessage;
  try {
    const n = new Notification(title, {
      body: conv.kind === "dm" ? bodyText : `${who}: ${bodyText}`,
      tag: conv.id,
      icon: "/favicon.svg",
    });
    n.onclick = () => {
      try { window.focus(); } catch { /* ignore */ }
      window.location.href = resolvePanelPath(`/panel/chat?c=${encodeURIComponent(conv.id)}`);
      n.close();
    };
  } catch { /* notifications unavailable */ }
}

function setBadge(count: number): void {
  const badge = document.getElementById("chat-badge");
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

function recomputeBadge(): void {
  const state = ensureState();
  state.unread = state.conversations.reduce((acc, c) => acc + (c.unread ? 1 : 0), 0);
  setBadge(state.unread);
}

function setConnState(label: string, tone?: string): void {
  const el = document.getElementById("chat-conn");
  if (!el) return;
  const cls = tone === "ok" ? "text-emerald-500" : tone === "warn" ? "text-amber-500" : "text-muted-foreground";
  el.className = `text-[11px] ${cls}`;
  el.innerHTML = `<i class="ti ti-plug text-xs"></i> ${escapeHtml(label)}`;
}

/**
 * Row preview. Bloque B: in a group the author prefix is the DISPLAY NAME
 * (`memberNames`), never the Linux username. Bloque E: with
 * `previewInBell` off, only the "new message" placeholder is shown.
 */
function previewText(c: ChatConversation): string {
  const t = i18n();
  const raw = c.lastMessagePreview || "";
  if (!raw) return "";
  if (!prefs().previewInBell) return t.newMessage;
  const from = c.lastMessageFrom;
  const who = from === me()
    ? `${t.you}: `
    : c.kind !== "dm" && from
      ? `${authorName(c, { id: "", from })}: `
      : "";
  return who + raw;
}

function renderList(): void {
  const t = i18n();
  const state = ensureState();
  const list = document.getElementById("chat-list");
  if (!list) return;

  if (state.conversations.length === 0) {
    list.innerHTML = `
      <li class="px-4 py-8 text-center text-xs text-muted-foreground">
        <i class="ti ti-message-off text-2xl block mx-auto mb-2"></i>
        ${escapeHtml(t.empty)}
      </li>`;
    return;
  }

  list.innerHTML = state.conversations.slice(0, 12).map((c) => {
    const icon = c.kind === "dm" ? null : "ti-users";
    const avatar = icon
      ? `<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><i class="ti ${icon} text-base"></i></div>`
      : `<div class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">${escapeHtml(initialsOf(c.displayTitle))}${c.online ? `<span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500"></span>` : ""}</div>`;
    return `
      <li class="chat-row group relative flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-accent ${c.unread ? "bg-primary/[0.04]" : ""}" data-id="${escapeHtml(c.id)}">
        ${avatar}
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <p class="truncate text-sm font-medium leading-tight">${escapeHtml(c.displayTitle)}</p>
            <span class="shrink-0 text-[10px] text-muted-foreground/80">${escapeHtml(relativeTime(c.lastMessageAt))}</span>
          </div>
          <p class="truncate text-xs text-muted-foreground">${escapeHtml(previewText(c))}</p>
        </div>
        ${c.unread ? `<span class="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary"></span>` : ""}
      </li>`;
  }).join("");
}

function setConversations(rows: unknown): void {
  const state = ensureState();
  state.conversations = Array.isArray(rows) ? (rows as ChatConversation[]) : [];
  recomputeBadge();
  renderList();
}

/** Apply a live `chat:message` event to the dropdown state. */
function applyMessage(payload: ChatEventPayload): void {
  const state = ensureState();
  const conv = payload?.conversation;
  const msg = payload?.message;
  if (!conv || !msg) return;
  const idx = state.conversations.findIndex((c) => c.id === conv.id);
  const fromMe = msg.from === me();

  // Bloque E — alert only for messages from someone else that are NOT in the
  // conversation the /panel/chat island currently has open.
  const activeConv = window.__lxpChatActive?.convId ?? null;
  if (!fromMe && activeConv !== conv.id) {
    if (prefs().soundOnNewMessage) beep();
    notifyDesktop(conv, msg);
  }

  if (hasStartupShell()) return; // The global channel supplies the authoritative counter.
  if (idx >= 0) {
    const existing = state.conversations[idx]!;
    existing.lastMessageAt = conv.lastMessageAt || msg.createdAt || existing.lastMessageAt;
    existing.lastMessagePreview = conv.lastMessagePreview ?? existing.lastMessagePreview;
    existing.lastMessageFrom = msg.from;
    // Keep the display-name map fresh so the preview never falls back to a
    // username after a live update.
    if (conv.memberNames) existing.memberNames = { ...(existing.memberNames ?? {}), ...conv.memberNames };
    if (!fromMe) existing.unread = true;
    state.conversations.splice(idx, 1);
    state.conversations.unshift(existing);
    recomputeBadge();
    renderList();
  } else {
    // Unknown conversation (first message of a brand-new chat) — refetch so we
    // get the resolved title / presence.
    void loadList();
  }
}

async function refreshUnreadCount(): Promise<void> {
  if (hasStartupShell()) return;
  const res = await api("GET", "/api/chat/unread-count");
  if (res.ok && res.json && typeof res.json.count === "number") {
    setBadge(res.json.count);
    ensureState().unread = res.json.count;
  }
}

async function loadList(): Promise<void> {
  const t = i18n();
  const list = document.getElementById("chat-list");
  if (list && !ensureState().conversations.length) {
    list.innerHTML = `<li class="px-4 py-6 text-center text-xs text-muted-foreground"><i class="ti ti-loader-2 animate-spin"></i> ${escapeHtml(t.loading)}</li>`;
  }
  const res = await api("GET", "/api/chat/conversations");
  if (!res.ok || !res.json || !Array.isArray(res.json.data)) {
    if (list) list.innerHTML = `<li class="px-4 py-6 text-center text-xs text-destructive">${escapeHtml(t.errorLoad)}</li>`;
    return;
  }
  setConversations(res.json.data);
}

function connectSse(): void {
  if (hasStartupShell()) return;
  const t = i18n();
  const state = ensureState();
  if (state.sse) return;
  setConnState(t.connecting, "warn");
  let es: EventSource;
  try {
    es = acquireChatStream();
  } catch {
    setConnState(t.retrying, "warn");
    return;
  }
  state.sse = es;

  es.addEventListener("open", () => {
    state.sseRetry = 0;
    setConnState(t.live, "ok");
  });

  es.addEventListener("chat:message", (event) => {
    try { applyMessage(JSON.parse((event as MessageEvent).data)); } catch { /* ignore */ }
  });

  es.addEventListener("chat:read", (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data);
      if (data && data.username === me() && data.convId) {
        const c = ensureState().conversations.find((x) => x.id === data.convId);
        if (c) { c.unread = false; recomputeBadge(); renderList(); }
      }
    } catch { /* ignore */ }
  });

  // Bloque F — llamadas. Un solo manejador para los tres nombres.
  es.addEventListener("chat:call:ring", (event) => {
    applyCallEvent("ring", (event as MessageEvent).data);
  });
  es.addEventListener("chat:call:state", (event) => {
    applyCallEvent("state", (event as MessageEvent).data);
  });
  es.addEventListener("chat:call:end", (event) => {
    applyCallEvent("end", (event as MessageEvent).data);
  });

  es.addEventListener("error", () => {
    setConnState(t.retrying, "warn");
    try { es.close(); } catch { /* noop */ }
    state.sse = null;
    const delay = Math.min(30_000, 1000 * Math.pow(2, state.sseRetry++));
    if (state.sseTimer) clearTimeout(state.sseTimer);
    state.sseTimer = setTimeout(connectSse, delay);
  });
}

function disconnectSse(): void {
  const t = i18n();
  const state = ensureState();
  if (state.sseTimer) { clearTimeout(state.sseTimer); state.sseTimer = null; }
  if (state.sse) {
    try { state.sse.close(); } catch { /* noop */ }
    state.sse = null;
  }
  setConnState(t.disconnected);
}

function bindOnce(): void {
  const state = ensureState();
  if (state.listeners) return;
  state.listeners = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // Bloque F — Aceptar lleva a /panel/chat?c=…&call=…, donde la isla se une
    // a la llamada; Rechazar solo llama a la API y quita el banner.
    if (target.closest("#chat-call-accept")) {
      event.preventDefault();
      const call = ensureState().call;
      hideCallBanner();
      if (call) {
        window.location.href = resolvePanelPath(
          `/panel/chat?c=${encodeURIComponent(call.convId)}&call=${encodeURIComponent(call.callId)}`,
        );
      }
      return;
    }
    if (target.closest("#chat-call-reject")) {
      event.preventDefault();
      const call = ensureState().call;
      hideCallBanner();
      if (call) void api("POST", `/api/chat/calls/${encodeURIComponent(call.callId)}/reject`, {});
      return;
    }

  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      connectSse();
      void refreshUnreadCount();
    }
  });

  document.addEventListener("astro:before-swap", () => disconnectSse());
  // Un tono sonando tras cerrar la pestaña/salir sería lo peor posible.
  window.addEventListener("pagehide", () => stopRing());
}

export function initChat(): void {
  const btn = document.getElementById("messenger-link");
  if (!btn) return;
  bindOnce();
  void refreshUnreadCount();
  connectSse();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChat, { once: true });
  } else {
    initChat();
  }
  document.addEventListener("astro:after-swap", initChat);
}

window.addEventListener("lxp:ui:status", (event) => { const n = (event as CustomEvent).detail?.chat; if (typeof n === "number") { ensureState().unread = n; setBadge(n); } });
window.addEventListener("lxp:ui:call", (event) => { const frame = (event as CustomEvent).detail; applyCallEvent(frame.type.split(":").pop(), JSON.stringify(frame.data)); });

window.addEventListener("lxp:ui:chat-message", (event) => applyMessage((event as CustomEvent).detail));
