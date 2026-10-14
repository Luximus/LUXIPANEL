import { localizeServerError } from "../../lib/server-error-localization";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Square, Volume2 } from "lucide-react-native";
import { createAudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { luxAssistantProxy } from "../../api/client";
import { getDirect } from "../../api/serverApi";
import type { ThemeTokens } from "../../theme/colors";
import { PanelText as Text } from "../ui/PanelText";

type SpeakResponse = { audioId?: string; audioBase64?: string; mimeType?: string };

/** Uses the same server TTS endpoint and persisted audio cache as the web chat. */
export function NativeSpeakButton({ panelId, token, text, conversationId, voiceName, autoPlay, tokens, language }: {
  panelId: string; token: string; text: string; conversationId?: string | null; voiceName?: string;
  autoPlay?: boolean; tokens: ThemeTokens; language?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState("");
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const sourceRef = useRef<string | null>(null);
  const localFileRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const autoPlayedRef = useRef(false);
  const spanish = (language ?? "es").startsWith("es");

  const stop = () => {
    subscriptionRef.current?.remove(); subscriptionRef.current = null;
    if (playerRef.current) { playerRef.current.pause(); playerRef.current.remove(); playerRef.current = null; }
    if (mountedRef.current) setState("idle");
  };
  const play = async (manual: boolean) => {
    if (state === "playing") { requestRef.current++; stop(); return; }
    if (state === "loading") return;
    const request = ++requestRef.current;
    setState("loading"); setError("");
    try {
      let uri = sourceRef.current;
      if (!uri) {
        const result = await luxAssistantProxy<SpeakResponse>(panelId, token, "POST", "/api/ai/voice/speak", {
          text, ...(voiceName ? { voice: voiceName } : {}), ...(conversationId ? { conversationId } : {}),
        });
        if (!result || request !== requestRef.current || !mountedRef.current) return;
        if (result.audioId && /^[a-zA-Z0-9_-]{1,128}$/.test(result.audioId)) {
          const target = getDirect(panelId);
          if (!target) throw new Error("NO_PANEL");
          uri = `${target.baseUrl}/api/ai/audio/${encodeURIComponent(result.audioId)}`;
        } else if (result.audioBase64) {
          const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
          if (!dir) throw new Error("NO_CACHE");
          const ext = result.mimeType?.includes("wav") ? "wav" : "mp3";
          uri = `${dir}lxp-voice-${Date.now()}.${ext}`;
          await FileSystem.writeAsStringAsync(uri, result.audioBase64, { encoding: FileSystem.EncodingType.Base64 });
          localFileRef.current = uri;
        } else throw new Error("NO_AUDIO");
        sourceRef.current = uri;
      }
      if (request !== requestRef.current || !mountedRef.current) return;
      const target = getDirect(panelId);
      const remote = uri.startsWith("http");
      if (remote && !target) throw new Error("NO_PANEL");
      const player = createAudioPlayer({ uri, ...(remote && target ? { headers: {
        Authorization: `Bearer ${target.jwt}`,
        Cookie: `luxipanel_session=${target.jwt}`,
        ...(target.bridgeSessionId ? { "X-Bridge-Session-Id": target.bridgeSessionId } : {}),
      } } : {}) });
      playerRef.current = player;
      subscriptionRef.current = player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) stop();
      });
      player.play();
      setState("playing");
    } catch (cause) {
      stop();
      if (manual && mountedRef.current) setError(/429|quota|exceed/i.test(String(cause))
        ? (spanish ? "Cuota de voz agotada." : "Voice quota exceeded.")
        : (spanish ? "No se pudo reproducir el audio." : "Could not play audio."));
    }
  };

  useEffect(() => {
    if (autoPlay && !autoPlayedRef.current && text.trim()) { autoPlayedRef.current = true; void play(false); }
  }, [autoPlay, text]);
  useEffect(() => () => {
    mountedRef.current = false;
    requestRef.current++;
    stop();
    if (localFileRef.current) void FileSystem.deleteAsync(localFileRef.current, { idempotent: true }).catch(() => undefined);
  }, []);

  return <View style={{ alignItems: "flex-start" }}>
    <Pressable onPress={() => void play(true)} disabled={state === "loading"} accessibilityRole="button"
      accessibilityLabel={state === "playing" ? (spanish ? "Detener audio" : "Stop audio") : (spanish ? "Escuchar respuesta" : "Listen to answer")}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 5, paddingVertical: 3, opacity: state === "loading" ? 0.6 : 1 }}>
      {state === "loading" ? <ActivityIndicator size="small" color={tokens.textMuted} /> : state === "playing" ? <Square size={12} color={tokens.textMuted} /> : <Volume2 size={13} color={tokens.textMuted} />}
      <Text style={{ color: tokens.textMuted, fontSize: 10 }}>{state === "playing" ? (spanish ? "Detener" : "Stop") : (spanish ? "Escuchar" : "Listen")}</Text>
    </Pressable>
    {error ? <Text accessibilityRole="alert" style={{ color: tokens.danger, fontSize: 10 }}>{localizeServerError(error)}</Text> : null}
  </View>;
}
