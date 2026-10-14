import { hasStartupShell } from "./startup-state";
import { startUiEvents } from "./ui-events";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Assistant WebSocket singleton.
 *
 * Connects to `/api/assistant/ws` once per browser session, decodes frames and
 * re-emits each as a `CustomEvent` on `window` so any React island or vanilla
 * script can subscribe without coupling to the connection. Reconnects with
 * exponential backoff and is wired to dedup `team_task_update` events (the
 * leader's SSE stream may also deliver them; the second delivery is dropped).
 *
 * Intentionally tiny: this module does NOT know about the chat-engine. The
 * engine listens on `window` (`lxp:assistant:team-task-update`) and updates
 * its in-memory mirrors + emits to subscribers. The WS itself never imports
 * the chat engine, so React islands that load lazily cannot create a cycle.
 *
 * Used by both `floating-assistant/chat-engine.ts` (the React app) and any
 * future vanilla panel that wants live team-task status without polling.
 */

import {
  resolvePanelApiPath,
  BRIDGE_SESSION_SESSION_KEY,
  SERVER_SWITCHER_ID,
  ATTR_CURRENT_BRIDGE_SESSION_ID,
  SESSION_COOKIE_NAME,
} from "./api-client";
import { WS_TOKEN_PATH } from "./api-routes";
import { DEFAULT_BACKEND_PORT } from "./server-env";

/** Wire-level frame `type` vocabulary for `/api/assistant/ws`. These are the
 *  values that travel ON THE WIRE (distinct from the local `window` CustomEvent
 *  names below). Keep in lockstep with backend `shared/assistant-ws-types.ts`. */
export const ASSISTANT_WS_WIRE = {
  HELLO: "assistant:hello",
  PING: "assistant:ping",
  PONG: "assistant:pong",
  TEAM_TASK_UPDATE: "assistant.team_task_update",
} as const;

/** Wire frame sent by the backend on `/api/assistant/ws`. */
export interface AssistantTeamTaskUpdate {
  id: string;
  conversationId?: string | null;
  /** "done" / "failed" / "cancelled" / "running" / "pending" — terminal
   *  statuses flip the subagent's "En curso" chip off in real time. */
  status: "done" | "failed" | "cancelled" | "running" | "pending" | string;
  workerConversationId?: string | null;
  workerId?: string | null;
  /** Any additional fields the backend may add over time — preserved verbatim. */
  [key: string]: unknown;
}

export interface AssistantWsFrame {
  type: typeof ASSISTANT_WS_WIRE.TEAM_TASK_UPDATE | string;
  task?: AssistantTeamTaskUpdate;
  [key: string]: unknown;
}

/** Window event names emitted by this module. Listeners should treat each
 *  payload as a snapshot — they do NOT replace previous frames. */
export const ASSISTANT_WS_EVENT = "lxp:assistant:ws" as const;
export const ASSISTANT_TEAM_TASK_EVENT = "lxp:assistant:team-task-update" as const;
export const ASSISTANT_WS_STATUS_EVENT = "lxp:assistant:ws-status" as const;

/** Connection state surfaced for debugging / status pills. */
export type AssistantWsStatus = "connecting" | "open" | "closed" | "reconnecting" | "stopped";

interface AssistantWsState {
  status: AssistantWsStatus;
  /** Set whenever the WS reconnects after a previous open session — useful for
   *  the chat-engine to invalidate its in-memory mirror and refetch on resume. */
  reconnectCount: number;
}

const state: AssistantWsState = { status: "stopped", reconnectCount: 0 };

/** Read the current connection status. Pure getter — does not subscribe. */
export function getAssistantWsStatus(): AssistantWsStatus {
  return state.status;
}

function emitStatus(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ASSISTANT_WS_STATUS_EVENT, { detail: { ...state } }));
}

