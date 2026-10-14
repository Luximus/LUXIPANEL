// SPDX-License-Identifier: AGPL-3.0-only
import { resolvePanelApiPath, scopeHeaders } from "/scripts/extracted/lib/api-client.js";

/** Fetch supplies the active tab's bridge header, which EventSource cannot. */
export function createNotificationStream(): EventSource {
  const controller = new AbortController();
  let readyState = 0;
  class NotificationStream extends EventTarget {
    readonly url = resolvePanelApiPath("/api/notifications/stream");
    readonly withCredentials = true;
    get readyState() { return readyState; }
    close() { readyState = 2; controller.abort(); }
  }
  const stream = new NotificationStream();
  const headers = { ...scopeHeaders(), Accept: "text/event-stream" };
  const connect = async () => {
    try {
      const response = await fetch(stream.url, {
        credentials: "include", headers, signal: controller.signal, cache: "no-store",
      });
      if (!response.ok || !response.body) throw new Error("Notification stream unavailable");
      if (controller.signal.aborted) return;
      readyState = 1;
      stream.dispatchEvent(new Event("open"));
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "", event = "message";
      let data: string[] = [];
      try {
        while (!controller.signal.aborted) {
          const chunk = await reader.read();
          if (chunk.done) break;
          pending += decoder.decode(chunk.value, { stream: true });
          let newline: number;
          while ((newline = pending.indexOf("\n")) >= 0) {
            const line = pending.slice(0, newline).replace(/\r$/, "");
            pending = pending.slice(newline + 1);
            if (!line) {
              if (data.length && !controller.signal.aborted) {
                stream.dispatchEvent(new MessageEvent(event, { data: data.join("\n") }));
              }
              event = "message"; data = [];
            } else if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
          }
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      if (!controller.signal.aborted) throw new Error("Notification stream ended");
    } catch {
      if (controller.signal.aborted) return;
      readyState = 2;
      stream.dispatchEvent(new Event("error"));
    }
  };
  void connect();
  return stream as unknown as EventSource;
}
