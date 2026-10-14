import { getDirect } from "../api/serverApi";
import { ChatStreamParser, type ChatStreamEvent } from "./chat-stream-parser";
export type { ChatStreamEvent } from "./chat-stream-parser";
type Listener = (event: ChatStreamEvent) => void;
const channels = new Map<
  string,
  { listeners: Set<Listener>; close: () => void }
>();
/** A server has one authenticated stream shared by views and call services. */
export function subscribeServerChat(
  serverId: string,
  listener: Listener,
): () => void {
  const target = getDirect(serverId);
  if (!target) return () => {};
  const key = `${serverId}:${target.baseUrl}:${target.jwt}:${target.bridgeSessionId ?? ""}`;
  let channel = channels.get(key);
  if (!channel) {
    const listeners = new Set<Listener>();
    channel = {
      listeners,
      close: openStream(serverId, (event) => {
        for (const consumer of listeners) consumer(event);
      }),
    };
    channels.set(key, channel);
  }
  channel.listeners.add(listener);
  const owned = channel;
  return () => {
    owned.listeners.delete(listener);
    if (!owned.listeners.size) {
      owned.close();
      channels.delete(key);
    }
  };
}
function openStream(serverId: string, deliver: Listener): () => void {
  let stopped = false,
    request: XMLHttpRequest | null = null,
    timer: ReturnType<typeof setTimeout> | null = null,
    rotation: ReturnType<typeof setTimeout> | null = null,
    attempt = 0;
  const retry = () => {
    if (timer) clearTimeout(timer);
    if (rotation) clearTimeout(rotation);
    if (!stopped)
      timer = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 30000));
  };
  const connect = () => {
    if (stopped) return;
    const target = getDirect(serverId);
    if (!target) return;
    const parser = new ChatStreamParser();
    let seen = 0;
    const xhr = new XMLHttpRequest();
    request = xhr;
    xhr.open("GET", `${target.baseUrl}/api/chat/stream`);
    xhr.withCredentials = false;
    xhr.setRequestHeader("Authorization", `Bearer ${target.jwt}`);
    if (target.bridgeSessionId) xhr.setRequestHeader("X-Bridge-Session-Id", target.bridgeSessionId);
    xhr.setRequestHeader("Accept", "text/event-stream");
    xhr.setRequestHeader("x-client-platform", "app");
    const drain = () => {
      if (stopped || request !== xhr || xhr.status >= 400) return;
      const text = xhr.responseText || "";
      const events = parser.push(text.slice(seen));
      seen = text.length;
      for (const event of events) {
        attempt = 0;
        deliver(event);
      }
    };
    xhr.onprogress = drain;
    xhr.onload = () => {
      drain();
      if (rotation) clearTimeout(rotation);
      if (xhr.status === 401 && target.relogin) {
        void target
          .relogin()
          .then((fresh) => {
            if (fresh) retry();
          })
          .catch(retry);
      } else retry();
    };
    xhr.onerror = retry;
    // Bound RN's cumulative responseText without losing pending server events.
    rotation = setTimeout(() => {
      xhr.abort();
      retry();
    }, 300000);
    xhr.send();
  };
  connect();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (rotation) clearTimeout(rotation);
    request?.abort();
  };
}
