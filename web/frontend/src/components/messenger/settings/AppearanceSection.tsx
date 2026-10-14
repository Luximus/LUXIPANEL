// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Bloque E — Appearance: density + font size (applied as `data-density` /
 *  `data-fontsize` on the ChatModule root). */
import { useChatI18n } from "../i18n";
import type { ChatPrefs, DeepPartialChatPrefs } from "../chat-prefs";
import { SelectRow, SettingsSection } from "./controls";

export function AppearanceSection({ prefs, onChange }: { prefs: ChatPrefs; onChange: (patch: DeepPartialChatPrefs) => void }) {
  const t = useChatI18n();
  return (
    <SettingsSection title={t.settings.appearance.title}>
      <SelectRow
        label={t.settings.appearance.density}
        value={prefs.appearance.density}
        options={[
          { value: "comfortable" as const, label: t.settings.appearance.densityComfortable },
          { value: "compact" as const, label: t.settings.appearance.densityCompact },
        ]}
        onChange={(v) => onChange({ appearance: { density: v } })}
      />
      <SelectRow
        label={t.settings.appearance.fontSize}
        value={prefs.appearance.fontSize}
        options={[
          { value: "sm" as const, label: t.settings.appearance.fontSm },
          { value: "md" as const, label: t.settings.appearance.fontMd },
          { value: "lg" as const, label: t.settings.appearance.fontLg },
        ]}
        onChange={(v) => onChange({ appearance: { fontSize: v } })}
      />
    </SettingsSection>
  );
}
