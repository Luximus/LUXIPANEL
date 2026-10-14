import * as React from "react";
import { Paperclip, X, Send } from "lucide-react";
import { createTicket, uploadTicketAttachment, type TicketAttachment } from "../api/client";
import { ticketStrings } from "./ticketHubStrings";

const MAX_ATTACHMENTS = 5;
type Priority = "critical" | "high" | "medium" | "low";

/** Panel "Nuevo ticket" del hub (desktop): asunto + prioridad + descripción + adjuntos. */
export default function NewTicketPanel({
  token,
  language,
  onCreated,
}: {
  token: string;
  language: string;
  onCreated: (ticketId: string) => void;
}) {
  const t = ticketStrings(language);
  const [title, setTitle] = React.useState("");
  const [priority, setPriority] = React.useState<Priority>("medium");
  const [description, setDescription] = React.useState("");
  const [attachments, setAttachments] = React.useState<TicketAttachment[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

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

  const submit = async () => {
    if (title.trim().length < 5) {
      setError(t.titleRequired);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { ticket } = await createTicket(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          attachments: attachments.length ? attachments : undefined,
        },
        token,
      );
      onCreated(ticket.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.createError;
      setError(/403|paid|pago/i.test(msg) ? t.needPaidData : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <label className="form-control">
          <span className="label-text mb-1 text-xs font-semibold opacity-80">{t.title}</span>
          <input className="input input-sm input-bordered w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.titlePlaceholder} maxLength={200} />
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-xs font-semibold opacity-80">{t.priority}</span>
          <select className="select select-sm select-bordered w-full" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="low">{t.prioLow}</option>
            <option value="medium">{t.prioMedium}</option>
            <option value="high">{t.prioHigh}</option>
            <option value="critical">{t.prioCritical}</option>
          </select>
        </label>
        <label className="form-control">
          <span className="label-text mb-1 text-xs font-semibold opacity-80">{t.description}</span>
          <textarea className="textarea textarea-bordered min-h-24 w-full text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t.descriptionPlaceholder} maxLength={5000} />
        </label>
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((a, i) => (
              <span key={`${a.url}-${i}`} className="badge badge-outline gap-1 py-3">
                <span className="max-w-32 truncate">{a.name ?? a.url.split("/").pop()}</span>
                <button type="button" onClick={() => setAttachments((p) => p.filter((_, idx) => idx !== i))} aria-label={t.delete}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}
      </div>
      <div className="flex items-end gap-2 border-t border-base-300 p-2 dark:border-zinc-700">
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => void pick(e.target.files)} />
        <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={() => fileRef.current?.click()} disabled={uploading || attachments.length >= MAX_ATTACHMENTS} aria-label={t.attach} title={t.attach}>
          <Paperclip size={16} />
        </button>
        <button type="button" className="btn btn-primary btn-sm flex-1" onClick={() => void submit()} disabled={saving || uploading}>
          <Send size={15} />
          {saving ? t.creating : t.create}
        </button>
      </div>
    </div>
  );
}
