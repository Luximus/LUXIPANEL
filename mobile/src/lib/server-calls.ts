import { realtimeMicrophoneActive } from "../features/assistant/input-lock";
import { useSyncExternalStore } from "react";
import {
  messagingApi,
  userRequest,
  type CallView,
  type CallSession,
} from "../api/serverUserApi";
import {
  getDirect,
  getDirectServerIds,
  subscribeDirectSessions,
} from "../api/serverApi";
import { subscribeServerChat } from "./server-chat-stream";
import { createAudioCall, type AudioCall } from "./audio-call-engine";
export type CallState = {
  serverId: string;
  session: CallSession | null;
  incoming: CallView | null;
  status: string;
  muted: boolean;
  translate: boolean;
  lang: string;
  captions: string[];
  error: string;
  ringtone?: boolean;
};
const listeners = new Set<() => void>();
let snapshot: CallState | null = null,
  engine: AudioCall | null = null,
  generation = 0;
const emit = () => {
  for (const listener of listeners) listener();
};
const patch = (value: Partial<CallState>) => {
  if (snapshot) {
    snapshot = { ...snapshot, ...value };
    emit();
  }
};
export const subscribeCalls = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getServerCallSnapshot = () => snapshot;
export const useServerCall = () =>
  useSyncExternalStore(subscribeCalls, getServerCallSnapshot);
export const reportCallError = (error: unknown) =>
  patch({ error: error instanceof Error ? error.message : "Error" });
