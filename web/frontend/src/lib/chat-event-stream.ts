// SPDX-License-Identifier: AGPL-3.0-only
import {
  resolvePanelApiPath,
  resolveTargetScope,
  scopeHeaders,
} from "./api-client";
const EVENTS = [
  "chat:message",
  "chat:read",
  "chat:call:ring",
  "chat:call:state",
  "chat:call:end",
];
type Channel = {
  subscribers: Set<ChatStream>;
  controller: AbortController;
  readyState: number;
  retry: number;
  timer?: ReturnType<typeof setTimeout>;
};
declare global {
  interface Window {
    __lxpChatStreams?: Map<string, Channel>;
  }
}
class ChatStream extends EventTarget {
  readonly url: string;
  readonly withCredentials = true;
  constructor(
    readonly channel: Channel,
    url: string,
    readonly release: () => void,
  ) {
    super();
    this.url = url;
  }
  get readyState() {
    return this.channel.readyState;
  }
  close() {
    this.channel.subscribers.delete(this);
    this.release();
  }
}
/** One authenticated stream per server/session; UI subscribers own no transport. */
export function acquireChatStream(): EventSource {
  const headers = scopeHeaders();
  const key =
    resolveTargetScope() + ":" + (headers["X-Bridge-Session-Id"] || "local");
  const channels = (window.__lxpChatStreams ??= new Map<string, Channel>());
  let channel = channels.get(key);
  if (!channel) {
    channel = {
      subscribers: new Set(),
      controller: new AbortController(),
      readyState: 0,
      retry: 0,
    };
    channels.set(key, channel);
  }
  const current = channel;
  const emit = (type: string, data?: string) => {
    for (const subscriber of current.subscribers)
      subscriber.dispatchEvent(
        data === undefined ? new Event(type) : new MessageEvent(type, { data }),
      );
  };
  const release = () => {
    if (current.subscribers.size) return;
    current.controller.abort();
    if (current.timer) clearTimeout(current.timer);
    current.readyState = 2;
    channels.delete(key);
  };
  const stream = new ChatStream(
    current,
    resolvePanelApiPath("/api/chat/stream"),
    release,
  );
  current.subscribers.add(stream);
  const connect = async () => {
    if (!current.subscribers.size) return;
    current.controller = new AbortController();
    try {
      const response = await fetch(stream.url, {
        credentials: "include",
        headers: { ...headers, Accept: "text/event-stream" },
        signal: current.controller.signal,
      });
      if (!response.ok || !response.body)
        throw new Error("Chat stream unavailable");
      current.readyState = 1;
      current.retry = 0;
      emit("open");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let eventName = "message";
      let data: string[] = [];
      while (!current.controller.signal.aborted) {
        const result = await reader.read();
        if (result.done) break;
        pending += decoder.decode(result.value, { stream: true });
        let newline;
        while ((newline = pending.indexOf("\n")) >= 0) {
          const line = pending.slice(0, newline).replace(/\r$/, "");
          pending = pending.slice(newline + 1);
          if (!line) {
            if (
              data.length &&
              (EVENTS.includes(eventName) || eventName === "message")
            )
              emit(eventName, data.join("\n"));
            eventName = "message";
            data = [];
          } else if (line.startsWith("event:"))
            eventName = line.slice(6).trim();
          else if (line.startsWith("data:"))
            data.push(line.slice(5).replace(/^ /, ""));
        }
      }
      if (!current.controller.signal.aborted)
        throw new Error("Chat stream ended");
    } catch (error) {
      if (current.controller.signal.aborted) return;
      current.readyState = 0;
      emit("error");
      if (current.subscribers.size)
        current.timer = setTimeout(
          connect,
          Math.min(30_000, 1000 * 2 ** current.retry++),
        );
    }
  };
  if (current.subscribers.size === 1) void connect();
  else if (current.readyState === 1)
    queueMicrotask(() => stream.dispatchEvent(new Event("open")));
  return stream as unknown as EventSource;
}
export function disposeChatStreams() {
  const channels = window.__lxpChatStreams;
  for (const channel of channels?.values() || []) {
    channel.controller.abort();
    if (channel.timer) clearTimeout(channel.timer);
    channel.readyState = 2;
    channel.subscribers.clear();
  }
  channels?.clear();
}
