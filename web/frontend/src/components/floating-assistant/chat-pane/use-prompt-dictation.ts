// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useCallback, useEffect, useRef } from "react";
import { voiceApi, type ChatAttachment } from "../assistant-api";
import { blobToBase64 } from "../assistant-api/voice";

export interface PromptDictationResult { text: string; recording: ChatAttachment; }

type RecordingSession = {
  cancelled: boolean;
  stopRequested: boolean;
  stop?: () => void;
  abort?: AbortController;
};

/** Records on the client and transcribes exclusively with OpenAI on the server. */
export function usePromptDictation() {
  const sessionRef = useRef<RecordingSession | null>(null);
  const stop = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.stopRequested = true;
    session.stop?.();
  }, []);
  const cancel = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.cancelled = true;
    session.abort?.abort();
    session.stop?.();
  }, []);
  useEffect(() => {
    window.addEventListener("luxipanel:target-changed", cancel);
    return () => { cancel(); window.removeEventListener("luxipanel:target-changed", cancel); };
  }, [cancel]);

  const dictate = useCallback(async (): Promise<PromptDictationResult | void> => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("Este navegador no permite grabar audio.");
    }
    const session: RecordingSession = { cancelled: false, stopRequested: false };
    sessionRef.current = session;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (sessionRef.current === session) sessionRef.current = null;
      if (session.cancelled) return;
      throw err;
    }
    if (session.cancelled || session.stopRequested) {
      stream.getTracks().forEach((track) => track.stop());
      if (sessionRef.current === session) sessionRef.current = null;
      return;
    }
    return new Promise<PromptDictationResult | void>((resolve, reject) => {
      let recorder: MediaRecorder;
      try { recorder = new MediaRecorder(stream); }
      catch (err) {
        stream.getTracks().forEach((track) => track.stop());
        if (sessionRef.current === session) sessionRef.current = null;
        reject(err);
        return;
      }
      const chunks: Blob[] = [];
      const finish = () => {
        window.clearTimeout(timer);
        stream.getTracks().forEach((track) => track.stop());
        if (sessionRef.current === session) sessionRef.current = null;
      };
      const timer = window.setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, 60_000);
      session.stop = () => { if (recorder.state !== "inactive") recorder.stop(); };
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { finish(); reject(new Error("No se pudo grabar el audio.")); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        window.clearTimeout(timer);
        if (session.cancelled) { finish(); resolve(); return; }
        try {
          const audio = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          if (!audio.size) throw new Error("La grabación está vacía.");
          session.abort = new AbortController();
          const text = (await voiceApi.transcribe(audio, session.abort.signal)).trim();
          if (session.cancelled) { resolve(); return; }
          if (!text) throw new Error("No se detectó voz en el audio.");
          const dataBase64 = await blobToBase64(audio);
          if (session.cancelled) { resolve(); return; }
          const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
          resolve({ text, recording: { name: `audio.${ext}`, mimeType: audio.type, dataBase64, voice: { transcript: text } } });
        } catch (err) {
          if (session.cancelled) resolve(); else reject(err);
        } finally { finish(); }
      };
      try { recorder.start(); }
      catch (err) { finish(); reject(err); }
      if (session.cancelled || session.stopRequested) session.stop();
    });
  }, []);
  return { dictate, stop, cancel };
}