export function attachServerCalls(serverId: string): () => void {
  let alive = true;
  const profile = userRequest<{ username: string }>(
    serverId,
    "GET",
    "/api/preferences",
  ).catch(() => null);
  const ended = new Set<string>();
  const preferences = () =>
    userRequest<{
      calls: {
        dnd: boolean;
        ringtone: string;
        language: string;
        translate: boolean;
        micDefault: string;
      };
    }>(serverId, "GET", "/api/preferences/chat");
  const off = subscribeServerChat(serverId, (event) => {
    if (!event.type.startsWith("chat:call:")) return;
    const data = event.data as { call?: CallView; event?: string };
    const call = data.call;
    if (!call) return;
    if (call.state === "ended") {
      ended.add(call.id);
      if (
        snapshot?.serverId === serverId &&
        (snapshot.session?.call.id === call.id ||
          snapshot.incoming?.id === call.id)
      )
        void releaseCall();
      return;
    }
    if (event.type === "chat:call:ring" && !snapshot?.session) {
      void Promise.all([profile, preferences()])
        .then(([me, prefs]) => {
          if (
            !alive ||
            !me ||
            ended.has(call.id) ||
            snapshot?.session ||
            call.startedBy === me.username ||
            !call.participants.some(
              (person) =>
                person.id === me.username && person.state === "ringing",
            )
          )
            return;
          if (prefs.calls.dnd) {
            void messagingApi(serverId)
              .reject(call.id)
              .catch(() => {});
            return;
          }
          snapshot = {
            serverId,
            session: null,
            incoming: call,
            status: "ringing",
            ringtone: prefs.calls.ringtone !== "off",
            muted: false,
            translate: prefs.calls.translate,
            lang: prefs.calls.language,
            captions: [],
            error: "",
          };
          emit();
        })
        .catch(() => {});
    }
  });
  return () => {
    alive = false;
    off();
    if (snapshot?.serverId === serverId) void releaseCall();
  };
}
async function join(serverId: string, session: CallSession) {
  if (realtimeMicrophoneActive()) throw new Error("Termina la voz del asistente antes de unirte a una llamada.");
  if (snapshot?.session) throw new Error("Ya tienes una llamada activa.");
  const version = ++generation;
  snapshot = {
    serverId,
    session,
    incoming: null,
    status: "connecting",
    muted: session.call.kind === "group",
    translate: false,
    lang: session.call.participants[0]?.lang ?? "es",
    captions: [],
    error: "",
  };
  emit();
  try {
    const target = getDirect(serverId);
    if (!target) throw new Error("La sesión del servidor terminó.");
    const prefs = await userRequest<{
      calls: { micDefault: string; language: string; translate: boolean };
    }>(serverId, "GET", "/api/preferences/chat");
    if (version !== generation) return;
    patch({
      muted:
        session.call.kind === "group" || prefs.calls.micDefault === "muted",
      lang: prefs.calls.language,
      translate: prefs.calls.translate && session.call.translation.enabled,
    });
    const candidate = await createAudioCall(
      session,
      target.baseUrl,
      (event) => {
        if (version !== generation) return;
        if (event.caption)
          patch({
            captions: [...(snapshot?.captions ?? []), event.caption].slice(
              -100,
            ),
          });
        if (event.status) patch({ status: event.status });
        if (event.error) patch({ error: event.error });
        if (event.muted !== undefined) patch({ muted: event.muted });
        if (event.status === "closed" || event.status === "ended")
          void releaseCall();
      },
      {
        muted: snapshot?.muted ?? false,
        lang: prefs.calls.language,
        translate: prefs.calls.translate && session.call.translation.enabled,
      },
    );
    if (version !== generation) {
      await candidate.close();
      return;
    }
    engine = candidate;
    engine.setMuted(snapshot?.muted ?? false);
    patch({ status: "active" });
  } catch (error) {
    if (version === generation) {
      patch({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "No se pudo conectar la llamada.",
      });
      await messagingApi(serverId)
        .end(session.call.id)
        .catch(() => {});
    }
  }
}
export async function startServerCall(serverId: string, convId: string) {
  if (snapshot?.session) throw new Error("Ya tienes una llamada activa.");
  const target = getDirect(serverId);
  const session = await messagingApi(serverId).startCall(convId);
  if (target !== getDirect(serverId))
    throw new Error("La sesión del servidor cambió.");
  await join(serverId, session);
}
export async function acceptServerCall() {
  if (!snapshot?.incoming) return;
  const { serverId, incoming } = snapshot;
  const target = getDirect(serverId);
  const session = await messagingApi(serverId).accept(incoming.id);
  if (target !== getDirect(serverId))
    throw new Error("La sesión del servidor cambió.");
  await join(serverId, session);
}
export async function rejectServerCall() {
  if (!snapshot?.incoming) return;
  const { serverId, incoming } = snapshot;
  await messagingApi(serverId).reject(incoming.id);
  await releaseCall();
}
export async function endServerCall() {
  const owned = snapshot;
  await releaseCall();
  if (owned?.session)
    await messagingApi(owned.serverId).end(owned.session.call.id);
}
async function releaseCall() {
  generation++;
  const old = engine;
  engine = null;
  snapshot = null;
  emit();
  await old?.close().catch(() => {});
}
export function muteServerCall() {
  if (!snapshot) return;
  const muted = !snapshot.muted;
  engine?.setMuted(muted);
  patch({ muted });
}
export function translateServerCall(lang: string, translate: boolean) {
  engine?.setLanguage(lang, translate);
  patch({ lang, translate });
}

/** Services follow authenticated direct sessions, independent of module visibility. */
export function initializeServerCalls(): () => void {
  const subscriptions = new Map<
    string,
    { jwt: string; baseUrl: string; close: () => void }
  >();
  const synchronize = () => {
    const ids = new Set(getDirectServerIds());
    for (const [id, entry] of subscriptions) {
      const target = getDirect(id);
      if (
        !ids.has(id) ||
        target?.jwt !== entry.jwt ||
        target.baseUrl !== entry.baseUrl
      ) {
        entry.close();
        subscriptions.delete(id);
      }
    }
    for (const id of ids) {
      const target = getDirect(id);
      if (target && !subscriptions.has(id))
        subscriptions.set(id, {
          jwt: target.jwt,
          baseUrl: target.baseUrl,
          close: attachServerCalls(id),
        });
    }
  };
  synchronize();
  const off = subscribeDirectSessions(synchronize);
  return () => {
    off();
    for (const entry of subscriptions.values()) entry.close();
  };
}
