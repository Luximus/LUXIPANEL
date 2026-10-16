import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { chatController } from "../../features/assistant/chat-controller";
import { chatStore } from "../../features/assistant/chat-store";
import { useRealtimeVoiceState, getRealtimeVoiceState, startRealtimeVoice, stopRealtimeVoice, muteRealtimeVoice } from "../../features/assistant/realtime-voice";
import { setVoiceInputLock } from "../../features/assistant/input-lock";
type Caps = { enabled: boolean; available: boolean };
export function useRealtimeComposer(panelId: string, enabled: boolean | undefined) {
  const selected = useSyncExternalStore(fn => chatStore.subscribeSession(panelId, fn), () => chatStore.getSession(panelId));
  const session = useRealtimeVoiceState();
  const own = session?.panelId === panelId && session.conversationId === selected.conversationId ? session : null;
  const [preparing, setPreparing] = useState(false);
  const starting = useRef<{ canceled: boolean; panelId: string; conversationId: string | null; selected: typeof selected } | null>(null);
  const [issue, setIssue] = useState<{panelId: string; conversationId: string | null; error: string; previousId?: string} | null>(null);
  const localIssue = issue?.panelId === panelId && issue.conversationId === selected.conversationId ? issue : null;
  const active = preparing || (!!own && own.phase !== "idle");
  const latest = useRef({panelId, selected}); latest.current = {panelId, selected};
  function cancelPreparation() {
    const attempt = starting.current;
    if (!attempt) return;
    attempt.canceled = true; starting.current = null;
    setVoiceInputLock(attempt.panelId, "realtime-start", false); setPreparing(false);
  }
  useEffect(() => {
    const a = starting.current;
    if (a && (a.panelId !== panelId || (a.conversationId ? a.conversationId !== selected.conversationId : a.selected !== selected))) cancelPreparation();
    if (session && session.phase !== "idle" && session.panelId === panelId && session.conversationId !== selected.conversationId) void stopRealtimeVoice();
    if (issue && !localIssue) setIssue(null);
  }, [panelId, selected]);
  useEffect(() => () => {
    // Explicit navigation/unmount closes this chat; AppState background does not unmount it.
    cancelPreparation();
    if (getRealtimeVoiceState()?.panelId === panelId) void stopRealtimeVoice();
  }, [panelId]);
  useEffect(() => {
    let canceled = false;
    void chatController.realtimeCapabilities(panelId).then((c: Caps | null) => {
      if (!canceled && c) chatStore.patchComposer(panelId, { realtimeEnabled: c.enabled });
    }).catch(() => {});
    if (enabled === false) { cancelPreparation(); if (own && own.phase !== "idle") void stopRealtimeVoice(); }
    return () => { canceled = true; };
  }, [panelId, enabled]);
  async function toggle() {
    if (starting.current) { cancelPreparation(); if (own) await stopRealtimeVoice(); return; }
    if (own && own.phase !== "idle") { await stopRealtimeVoice(); return; }
    const attempt = { canceled: false, panelId, conversationId: selected.conversationId, selected };
    starting.current = attempt; setPreparing(true); setIssue(null);
    setVoiceInputLock(panelId, "realtime-start", true);
    const valid = () => !attempt.canceled && starting.current === attempt && latest.current.panelId === panelId &&
      (attempt.conversationId ? chatStore.getSession(panelId).conversationId === attempt.conversationId : chatStore.getSession(panelId) === attempt.selected);
    try {
      const c = await chatController.realtimeCapabilities(panelId) as Caps | null;
      if (!valid()) return;
      if (!c?.available || !c.enabled) throw new Error("Activa Voz en tiempo real y configura OpenAI.");
      const context = await chatController.prepareRealtimeContext(panelId, id => {
        if (!valid()) return false;
        attempt.conversationId = id; return true;
      });
      if (!valid()) return;
      const prior = await chatController.realtimeConversation(panelId, context.conversationId);
      if (!valid()) return;
      if (!prior) throw new Error("No se pudo verificar la sesión anterior.");
      if (prior.activeId) {
        setIssue({panelId, conversationId: context.conversationId, previousId: prior.activeId, error: "Hay una sesión anterior activa."});
        return;
      }
      await startRealtimeVoice(context, valid);
    } catch (e) {
      if (valid()) setIssue({panelId, conversationId: attempt.conversationId, error: e instanceof Error ? e.message : "No se pudo iniciar la voz."});
    } finally {
      if (starting.current === attempt) { starting.current = null; setPreparing(false); setVoiceInputLock(panelId, "realtime-start", false); }
    }
  }
  async function closePrevious() {
    if (!localIssue?.previousId) return;
    const previous = localIssue;
    const result = await chatController.closeRealtimeSession(panelId, previous.previousId!);
    if (latest.current.panelId !== panelId || latest.current.selected.conversationId !== previous.conversationId) return;
    setIssue(result?.ok ? null : {...previous, error: "No se pudo confirmar el cierre anterior."});
  }
  return { active, toggle, phase: preparing ? "connecting" : own?.phase ?? "idle", muted: !!own?.muted,
    toggleMuted: () => { if (own && own.phase !== "idle") muteRealtimeVoice(!own.muted); },
    error: localIssue?.error || own?.error || "", previousId: localIssue?.previousId, closePrevious };
}
