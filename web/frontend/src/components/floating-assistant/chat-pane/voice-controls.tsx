// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useCallback, useEffect, useRef, useState } from "react";
import { useAssistantI18n } from "../i18n";
import { voiceApi } from "../assistant-api";

/**
 * Speaker button for an assistant reply: turns the reply's text into speech via
 * `/api/ai/voice/speak` and plays it. With `autoPlay` (the global "leer
 * respuestas" toggle) it speaks the latest completed reply once.
 *
 * The synthesized clip is PERSISTED on the target (keyed by conversation + voice
 * + text), so the first play returns a served URL (`/api/ai/audio/:id`) and any
 * replay — this session (cached `urlRef`) or after a reload (server-side dedup
 * hit) — streams the same file instead of regenerating the audio.
 */
export function SpeakButton({ text, voiceName, conversationId, autoPlay }: { text: string; voiceName?: string; conversationId?: string; autoPlay?: boolean }) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const autoPlayedRef = useRef(false);

  const stop = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }, []);
  const dispose = useCallback(() => {
    stop();
    // Only object URLs need revoking; served `/api/ai/audio/:id` urls don't.
    if (urlRef.current?.startsWith("blob:")) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, [stop]);

  const play = useCallback(async (manual: boolean) => {
    if (state === "playing") { stop(); setState("idle"); return; }
    setState("loading");
    setError(null);
    try {
      // Reuse the already-resolved clip on replay — no second request, and the
      // server never regenerates the audio.
      let url = urlRef.current;
      if (!url) {
        url = await voiceApi.speak(text, { voice: voiceName, conversationId });
        urlRef.current = url;
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setState("idle"); stop(); };
      audio.onerror = () => {
        setState("idle");
        stop();
        if (manual) setError(ct.ttsError ?? "No se pudo reproducir el audio.");
      };
      await audio.play();
      setState("playing");
    } catch (err) {
      setState("idle");
      stop();
      // Don't leave a silent dead spinner: surface WHY nothing played. The
      // backend forwards the provider's message (e.g. OpenAI 429 "quota
      // exceeded"), so the user can tell it's a billing/quota problem and not a
      // broken button. Auto-speak stays silent — an autoplay block isn't an error.
      if (manual) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(
          /\b429\b|quota|exceed/i.test(msg)
            ? (ct.ttsQuotaError ?? "Cuota del proveedor de voz agotada. Revisa el plan o la facturación.")
            : (ct.ttsError ?? "No se pudo generar el audio."),
        );
      }
    }
  }, [state, text, voiceName, conversationId, stop, ct]);

  // Auto-speak the latest reply once when the toggle is on. Browsers may block
  // autoplay without a gesture; failure degrades to the manual button silently.
  useEffect(() => {
    if (autoPlay && !autoPlayedRef.current && text.trim()) {
      autoPlayedRef.current = true;
      void play(false);
    }
  }, [autoPlay, text, play]);

  useEffect(() => dispose, [dispose]);

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => void play(true)}
        disabled={state === "loading"}
        title={state === "playing" ? (ct.ttsStop ?? "Detener") : (ct.ttsListenResponse ?? "Escuchar respuesta")}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
      >
        <i className={`ti ${state === "loading" ? "ti-loader-2 animate-spin" : state === "playing" ? "ti-player-stop" : "ti-volume"} text-[12px]`} aria-hidden></i>
        {state === "playing" ? (ct.ttsStop ?? "Detener") : (ct.ttsListen ?? "Escuchar")}
      </button>
      {error && (
        <span role="alert" className="text-[10px] leading-tight text-red-600/90 dark:text-red-400/90">{error}</span>
      )}
    </span>
  );
}

