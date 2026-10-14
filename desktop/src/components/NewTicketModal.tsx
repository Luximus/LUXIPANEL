import { Paperclip, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NewTicketState, TicketPriority } from "../features/app/viewModels";
import { MAX_TICKET_ATTACHMENTS, useTicketUploads } from "../hooks/useTicketUploads";
import { getCurrentCustomer } from "../api/client";
import { UploadList } from "./UploadList";
import type { TicketAttachment } from "../types/models";
import { getMessages } from "../i18n";
import styles from "./NewTicketModal.module.css";

export function NewTicketModal({
  state,
  setState,
  close,
  submit,
  token,
  language,
}: {
  state: NewTicketState;
  setState: (updater: (current: NewTicketState) => NewTicketState) => void;
  close: () => void;
  submit: (attachments: TicketAttachment[]) => void;
  token: string | null;
  language?: string;
}) {
  const t = getMessages(language);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  // Límite de subida dinámico por rol (MB → bytes); fallback 5 MB hasta cargar.
  const [maxUploadMb, setMaxUploadMb] = useState<number | null>(null);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      const me = await getCurrentCustomer(token);
      if (!cancelled && typeof me?.maxUploadMb === "number") setMaxUploadMb(me.maxUploadMb);
    })();
    return () => { cancelled = true; };
  }, [token]);
  const uploads = useTicketUploads(() => tokenRef.current, language, {
    maxFileBytes: (maxUploadMb ?? 5) * 1024 * 1024,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const wasOpen = useRef(state.open);

  // Enfoca el campo que falló al enviar (title/description obligatorios).
  useEffect(() => {
    if (state.failedField === "title") titleRef.current?.focus();
  }, [state.failedField]);

  const priorities = useMemo<{ value: TicketPriority; label: string }[]>(
    () => [
      { value: "low", label: t.newTicket.priorities.low },
      { value: "medium", label: t.newTicket.priorities.medium },
      { value: "high", label: t.newTicket.priorities.high },
      { value: "critical", label: t.newTicket.priorities.critical },
    ],
    [t],
  );

  useEffect(() => {
    if (wasOpen.current && !state.open) {
      uploads.clear();
    }
    wasOpen.current = state.open;
  }, [state.open, uploads]);

  if (!state.open) return null;

  const onPickFiles = () => fileInputRef.current?.click();

  const onFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const { rejected } = uploads.add(files);
    if (rejected.length > 0) {
      const message = rejected.map((r) => `${r.name}: ${r.reason}`).join("\n");
      setState((current) => ({ ...current, error: message }));
    }
    event.target.value = "";
  };

  const onSubmit = () => {
    if (uploads.hasPending) {
      setState((current) => ({ ...current, error: t.newTicket.awaitUploads }));
      return;
    }
    submit(uploads.ready);
  };

  return (
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4"
    >
      <div
        className="lp-modal-card flex max-h-full w-full max-w-lg flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{t.newTicket.title}</h3>
          <button type="button" className="lp-modal-close" onClick={close} aria-label={t.common.close}>
            <X size={18} />
          </button>
        </div>

        <div className="lp-modal-body flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={`text-sm font-medium ${styles.labelText}`}>{t.newTicket.titleField}</span>
            <input
              ref={titleRef}
              type="text"
              className={`input input-bordered w-full${state.failedField === "title" ? " input-error" : ""}`}
              aria-invalid={state.failedField === "title" || undefined}
              placeholder={t.newTicket.titlePlaceholder}
              value={state.title}
              onChange={(event) => setState((current) => ({ ...current, title: event.target.value, failedField: null }))}
              maxLength={200}
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={`text-sm font-medium ${styles.labelText}`}>{t.newTicket.priorityField}</span>
            <select
              className="select select-bordered w-full"
              value={state.priority}
              onChange={(event) => setState((current) => ({ ...current, priority: event.target.value as TicketPriority }))}
            >
              {priorities.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={`text-sm font-medium ${styles.labelText}`}>{t.newTicket.descriptionField}</span>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder={t.newTicket.descriptionPlaceholder}
              rows={6}
              value={state.description}
              onChange={(event) => setState((current) => ({ ...current, description: event.target.value }))}
              maxLength={5000}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className={`text-sm font-medium ${styles.labelText}`}>{t.newTicket.attachFiles}</span>
            <div className="upload-toolbar">
              <button
                type="button"
                className="upload-toolbar__btn"
                onClick={onPickFiles}
                disabled={uploads.remaining === 0}
              >
                <Paperclip size={14} />
                <span>{t.newTicket.attachButton}</span>
              </button>
              <span className="upload-toolbar__counter">{uploads.count} / {MAX_TICKET_ATTACHMENTS}</span>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={onFilesSelected}
              />
            </div>
            <UploadList entries={uploads.entries} onRemove={uploads.remove} language={language} />
          </div>

          {state.error ? <p className="lp-modal-error whitespace-pre-line">{state.error}</p> : null}
        </div>

        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={close}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--primary"
            disabled={state.saving || uploads.hasPending}
            onClick={onSubmit}
          >
            {state.saving ? t.newTicket.creating : t.newTicket.create}
          </button>
        </div>
      </div>
    </div>
  );
}
