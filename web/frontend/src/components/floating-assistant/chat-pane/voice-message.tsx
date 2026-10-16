// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useState } from "react";
import { resolvePanelApiPath, scopeHeaders } from "@/lib/api-client";
import { useAssistantI18n } from "../i18n";
import type { TurnAttachment } from "../chat-engine";

/** Load persisted media with the selected server/session headers. */
export function RecordedAudio({ recording }: { recording: TurnAttachment }) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let objectUrl = "";
    setSrc(""); setFailed(false);
    const invalidate = () => { abort.abort(); if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = ""; } setSrc(""); };
    for (const event of ["luxipanel:target-changed", "luxipanel:logout", "luxipanel:session-ended"]) window.addEventListener(event, invalidate);
    if (recording.url.startsWith("data:audio/")) setSrc(recording.url);
    else if (recording.url.startsWith("/api/ai/attachments/")) {
      void fetch(resolvePanelApiPath(recording.url), {
        credentials: "include", headers: scopeHeaders(),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(20_000)]),
      }).then(async response => {
        if (!response.ok) throw new Error("Audio unavailable");
        const blob = await response.blob();
        if (abort.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      }).catch(() => { if (!abort.signal.aborted) setFailed(true); });
    } else setFailed(true);
    return () => {
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      for (const event of ["luxipanel:target-changed", "luxipanel:logout", "luxipanel:session-ended"]) window.removeEventListener(event, invalidate);
    };
  }, [recording.url, attempt]);
  return <div data-voice-recording className="w-[280px] max-w-full py-1">
    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium"><i className="ti ti-microphone" aria-hidden />{ct.voiceMessage ?? "Mensaje de voz"}</p>
    {src ? <audio controls preload="metadata" src={src} aria-label={ct.voiceMessage ?? "Mensaje de voz"} className="h-10 w-full max-w-full" />
      : failed ? <button type="button" className="text-xs underline" onClick={() => setAttempt(n => n + 1)}>{ct.voiceLoadRetry ?? "No se pudo cargar el audio. Reintentar"}</button>
      : <span role="status" className="text-xs opacity-70">{ct.voiceLoading ?? "Cargando audio…"}</span>}
  </div>;
}

export function VoiceMessage({ recordings, forwardedText }: { recordings: TurnAttachment[]; forwardedText: string }) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  return <div data-user-voice-message className="min-w-0 space-y-1.5">
    {recordings.map((recording, i) => <RecordedAudio key={`${recording.url}:${i}`} recording={recording} />)}
    <details data-voice-transcript className="rounded-md border border-border/60 bg-background/30 text-xs">
      <summary className="cursor-pointer px-2 py-1.5">{ct.voiceOpenAiTranscript ?? "Transcripción de OpenAI"}</summary>
      <div className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-border/60 px-2 py-2">{recordings.map(r => r.voice?.transcript).filter(Boolean).join("\n")}</div>
    </details>
    <details data-voice-forwarded className="rounded-md border border-border/60 bg-background/30 text-xs">
      <summary className="cursor-pointer px-2 py-1.5">{ct.voiceForwarded ?? "Texto enviado al agente"}</summary>
      <div className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-border/60 px-2 py-2">{forwardedText}</div>
    </details>
  </div>;
}
