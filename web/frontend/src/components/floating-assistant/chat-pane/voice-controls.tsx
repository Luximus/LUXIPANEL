// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Voice controls for the composer / assistant replies: Web-Speech dictation
 * button, press-and-hold recorder (waveform + STT), and the TTS speaker button.
 * Extracted verbatim from the original `ChatPane.tsx`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAssistantI18n } from "../i18n";
import { voiceApi } from "../assistant-api";
import { fmtRecordTime, paintWaveform } from "./helpers";

/**
 * Voice dictation (Web Speech API). Hidden when unsupported. Appends the
 * recognized speech to the composer in the user's own language — pairs neatly
 * with the background translation layer (voice → text → ES→EN → agent).
 */
export function VoiceDictateButton({ onText, className }: { onText: (t: string) => void; className?: string }) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const SR = typeof window !== "undefined"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null;
  if (!SR) return null;

  function toggle() {
    if (listening) { recRef.current?.stop?.(); return; }
    const rec = new SR();
    rec.lang = typeof navigator !== "undefined" ? navigator.language || "es-ES" : "es-ES";
    rec.interimResults = false;
    rec.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const text = Array.from(e.results as ArrayLike<{ 0: { transcript: string } }>)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (text) onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); navigator.vibrate?.(8); } catch { setListening(false); }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      title={listening ? (ct.sttStop ?? "Detener dictado") : (ct.sttStart ?? "Dictar por voz")}
      className={`shrink-0 inline-flex items-center justify-center h-[42px] w-[42px] rounded-lg border text-base transition-colors ${
        listening ? "border-red-500 text-red-500 animate-pulse" : "border-border text-muted-foreground hover:bg-accent"
      } ${className ?? ""}`}
    >
      <i className={`ti ${listening ? "ti-microphone-2" : "ti-microphone"}`} aria-hidden></i>
    </button>
  );
}

/**
 * Press-and-hold voice recorder (WhatsApp-style). Hold the mic to record — the
 * composer textarea is swapped for a live Web-Audio waveform + timer. Release to
 * stage the clip; then Send transcribes it (server STT, `/api/ai/voice/transcribe`)
 * and dispatches the message via `onSubmit`, or Cancel (trash) discards it.
 * Reports `active` (recording|staged|transcribing) so the parent collapses the
 * normal composer controls. Requires `getUserMedia` + `MediaRecorder`.
 */
