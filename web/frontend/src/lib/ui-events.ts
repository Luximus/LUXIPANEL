import { invalidateStartup } from "./startup-state";
import { MODULES_CHANGED_EVENT } from "./module-events";
import { afterPrimaryReady, hasStartupShell } from "./startup-state";
import { resolvePanelApiPath, scopeHeaders } from "./api-client";
import { DEFAULT_BACKEND_PORT } from "./server-env";

const slot = Symbol.for("luxipanel.ui-events.v1");
type State = {stop: () => void; start: () => void};
/** Module executions from Astro and extracted bundles share one lifecycle. */
export function startUiEvents() {
  if (typeof window === "undefined") return;
  const host = window as unknown as Record<symbol, State>;
  if (host[slot]) { host[slot].start(); return; }
  let socket: WebSocket | null = null, generation = 0, attempts = 0, enabled = false;
  let retry: ReturnType<typeof setTimeout> | undefined, heartbeat: ReturnType<typeof setInterval> | undefined;
  let handshake: ReturnType<typeof setTimeout> | undefined;
  let lastFrame = 0;
  const subscriptions = new Map<string, string[]>();
  let dataCursor: string | undefined, subscribeTimer: ReturnType<typeof setTimeout> | undefined;
  const subscribe = () => {
    clearTimeout(subscribeTimer);
    subscribeTimer = setTimeout(() => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({type:"data:subscribe", cursor:dataCursor,
        resources: document.hidden ? [] : [...new Set([...subscriptions.values()].flat())].slice(0,8)}));
    }, 150);
  };
  window.addEventListener("lxp:data:subscription", (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (!detail?.id || !Array.isArray(detail.resources)) return;
    if (detail.resources.length) subscriptions.set(detail.id, detail.resources); else subscriptions.delete(detail.id);
    subscribe();
  });
  let release: (() => void) | undefined, abort: AbortController | undefined;
  const emit = (name: string, detail: unknown) => window.dispatchEvent(new CustomEvent(name, {detail}));
  const status = (value: string) => emit("lxp:assistant:ws-status", {status:value});
  const deliver = (frame: any) => {
    if (frame.type === "data:invalidate" || frame.type === "data:resync") {
      if (frame.cursor) dataCursor = frame.cursor;
      emit("lxp:data:change", frame);
    }
    if (frame.type === "ui:modules-changed") { invalidateStartup(); emit(MODULES_CHANGED_EVENT, frame); }
    if (frame.type === "ui:chat-message") emit("lxp:ui:chat-message", frame.data);
    if (frame.type === "ui:status") emit("lxp:ui:status", frame);
    if (frame.type === "ui:notifications-changed") emit("lxp:ui:notifications-changed", frame);
    if (frame.type?.startsWith("chat:call:")) emit("lxp:ui:call", frame);
    if (frame.type === "assistant.team_task_update") {
      emit("lxp:assistant:ws", frame); emit("lxp:assistant:team-task-update", {task:frame.task});
    }
    if (frame.type === "ui:status-error") void fallback(generation);
  };
  let fallbackAt = -Infinity;
  const fallback = async (epoch: number) => {
    if (document.hidden || !enabled || Date.now() - fallbackAt < 30_000) return;
    fallbackAt = Date.now(); abort?.abort(); abort = new AbortController();
    try {
      const response = await fetch(resolvePanelApiPath("/api/ui/status"), {credentials:"include",headers:scopeHeaders(),signal:abort.signal,cache:"no-store"});
      if (epoch !== generation || !enabled) return;
      if (response.status === 401 || response.status === 403) { stop(); return; }
      const body = await response.json();
      if (epoch === generation && body.ok) deliver({type:"ui:status",...body.data});
    } catch { /* next reconnect has a bounded fallback */ }
  };
  const connect = () => {
    if (!enabled || socket || !hasStartupShell()) return;
    const epoch = generation;
    const url = new URL(resolvePanelApiPath("/api/ui/events"), location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    if (location.port && !["80","443"].includes(location.port)) url.port = String((window as any).__BACKEND_PORT__ ?? DEFAULT_BACKEND_PORT);
    const bridge = scopeHeaders()["X-Bridge-Session-Id"];
    if (bridge) url.searchParams.set("bridge", bridge);
    status("connecting");
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch {
      void fallback(epoch);retry=setTimeout(connect,30_000);return;
    }
    socket = ws; lastFrame = Date.now();
    handshake = setTimeout(() => {if(epoch === generation && ws.readyState !== WebSocket.OPEN) {void fallback(epoch);ws.close();}},8000);
    ws.onopen = () => { if (epoch !== generation) return; clearTimeout(handshake); attempts = 0; status("open"); subscribe(); };
    ws.onmessage = event => { if (epoch !== generation) return; lastFrame=Date.now(); try { deliver(JSON.parse(event.data)); } catch {} };
    ws.onclose = event => {
      if (epoch !== generation) return; clearTimeout(handshake); socket = null; status("closed");
      if ([4001,4003].includes(event.code) || (event.code === 1008 && !event.reason.startsWith("Permissions changed"))) { stop(); return; }
      void fallback(epoch);
      if (enabled) retry = setTimeout(connect, Math.min(60_000, 1000 * 2 ** Math.min(attempts++,6)) + Math.random()*500);
    };
    ws.onerror = () => { /* close drives retry */ };
  };
  const stop = () => {
    clearTimeout(subscribeTimer); dataCursor = undefined;
    enabled = false; generation++; release?.(); release = undefined;
    fallbackAt = -Infinity; attempts = 0;
    clearTimeout(retry); clearTimeout(handshake); clearInterval(heartbeat); abort?.abort(); socket?.close(); socket = null;
    status("stopped");
  };
  const start = () => {
    if (enabled || !hasStartupShell()) return; enabled = true;
    release = afterPrimaryReady(() => {
      connect(); heartbeat = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          if (Date.now()-lastFrame>90_000) socket.close();
          else socket.send(JSON.stringify({type:"ui:ping"}));
        }
        else void fallback(generation);
      }, 60_000);
    });
  };
  host[slot] = {stop,start};
  document.addEventListener("astro:before-swap", stop);
  document.addEventListener("astro:page-load", start);
  document.addEventListener("visibilitychange", () => {
    subscribe();
    if (!document.hidden && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({type:"ui:refresh"}));
  });
  for (const name of ["luxipanel:logout","luxipanel:session-ended","luxipanel:session-started"]) window.addEventListener(name, stop);
  for (const name of ["luxipanel:target-changed", "luxipanel:permissions-changed"]) window.addEventListener(name, () => {stop(); start();});
  window.addEventListener("pagehide", stop); window.addEventListener("pageshow", start);
  start();
}
startUiEvents();