/** Recent (taskId,status) tuples we've already applied via SSE OR via WS. The
 *  WS handler consults this BEFORE dispatching, so the leader's own SSE stream
 *  can race the WS without producing a double state mutation. Cleared by an LRU
 *  window so old entries fall off and a stale "done → running" cycle still
 *  repaints. Keyed by `taskId|status`. */
const RECENT_SEEN_MAX = 256;
const recentSeen = new Map<string, number>();

function rememberSeen(taskId: string, status: string): boolean {
  if (!taskId) return false;
  const key = `${taskId}|${status}`;
  const now = Date.now();
  if (recentSeen.has(key)) return true;
  recentSeen.set(key, now);
  // LRU-ish trim: when over capacity, drop the oldest insertion.
  if (recentSeen.size > RECENT_SEEN_MAX) {
    const firstKey = recentSeen.keys().next().value;
    if (firstKey) recentSeen.delete(firstKey);
  }
  return false;
}

/** Mark a (taskId, status) as already applied via the leader's SSE stream.
 *  Called from `chat-engine.applyEvent` when handling `team_task_update` —
 *  the WS handler will then drop any subsequent frame for the same pair. */
export function markAssistantTeamTaskSeen(taskId: string, status: string): void {
  rememberSeen(taskId, status);
}

// ── Connection lifecycle ─────────────────────────────────────────────────────

interface ConnectOpts {
  /** Override the URL builder — used by tests. */
  urlBuilder?: () => Promise<string> | string;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
/** Exponential backoff (ms) — capped at 10s. Reset on every successful open. */
const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000];
let backoffIndex = 0;
let stopped = false;

function getCookieToken(): string {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.split("=")[1] ?? ""
  );
}

let wsTokenCache: { token: string; expiresAt: number } | null = null;

async function fetchWsToken(): Promise<string> {
  const cookieToken = getCookieToken();
  if (cookieToken) return cookieToken;
  if (wsTokenCache && wsTokenCache.expiresAt - Date.now() > 15_000) return wsTokenCache.token;
  try {
    const res = await fetch(resolvePanelApiPath(WS_TOKEN_PATH), {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return "";
    const json = (await res.json().catch(() => null)) as { data?: { token?: string; expiresAt?: number } } | null;
    const token = typeof json?.data?.token === "string" ? json.data.token : "";
    const expiresAt = typeof json?.data?.expiresAt === "number" ? json.data.expiresAt : 0;
    if (token && expiresAt > Date.now()) wsTokenCache = { token, expiresAt };
    return token;
  } catch {
    return "";
  }
}

function getBridgeSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = (window.sessionStorage.getItem(BRIDGE_SESSION_SESSION_KEY) || "").trim();
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return (document.getElementById(SERVER_SWITCHER_ID)?.getAttribute(ATTR_CURRENT_BRIDGE_SESSION_ID) || "").trim();
}

// Standalone: the WS always goes to THIS box (same origin), never through a
// gateway. The old managed routing sent it to `api.luxisoft.com/__luxipanel`
// whenever the panel's own hostname ended in `.luxipanel.com` — which is
// exactly what a self-hosted panel on `panel.example.org` looks like, so
// every connection was proxied to LP-LS and rejected (401). The LP bridge is
// retired (no managed mode in the backend, and nothing ever sets the
// `lxp_auth_state` cookie the old check read), so the branch is gone.
//
// Token: `fetchWsToken()` prefers the session cookie and falls back to
// `/api/auth/ws-token`; the session cookie is httpOnly in practice, so reading
// it from JS yielded an empty token on the direct path.
async function buildWsUrl(): Promise<string> {
  const isNginxMode = !location.port || location.port === "80" || location.port === "443";
  const wsPort = (window as any).__BACKEND_PORT__ ?? DEFAULT_BACKEND_PORT;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const token = await fetchWsToken();
  const qs = new URLSearchParams();
  if (token) qs.set("token", token);
  const bridge = getBridgeSessionId();
  if (bridge) qs.set("bridge", bridge);
  const tokenParam = qs.toString() ? `?${qs.toString()}` : "";
  const authority = isNginxMode ? location.host : `${location.hostname}:${wsPort}`;
  return `${proto}//${authority}/api/assistant/ws${tokenParam}`;
}

function scheduleReconnect(): void {
  if (stopped) return;
  if (reconnectTimer) return;
  const delay = BACKOFF_MS[Math.min(backoffIndex, BACKOFF_MS.length - 1)];
  backoffIndex = Math.min(backoffIndex + 1, BACKOFF_MS.length - 1);
  state.status = "reconnecting";
  emitStatus();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectInternal();
  }, delay);
  reconnectTimer.unref?.();
}

