// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * The call surface of `/panel/chat` — everything the Tolqia SDK renders lives
 * here and nowhere else.
 *
 * `@tolqia/react` ships no CSS and no strings by design: every component takes
 * a `className` per visual slot and a `labels` object. That is the whole reason
 * this file exists — it is the single place where the SDK meets LUXIPANEL's
 * design tokens (`bg-card`, `text-primary`, …) and the `chat.call.*` namespace.
 * Adding a call affordance elsewhere means passing it down from here, never
 * importing the SDK again.
 *
 * Two independent surfaces, deliberately not merged:
 *   • the INCOMING banner exists before any client does — the invitation
 *     arrives over the chat SSE stream and the Tolqia token is minted only on
 *     accept, so it is a pure prop-driven widget;
 *   • the OVERLAY (or its minimized pill) exists only once we hold a session.
 */
import { useCallback, useMemo, useState } from "react";
import { isSupported } from "@tolqia/client";
import type { ParticipantView } from "@tolqia/client";
import {
  CallOverlay,
  CallPill,
  CallProvider,
  IncomingCallBanner,
  useCallContext,
} from "@tolqia/react";
import { useChatI18n } from "../i18n";
import { initials } from "../format";
import { callClientOptions, langBadge, shouldRing, useCallPrefs } from "./call-prefs";
import { TolqiaPlanNotice } from "./TolqiaPlanNotice";
import type { ChatCallSession, ChatCallView } from "@/lib/chat-call";

/**
 * Can this browser take a call at all?
 *
 * Cached at module level: `isSupported()` probes `getUserMedia`, `AudioWorklet`
 * and `WebSocket`, none of which change during a page's life, and the "Llamar"
 * button asks on every render.
 */
let supportCache: { ok: boolean; missing: string[] } | null = null;
export function callsSupported(): { ok: boolean; missing: string[] } {
  if (supportCache) return supportCache;
  if (typeof window === "undefined") return { ok: false, missing: ["ssr"] };
  try {
    const report = isSupported();
    supportCache = { ok: !!report.ok, missing: report.missing ?? [] };
  } catch {
    supportCache = { ok: false, missing: ["unknown"] };
  }
  return supportCache;
}

