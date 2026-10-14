// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bloque E — Presence. Unlike the rest of the drawer, presence is NOT part of
 * `/api/preferences/chat`: it lives in the chat module's own profile
 * (`GET/PUT /api/chat/me/profile`), so this section owns its own load/save.
 */
import { useEffect, useRef, useState } from "react";
import { useChatI18n } from "../i18n";
import { messengerApi, type ChatProfile } from "../messenger-api";
import { SettingsSection, SwitchRow, TextRow } from "./controls";

const STATUS_MAX = 80;
const SAVE_DEBOUNCE_MS = 600;

export function PresenceSection({ onSaved }: { onSaved: (ok: boolean) => void }) {
  const t = useChatI18n();
  const [profile, setProfile] = useState<ChatProfile>({ showOnline: true, statusMessage: "" });
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    void messengerApi.getProfile().then((p) => {
      if (!alive) return;
      if (p) setProfile({ showOnline: !!p.showOnline, statusMessage: p.statusMessage ?? "" });
      setLoading(false);
    });
    return () => {
      alive = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function save(patch: Partial<ChatProfile>, debounce = false) {
    setProfile((prev) => ({ ...prev, ...patch }));
    if (timerRef.current) clearTimeout(timerRef.current);
    const run = () => void messengerApi.saveProfile(patch).then(onSaved);
    if (debounce) timerRef.current = setTimeout(run, SAVE_DEBOUNCE_MS);
    else run();
  }

  return (
    <SettingsSection title={t.settings.presence.title}>
      <SwitchRow
        label={t.settings.presence.showOnline}
        hint={t.settings.presence.showOnlineHint}
        checked={profile.showOnline}
        disabled={loading}
        onChange={(v) => save({ showOnline: v })}
      />
      <TextRow
        label={t.settings.presence.statusMessage}
        hint={t.settings.presence.statusHint}
        placeholder={t.settings.presence.statusPlaceholder}
        value={profile.statusMessage}
        maxLength={STATUS_MAX}
        onChange={(v) => save({ statusMessage: v.slice(0, STATUS_MAX) }, true)}
      />
    </SettingsSection>
  );
}
