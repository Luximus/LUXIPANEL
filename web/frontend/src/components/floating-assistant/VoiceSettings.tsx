// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useState } from "react";
import { TOGGLE_SWITCH } from "@/lib/ui-classes";
import { assistantApi, voiceApi, type AssistantConfigState, type VoiceConfigPatch } from "./assistant-api";
import { CollapsibleSection } from "./CollapsibleSection";
import { useAssistantI18n } from "./i18n";

/** OpenAI built-in TTS voices (mirror of backend audio.ts OPENAI_TTS_VOICES). */
const OPENAI_TTS_VOICES = [
  "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer",
];

/**
 * Voice (audio in/out) settings. Lives in the Providers tab next to the
 * translation panel. The STT/TTS engines reuse the OpenAI (`codex`) / Gemini
 * provider keys, so availability is derived — there's no key to set here. When
 * no capable key exists, the panel explains how to enable voice.
 */
export function VoiceSettings({
  config,
  onChange,
}: {
  config: AssistantConfigState;
  onChange: (next: AssistantConfigState) => void;
}) {
  const t = useAssistantI18n().voiceSettings;
  const voice = config.voice;
  const [busy, setBusy] = useState(false);

  const caps = voice?.capabilities ?? { stt: null, tts: null };
  const anyCapability = !!caps.stt || !!caps.tts;
  const ttsProvider = voice?.ttsProvider ?? "api";
  const minimaxInstalled = !!config.providers.minimax?.cli?.installed;
  const minimaxAuthed = !!config.providers.minimax?.cli?.loggedIn || !!config.providers.minimax?.api?.hasApiKey;
  // Piper install status is a panel-host fact (not in the redacted config), so
  // confirm it from the capabilities endpoint; re-check when the provider flips.
  const [piperInstalled, setPiperInstalled] = useState(caps.piperInstalled ?? false);
  useEffect(() => {
    let alive = true;
    voiceApi
      .capabilities()
      .then((c) => { if (alive) setPiperInstalled(!!c.piperInstalled); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [ttsProvider]);

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
      icon={<i className="ti ti-microphone text-lg" aria-hidden></i>}
      title={t.title}
      description={t.description}
      headerAction={
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={voice?.enabled ?? true}
            disabled={busy}
            onChange={(e) => void save({ enabled: e.currentTarget.checked })}
          />
          <span className={TOGGLE_SWITCH}></span>
        </label>
      }
    >
      {voice?.enabled !== false && (
        <div className="mb-3">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{t.audioProvider}</span>
          <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label={t.audioProvider}>
            {(["api", "cli", "minimax-cli"] as const).map((p) => (
              <button
                key={p}
                type="button"
                disabled={busy}
                aria-pressed={ttsProvider === p}
                onClick={() => void save({ ttsProvider: p })}
                className={`rounded px-3 py-1 text-[11px] font-medium transition-colors disabled:opacity-60 ${
                  ttsProvider === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "api" ? t.providerApi : p === "cli" ? t.providerPiper : t.providerMinimax}
              </button>
            ))}
          </div>
          {ttsProvider === "api" && (
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{t.providerApiHint}</p>
          )}
          {ttsProvider === "cli" && (
            <p
              className={`mt-1.5 rounded-md px-2.5 py-1.5 text-[11px] leading-snug ${
                piperInstalled
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              <i className={`ti ${piperInstalled ? "ti-check" : "ti-alert-triangle"} mr-1`} aria-hidden></i>
              {piperInstalled ? t.piperReady : t.piperMissing}
            </p>
          )}
          {ttsProvider === "minimax-cli" && (
            <p
              className={`mt-1.5 rounded-md px-2.5 py-1.5 text-[11px] leading-snug ${
                minimaxInstalled && minimaxAuthed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              <i className={`ti ${minimaxInstalled && minimaxAuthed ? "ti-check" : "ti-alert-triangle"} mr-1`} aria-hidden></i>
              {!minimaxInstalled ? t.minimaxMissing : minimaxAuthed ? t.minimaxReady : t.minimaxAuthMissing}
            </p>
          )}
        </div>
      )}

      {!anyCapability && ttsProvider === "api" && (
        <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
          {t.missingCapabilities}
        </p>
      )}

      {anyCapability && (
        <>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              <i className="ti ti-microphone mr-1" aria-hidden></i>
              {t.inputLabel}: {caps.stt ? <span className="text-emerald-500 capitalize">{caps.stt}</span> : <span className="text-muted-foreground">{t.notAvailable}</span>}
            </span>
            <span>
              <i className="ti ti-volume mr-1" aria-hidden></i>
              {t.outputLabel}: {caps.tts ? <span className="text-emerald-500 capitalize">{caps.tts}</span> : <span className="text-muted-foreground">{t.notAvailable}</span>}
            </span>
          </div>

          {caps.tts && (
            <>
              {/* Voice picker is OpenAI-only (Piper selects its model by language). */}
              {ttsProvider === "api" && (
                <label className="mb-3 block">
                  <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{t.voiceLabel}</span>
                  <select
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    value={voice?.voice || "alloy"}
                    disabled={busy}
                    onChange={(e) => void save({ voice: e.currentTarget.value })}
                  >
                    {OPENAI_TTS_VOICES.map((v) => (
                      <option key={v} value={v} className="capitalize">{v}</option>
                    ))}
                  </select>
                </label>
              )}
              {ttsProvider === "minimax-cli" && (
                <label className="mb-3 block">
                  <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{t.voiceLabel}</span>
                  <input
                    type="text"
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    value={voice?.voice === "alloy" ? "" : voice?.voice || ""}
                    placeholder="English_magnetic_voiced_man"
                    disabled={busy}
                    onChange={(e) => void save({ voice: e.currentTarget.value || "alloy" })}
                  />
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t.minimaxVoiceHint}</p>
                </label>
              )}

              <label className="flex items-center justify-between gap-3">
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {t.autoSpeak}
                </span>
                <span className="relative inline-flex shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={!!voice?.autoSpeak}
                    disabled={busy || voice?.enabled === false}
                    onChange={(e) => void save({ autoSpeak: e.currentTarget.checked })}
                  />
                  <span className={TOGGLE_SWITCH}></span>
                </span>
              </label>
            </>
          )}
        </>
      )}
    </CollapsibleSection>
  );
}
