// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Bloque E — General: sound, desktop notifications, preview, Enter sends. */
import { useEffect, useState } from "react";
import { useChatI18n } from "../i18n";
import type { ChatPrefs, DeepPartialChatPrefs } from "../chat-prefs";
import { SettingsSection, SwitchRow } from "./controls";

export function GeneralSection({ prefs, onChange }: { prefs: ChatPrefs; onChange: (patch: DeepPartialChatPrefs) => void }) {
  const t = useChatI18n();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  // Enabling desktop notifications asks for the browser permission (same
  // pattern as the monitor watchdog): the pref only sticks if it is granted.
  async function toggleDesktop(next: boolean) {
    if (!next) {
      onChange({ general: { desktopNotifications: false } });
      return;
    }
    if (typeof window === "undefined" || !("Notification" in window)) return;
    let state = Notification.permission;
    if (state === "default") {
      try {
        state = await Notification.requestPermission();
      } catch {
        state = Notification.permission;
      }
    }
    setPermission(state);
    onChange({ general: { desktopNotifications: state === "granted" } });
  }

  return (
    <SettingsSection title={t.settings.general.title}>
      <SwitchRow
        label={t.settings.general.soundOnNewMessage}
        hint={t.settings.general.soundOnNewMessageHint}
        checked={prefs.general.soundOnNewMessage}
        onChange={(v) => onChange({ general: { soundOnNewMessage: v } })}
      />
      <SwitchRow
        label={t.settings.general.desktopNotifications}
        hint={permission === "denied" ? t.settings.general.desktopBlocked : t.settings.general.desktopNotificationsHint}
        checked={prefs.general.desktopNotifications && permission === "granted"}
        disabled={permission === "denied" || permission === "unsupported"}
        onChange={(v) => void toggleDesktop(v)}
      />
      <SwitchRow
        label={t.settings.general.previewInBell}
        hint={t.settings.general.previewInBellHint}
        checked={prefs.general.previewInBell}
        onChange={(v) => onChange({ general: { previewInBell: v } })}
      />
      <SwitchRow
        label={t.settings.general.enterSends}
        hint={t.settings.general.enterSendsHint}
        checked={prefs.general.enterSends}
        onChange={(v) => onChange({ general: { enterSends: v } })}
      />
    </SettingsSection>
  );
}
