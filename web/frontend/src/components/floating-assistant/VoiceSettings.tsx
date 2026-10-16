// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useState } from "react";
import { TOGGLE_SWITCH } from "@/lib/ui-classes";
import { assistantApi, type AssistantConfigState, type VoiceConfigPatch } from "./assistant-api";
import { CollapsibleSection } from "./CollapsibleSection";
import { useAssistantI18n } from "./i18n";

const OPENAI_TTS_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"];

/** Voice uses the OpenAI API key configured in the Codex provider. */
export function VoiceSettings({ config, onChange }: {
  config: AssistantConfigState;
  onChange: (next: AssistantConfigState) => void;
}) {
  const t = useAssistantI18n().voiceSettings;
  const voice = config.voice;
  const [busy, setBusy] = useState(false);
  const available = !!voice?.capabilities?.stt;

  async function save(patch: VoiceConfigPatch) {
    setBusy(true);
    try {
      const next = await assistantApi.patchConfig({ voice: patch });
      onChange(next);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <CollapsibleSection
      icon={<i className="ti ti-microphone text-lg" aria-hidden />}
      title={t.title}
      description={t.description}
      headerAction={
        <label className="relative inline-flex cursor-pointer items-center">
          <input type="checkbox" className="peer sr-only" checked={voice?.enabled ?? true} disabled={busy}
            onChange={(e) => void save({ enabled: e.currentTarget.checked })} />
          <span className={TOGGLE_SWITCH} />
        </label>
      }
    >
      <p className="mb-3 text-[11px] leading-snug text-muted-foreground">{t.audioProvider}: OpenAI</p>
      <label className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs">Voz en tiempo real
          <span className="block text-[11px] text-muted-foreground">El micrófono inicia una conversación. El envío de texto se bloquea mientras usas la voz.</span>
        </span>
        <input type="checkbox" checked={!!voice?.realtimeEnabled} disabled={busy || voice?.enabled === false}
          onChange={(e) => void save({ realtimeEnabled: e.currentTarget.checked })} />
      </label>
      {voice?.enabled !== false && !available && (
        <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
          {t.missingCapabilities}
        </p>
      )}
      {available && (
        <>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span><i className="ti ti-microphone mr-1" aria-hidden />{t.inputLabel}: <span className="text-emerald-500">OpenAI</span></span>
            <span><i className="ti ti-volume mr-1" aria-hidden />{t.outputLabel}: <span className="text-emerald-500">OpenAI</span></span>
          </div>
          <label className="mb-3 block">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{t.voiceLabel}</span>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={OPENAI_TTS_VOICES.includes(voice?.voice ?? "") ? voice?.voice : "alloy"} disabled={busy}
              onChange={(e) => void save({ voice: e.currentTarget.value })}>
              {OPENAI_TTS_VOICES.map((v) => <option key={v} value={v} className="capitalize">{v}</option>)}
            </select>
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-[11px] leading-snug text-muted-foreground">{t.autoSpeak}</span>
            <span className="relative inline-flex shrink-0 cursor-pointer items-center">
              <input type="checkbox" className="peer sr-only" checked={!!voice?.autoSpeak}
                disabled={busy || voice?.enabled === false}
                onChange={(e) => void save({ autoSpeak: e.currentTarget.checked })} />
              <span className={TOGGLE_SWITCH} />
            </span>
          </label>
        </>
      )}
    </CollapsibleSection>
  );
}