export function VoiceRecorder({
  serverStt,
  onActiveChange,
  onSubmit,
  className,
  tapToggle = false,
}: {
  /** When true, transcribe the recorded clip via server STT; otherwise use the
   *  browser Web Speech API captured live during the hold (works in CLI mode). */
  serverStt: boolean;
  onActiveChange: (active: boolean) => void;
  onSubmit: (text: string) => void;
  /** Extra classes for the mic button (e.g. responsive flex `order`). */
  className?: string;
  /** Mobile: tap to start / tap to stop, instead of press-and-hold. */
  tapToggle?: boolean;
}) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  type RecState = "idle" | "recording" | "staged" | "transcribing";
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  // True if the user released the press before getUserMedia resolved.
  const abortStartRef = useRef(false);
  // Web Speech (fallback transcription, when serverStt is false).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const srRef = useRef<any>(null);
  const transcriptRef = useRef("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const peaksRef = useRef<number[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  // getUserMedia drives the waveform for both modes; MediaRecorder is only
  // needed when we ship the clip to server STT.
  const canRecord = typeof navigator !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia
    && (!serverStt || typeof MediaRecorder !== "undefined");

  const active = state !== "idle";
  useEffect(() => { onActiveChange(active); }, [active, onActiveChange]);

  function stopWaveformLoop() {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }
  function stopTimer() {
    if (timerRef.current != null) { clearInterval(timerRef.current); timerRef.current = null; }
  }
  function releaseStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }
  function closeAudio() {
    try { void audioCtxRef.current?.close(); } catch { /* noop */ }
    audioCtxRef.current = null;
    analyserRef.current = null;
  }
  function stopWebSpeech() {
    try { srRef.current?.stop?.(); } catch { /* noop */ }
    srRef.current = null;
  }
  function teardown() {
    stopWaveformLoop();
    stopTimer();
    try { if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop(); } catch { /* noop */ }
    stopWebSpeech();
    releaseStream();
    closeAudio();
  }

  function reset() {
    teardown();
    blobRef.current = null;
    peaksRef.current = [];
    transcriptRef.current = "";
    setElapsed(0);
    setState("idle");
  }

  useEffect(() => () => teardown(), []);

  // Redraw the frozen waveform once the clip is staged (after layout settles).
  useEffect(() => {
    if (state === "staged" && canvasRef.current) paintWaveform(canvasRef.current, peaksRef.current, false);
  }, [state]);

  function runWaveformLoop() {
    const tick = () => {
      const analyser = analyserRef.current;
      const canvas = canvasRef.current;
      if (analyser && canvas) {
        const buf = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        peaksRef.current.push(peak);
        paintWaveform(canvas, peaksRef.current, true);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  // Live browser transcription (no server STT). Accumulates final results into
  // transcriptRef while the user holds; read on Send.
  function startWebSpeech() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const sr = new SR();
      sr.lang = typeof navigator !== "undefined" ? navigator.language || "es-ES" : "es-ES";
      sr.continuous = true;
      sr.interimResults = true;
      transcriptRef.current = "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sr.onresult = (e: any) => {
        let finalTxt = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalTxt += e.results[i][0].transcript;
        }
        if (finalTxt.trim()) transcriptRef.current = `${transcriptRef.current} ${finalTxt.trim()}`.trim();
      };
      sr.onerror = () => { /* waveform still works; Send just yields no text */ };
      srRef.current = sr;
      sr.start();
    } catch { /* noop */ }
  }

  async function startRecording() {
    if (!canRecord || state !== "idle") return;
    abortStartRef.current = false;
    peaksRef.current = [];
    transcriptRef.current = "";
    setElapsed(0);
    setState("recording");
    try { navigator.vibrate?.(8); } catch { /* unsupported */ }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (abortStartRef.current) { stream.getTracks().forEach((t) => t.stop()); setState("idle"); return; }
      streamRef.current = stream;
      // Web-Audio analyser for the live waveform (both modes).
      const AC: typeof AudioContext = window.AudioContext
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        || (window as any).webkitAudioContext;
      const ac = new AC();
      audioCtxRef.current = ac;
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      ac.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      // Transcription source.
      if (serverStt) {
        const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
        const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        chunksRef.current = [];
        rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        rec.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          chunksRef.current = [];
          blobRef.current = blob.size > 0 ? blob : null;
        };
        recRef.current = rec;
        rec.start();
      } else {
        startWebSpeech();
      }
      startedAtRef.current = Date.now();
      runWaveformLoop();
      timerRef.current = window.setInterval(() => setElapsed((Date.now() - startedAtRef.current) / 1000), 200);
    } catch {
      teardown();
      setState("idle");
    }
  }

  // Pointer released → stop recording and stage the clip (or discard if it never
  // started / was too short to be intentional). `fromCancel` distinguishes a
  // genuine release (pointerup) from a pointercancel: when the waveform bar
  // mounts on mobile the resulting layout reflow fires a spurious pointercancel
  // on the captured pointer *before* getUserMedia resolves — that must NOT abort
  // the recording (it was killing the press instantly). A real release this
  // early arrives as pointerup and still aborts as intended.
  function endHold(fromCancel = false) {
    if (state !== "recording") return;
    if (!streamRef.current) { if (!fromCancel) abortStartRef.current = true; return; } // released before mic was ready
    stopWaveformLoop();
    stopTimer();
    try { recRef.current?.stop(); } catch { /* noop */ }
    stopWebSpeech();
    releaseStream();
    closeAudio();
    const secs = (Date.now() - startedAtRef.current) / 1000;
    if (secs < 0.5) { reset(); return; } // accidental tap
    setState("staged");
  }

  function onPointerDown(e: React.PointerEvent) {
    if (state !== "idle" || !canRecord) return;
    e.preventDefault();
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch { /* noop */ }
    void startRecording();
  }

  async function submit() {
    if (state !== "staged") return;
    if (!serverStt) {
      // Web Speech path — transcript already captured during the hold.
      const text = transcriptRef.current.trim();
      reset();
      if (text) onSubmit(text);
      return;
    }
    const blob = blobRef.current;
    if (!blob) { reset(); return; }
    setState("transcribing");
    try {
      const text = await voiceApi.transcribe(blob);
      reset();
      if (text.trim()) onSubmit(text.trim());
    } catch {
      reset();
    }
  }

  if (!canRecord) return null;

  // Active bar (recording / staged / transcribing) — replaces the textarea.
  const bar = active ? (
    <div className={`flex h-9 flex-1 min-w-0 items-center gap-1.5 rounded-lg border border-input bg-background px-1.5 text-primary ${
      // While recording the bar has no controls — keep it inert so its reflow
      // can't intercept the held press or trigger a touch-cancel on mobile.
      state === "recording" ? "pointer-events-none touch-none" : ""
    }`}>
      <button
        type="button"
        onClick={reset}
        disabled={state === "transcribing"}
        title={ct.cancelAudio ?? "Cancelar audio"}
        aria-label={ct.cancelAudio ?? "Cancelar audio"}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-red-500 disabled:opacity-50"
      >
        <i className="ti ti-trash text-sm" aria-hidden></i>
      </button>
      {state === "recording" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 animate-pulse" aria-hidden></span>}
      <span className="w-8 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground">{fmtRecordTime(elapsed)}</span>
      <canvas ref={canvasRef} className="h-6 min-w-0 flex-1 pointer-events-none" />
      {state !== "recording" && (
        <button
          type="button"
          onClick={() => void submit()}
          disabled={state === "transcribing"}
          title={ct.sendAudio ?? "Enviar audio"}
          aria-label={ct.sendAudio ?? "Enviar audio"}
          className="shrink-0 rounded-md bg-primary p-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          <i className={`ti ${state === "transcribing" ? "ti-loader-2 animate-spin" : "ti-send"}`} aria-hidden></i>
        </button>
      )}
    </div>
  ) : null;

  // Persistent mic press-target. Kept mounted across idle→recording so the
  // pointer capture survives until release; hidden once staged (Send lives in
  // the bar). Releasing while recording stages the clip.
  // Mobile uses tap-to-toggle (tap to start, tap again to stop); desktop keeps
  // press-and-hold. Toggle mode needs no pointer capture nor the reflow-cancel
  // guard, so it binds a plain onClick instead of the pointer handlers.
  const micHandlers = tapToggle
    ? { onClick: () => { if (state === "idle") void startRecording(); else endHold(false); } }
    : {
        onPointerDown,
        onPointerUp: () => endHold(false),
        onPointerCancel: () => endHold(true),
      };
  const micBtn = (state === "idle" || state === "recording") ? (
    <button
      type="button"
      {...micHandlers}
      onContextMenu={(e) => e.preventDefault()}
      aria-pressed={state === "recording"}
      title={
        state === "recording"
          ? (tapToggle ? (ct.voiceTapStop ?? "Toca para detener") : (ct.voiceReleaseReview ?? "Suelta para revisar"))
          // Spell out which transcription backend will be used (C3): server STT
          // (api mode) gives the best result; otherwise the browser does it live.
          : `${tapToggle ? (ct.voiceTapRecord ?? "Toca para grabar") : (ct.voiceHoldRecord ?? "Mantén pulsado para grabar")} — ${ct.voiceTranscription ?? "transcripción"}: ${serverStt ? (ct.sttServer ?? "STT del servidor") : (ct.sttBrowser ?? "navegador (Web Speech)")}`
      }
      className={`shrink-0 inline-flex items-center justify-center touch-none select-none rounded-lg border text-base transition-colors ${
        state === "recording"
          ? "h-9 w-9 border-red-500 bg-red-500 text-white animate-pulse"
          : "h-[42px] w-[42px] border-border text-muted-foreground hover:bg-accent"
      } ${className ?? ""}`}
    >
      <i className={`ti ${state === "recording" ? "ti-microphone-2" : "ti-microphone"}`} aria-hidden></i>
    </button>
  ) : null;

  return (
    <>
      {bar}
      {micBtn}
    </>
  );
}

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

