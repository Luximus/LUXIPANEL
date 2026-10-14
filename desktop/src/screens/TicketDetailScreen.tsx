import { ArrowLeft, Check, Paperclip } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from './TicketDetailScreen.module.css';
import { ENV } from "../config/env";
import type { TicketDetailState } from "../features/app/viewModels";
import { fileExtBadge, humanFileSize, MAX_TICKET_ATTACHMENTS, useTicketUploads } from "../hooks/useTicketUploads";
import { getCurrentCustomer } from "../api/client";
import type { TicketAttachment, TicketMessage, TicketStatusHistoryEntry } from "../types/models";
import { UploadList } from "../components/UploadList";
import { UserAvatar } from "../components/ui/Avatar";
import { useAuth } from "../context/useAuth";
import { formatMessage, getMessages, type Messages } from "../i18n";

function formatDate(input: string, locale?: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleString(locale || undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function buildAttachmentUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${ENV.apiUrl}${url}`;
  return url;
}

function MessageAttachment({ att, t }: { att: TicketAttachment; t: Messages }) {
  const fullUrl = buildAttachmentUrl(att.url);
  const fallbackName = att.url.split("/").pop() || t.ticketDetail.attachmentFallbackName;
  const name = att.name || fallbackName;
  const ext = fileExtBadge(name, att.type || "");
  const sizeLabel = att.size ? humanFileSize(att.size) : "";
  const isImage = (att.type || "").startsWith("image/");

  return (
    <>
      <a className="ticket-message__attachment tooltip tooltip-bottom" href={fullUrl} target="_blank" rel="noreferrer noopener" download={name} data-tip={`${t.ticketDetail.downloadAttachmentPrefix} ${name}`}>
        <span className="ticket-message__attachment-icon">{ext}</span>
        <span className="ticket-message__attachment-info">
          <span className="ticket-message__attachment-name">{name}</span>
          {sizeLabel ? <span className="ticket-message__attachment-size">{sizeLabel}</span> : null}
        </span>
      </a>
      {isImage ? (
        <a href={fullUrl} target="_blank" rel="noreferrer noopener" aria-label={t.ticketDetail.downloadAttachmentAria}>
          <img className="ticket-message__attachment-image" src={fullUrl} alt={t.ticketDetail.attachmentAlt} loading="lazy" />
        </a>
      ) : null}
    </>
  );
}

function MessageBubble({
  message,
  isOwn,
  ownPhotoURL,
  t,
  language,
}: {
  message: TicketMessage;
  isOwn: boolean;
  ownPhotoURL: string | null;
  t: Messages;
  language?: string;
}) {
  const sideClass = isOwn ? "ticket-message--user" : "ticket-message--admin";
  const senderName = message.sender?.name || message.sender?.email || t.ticketDetail.unknownSender;
  // Only the current viewer's photoURL is available locally (Firebase). Others
  // fall back to initials since we don't fetch their photos.
  const photoURL = isOwn ? ownPhotoURL : null;
  return (
    <div className={`ticket-message ${sideClass}`}>
      <div className="ticket-message__row">
        <div className="ticket-message__avatar-slot">
          <UserAvatar src={photoURL} name={senderName} email={message.sender?.email} size={32} altFallback={t.common.avatarAlt} />
        </div>
        <div className="ticket-message__content">
          <div className="ticket-message__meta">
            <span className="ticket-message__sender">{senderName}</span>
            {message.isAdmin ? <span className="ticket-message__admin-tag">{t.ticketDetail.supportTag}</span> : null}
            <span>·</span>
            <span>{formatDate(message.createdAt, language)}</span>
          </div>
          <div className="ticket-message__bubble">
            {message.content
              ? message.content.split("\n").map((line, idx, arr) => (
                  <span key={idx}>
                    {line}
                    {idx < arr.length - 1 ? <br /> : null}
                  </span>
                ))
              : null}
            {message.attachments && message.attachments.length > 0 ? (
              <div className="ticket-message__attachments">
                {message.attachments.map((att, idx) => (
                  <MessageAttachment key={`${att.url}-${idx}`} att={att} t={t} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TicketDetailScreen({
  state,
  setState,
  onBack,
  sendReply,
  currentUserId,
  token,
  language,
}: {
  state: TicketDetailState;
  setState: (updater: (current: TicketDetailState) => TicketDetailState) => void;
  onBack: () => void;
  sendReply: (attachments: TicketAttachment[]) => void;
  currentUserId: string | null;
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
  // Resalta + enfoca el textarea de respuesta cuando se intenta enviar vacío.
  const replyRef = useRef<HTMLTextAreaElement | null>(null);
  const [replyInvalid, setReplyInvalid] = useState(false);

  const { userEmail, savedAccounts } = useAuth();
  const currentAccount = userEmail ? savedAccounts.find((entry) => entry.email === userEmail) : null;
  const ownPhotoURL = currentAccount?.photoURL ?? null;

  useEffect(() => {
    return () => uploads.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedMessages = useMemo(() => {
    const messages = state.ticket?.messages ?? [];
    return [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [state.ticket?.messages]);

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

  const onSendReply = () => {
    if (uploads.hasPending) {
      setState((current) => ({ ...current, error: t.ticketDetail.awaitUploads }));
      return;
    }
    // Un mensaje vacío sin adjuntos no es enviable: resalta y enfoca el textarea
    // (el controlador ya valida, pero aquí guiamos el foco al campo que falta).
    if (!state.replyContent.trim() && uploads.ready.length === 0) {
      setState((current) => ({ ...current, error: t.errors.replyEmpty }));
      setReplyInvalid(true);
      replyRef.current?.focus();
      return;
    }
    setReplyInvalid(false);
    sendReply(uploads.ready);
    uploads.clear();
  };

  const ticket = state.ticket;
  const priorityLabel = ticket
    ? t.ticketDetail.priorityLabels[ticket.priority as keyof typeof t.ticketDetail.priorityLabels] ?? ticket.priority
    : "";

  // Latest history entry per status, so each timeline step can show the
  // *most recent* change-to-this-status timestamp (reopen → resolved → reopen
  // would otherwise lose the latest stamp).
  const lastHistoryByStatus = useMemo(() => {
    const map = new Map<string, TicketStatusHistoryEntry>();
    const entries = ticket?.statusHistory ?? [];
    for (const entry of entries) {
      const existing = map.get(entry.toStatus);
      if (!existing || new Date(entry.changedAt).getTime() > new Date(existing.changedAt).getTime()) {
        map.set(entry.toStatus, entry);
      }
    }
    return map;
  }, [ticket?.statusHistory]);

  // Response state from the desktop user's perspective. The desktop is the
  // user-facing app, so "awaiting_user" means the user must reply.
  let responseStateKey: "responded" | "awaiting_user" | "awaiting_admin" | "no_response" = "no_response";
  if (ticket?.lastResponderRole === "admin") responseStateKey = "awaiting_user";
  else if (ticket?.lastResponderRole === "user") responseStateKey = "responded";
  const responseStateLabel = t.ticketTable.responseBadges[responseStateKey];

  const isLoading = state.loading && !ticket;

  return (
    <main className="ticket-page">
      <div className="ticket-page__shell">
        <aside className="ticket-page__sidebar">
          <button type="button" className="ticket-page__back" onClick={onBack}>
            <ArrowLeft size={14} className="lp-rtl-flip" />
            <span>{t.ticketDetail.backToTickets}</span>
          </button>

          <div className="card bg-base-100 border border-base-300 shadow-xs ticket-page__info-card">
            <div className="card-body p-4 gap-3">
              {!ticket && state.error ? (
                <p className="ticket-page__error">{state.error || t.ticketDetail.couldNotLoad}</p>
              ) : (
                <div className="ticket-page__info">
                  <div className="ticket-page__info-item">
                    <span className="ticket-page__info-label">{t.ticketDetail.priority}</span>
                    {isLoading ? (
                      <div className="lxp-skeleton ticket-page__skeleton-line ticket-page__skeleton-line--badge" />
                    ) : ticket ? (
                      <span className={`ticket-badge ticket-badge--${ticket.priority}`}>{priorityLabel}</span>
                    ) : null}
                  </div>

                  <div className="ticket-page__info-item">
                    <span className="ticket-page__info-label">{t.ticketDetail.responseState}</span>
                    {isLoading ? (
                      <div className="lxp-skeleton ticket-page__skeleton-line ticket-page__skeleton-line--badge" />
                    ) : (
                      <span className={`ticket-badge ticket-badge--response-${responseStateKey}`}>{responseStateLabel}</span>
                    )}
                  </div>

                  {ticket?.customer?.name || ticket?.customer?.email ? (
                    <div className="ticket-page__info-item">
                      <span className="ticket-page__info-label">{t.ticketDetail.requester}</span>
                      <span className="ticket-page__info-value">{ticket.customer?.name ?? ticket.customer?.email}</span>
                      {ticket.customer?.email && ticket.customer?.name ? (
                        <span className="ticket-page__info-sub">{ticket.customer.email}</span>
                      ) : null}
                    </div>
                  ) : null}

                  {ticket?.assignedAdmin?.name || ticket?.assignedAdmin?.email ? (
                    <div className="ticket-page__info-item">
                      <span className="ticket-page__info-label">{t.ticketDetail.assignedAdmin}</span>
                      <span className="ticket-page__info-value">{ticket.assignedAdmin?.name ?? ticket.assignedAdmin?.email}</span>
                      {ticket.assignedAdmin?.email && ticket.assignedAdmin?.name ? (
                        <span className="ticket-page__info-sub">{ticket.assignedAdmin.email}</span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="ticket-page__info-item">
                    <span className="ticket-page__info-label">{t.ticketDetail.progress}</span>
                    <ul className="timeline timeline-vertical timeline-compact ticket-page__timeline">
                      {(["open", "in_progress", "resolved", "closed"] as const).map((step, idx, all) => {
                        const currentStatus = ticket?.status ?? "open";
                        const currentIdx = all.indexOf(currentStatus as typeof all[number]);
                        const isDone = currentIdx >= 0 && idx < currentIdx;
                        const isCurrent = currentIdx >= 0 && idx === currentIdx;
                        const reached = isDone || isCurrent;
                        const nextReached = currentIdx >= 0 && idx + 1 <= currentIdx;
                        const entry = lastHistoryByStatus.get(step);
                        const dateLabel = reached && entry ? formatDate(entry.changedAt, language) : "";
                        const actorName = entry?.changedBy?.name || entry?.changedBy?.email || entry?.changedByEmail || "";
                        const actorLabel = reached && actorName ? formatMessage(t.ticketDetail.statusChangedBy, { actor: actorName }) : "";
                        return (
                          <li key={step}>
                            {idx > 0 ? <hr className={reached ? "bg-primary" : "bg-base-300"} /> : null}
                            <div className="timeline-middle">
                              <span
                                className={`ticket-page__timeline-dot ${
                                  isCurrent ? "is-current" : isDone ? "is-done" : "is-pending"
                                }`}
                              >
                                {isDone ? <Check size={10} strokeWidth={3} /> : null}
                              </span>
                            </div>
                            <div className={`timeline-end ticket-page__timeline-body ${isCurrent ? "is-current" : ""} ${reached ? "is-reached" : ""}`}>
                              <span className="ticket-page__timeline-label">{t.ticketDetail.statusLabels[step]}</span>
                              {dateLabel ? <span className="ticket-page__timeline-date">{dateLabel}</span> : null}
                              {actorLabel ? <span className="ticket-page__timeline-actor">{actorLabel}</span> : null}
                            </div>
                            {idx < all.length - 1 ? <hr className={nextReached ? "bg-primary" : "bg-base-300"} /> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Status changes only happen from the admin portal at /portal/support — see CLAUDE.md. */}
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="ticket-page__content">
          <header className="ticket-page__content-header">
            {isLoading ? (
              <div className="lxp-skeleton ticket-page__skeleton-line ticket-page__skeleton-line--title" />
            ) : (
              <h2 className="ticket-page__content-title">{ticket?.title ?? "—"}</h2>
            )}
            <div className="ticket-page__content-dates">
              <div className="ticket-page__content-date">
                <span className="ticket-page__content-date-label">{t.ticketDetail.date}</span>
                {isLoading ? (
                  <div className={`lxp-skeleton ticket-page__skeleton-line ${styles.skeletonDate}`} />
                ) : (
                  <span className="ticket-page__content-date-value">{ticket ? formatDate(ticket.createdAt, language) : "—"}</span>
                )}
              </div>
              <div className="ticket-page__content-date">
                <span className="ticket-page__content-date-label">{t.ticketDetail.updatedAt}</span>
                {isLoading ? (
                  <div className={`lxp-skeleton ticket-page__skeleton-line ${styles.skeletonDate}`} />
                ) : (
                  <span className="ticket-page__content-date-value">{ticket?.updatedAt ? formatDate(ticket.updatedAt, language) : "—"}</span>
                )}
              </div>
              {ticket?.closedAt ? (
                <div className="ticket-page__content-date">
                  <span className="ticket-page__content-date-label">{t.ticketDetail.closedAt}</span>
                  <span className="ticket-page__content-date-value">{formatDate(ticket.closedAt, language)}</span>
                </div>
              ) : null}
            </div>
          </header>

          <div className="ticket-page__chat">
            {isLoading ? (
              <div className="ticket-chat-skeleton">
                <div className="lxp-skeleton ticket-chat-skeleton__bubble ticket-chat-skeleton__bubble--right" />
                <div className="lxp-skeleton ticket-chat-skeleton__bubble ticket-chat-skeleton__bubble--left" />
                <div className="lxp-skeleton ticket-chat-skeleton__bubble ticket-chat-skeleton__bubble--right" />
              </div>
            ) : sortedMessages.length === 0 ? (
              <div className="ticket-chat__empty">{t.ticketDetail.noMessages}</div>
            ) : (
              sortedMessages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={currentUserId ? msg.senderId === currentUserId : !msg.isAdmin}
                  ownPhotoURL={ownPhotoURL}
                  t={t}
                  language={language}
                />
              ))
            )}
          </div>

          <div className="ticket-page__reply">
            <textarea
              ref={replyRef}
              className={`textarea textarea-bordered w-full${replyInvalid ? " input-error border-error" : ""}`}
              aria-invalid={replyInvalid || undefined}
              placeholder={t.ticketDetail.replyPlaceholder}
              rows={3}
              value={state.replyContent}
              onChange={(event) => { setState((current) => ({ ...current, replyContent: event.target.value })); if (replyInvalid) setReplyInvalid(false); }}
              maxLength={5000}
              disabled={!ticket || state.sending}
            />
            <UploadList entries={uploads.entries} onRemove={uploads.remove} language={language} />
            <div className="ticket-page__reply-actions">
              <button
                type="button"
                className="upload-toolbar__btn"
                onClick={onPickFiles}
                disabled={!ticket || uploads.remaining === 0}
              >
                <Paperclip size={14} />
                <span>{t.ticketDetail.attach}</span>
              </button>
              <span className="upload-toolbar__counter">{uploads.count} / {MAX_TICKET_ATTACHMENTS}</span>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={onFilesSelected}
              />
              <div className="ticket-page__reply-spacer" />
              <button
                type="button"
                className="lp-modal-btn lp-modal-btn--primary"
                disabled={!ticket || state.sending || uploads.hasPending}
                onClick={onSendReply}
              >
                {state.sending ? t.ticketDetail.sending : t.ticketDetail.send}
              </button>
            </div>
            {state.error ? <p className="lp-modal-error whitespace-pre-line">{state.error}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
