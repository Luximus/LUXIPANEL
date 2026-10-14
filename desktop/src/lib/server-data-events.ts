import { callServerApi, getDirect, subscribeDirectSessions, invalidateServerData, unwrap } from "../api/serverApi";
import { reportFreshness } from "./native-live-read";
type Listener = {resources: string[]; reload: () => void};
type Hub = {listeners: Set<Listener>; sessionEpoch: number; close: () => void; update: () => void};
const hubs = new Map<string, Hub>();
const sessionIdentity = (serverId: string) => {
  const direct = getDirect(serverId);
  return JSON.stringify([direct?.baseUrl, direct?.jwt]);
};
/** A single authenticated UI channel per active direct server session. */
export function listenServerData(serverId: string, resources: string[], reload: () => void): () => void {
  let hub = hubs.get(serverId);
  if (!hub) {
    const listeners = new Set<Listener>();
    let socket: WebSocket | undefined, disposed = false, generation = 0, cursor: string | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined, debounce: ReturnType<typeof setTimeout> | undefined;
    let subscribeTimer: ReturnType<typeof setTimeout> | undefined;
    const identity = () => sessionIdentity(serverId);
    let currentIdentity = identity(), connecting: number | undefined, unauthorized = false;
    let attempts = 0, lastFrame = Date.now(), allowed = new Set<string>();
    const changed = new Set<string>();
    const keys = () => [...new Set([...listeners].flatMap(row => row.resources))];
    const notify = (resources: string[]) => {
      resources.forEach(key => changed.add(key));
      if (!debounce) debounce = setTimeout(() => {
        debounce = undefined; const dirty = [...changed]; changed.clear();
        invalidateServerData(serverId, dirty);
        for (const row of listeners) if (row.resources.some(key => dirty.includes(key))) row.reload();
      }, 250);
    };
    const update = () => {
      clearTimeout(subscribeTimer);
      subscribeTimer = setTimeout(() => {
        if (socket?.readyState === 1) socket.send(JSON.stringify({type:"data:subscribe", cursor, resources:keys().filter(key => allowed.has(key)).slice(0,8)}));
      }, 150);
    };
    const reconnect = (delay: number) => {
      clearTimeout(retry);
      retry = setTimeout(() => {retry = undefined; void connect();}, delay);
    };
    const connect = async () => {
      if (disposed || unauthorized || connecting !== undefined || socket) return;
      const direct = getDirect(serverId);
      if (!direct) return;
      clearTimeout(retry); retry = undefined;
      const epoch = ++generation, session = identity();
      connecting = epoch;
      const current = () => !disposed && epoch === generation && identity() === session;
      try {
        const caps = unwrap<{events?: boolean; resources?: string[]}>(await callServerApi(serverId, "", "GET", "/api/ui/data/capabilities"));
        if (!current() || !caps?.events) return;
        allowed = new Set(caps.resources ?? []);
        const auth = unwrap<{token?: string}>(await callServerApi(serverId, "", "GET", "/api/auth/ws-token"));
        if (!current() || !auth?.token) return;
        const url = new URL(`${direct.baseUrl}/api/ui/events`); url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        url.searchParams.set("token", auth.token);
        const ws = socket = new WebSocket(url.toString()); lastFrame = Date.now();
        ws.onopen = () => {if (current()) {attempts = 0; update(); notify(keys());}};
        ws.onmessage = event => {
          if (!current()) return;
          lastFrame = Date.now();
          try {
            const frame = JSON.parse(String(event.data));
            if (frame.type !== "data:invalidate" && frame.type !== "data:resync") return;
            if (typeof frame.cursor === "string") cursor = frame.cursor;
            if (Array.isArray(frame.resources)) notify(frame.resources.filter((key: unknown): key is string => typeof key === "string" && allowed.has(key)));
          } catch { /* ignore malformed frames */ }
        };
        ws.onclose = event => {
          if (!current()) return;
          socket = undefined;
          for (const key of keys()) reportFreshness(serverId, key, {state:"offline"});
          if ([4001,4003].includes(event.code)) {unauthorized = true; return;}
          reconnect(Math.min(30_000, 1000 * 2 ** Math.min(attempts++, 5)));
        };
        ws.onerror = () => { /* close drives retry */ };
      } catch { if (current()) reconnect(30_000); }
      finally { if (connecting === epoch) connecting = undefined; }
    };
    const timer = setInterval(() => {
      notify(keys()); // reconcile even when an older target has no events
      if (socket?.readyState === 1) {
        if (Date.now() - lastFrame > 60_000) socket.close(); else socket.send(JSON.stringify({type:"ui:ping"}));
      } else if (socket && Date.now() - lastFrame > 15_000) socket.close();
      else if (!socket && retry === undefined) void connect();
    }, 30_000);
    const unlisten = subscribeDirectSessions(() => {
      if (identity() === currentIdentity) return;
      currentIdentity = identity();
      generation++; connecting = undefined; unauthorized = false; cursor = undefined;
      if (hub) hub.sessionEpoch++;
      socket?.close(); socket = undefined; clearTimeout(retry); retry = undefined;
      clearTimeout(debounce); debounce = undefined; changed.clear(); allowed.clear();
      invalidateServerData(serverId); notify(keys()); void connect();
    });
    hub = {listeners, sessionEpoch: 0, update, close() {
      disposed = true; generation++; clearTimeout(retry); clearTimeout(debounce); clearTimeout(subscribeTimer);
      clearInterval(timer); unlisten(); socket?.close();
    }};
    hubs.set(serverId, hub); void connect();
  }
  const listener = {resources, reload}; hub.listeners.add(listener); hub.update();
  let released = false;
  return () => {
    if (released) return;
    released = true; hub!.listeners.delete(listener);
    if (!hub!.listeners.size) {hub!.close(); if (hubs.get(serverId) === hub) hubs.delete(serverId);}
    else hub!.update();
  };
}
export async function refreshServerData(serverId: string, resources: string[]): Promise<boolean> {
  // Bind the complete operation before its first await, including the view
  // that requested it. Closing and reopening must not revive an old refresh.
  const hub = hubs.get(serverId), session = sessionIdentity(serverId), epoch = hub?.sessionEpoch;
  const listeners = [...(hub?.listeners ?? [])].filter(row => row.resources.some(key => resources.includes(key)));
  const current = () => !!hub && hubs.get(serverId) === hub && hub.sessionEpoch === epoch
    && sessionIdentity(serverId) === session && listeners.some(row => hub.listeners.has(row));
  if (!current()) return false;
  try {
    const caps = unwrap<{versionedReads?: boolean; resources?: string[]}>(await callServerApi(serverId, "", "GET", "/api/ui/data/capabilities"));
    if (!current()) return false;
    if (caps?.versionedReads) for (const resource of resources.filter(key => caps.resources?.includes(key))) {
      if (!current()) return false;
      reportFreshness(serverId, resource, {state:"updating"});
      const reply = unwrap<{job?: {id:string}}>(await callServerApi(serverId, "", "POST", "/api/ui/data/refresh", {resource}));
      if (!current()) return false;
      if (!reply?.job?.id) throw new Error("refresh");
      let done = false;
      for (let count = 0; count < 100; count++) {
        if (!current()) return false;
        const job = unwrap<{state:string; viewReady?: boolean}>(await callServerApi(serverId, "", "GET", `/api/jobs/${reply.job.id}`));
        if (!current()) return false;
        if (!job || ["failed", "unknown"].includes(job.state)) throw new Error("refresh");
        if (job.state === "done") {if (job.viewReady === false) throw new Error("refresh"); done = true; break;}
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!done) throw new Error("refresh");
    }
    if (!current()) return false;
    invalidateServerData(serverId, resources);
    for (const listener of hub!.listeners) if (listener.resources.some(key => resources.includes(key))) listener.reload();
    return true;
  } catch {
    if (current()) for (const key of resources) reportFreshness(serverId, key, {state:"stale", failedAt:Date.now()/1000});
    return false;
  }
}