/** Avatar shared by every SDK slot: initials of the DISPLAY NAME (bloque B). */
function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-8 w-8 text-[10px]" : "h-14 w-14 text-base";
  return (
    <span
      className={`inline-flex ${box} items-center justify-center rounded-full bg-primary/15 font-bold text-primary`}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

/**
 * The overlay body. It has to be a child of `CallProvider` (it reads the live
 * phase through the call context) which is why it is not inlined in
 * `ChatCallHost`.
 */
function CallSurface({
  call,
  displayNames,
  onLeave,
}: {
  call: ChatCallView;
  displayNames: ReadonlyMap<string, string>;
  onLeave: () => void;
}) {
  const t = useChatI18n();
  // `useCallContext` rather than `useCall`: the flattened hook drops `self`,
  // `lang` and `muted`, which the pill and the language badge both need.
  const { state, phase, elapsedSec, actions } = useCallContext();
  const [minimized, setMinimized] = useState(false);

  /** Display name for an SDK participant — the map first, the room's copy next. */
  const nameOf = useCallback(
    (p: { id: string; displayName?: string }) =>
      displayNames.get(p.id) ??
      call.participants.find((c) => c.id === p.id)?.displayName ??
      p.displayName ??
      t.unknownUser,
    [displayNames, call.participants, t.unknownUser],
  );

  const renderAvatar = useCallback(
    (p: ParticipantView) => <Avatar name={nameOf(p)} size={minimized ? "sm" : "md"} />,
    [nameOf, minimized],
  );

  const hangUp = useCallback(() => {
    void actions.leave().finally(onLeave);
  }, [actions, onLeave]);

  if (minimized) {
    return (
      <div className="pointer-events-auto fixed bottom-4 right-4 z-50">
        <CallPill
          participants={state.participants.filter((p) => p.id !== state.self?.id)}
          elapsedSec={elapsedSec}
          muted={state.muted}
          connecting={phase === "connecting" || phase === "ringing"}
          renderAvatar={renderAvatar}
          labels={{
            expand: t.call.expand,
            mute: t.call.mute,
            unmute: t.call.unmute,
            hangUp: t.call.hangUp,
            connecting: t.call.connecting,
          }}
          onExpand={() => setMinimized(false)}
          onToggleMute={() => actions.setMuted(!state.muted)}
          onHangUp={hangUp}
          className="border border-border bg-card text-foreground shadow-lg"
          buttonClassName="hover:bg-accent"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm motion-fade-in">
      <div className="flex h-[min(90vh,42rem)] w-[min(96vw,48rem)] flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl">
        {/* Aviso discreto cuando Tolqia rechazó la traducción y dijo por qué
            (límite del plan / plan inactivo). La llamada SÍ está en curso: es
            una nota, no un error. Se silencia solo si no hay motivo. */}
        <TolqiaPlanNotice call={call} />
        <CallOverlay
          renderAvatar={renderAvatar}
          showLanguageBadges
          onMinimize={() => setMinimized(true)}
          headerExtra={
            state.lang ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {langBadge(state.lang)}
              </span>
            ) : null
          }
          labels={{
            connecting: t.call.connecting,
            ringing: t.call.ringing,
            ended: t.call.ended,
            error: t.call.error,
            mute: t.call.mute,
            unmute: t.call.unmute,
            hangUp: t.call.hangUp,
            minimize: t.call.minimize,
            captions: t.call.captions,
            you: t.call.you,
            muted: t.call.muted,
            speaking: t.call.speaking,
          }}
          className="min-h-0"
          headerClassName="text-muted-foreground"
          tileClassName="rounded-lg border border-border bg-muted/40 p-4"
          captionsClassName="max-h-32 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2 text-xs"
          buttonClassName="bg-muted text-foreground hover:bg-accent"
          hangUpClassName="!bg-destructive !text-destructive-foreground hover:!bg-destructive/90"
        />
      </div>
    </div>
  );
}

export function ChatCallHost({
  session,
  incoming,
  displayNames,
  onAccept,
  onReject,
  onLeave,
}: {
  /** The call THIS user is in (token + wsUrl), or `null`. */
  session: ChatCallSession | null;
  /** A call ringing for this user that they have not answered yet. */
  incoming: ChatCallView | null;
  /** username → display name, shared by the whole messenger. */
  displayNames: ReadonlyMap<string, string>;
  onAccept: (call: ChatCallView) => void;
  onReject: (call: ChatCallView) => void;
  /** Called once the local client has left (hang up, or the room ended). */
  onLeave: () => void;
}) {
  const t = useChatI18n();
  const prefs = useCallPrefs();

  /**
   * MEMOIZED on the wsUrl alone: `CallProvider` tears the client down (and with
   * it the microphone) whenever this object's identity changes, which is
   * correct for "a different call" and a bug for "the parent re-rendered".
   */
  const options = useMemo(
    () => (session ? callClientOptions(session.wsUrl, prefs) : null),
    // `prefs.micDefault` only matters at connect time; re-reading the whole
    // object here would rebuild the client on any unrelated preference change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.wsUrl],
  );

  const caller = useMemo(() => {
    if (!incoming) return null;
    const host = incoming.participants.find((p) => p.id === incoming.startedBy) ?? incoming.participants[0];
    if (!host) return null;
    return {
      id: host.id,
      displayName: displayNames.get(host.id) ?? host.displayName ?? t.unknownUser,
      lang: langBadge(host.lang),
    };
  }, [incoming, displayNames, t.unknownUser]);

  return (
    <>
      {incoming && caller && (
        <div className="pointer-events-auto fixed left-1/2 top-4 z-50 w-[min(94vw,26rem)] -translate-x-1/2 motion-fade-in">
          <IncomingCallBanner
            caller={caller}
            // The ringtone is opt-in in the SDK for a reason: it needs a prior
            // user gesture, and "no molestar" / "sin tono" must silence it.
            ringtone={shouldRing(prefs)}
            renderAvatar={(c) => <Avatar name={c.displayName} size="sm" />}
            labels={{
              title: t.call.incoming,
              subtitle: t.call.incomingHint,
              accept: t.call.accept,
              reject: t.call.reject,
            }}
            onAccept={() => onAccept(incoming)}
            onReject={() => onReject(incoming)}
            className="border border-border bg-card text-foreground shadow-xl"
            acceptClassName="bg-emerald-600 text-white hover:bg-emerald-700"
            rejectClassName="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          />
        </div>
      )}

      {session && options && (
        <CallProvider options={options} autoJoin onEnded={onLeave}>
          <CallSurface call={session.call} displayNames={displayNames} onLeave={onLeave} />
        </CallProvider>
      )}
    </>
  );
}
