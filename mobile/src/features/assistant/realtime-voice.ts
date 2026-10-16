import { useSyncExternalStore } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { luxAssistantProxy } from "../../api/client";
import { registerStoreReset } from "../../lib/store-reset";
import { createRealtimePcmAudio, type RealtimePcmAudio } from "./realtime-pcm";
import { getDirect } from "../../api/serverApi";
import { setVoiceInputLock } from "./input-lock";

type Event = { seq: number; type: string; [key: string]: any };
export type VoiceState = { panelId: string; conversationId: string; sessionId?: string; phase: "connecting" | "live" | "closing" | "idle"; muted: boolean; error: string; events: Event[] };
let state: VoiceState | null = null;
const listeners = new Set<() => void>();
const notify = () => { for (const fn of listeners) fn(); };
const patch = (p: Partial<VoiceState>) => { if (state) { state = { ...state, ...p }; notify(); } };
type NativeSession = { panelId: string; token: string; conversationId: string; id?: string; canceled: boolean; pcm?: RealtimePcmAudio; timer?: ReturnType<typeof setTimeout>;
  audio?: typeof import("react-native-audio-api"); subscriptions: { remove(): void }[]; seq: number; polling?: boolean };
let live: NativeSession | null = null;
export function getRealtimeVoiceState() { return state; }
export function useRealtimeVoiceState() { return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => state); }
async function request<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  if (!live) throw new Error("La sesión terminó.");
  const data = await luxAssistantProxy<T>(live.panelId, live.token, method, path, body);
  if (!data) throw new Error("No se pudo comunicar con el panel.");
  return data;
}
export async function stopRealtimeVoice(): Promise<void> {
  const s = live;
  if (!s || s.canceled) return;
  s.canceled = true; clearTimeout(s.timer); patch({ phase: "closing" });
  await s.pcm?.close().catch(() => undefined);
  for (const subscription of s.subscriptions) subscription.remove();
  try {
    if (s.id) {
      const result = await luxAssistantProxy<{ ok: boolean }>(s.panelId, s.token, "DELETE", "/api/ai/realtime/sessions/" + s.id);
      if (!result?.ok) patch({ error: "Micrófono apagado; no se pudo confirmar el cierre remoto." });
    }
  } catch { if (live === s) patch({error: "Micrófono apagado; no se pudo confirmar el cierre remoto."}); }
  finally {
    await s.audio?.RecordingNotificationManager.hide().catch(() => undefined);
    await s.audio?.AudioManager.setAudioSessionActivity(false).catch(() => undefined);
    setVoiceInputLock(s.panelId, "realtime", false);
    if (live === s) { live = null; patch({ phase: "idle", muted: false }); }
  }
}
export function muteRealtimeVoice(value: boolean): void {
  live?.pcm?.setMuted(value);
  patch({ muted: value });
  void live?.audio?.RecordingNotificationManager.show({ paused: value });
}
registerStoreReset(() => { void stopRealtimeVoice(); state = null; notify(); });
async function poll(s: NativeSession): Promise<void> {
  if (s.canceled || live !== s || !s.id || s.polling) return;
  s.polling = true;
  try {
    const result = await request<{ closed: boolean; events: Event[] }>("GET", "/api/ai/realtime/sessions/" + s.id + "?since=" + s.seq);
    if (s.canceled || live !== s) return;
    s.seq = Math.max(s.seq, ...result.events.map(e => e.seq));
    if (result.events.length) patch({ events: [...(state?.events ?? []), ...result.events].slice(-300) });
    if (result.closed) {
      if (result.events.some(e => e.type === "renew")) {
        patch({ phase: "connecting", events: [] }); s.seq = 0;
        try { await connectNative(s); if (!s.canceled && live === s) patch({ phase: "live" }); }
        catch { if (!s.canceled && live === s) { patch({ error: "No se pudo renovar la voz. Las tareas continúan." }); await stopRealtimeVoice(); } return; }
      } else { await stopRealtimeVoice(); return; }
    }
  } catch { if (!s.canceled && live === s) patch({ error: "No se pudo actualizar el estado. Las tareas pueden continuar." }); }
  finally { s.polling = false; }
  if (!s.canceled) s.timer = setTimeout(() => void poll(s), 1800);
}
export async function startRealtimeVoice(input: { panelId: string; token: string; conversationId: string }, isCurrent: () => boolean = () => true): Promise<void> {
  if (live) throw new Error("Termina la conversación de voz activa.");
  if (AppState.currentState !== "active") throw new Error("Inicia la voz con la aplicación abierta.");
  const calls = await import("../../lib/server-calls");
  if (calls.getServerCallSnapshot()?.session) throw new Error("Termina la llamada antes de iniciar la voz del asistente.");
  if (!isCurrent()) return;
  if (live) throw new Error("Ya se está iniciando otra sesión de voz.");
  const s: NativeSession = { ...input, canceled: false, subscriptions: [], seq: 0 };
  live = s; state = { panelId: input.panelId, conversationId: input.conversationId, phase: "connecting", muted: false, error: "", events: [] };
  setVoiceInputLock(input.panelId, "realtime", true); notify();
  try {
    const audio = await import("react-native-audio-api"); s.audio = audio;
    if (s.canceled || !isCurrent()) { await stopRealtimeVoice(); return; }
    if (await audio.AudioManager.requestRecordingPermissions() !== "Granted") throw new Error("Permite el acceso al micrófono.");
    if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
      const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) throw new Error("Permite las notificaciones para mostrar el micrófono activo.");
    }
    if (s.canceled || !isCurrent()) { await stopRealtimeVoice(); return; }
    audio.AudioManager.setAudioSessionOptions({ iosCategory: "playAndRecord", iosMode: "voiceChat", iosOptions: ["defaultToSpeaker", "allowBluetoothHFP"] });
    await audio.AudioManager.setAudioSessionActivity(true);
    if (s.canceled || !isCurrent()) { await audio.AudioManager.setAudioSessionActivity(false); await stopRealtimeVoice(); return; }
    await audio.RecordingNotificationManager.show({ title: "LUXIPANEL · Voz en tiempo real", contentText: "Micrófono activo · toca para abrir el panel", paused: false });
    if (s.canceled || !isCurrent()) { await audio.RecordingNotificationManager.hide(); await audio.AudioManager.setAudioSessionActivity(false); await stopRealtimeVoice(); return; }
    audio.AudioManager.observeAudioInterruptions(true);
    s.subscriptions.push(audio.AudioManager.addSystemEventListener("interruption", event => {
      if (event.type === "began") { muteRealtimeVoice(true); patch({ error: "Audio interrumpido. Reactiva el micrófono cuando puedas continuar." }); }
    }));
    s.subscriptions.push(audio.RecordingNotificationManager.addEventListener("recordingNotificationPause", () => muteRealtimeVoice(true)));
    s.subscriptions.push(audio.RecordingNotificationManager.addEventListener("recordingNotificationResume", () => muteRealtimeVoice(false)));
    s.pcm = await createRealtimePcmAudio(audio, renew => {
      if (s.canceled || live !== s) return;
      if (renew) { clearTimeout(s.timer); void poll(s); }
      else { patch({error:"Se interrumpió la voz. Las tareas aceptadas continúan."}); void stopRealtimeVoice(); }
    });
    if (s.canceled) { await s.pcm.close(); return; }
    await connectNative(s);
    if (!s.canceled) { patch({ phase: "live" }); void poll(s); }
  } catch (error) {
    if (!s.canceled && live === s) {
      patch({ error: error instanceof Error ? error.message : "No se pudo iniciar la voz." });
      await stopRealtimeVoice();
    }
  }
}
export async function respondRealtimePermission(conversationId: string, requestId: string, decision: "allow" | "deny") {
  await request("POST", "/api/ai/agent/permission", { conversationId, requestId, decision });
}
export async function answerRealtimeAsk(taskId: string, askedAt: string, choice: number) {
  if (!live?.id) throw new Error("Reabre la voz o la conversación del trabajador para responder.");
  await request("POST", "/api/ai/realtime/sessions/" + live.id + "/answer", {taskId, askedAt, choice});
}
export async function cancelRealtimeTask(taskId: string) { await request("POST", "/api/ai/team/tasks/" + taskId + "/cancel", {}); }

