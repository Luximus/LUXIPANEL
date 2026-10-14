// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bridges `AI_CHAT_FINISHED` to the finishing user's registered Web Push and
 * mobile devices. The notifications module creates the in-panel bell row.
 *
 * The preference comes from the run's server; device registrations are
 * resolved separately by the delivery service. A delivery error only logs.
 *
 * Delivery respects the user's server notification preference.
 */

import { Events } from "../../../shared/events/index.js";
import { wirePushBridge } from "./push-bridge.js";
import type { Executor } from "../../../shared/executor/index.js";
import { resolveNotificationExecutor } from "../../notifications/services/notification-scope.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { settingsRepository } from "../../admin/repositories/settings.repository.js";
import { notificationDeliveryService } from "./notification-delivery.service.js";

const log = createModuleLogger("chat-finished-push");

/** Per-server setting key for the "notify my devices when a chat finishes"
 *  toggle. Read here (push gate) and read/written by the assistant notify-prefs
 *  controller. Default = enabled when unset. */
export const CHAT_FINISHED_PREF_KEY = "notify.chat_finished.enabled";

/** Whether the originating server enables chat-finished device push. */
export async function isChatFinishedPushEnabled(executor?: Executor): Promise<boolean> {
  const v = await settingsRepository.get(CHAT_FINISHED_PREF_KEY, executor);
  return v === null ? true : v === "true";
}

interface ChatFinishedPayload {
  conversationId?: string;
  userId?: number;
  targetId?: string;
  errored?: boolean;
  preview?: string;
  hadSubscribers?: boolean;
}

/** Subscribe once to AI_CHAT_FINISHED and fan the alert to the owner's devices. */
export function wireChatFinishedPush(): void {
  wirePushBridge<ChatFinishedPayload>({
    name: "chat-finished",
    event: Events.AI_CHAT_FINISHED,
    wiredLog: "Chat-finished push wired (AI_CHAT_FINISHED → owner devices: web/app/desktop)",
    handle: (d) => {
    // Only ping the owner's devices when NO client was attached to the run — i.e.
    // the user had navigated away. A user watching the answer live doesn't need a
    // cross-device push (the in-app bell still records it). This mirrors the CLI
    // job tracker's `!hasActiveStream` gate.
    if (d.hadSubscribers) return;
    if (typeof d.userId !== "number" || !d.targetId) return;

    const title = d.errored ? "Chat IA terminó con error" : "Chat IA finalizado";
    const body =
      (d.preview && d.preview.trim()) ||
      (d.errored ? "El asistente terminó con error." : "El asistente terminó de responder.");

    void (async () => {
      const executor = await resolveNotificationExecutor(d.targetId);
      // Owner opted out of chat-finished device notifications → don't push.
      if (!(await isChatFinishedPushEnabled(executor))) return;
      // Route device taps to the completed conversation.
      const path = `/panel/assistant${d.conversationId ? `?c=${d.conversationId}` : ""}`;
      await notificationDeliveryService.send({ targetId: d.targetId!, targetUserId: d.userId, category: "chat", title, body, path, skipPanel: true });
    })().catch((err) => log.warn({ err: (err as Error).message }, "chat-finished push failed"));
    },
  });
}
