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
  const key = `${serverId}:${target.baseUrl}:${target.jwt}`;
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
    timer: ReturnType<typeof setTimeout> | null = null,
    controller: AbortController | null = null,
    off: (() => void) | undefined,
    attempt = 0;
  const id = crypto.randomUUID();
  const connect = async () => {
    if (stopped) return;
    const target = getDirect(serverId);
    if (!target) return;
    const parser = new ChatStreamParser();
    try {
      if (window.electronApi?.chatStream) {
        off = window.electronApi.onChatStream?.((event) => {
          if (event.id !== id || stopped) return;
          if (event.chunk) {
            attempt = 0;
            for (const frame of parser.push(event.chunk)) deliver(frame);
          }
          if (event.closed) {
            off?.();
            off = undefined;
            if (event.status === 401)
              void Promise.resolve(target.relogin?.()).finally(retry);
            else retry();
          }
        });
        await window.electronApi.chatStream({
          id,
          url: `${target.baseUrl}/api/chat/stream`,
          authorization: `Bearer ${target.jwt}`,
        });
        return;
      }
      controller = new AbortController();
      const response = await fetch(`${target.baseUrl}/api/chat/stream`, {
        headers: {
          Authorization: `Bearer ${target.jwt}`,
          Accept: "text/event-stream",
          "x-client-platform": "desktop",
        },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        if (response.status === 401) await target.relogin?.();
        throw new Error("Stream unavailable");
      }
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        attempt = 0;
        for (const event of parser.push(
          decoder.decode(value, { stream: true }),
        ))
          deliver(event);
      }
      retry();
    } catch {
      retry();
    }
  };
  const retry = () => {
    if (timer) clearTimeout(timer);
    if (!stopped)
      timer = setTimeout(
        () => void connect(),
        Math.min(1000 * 2 ** attempt++, 30000),
      );
  };
  void connect();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    controller?.abort();
    off?.();
    void window.electronApi?.stopChatStream?.(id);
  };
}
