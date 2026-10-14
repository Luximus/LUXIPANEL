import { useEffect } from "react";
import {
  getDirect,
  getDirectServerIds,
  subscribeDirectSessions,
} from "../api/serverApi";
import { userRequest, type Message } from "../api/serverUserApi";
import { subscribeServerChat } from "./server-chat-stream";
import {
  getChatActivity,
  getCachedChatPreferences,
  clearChatPreferences,
} from "./chat-activity";
import type { ChatPreferences } from "./use-server-preferences";
import { serverUserText } from "../i18n/server-user-messages";
import { loadSessionState } from "./session-state";
import { createAudioPlayer } from "expo-audio";
import * as Notifications from "expo-notifications";
import { AppState } from "react-native";
export function initializeChatNotifications(): () => void {
  const subscriptions = new Map<
    string,
    { target: unknown; close: () => void }
  >();
  const synchronize = () => {
    const ids = new Set(getDirectServerIds());
    for (const [id, entry] of subscriptions)
      if (!ids.has(id) || getDirect(id) !== entry.target) {
        entry.close();
        subscriptions.delete(id);
      }
    for (const id of ids) {
      const target = getDirect(id);
      if (!target || subscriptions.has(id)) continue;
      let alive = true;
      const profile = userRequest<{ username: string }>(
        id,
        "GET",
        "/api/preferences",
      ).catch(() => null);
      const prefs = userRequest<ChatPreferences>(
        id,
        "GET",
        "/api/preferences/chat",
      ).catch(() => null);
      const off = subscribeServerChat(id, (event) => {
        if (event.type !== "chat:message") return;
        const message = ((event.data as { message?: Message }).message ??
          event.data) as Message;
        void Promise.all([profile, prefs])
          .then(async ([me, initial]) => {
            const settings = getCachedChatPreferences(id) ?? initial;
            const activity = getChatActivity(id);
            if (
              !alive ||
              !me ||
              !settings ||
              message.editedAt ||
              message.deletedAt ||
              message.from === me.username ||
              (activity?.visible && activity.convId === message.convId)
            )
              return;
            await notify(message, settings);
          })
          .catch(() => {});
      });
      subscriptions.set(id, {
        target,
        close: () => {
          alive = false;
          off();
          clearChatPreferences(id);
        },
      });
    }
  };
  synchronize();
  const off = subscribeDirectSessions(synchronize);
  return () => {
    off();
    for (const entry of subscriptions.values()) entry.close();
    subscriptions.clear();
  };
}
async function notify(message: Message, settings: ChatPreferences) {
  if (
    settings.general.soundOnNewMessage &&
    AppState.currentState === "active"
  ) {
    const player = createAudioPlayer(
      require("../../assets/chat-notification.wav"),
    );
    player.play();
    setTimeout(() => player.remove(), 1000);
  }
  if (
    settings.general.desktopNotifications &&
    AppState.currentState !== "active" &&
    (await Notifications.getPermissionsAsync()).granted
  ) {
    const t = serverUserText(loadSessionState().language);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.fromDisplayName || t("chat.pageTitle"),
        body: settings.general.previewInBell
          ? message.body.slice(0, 160)
          : t("chat.pageTitle"),
        sound: !!settings.general.soundOnNewMessage,
      },
      trigger: null,
    });
  }
}

export function useIncomingRing(ringing: boolean) {
  useEffect(() => {
    if (!ringing) return;
    const player = createAudioPlayer(require("../../assets/chat-ring.wav"));
    player.loop = true;
    player.play();
    return () => {
      player.pause();
      player.remove();
    };
  }, [ringing]);
}
