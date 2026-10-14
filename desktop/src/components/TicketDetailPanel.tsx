import * as React from "react";
import { Paperclip, X, Send, Trash2, CheckCircle2, Download } from "lucide-react";
import {
  getTicket,
  sendTicketMessage,
  updateTicketStatus,
  deleteTicket,
  uploadTicketAttachment,
  type TicketDetail,
  type TicketAttachment,
} from "../api/client";
import {
  ticketStrings,
  tkStatusLabel,
  tkPriorityLabel,
  tkStatusClass,
  tkFormatDate,
  isImageAtt,
} from "./ticketHubStrings";

const MAX_ATTACHMENTS = 5;

/** Panel de DETALLE de ticket (desktop): timeline + hilo + responder con adjuntos
 *  + cerrar / eliminar. Espejo del web. */
export default function TicketDetailPanel({
  token,
  language,
  ticketId,
  onChanged,
  onDeleted,
}: {
  token: string;
  language: string;
  ticketId: string;
  onChanged?: () => void;
  onDeleted?: () => void;
}) {
  const t = ticketStrings(language);
  const [ticket, setTicket] = React.useState<TicketDetail | null>(null);
  const [error, setError] = React.useState("");
  const [reply, setReply] = React.useState("");
  const [attachments, setAttachments] = React.useState<TicketAttachment[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [acting, setActing] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const threadRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    setError("");
    try {
      const { ticket: data } = await getTicket(ticketId, token);
      setTicket(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.loadError);
    }
  }, [ticketId, token, t.loadError]);

  React.useEffect(() => {
    void load();
  }, [load]);
  React.useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ticket]);

  const closed = ticket?.status === "closed";

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        if (attachments.length >= MAX_ATTACHMENTS) break;
        const a = await uploadTicketAttachment(file, token).promise;
        setAttachments((prev) => [...prev, a]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submitReply = async () => {
    if (!reply.trim() && attachments.length === 0) return;
    setSending(true);
    setError("");
    try {
      await sendTicketMessage(ticketId, { content: reply.trim() || " ", attachments: attachments.length ? attachments : undefined }, token);
      setReply("");
      setAttachments([]);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.loadError);
    } finally {
      setSending(false);
    }
  };

  const act = async (fn: () => Promise<void>) => {
    setActing(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(/STEP_UP|2FA/i.test(msg) ? t.twoFaRequired : msg || t.loadError);
    } finally {
      setActing(false);
    }
  };
  const doClose = () => act(async () => { await updateTicketStatus(ticketId, "closed", token); await load(); onChanged?.(); });
  const doDelete = () => {
    if (!window.confirm(t.deleteConfirm)) return;
    void act(async () => { await deleteTicket(ticketId, token); onDeleted?.(); });
  };

  if (!ticket) {
    return <div className="flex min-h-0 flex-1 items-center justify-center"><p className="text-sm opacity-60">{error || t.loading}</p></div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-1.5 border-b border-base-300 p-3 dark:border-zinc-700">
        <div className="flex flex-wrap gap-1">
          <span className={`badge badge-sm ${tkStatusClass(ticket.status)}`}>{tkStatusLabel(t, ticket.status)}</span>
          <span className="badge badge-outline badge-sm">{tkPriorityLabel(t, ticket.priority)}</span>
        </div>
        <p className="text-sm font-bold">{ticket.title}</p>
        {ticket.statusHistory?.length ? (
          <div className="flex flex-wrap gap-1" aria-label={t.timeline}>
            {ticket.statusHistory.map((h) => (
              <span key={h.id} className="rounded-full bg-base-200 px-2 py-0.5 text-[0.66rem] opacity-70">
                {tkStatusLabel(t, h.toStatus)} · {tkFormatDate(h.changedAt, language)}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3" ref={threadRef}>
        {!ticket.messages?.length ? (
          <p className="my-4 text-center text-sm opacity-60">{t.noMessages}</p>
        ) : (
          ticket.messages.map((m) => (
            <div key={m.id} className={`max-w-[90%] rounded-lg border border-base-300 p-2 dark:border-zinc-700 ${m.isAdmin ? "self-start bg-base-200/50" : "self-end bg-primary/10"}`}>
              <div className="mb-0.5 flex justify-between gap-2 text-[0.66rem] opacity-60">
                <span className="font-bold">{m.isAdmin ? t.support : t.you}</span>
                <span>{tkFormatDate(m.createdAt, language)}</span>
              </div>
              {m.content.trim() ? <div className="whitespace-pre-wrap break-words text-sm">{m.content}</div> : null}
              {m.attachments?.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.attachments.map((a, i) =>
                    isImageAtt(a) ? (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                        <img src={a.url} alt={a.name ?? ""} className="h-24 w-24 rounded-md object-cover" loading="lazy" />
                      </a>
                    ) : (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-base-300 px-2 py-1 text-xs text-primary dark:border-zinc-700">
                        <Download size={13} />
                        <span className="max-w-32 truncate">{a.name ?? a.url.split("/").pop()}</span>
                      </a>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {error ? <p className="px-3 text-sm text-error">{error}</p> : null}

      {closed ? (
        <div className="flex items-center gap-2 border-t border-base-300 p-2 dark:border-zinc-700">
          <span className="flex-1 text-sm opacity-60">{t.closedNotice}</span>
          <button type="button" className="btn btn-outline btn-error btn-sm" onClick={doDelete} disabled={acting}><Trash2 size={14} />{t.delete}</button>
        </div>
      ) : (
        <>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => void pick(e.target.files)} />
          {attachments.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 px-2">
              {attachments.map((a, i) => (
                <span key={`${a.url}-${i}`} className="badge badge-outline gap-1 py-3">
                  <span className="max-w-32 truncate">{a.name ?? a.url.split("/").pop()}</span>
                  <button type="button" onClick={() => setAttachments((p) => p.filter((_, idx) => idx !== i))} aria-label={t.delete}><X size={12} /></button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex items-end gap-1.5 border-t border-base-300 p-2 dark:border-zinc-700">
            <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={() => fileRef.current?.click()} disabled={uploading || attachments.length >= MAX_ATTACHMENTS} aria-label={t.attach} title={t.attach}><Paperclip size={16} /></button>
            <textarea className="textarea textarea-bordered min-h-9 flex-1 text-sm" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t.replyPlaceholder} rows={1} maxLength={5000} />
            <button type="button" className="btn btn-primary btn-sm btn-square" onClick={() => void submitReply()} disabled={sending || uploading || (!reply.trim() && attachments.length === 0)} aria-label={t.send} title={t.send}><Send size={16} /></button>
          </div>
          <div className="flex items-center gap-2 border-t border-base-300 p-2 dark:border-zinc-700">
            <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={doClose} disabled={acting}><CheckCircle2 size={14} />{t.closeTicket}</button>
            <button type="button" className="btn btn-outline btn-error btn-sm" onClick={doDelete} disabled={acting}><Trash2 size={14} />{t.delete}</button>
          </div>
        </>
      )}
    </div>
  );
}
