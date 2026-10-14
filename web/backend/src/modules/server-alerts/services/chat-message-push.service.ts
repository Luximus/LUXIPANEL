// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bridges the `CHAT_MESSAGE_RECEIVED` event (emitted by the chat service for
 * recipients who were AWAY — no live chat stream open) to each recipient's PUSH
 * devices — web (WebPush), mobile app (Expo) and desktop (SSE tray) — via LP's
 * managed push channel. The in-app bell is wired separately in notifications.
 *
 * Unlike the chat-finished push (which targets the panel OWNER), this targets a
 * SPECIFIC recipient by their Linux username via `recipientUsername`; LP resolves
 * it to that user's LP customer, so a message only pings its intended recipient.
 *
 * Why `runOnPanelHost`: the event fires inside the sender's PER-SERVER executor
 * scope, but push + host resolution are instance-level (panel host). Fully
 * fail-open: a delivery error only logs, never throws.
 */

import { Events } from "../../../shared/events/index.js";
import { wirePushBridge } from "./push-bridge.js";
import { runOnPanelHost } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { serverAlertsService } from "./server-alerts.service.js";

const log = createModuleLogger("chat-message-push");

interface ChatMessagePayload {
  host?: string | null;
  targetId?: string;
  convId?: string;
  title?: string;
  body?: string;
  recipients?: Array<{ username: string; userId?: number }>;
}

/** Subscribe once to CHAT_MESSAGE_RECEIVED and fan the alert to each recipient. */
export function wireChatMessagePush(): void {
  wirePushBridge<ChatMessagePayload>({
    name: "chat-message",
    event: Events.CHAT_MESSAGE_RECEIVED,
    wiredLog:
      "Chat-message push wired (CHAT_MESSAGE_RECEIVED → recipient devices: web/app/desktop)",
    handle: (d) => {
    if (!Array.isArray(d.recipients) || d.recipients.length === 0) return;
    // The panel host is needed for LP to resolve panel → recipient customer.
    const host = (d.host ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
    if (!host) return;

    const path = `/panel/chat${d.convId ? `?c=${d.convId}` : ""}`;
    const url = `https://${host}${path}`;
    const title = d.title || "Nuevo mensaje";
    const body = (d.body && d.body.trim()) || "Tienes un mensaje nuevo";

    for (const r of d.recipients) {
      const username = r?.username;
      if (!username) continue;
      void runOnPanelHost(async () => {
        await serverAlertsService.sendImmediate(
          {
            title,
            body,
            signals: ["chat_message"],
            data: {
              type: "chat_message",
              url,
              ...(d.convId ? { conversationId: d.convId } : {}),
            },
            // Chat messages should reach the recipient regardless of the owner's
            // notification prefs (those gate panel/system alerts, not DMs).
            respectPrefs: false,
            recipientUsername: username,
          },
          host,
        );
      }).catch((err) => log.warn({ err: (err as Error).message, username }, "chat-message push failed"));
    }
    },
  });
}
