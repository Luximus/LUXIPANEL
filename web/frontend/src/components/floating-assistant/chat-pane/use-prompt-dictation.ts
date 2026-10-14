// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useCallback, useEffect, useRef } from "react";
import { voiceApi } from "../assistant-api";

/** Connects React Bits' mic toggle to the assistant's existing transcription API. */
export function usePromptDictation(serverStt: boolean) {
  const stopRef = useRef<(() => void) | null>(null);
  const stop = useCallback(() => { stopRef.current?.(); }, []);
  useEffect(() => () => { stopRef.current?.(); }, []);

  const dictate = useCallback(async (): Promise<string | void> => {
    if (serverStt && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined") {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      return new Promise<string | void>((resolve) => {
        const timer = window.setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, 60_000);
        stopRef.current = () => { if (recorder.state !== "inactive") recorder.stop(); };
        recorder.onstop = async () => {
          window.clearTimeout(timer);
          stopRef.current = null;
          stream.getTracks().forEach((track) => track.stop());
          try { resolve(await voiceApi.transcribe(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }))); }
          catch { resolve(); }
        };
        try { recorder.start(); } catch { window.clearTimeout(timer); stream.getTracks().forEach((track) => track.stop()); stopRef.current = null; resolve(); }
      });
    }
    const SpeechRecognition = (window as Window & { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition
      ?? (window as Window & { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "es-ES";
    recognition.continuous = false;
    recognition.interimResults = false;
    return new Promise<string | void>((resolve) => {
      let transcript = "";
      stopRef.current = () => recognition.stop();
      recognition.onresult = (event: any) => {
        transcript = Array.from(event.results as ArrayLike<{ 0: { transcript: string } }>)
          .map((result) => result[0].transcript).join(" ").trim();
      };
      recognition.onend = () => { stopRef.current = null; resolve(transcript); };
      recognition.onerror = () => { stopRef.current = null; resolve(); };
      try { recognition.start(); } catch { stopRef.current = null; resolve(); }
    });
  }, [serverStt]);
  return { dictate, stop };
}
