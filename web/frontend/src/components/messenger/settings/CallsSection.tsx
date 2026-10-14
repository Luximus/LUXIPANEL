// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bloque E — Calls: PREFERENCES ONLY. No call logic lives here; the audio-call
 * UI (bloque F) reads `prefs.calls.*` when it is built on top of this drawer.
 */
import { useChatI18n } from "../i18n";
import { CALL_LANGUAGES, type ChatPrefs, type DeepPartialChatPrefs } from "../chat-prefs";
import { SelectRow, SettingsSection, SwitchRow } from "./controls";
import { useTolqiaPlan } from "../call/tolqia-plan";
import { TolqiaPlanRow } from "../call/TolqiaPlanNotice";

/** Endonyms — the language picker should read in the language it names. */
const LANGUAGE_LABELS: Record<string, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  ar: "العربية",
  hi: "हिन्दी",
  bn: "বাংলা",
  ja: "日本語",
  ko: "한국어",
  ru: "Русский",
};

export function CallsSection({
  prefs,
  onChange,
  isAdmin = false,
}: {
  prefs: ChatPrefs;
  onChange: (patch: DeepPartialChatPrefs) => void;
  /** Solo un admin ve el enlace a Ajustes → Credenciales (él es quien lo pega). */
  isAdmin?: boolean;
}) {
  const t = useChatI18n();
  // El plan de tolqia.com del SERVIDOR: gobierna si estas preferencias de
  // traducción tienen efecto, así que encabeza la sección.
  const plan = useTolqiaPlan();
  return (
    <SettingsSection title={t.settings.calls.title} hint={t.settings.calls.hint}>
      <TolqiaPlanRow plan={plan} isAdmin={isAdmin} />
      <SelectRow
        label={t.settings.calls.language}
        hint={t.settings.calls.languageHint}
        value={prefs.calls.language}
        options={CALL_LANGUAGES.map((code) => ({ value: code as string, label: LANGUAGE_LABELS[code] ?? code }))}
        onChange={(v) => onChange({ calls: { language: v } })}
      />
      <SwitchRow
        label={t.settings.calls.translate}
        hint={t.settings.calls.translateHint}
        checked={prefs.calls.translate}
        onChange={(v) => onChange({ calls: { translate: v } })}
      />
      <SelectRow
        label={t.settings.calls.provider}
        hint={t.settings.calls.providerHint}
        value={prefs.calls.provider}
        options={[
          { value: "auto" as const, label: t.settings.calls.providerAuto },
          { value: "elevenlabs" as const, label: t.settings.calls.providerElevenlabs },
          { value: "openai-realtime" as const, label: t.settings.calls.providerOpenai },
        ]}
        onChange={(v) => onChange({ calls: { provider: v } })}
      />
      <SelectRow
        label={t.settings.calls.micDefault}
        value={prefs.calls.micDefault}
        options={[
          { value: "on" as const, label: t.settings.calls.micOn },
          { value: "muted" as const, label: t.settings.calls.micMuted },
        ]}
        onChange={(v) => onChange({ calls: { micDefault: v } })}
      />
      <SelectRow
        label={t.settings.calls.ringtone}
        value={prefs.calls.ringtone}
        options={[
          { value: "default" as const, label: t.settings.calls.ringtoneDefault },
          { value: "off" as const, label: t.settings.calls.ringtoneOff },
        ]}
        onChange={(v) => onChange({ calls: { ringtone: v } })}
      />
      <SwitchRow
        label={t.settings.calls.dnd}
        hint={t.settings.calls.dndHint}
        checked={prefs.calls.dnd}
        onChange={(v) => onChange({ calls: { dnd: v } })}
      />
    </SettingsSection>
  );
}
