// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useRef, useState } from "react";
import { api, unwrap, resolveTargetScope } from "@/lib/api-client";
import { lockChatInput } from "../chat-engine/input-lock";
import { useAssistantI18n } from "../i18n";
export type VoiceEvent = { seq: number; type: string; [key: string]: any };
type Session = { id?: string; key: string; draft: boolean; scope: string; conversationId: string | null;
  peer?: RTCPeerConnection; stream?: MediaStream; audio?: HTMLAudioElement;
  timer?: ReturnType<typeof setTimeout>; release: () => void; canceled: boolean; seq: number };
type Options = { enabled: boolean; canStart?: boolean; chatKey: string; conversationId: string | null;
  ensureConversation: (accept: (id: string) => boolean) => Promise<string>;
  refresh: (key: string, id: string) => Promise<void> };
export function useRealtimeVoice(opts: Options) {
  const readOnlyMessage = useAssistantI18n().agentMarket.readOnly;
  const [phase, setPhase] = useState<"idle" | "connecting" | "live" | "closing">("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [previousId, setPreviousId] = useState<string | null>(null);
  const [events, setEvents] = useState<VoiceEvent[]>([]);
  const current = useRef<Session | null>(null);
  const owner = useRef<Session | null>(null);
  const mounted = useRef(true);
  const latest = useRef(opts); latest.current = opts;
  const scope = resolveTargetScope();
  const matches = (s: Session) => s.scope === resolveTargetScope() &&
    (latest.current.conversationId ? s.conversationId === latest.current.conversationId
      : s.draft && s.key === latest.current.chatKey);
  const visible = !!owner.current && matches(owner.current);
  const valid = (s: Session) => mounted.current && current.current === s && !s.canceled && matches(s);
  const showError = (s: Session, message: string) => {
    if (mounted.current && owner.current === s && matches(s)) setError(message);
  };
  async function refresh(s: Session) {
    if (s.conversationId && s.scope === resolveTargetScope()) {
      try { await latest.current.refresh(s.conversationId, s.conversationId); }
      catch { showError(s, "No se pudo actualizar el historial. Las tareas siguen disponibles en la conversación."); }
    }
  }
  async function closeRemote(s: Session) {
    // Never send an old server's session id through a newly selected target.
    if (!s.id || s.scope !== resolveTargetScope()) return;
    try { unwrap(await api.delete<{ ok: boolean }>("/api/ai/realtime/sessions/" + s.id), "No se pudo confirmar el cierre de voz."); }
    catch { showError(s, "Micrófono apagado; no se pudo confirmar el cierre remoto. Se verificará antes de iniciar otra sesión."); }
  }
  async function stop(s = current.current) {
    if (!s || s.canceled) return;
    s.canceled = true; clearTimeout(s.timer);
    s.stream?.getTracks().forEach(t => t.stop()); s.peer?.close();
    if (s.audio) { s.audio.pause(); s.audio.srcObject = null; }
    if (mounted.current && current.current === s) setPhase("closing");
    // Keep text locked until remote closure has been checked; accepted tasks continue.
    await closeRemote(s);
    s.release();
    if (current.current === s) {
      current.current = null;
      if (mounted.current) { setPhase("idle"); setMuted(false); }
    }
    await refresh(s);
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; void stop(); };
  }, []);
  useEffect(() => { if (!opts.enabled) void stop(); }, [opts.enabled]);
  useEffect(() => {
    if (current.current && !matches(current.current)) void stop();
    if (owner.current && !matches(owner.current)) {
      owner.current = null; setEvents([]); setError(""); setPreviousId(null);
    }
  }, [opts.chatKey, opts.conversationId, scope]);
  async function poll(s: Session) {
    if (!valid(s)) { if (current.current === s) await stop(s); return; }
    if (!s.id) return;
    try {
      const data = unwrap(await api.get<{ closed: boolean; events: VoiceEvent[] }>(
        "/api/ai/realtime/sessions/" + s.id + "?since=" + s.seq, { fresh: true }), "No se pudo actualizar la voz.");
      if (!valid(s)) return;
      if (data.events.length) {
        s.seq = Math.max(s.seq, ...data.events.map(e => e.seq));
        setEvents(previous => [...previous, ...data.events].slice(-300));
        await refresh(s);
      }
      if (!valid(s)) return;
      if (data.closed) {
        const renew = data.events.some(e => e.type === "renew");
        await stop(s);
        if (renew && mounted.current && matches(s) && latest.current.enabled && !current.current) await start();
        return;
      }
    } catch { if (valid(s)) showError(s, "No se pudo actualizar la voz. Las tareas pueden seguir ejecutándose."); }
    if (valid(s)) s.timer = setTimeout(() => void poll(s), 1500);
  }
  const hasAdmission = () => latest.current.enabled && latest.current.canStart !== false;
  async function start() {
    if (current.current || !hasAdmission()) return;
    const options = latest.current;
    const s: Session = { key: options.chatKey, draft: !options.conversationId, scope: resolveTargetScope(), conversationId: options.conversationId,
      canceled: false, seq: 0, release: lockChatInput(options.chatKey, "realtime") };
    current.current = s; owner.current = s;
    setError(""); setPreviousId(null); setEvents([]); setMuted(false); setPhase("connecting");
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!valid(s)) { s.stream.getTracks().forEach(t => t.stop()); return; }
      if (!hasAdmission()) { await stop(s); return; }
      const id = await options.ensureConversation(id => {
        if (!valid(s)) return false;
        s.conversationId = id;
        const releaseDraft = s.release, releaseConversation = lockChatInput(id, "realtime");
        s.release = () => { releaseDraft(); releaseConversation(); };
        return true;
      });
      if (s.canceled || current.current !== s || !mounted.current) return;
      s.conversationId = id;
      if (!valid(s) || !hasAdmission()) { await stop(s); return; }
      const previous = unwrap(await api.get<{ activeId: string | null }>("/api/ai/realtime/conversations/" + id, { fresh: true }), "No se pudo verificar la sesión anterior.");
      if (!valid(s)) return;
      if (!hasAdmission()) { await stop(s); return; }
      if (previous.activeId) { setPreviousId(previous.activeId); throw new Error("Hay una sesión anterior activa. Finalízala antes de iniciar otra."); }
      const peer = new RTCPeerConnection(); s.peer = peer;
      const audio = new Audio(); audio.autoplay = true; s.audio = audio;
      peer.ontrack = e => {
        if (!valid(s)) return;
        audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
        void audio.play().catch(() => { if (valid(s)) showError(s, "Permite reproducir audio para escuchar al agente."); });
      };
      for (const track of s.stream.getTracks()) peer.addTrack(track, s.stream);
      peer.createDataChannel("oai-events");
      peer.onconnectionstatechange = () => {
        if (!valid(s)) return;
        if (peer.connectionState === "connected") setPhase("live");
        if (peer.connectionState === "failed" || peer.connectionState === "closed") {
          showError(s, "Se interrumpió la voz. Las tareas aceptadas continúan."); void stop(s);
        }
      };
      const offer = await peer.createOffer();
      if (!valid(s) || !hasAdmission()) { await stop(s); return; }
      await peer.setLocalDescription(offer);
      if (!valid(s) || !hasAdmission()) { await stop(s); return; }
      const data = unwrap(await api.post<{ id: string; sdp: string }>("/api/ai/realtime/sessions", {
        conversationId: id, sdp: offer.sdp,
      }), "No se pudo iniciar la voz.");
      s.id = data.id;
      if (!valid(s)) { await closeRemote(s); return; }
      await peer.setRemoteDescription({ type: "answer", sdp: data.sdp });
      if (!valid(s)) return;
      setPhase("live"); void poll(s);
    } catch (e) {
      if (valid(s)) showError(s, e instanceof Error ? e.message : "No se pudo iniciar el micrófono.");
      await stop(s);
    }
  }
  async function toggle() { if (current.current) await stop(); else await start(); }
  function toggleMuted() {
    const s = current.current;
    if (!s || !valid(s)) return;
    const value = !muted;
    s.stream?.getAudioTracks().forEach(t => { t.enabled = !value; }); setMuted(value);
  }
  async function closePrevious() {
    const s = owner.current, id = previousId;
    if (!s || !matches(s) || !id) return;
    try {
      unwrap(await api.delete<{ok: boolean}>("/api/ai/realtime/sessions/" + id), "No se pudo confirmar el cierre anterior.");
      if (owner.current === s && matches(s)) { setPreviousId(null); setError(""); }
    } catch { showError(s, "No se pudo confirmar el cierre anterior. Vuelve a verificar su estado."); }
  }
  async function permission(e: VoiceEvent, decision: "allow" | "deny" | "always") {
    const s = owner.current;
    if (!s || !mounted.current || !matches(s)) return;
    if (decision !== "deny" && !hasAdmission()) throw new Error(readOnlyMessage);
    unwrap(await api.post<{ok: boolean}>("/api/ai/agent/permission", { conversationId: e.conversationId, requestId: e.event.id, decision }), "La aprobación ya no está disponible.");
    if (mounted.current && owner.current === s && matches(s))
      setEvents(old => [...old, {seq: -Date.now(), type: "permission_resolved", event: {id: e.event.id}}]);
    await refresh(s);
  }
  async function answer(e: VoiceEvent, choice: number) {
    const s = owner.current;
    if (!s?.id || !mounted.current || !matches(s)) return;
    if (!hasAdmission()) throw new Error(readOnlyMessage);
    unwrap(await api.post<{ok: boolean}>("/api/ai/realtime/sessions/" + s.id + "/answer", {taskId: e.taskId, askedAt: e.askedAt, choice}), "La solicitud ya no está disponible.");
    if (mounted.current && owner.current === s && matches(s))
      setEvents(old => [...old, {seq: -Date.now(), type: "ask_resolved", taskId: e.taskId}]);
    await refresh(s);
  }
  const permissions = new Map<string, VoiceEvent>(), asks = new Map<string, VoiceEvent>();
  for (const e of visible ? events : []) {
    if (e.type === "permission_request") permissions.set(e.event.id, e);
    if (e.type === "permission_resolved") permissions.delete(e.event.id);
    if (e.type === "ask") asks.set(e.taskId, e);
    if (e.type === "ask_resolved") asks.delete(e.taskId);
  }
  return { active: visible && phase !== "idle", phase: visible ? phase : "idle", muted: visible && muted,
    error: visible ? error : "", previousId: visible ? previousId : null,
    canRespond: visible && hasAdmission(),
    toggle, toggleMuted, closePrevious, permissions: [...permissions.values()], asks: [...asks.values()], permission, answer };
}