async function connectNative(s: NativeSession): Promise<void> {
  async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    if (s.canceled || live !== s) throw new Error("La sesión terminó.");
    const result = await luxAssistantProxy<T>(s.panelId, s.token, method, path, body);
    if (!result) throw new Error("No se pudo comunicar con el panel.");
    return result;
  }
  const previous = await call<{ activeId: string | null }>("GET", "/api/ai/realtime/conversations/" + s.conversationId);
  if (previous.activeId) throw new Error("Hay una sesión anterior activa. Abre la conversación para finalizarla antes de iniciar otra.");
  const result = await call<{id:string}>("POST","/api/ai/realtime/sessions", {
    conversationId:s.conversationId,transport:"pcm",
  });
  s.id=result.id;
  if(s.canceled){await luxAssistantProxy(s.panelId,s.token,"DELETE","/api/ai/realtime/sessions/"+s.id);return;}
  patch({sessionId:s.id});
  const auth=await call<{token:string}>("GET","/api/auth/ws-token");
  if (s.canceled || live !== s) return;
  const direct=getDirect(s.panelId);
  if(!direct||!auth.token)throw new Error("La sesión del servidor terminó.");
  const url=new URL(direct.baseUrl+"/api/assistant/ws/realtime-audio");
  url.protocol=url.protocol==="https:"?"wss:":"ws:";
  url.searchParams.set("token",auth.token);url.searchParams.set("session",s.id);
  if(direct.bridgeSessionId)url.searchParams.set("bridge",direct.bridgeSessionId);
  await s.pcm!.connect(url.toString());
}
