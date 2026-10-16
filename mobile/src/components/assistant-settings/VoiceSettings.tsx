import { chatStore } from "../../features/assistant/chat-store";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { luxAssistantProxy } from "../../api/client";
import type { ThemeTokens } from "../../theme/colors";
import type { Messages } from "../../i18n/messages";
import { Select } from "../ui/Select";
import { SegmentedControl } from "../ui/SegmentedControl";
import { s } from "./styles";
import { SectionHead, ToggleRow } from "./parts";

type T = Messages["assistantSettings"];
type TtsProvider = "api" | "cli" | "minimax-cli";

/** Voces TTS integradas de OpenAI (espeja backend audio.ts OPENAI_TTS_VOICES). */
const OPENAI_TTS_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"];

type VoiceCfg = {
  realtimeEnabled?: boolean;
  enabled: boolean;
  ttsProvider: TtsProvider;
  autoSpeak: boolean;
  voice: string;
  capabilities: { stt: string | null; tts: string | null; piperInstalled?: boolean };
};

type ConfigWithVoice = { voice?: VoiceCfg };

/**
 * Ajustes de voz (audio de entrada/salida). Réplica RN de `VoiceSettings` de la
 * web: activar audio + motor de salida (API/Piper/MiniMax) + voz OpenAI + leer
 * respuestas. Las capacidades STT/TTS derivan de las keys ya configuradas (no hay
 * key propia aquí). Persiste vía `PUT /api/ai/config` ({ voice }).
 */
export function VoiceSettings({
  panelId,
  token,
  t,
  tokens,
}: {
  panelId: string;
  token: string;
  t: T;
  tokens: ThemeTokens;
}) {
  const [voice, setVoice] = useState<VoiceCfg | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void luxAssistantProxy<{ config?: ConfigWithVoice }>(panelId, token, "GET", "/api/ai/config").then((body) => {
      if (!cancelled && body?.config?.voice) setVoice(body.config.voice);
    });
    return () => { cancelled = true; };
  }, [panelId, token]);

  const save = async (patch: Partial<VoiceCfg>) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await luxAssistantProxy<{ config?: ConfigWithVoice }>(
        panelId, token, "PUT", "/api/ai/config", { voice: patch },
      );
      if (!res) return;
      if (patch.realtimeEnabled !== undefined || patch.enabled !== undefined) chatStore.patchComposer(panelId, { realtimeEnabled: !!(res.config?.voice?.realtimeEnabled ?? patch.realtimeEnabled ?? voice?.realtimeEnabled) && !!(res.config?.voice?.enabled ?? patch.enabled ?? voice?.enabled) });
      if (res?.config?.voice) setVoice(res.config.voice);
      else setVoice((cur) => (cur ? { ...cur, ...patch } : cur));
    } finally {
      setBusy(false);
    }
  };

  const tx = t.providersExtra;
  const enabled = voice?.enabled ?? true;
  const ttsProvider = voice?.ttsProvider ?? "api";
  const caps = voice?.capabilities ?? { stt: null, tts: null };
  const anyCapability = !!caps.stt || !!caps.tts;

  return (
    <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
      <SectionHead title={tx.voiceTitle} desc={tx.voiceDesc} tokens={tokens} />
      <ToggleRow
        label={tx.voiceEnable}
        value={enabled}
        disabled={busy || !voice}
        onChange={(v) => void save({ enabled: v })}
        tokens={tokens}
      />

      <ToggleRow label="Voz en tiempo real" value={!!voice?.realtimeEnabled}
        disabled={busy || !voice || !enabled} onChange={(v) => void save({ realtimeEnabled: v })} tokens={tokens} />
      {enabled ? (
        <>
          <View>
            <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{tx.voiceProvider}</Text>
            <SegmentedControl
              fill
              items={[
                { key: "api", label: tx.voiceProviderApi },
                { key: "cli", label: tx.voiceProviderPiper },
                { key: "minimax-cli", label: tx.voiceProviderMinimax },
              ]}
              value={ttsProvider}
              onChange={(k) => void save({ ttsProvider: k as TtsProvider })}
            />
          </View>

          {!anyCapability && ttsProvider === "api" ? (
            <Text style={[s.cardDesc, { color: tokens.warning }]}>{tx.voiceMissing}</Text>
          ) : null}

          {caps.tts && ttsProvider === "api" ? (
            <View>
              <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{tx.voiceVoice}</Text>
              <Select
                value={voice?.voice || "alloy"}
                options={OPENAI_TTS_VOICES.map((v) => ({ value: v, label: v }))}
                onChange={(v) => void save({ voice: v })}
              />
            </View>
          ) : null}

          {caps.tts ? (
            <ToggleRow
              label={tx.voiceAutoSpeak}
              value={!!voice?.autoSpeak}
              disabled={busy}
              onChange={(v) => void save({ autoSpeak: v })}
              tokens={tokens}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

export default VoiceSettings;
