// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Bloque E — Groups: accordion default + page size of "Últimas conversaciones". */
import { useChatI18n } from "../i18n";
import type { ChatLatestPageSize, ChatPrefs, DeepPartialChatPrefs } from "../chat-prefs";
import { SelectRow, SettingsSection, SwitchRow } from "./controls";

export function GroupsSettingsSection({ prefs, onChange }: { prefs: ChatPrefs; onChange: (patch: DeepPartialChatPrefs) => void }) {
  const t = useChatI18n();
  return (
    <SettingsSection title={t.settings.groups.title}>
      <SwitchRow
        label={t.settings.groups.collapsedByDefault}
        hint={t.settings.groups.collapsedByDefaultHint}
        checked={prefs.groups.collapsedByDefault}
        onChange={(v) => onChange({ groups: { collapsedByDefault: v } })}
      />
      <SelectRow
        label={t.settings.groups.latestPageSize}
        hint={t.settings.groups.latestPageSizeHint}
        value={String(prefs.groups.latestPageSize)}
        options={[
          { value: "5", label: "5" },
          { value: "10", label: "10" },
          { value: "15", label: "15" },
        ]}
        onChange={(v) => onChange({ groups: { latestPageSize: Number(v) as ChatLatestPageSize } })}
      />
    </SettingsSection>
  );
}