function dispatchFrame(frame: AssistantWsFrame): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ASSISTANT_WS_EVENT, { detail: frame }));
  if (frame.type === ASSISTANT_WS_WIRE.TEAM_TASK_UPDATE && frame.task?.id && frame.task.status) {
    const task = frame.task;
    if (rememberSeen(task.id, String(task.status))) return; // already applied via SSE
    window.dispatchEvent(new CustomEvent(ASSISTANT_TEAM_TASK_EVENT, { detail: { task } }));
  }
}

async function connectInternal(opts: ConnectOpts = {}): Promise<void> {
  if (typeof window === "undefined") return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  stopped = false;
  state.status = "connecting";
  emitStatus();
  let url: string;
  try {
    url = opts.urlBuilder ? await opts.urlBuilder() : await buildWsUrl();
  } catch {
    scheduleReconnect();
    return;
  }
  let socket: WebSocket;
  try {
    socket = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }
  ws = socket;

  socket.onopen = () => {
    backoffIndex = 0;
    state.status = "open";
    state.reconnectCount += 1;
    emitStatus();
  };

  socket.onmessage = (event) => {
    let payload: AssistantWsFrame;
    try {
      payload = JSON.parse(typeof event.data === "string" ? event.data : "") as AssistantWsFrame;
    } catch {
      return;
    }
    if (!payload || typeof payload !== "object" || typeof payload.type !== "string") return;
    dispatchFrame(payload);
  };

  socket.onerror = () => {
    // The browser fires onerror before onclose in most cases; let onclose do
    // the scheduling to keep a single code path.
  };

  socket.onclose = () => {
    ws = null;
    if (stopped) {
      state.status = "stopped";
      emitStatus();
      return;
    }
    scheduleReconnect();
  };
}

/** Public — open the singleton connection. Idempotent (no-op if already
 *  open or connecting). Safe to call from any module; typically invoked once
 *  from the assistant module's mount. */
export function connectAssistantWs(): void {
  if (typeof window === "undefined") return;
  if (hasStartupShell()) { startUiEvents(); return; }
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  stopped = false;
  void connectInternal();
}

/** Public — close the connection and refuse further reconnects until the next
 *  `connectAssistantWs()`. Use on logout (token gone) or app teardown. */
export function disconnectAssistantWs(): void {
  stopped = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    try { ws.close(1000, "client-disconnect"); } catch { /* ignore */ }
    ws = null;
  }
  state.status = "stopped";
  emitStatus();
}

// On logout the session token is gone, so every reconnect attempt re-fetches a
// ws-token that now 401s and the socket closes → an infinite reconnect loop
// (the terminal already listens for this event; the assistant WS did not, and
// `disconnectAssistantWs` had no other callsite). Stop the singleton for good
// until the next explicit `connectAssistantWs()` after re-login.
if (typeof window !== "undefined") {
  window.addEventListener("luxipanel:logout", () => disconnectAssistantWs());
}
if (typeof window !== "undefined") window.addEventListener(ASSISTANT_WS_STATUS_EVENT, (event) => { if (hasStartupShell()) state.status = (event as CustomEvent).detail.status; });
