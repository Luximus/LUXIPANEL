// SPDX-License-Identifier: AGPL-3.0-only
import { useState } from "react";
import { PermissionView } from "./ask-permission";
import { MessageContent } from "../MessageContent";
import type { useRealtimeVoice, VoiceEvent } from "./use-realtime-voice";
type Voice = ReturnType<typeof useRealtimeVoice>;
function VoiceQuestion({ event, voice }: {event: VoiceEvent; voice: Voice}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const q = event.questions?.[0];
  return <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs space-y-2">
    {event.content && <MessageContent text={event.content} />}
    {event.questions.length === 1 && q?.type === "single" ? <>
      <p>{q.text}</p>
      <div className="flex flex-wrap gap-2">{q.options.map((label: string, i: number) =>
        <button type="button" key={i} disabled={busy || !voice.canRespond} className="rounded-full border border-border px-3 py-1 disabled:opacity-50"
          onClick={() => { if (!voice.canRespond) return; setBusy(true); setError(""); void voice.answer(event, i).catch(e => { setError(e.message); setBusy(false); }); }}>{label}</button>
      )}</div>
    </> : <p>Abre la conversación de la tarea para responder a sus preguntas.</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
/** Only actionable worker requests; transcripts and tasks use the regular history. */
export function RealtimeRequests({voice}: {voice: Voice}) {
  return <>
    {voice.asks.map(e => <VoiceQuestion key={e.taskId + e.askedAt} event={e} voice={voice} />)}
    {voice.permissions.map(e => <PermissionView key={e.event.id} request={e.event} interactive canApprove={voice.canRespond === true} onDecide={d => voice.permission(e, d)} />)}
  </>;
}
