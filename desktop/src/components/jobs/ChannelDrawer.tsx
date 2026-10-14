// Drawer "Seguimiento": canal/bitácora del requerimiento (Fase 6, IMPL-B, §D).
// Espejo de `openChannelModal`/`refreshChannel`/`loadEarlierMessages`/
// `renderChannelMessages`/`renderChannelGrants`/`openChannelStream` del web.
//
// SSE (Electron): EventSource NO admite headers → auth por `?access_token`
// (helper `jobsChannelStreamUrl` de IMPL-A). El payload es SOLO señal: al recibir
// `notification` con `kind === "jobs_channel"` del MISMO `requirementId` se
// re-fetchan mensajes+grants con auth (nunca se pinta del payload). Un único
// EventSource por drawer; el cleanup del effect lo garantiza.
//
// Secretos: los grants se comparten SIEMPRE por referencia (tipo + id/enlace/
// nota), JAMÁS material de llave. El upload usa `uploadChannelFile` (fetch crudo
// con solo `Authorization`). No se loguea token ni access_token.
import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import {
  getChannelMessages, postChannelMessage, uploadChannelFile,
  getGrants, shareAccess, revokeGrant, jobsChannelStreamUrl, jobsErrorKey,
  type AccessGrant, type ChannelAttachment, type ChannelMessage,
  type ChannelParticipant, type GrantResourceType,
} from "../../api/jobs";
import { fmtBytes, fmtDateTime } from "./utils";
import type { JobsMessages } from "./i18n";

const CHANNEL_PAGE = 30;
const GRANT_TYPES: GrantResourceType[] = ["server", "ssh_key", "group", "link", "note"];

function Attachments({ atts }: { atts: ChannelAttachment[] }) {
  if (!atts?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {atts.map((a, i) => {
        const isImg = (a.type || "").startsWith("image/");
        const name = a.name || a.url.split("/").pop() || "file";
        if (isImg) {
          return (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
              <img src={a.url} alt={name} loading="lazy" className="max-h-28 rounded-lg border border-base-300" />
            </a>
          );
        }
        return (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="badge badge-outline gap-1">
            📎 {name}{typeof a.size === "number" ? ` · ${fmtBytes(a.size)}` : ""}
          </a>
        );
      })}
    </div>
  );
}

export function ChannelDrawer({
  open, token, requirementId, j, onClose,
}: {
  open: boolean;
  token: string;
  requirementId: string | null;
  j: JobsMessages;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [participants, setParticipants] = useState<ChannelParticipant[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<ChannelAttachment[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Formulario de compartir acceso (por referencia).
  const [shareOpen, setShareOpen] = useState(false);
  const [shareType, setShareType] = useState<GrantResourceType>("server");
  const [shareRef, setShareRef] = useState("");
  const [shareLabel, setShareLabel] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Id propio (heurística del web): se marca como "mío" lo del participante
  // guardado tras el primer envío. Persistido en sessionStorage por scope.
  const selfIdRef = useRef<string | null>(null);

  const errKey = useCallback((err: unknown): string => {
    const path = jobsErrorKey(err).split(".");
    let node: unknown = j;
    for (const p of path) node = (node as Record<string, unknown>)?.[p];
    return typeof node === "string" ? node : (err instanceof Error ? err.message : j.error.generic);
  }, [j]);

  // Re-trae los últimos mensajes + grants con auth y repinta (best-effort).
  const refreshChannel = useCallback(async () => {
    if (!requirementId) return;
    try {
      const [msg, gr] = await Promise.all([
        getChannelMessages(token, requirementId, { limit: CHANNEL_PAGE }),
        getGrants(token, requirementId).catch(() => [] as AccessGrant[]),
      ]);
      // El backend devuelve los más recientes primero; mostramos ascendente.
      setMessages([...msg.messages].reverse());
      setParticipants(msg.participants);
      setNextBefore(msg.nextBefore);
      setGrants(gr);
    } catch (err) {
      setError(errKey(err));
    }
  }, [token, requirementId, errKey]);

  // Carga inicial al abrir / cambiar de requerimiento.
  useEffect(() => {
    if (!open || !requirementId) return;
    setMessages([]);
    setParticipants([]);
    setNextBefore(null);
    setGrants([]);
    setInput("");
    setPendingAttachments([]);
    setError("");
    setShareOpen(false);
    try { selfIdRef.current = sessionStorage.getItem(`lxp-jobs-self-id:${requirementId}`); } catch { selfIdRef.current = null; }
    void refreshChannel();
  }, [open, requirementId, refreshChannel]);

  // SSE en vivo: un único EventSource; re-fetch al recibir señal del mismo req.
  useEffect(() => {
    if (!open || !requirementId || !token) return;
    let es: EventSource;
    try {
      es = new EventSource(jobsChannelStreamUrl(requirementId, token));
    } catch {
      return;
    }
    es.addEventListener("notification", (ev) => {
      try {
        const p = JSON.parse((ev as MessageEvent).data);
        if (p?.data?.kind === "jobs_channel" && p.data.requirementId === requirementId) {
          void refreshChannel();
        }
      } catch { /* ignorar frames ajenos */ }
    });
    es.onerror = () => { /* noop: el runtime reconecta solo */ };
    return () => es.close();
  }, [open, requirementId, token, refreshChannel]);

  // Auto-scroll al fondo cuando llegan mensajes nuevos.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  if (!open || !requirementId) return null;

  async function loadEarlier() {
    if (!nextBefore) return;
    try {
      const res = await getChannelMessages(token, requirementId!, { limit: CHANNEL_PAGE, before: nextBefore });
      const older = [...res.messages].reverse();
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !known.has(m.id)), ...prev];
      });
      setNextBefore(res.nextBefore);
    } catch (err) {
      setError(errKey(err));
    }
  }

  async function onPickFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const att = await uploadChannelFile(token, requirementId!, file);
        setPendingAttachments((prev) => [...prev, att]);
      }
    } catch (err) {
      setError(errKey(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function send() {
    const content = input.trim();
    if (!content && !pendingAttachments.length) return;
    setSending(true);
    setError("");
    try {
      const msg = await postChannelMessage(token, requirementId!, content, pendingAttachments.length ? pendingAttachments : undefined);
      // Heurística de "mío": guarda el remitente del mensaje recién enviado.
      if (msg.senderId) {
        selfIdRef.current = msg.senderId;
        try { sessionStorage.setItem(`lxp-jobs-self-id:${requirementId}`, msg.senderId); } catch { /* ignore */ }
      }
      setInput("");
      setPendingAttachments([]);
      await refreshChannel();
    } catch (err) {
      setError(errKey(err) || j.channel.sendError);
    } finally {
      setSending(false);
    }
  }

  async function doShare() {
    const ref = shareRef.trim();
    if (!ref) return;
    setError("");
    try {
      await shareAccess(token, requirementId!, {
        resourceType: shareType,
        resourceRef: ref,
        label: shareLabel.trim() || undefined,
      });
      setShareRef("");
      setShareLabel("");
      setShareOpen(false);
      await refreshChannel();
    } catch (err) {
      setError(errKey(err) || j.grants.shareError);
    }
  }

  async function doRevoke(grantId: string) {
    setError("");
    try {
      await revokeGrant(token, requirementId!, grantId);
      await refreshChannel();
    } catch (err) {
      setError(errKey(err) || j.grants.revokeError);
    }
  }

  const authorLabel = (senderId: string | null): string => {
    const p = participants.find((x) => x.id === senderId);
    return p ? (p.displayName || p.email || "—") : "—";
  };

  return (
    <>
      <div className="fixed inset-0 z-[1304] bg-black/40" aria-hidden="true" onClick={onClose} />
      <aside className="fixed end-0 top-[var(--lp-titlebar-h)] z-[1305] flex h-[calc(100vh-var(--lp-titlebar-h))] w-full max-w-md flex-col border-s border-base-300 bg-base-100 shadow-2xl">
        <header className="flex items-center justify-between border-b border-base-300 p-3">
          <h3 className="font-bold">{j.channel.title}</h3>
          <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose} aria-label="x">
            <X size={16} />
          </button>
        </header>

        {/* Mensajes */}
        <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
          {nextBefore ? (
            <div className="text-center">
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => void loadEarlier()}>
                {j.channel.loadMore}
              </button>
            </div>
          ) : null}
          {!messages.length ? (
            <div className="py-8 text-center text-sm opacity-60">{j.channel.empty}</div>
          ) : (
            messages.map((m) => {
              const when = fmtDateTime(m.createdAt);
              if (m.kind === "system" || m.kind === "access_share") {
                const text = m.kind === "system" ? (m.content || j.channel.systemRevoked) : m.content;
                return (
                  <div key={m.id} className="text-center text-xs opacity-60">
                    {text} · {when}
                  </div>
                );
              }
              const mine = selfIdRef.current !== null && m.senderId === selfIdRef.current;
              return (
                <div key={m.id} className={`max-w-[85%] rounded-xl p-2 ${mine ? "ms-auto bg-primary/10" : "bg-base-200"}`}>
                  <div className="flex items-center justify-between gap-2 text-xs opacity-60">
                    <strong>{authorLabel(m.senderId)}</strong>
                    <time>{when}</time>
                  </div>
                  {m.content ? <p className="mt-0.5 whitespace-pre-wrap text-sm">{m.content}</p> : null}
                  <Attachments atts={m.attachments} />
                </div>
              );
            })
          )}
        </div>

        {/* Grants compartidos */}
        <div className="border-t border-base-300 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase opacity-70">{j.grants.label}</span>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShareOpen((v) => !v)}>
              {j.grants.share}
            </button>
          </div>
          {grants.length ? (
            <div className="space-y-1">
              {grants.map((g) => {
                const typeLabel = (j.grants.type as Record<string, string>)[g.resourceType] ?? g.resourceType;
                const revoked = g.status === "revoked";
                return (
                  <div key={g.id} className={`flex items-center justify-between gap-2 rounded-lg border border-base-300 px-2 py-1 text-sm ${revoked ? "opacity-50" : ""}`}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="badge badge-ghost badge-sm">{typeLabel}</span>
                      <span className="truncate">{g.label || g.resourceRef}</span>
                    </div>
                    {revoked ? (
                      <span className="badge badge-sm">{j.grants.revoked}</span>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => void doRevoke(g.id)}>
                        {j.grants.revoke}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs opacity-60">{j.grants.empty}</p>
          )}

          {shareOpen ? (
            <div className="mt-2 space-y-2 rounded-lg bg-base-200 p-2">
              <div className="flex gap-2">
                <select className="select select-bordered select-sm" value={shareType} onChange={(e) => setShareType(e.target.value as GrantResourceType)}>
                  {GRANT_TYPES.map((tpe) => (
                    <option key={tpe} value={tpe}>{(j.grants.type as Record<string, string>)[tpe] ?? tpe}</option>
                  ))}
                </select>
                <input
                  className="input input-bordered input-sm flex-1"
                  placeholder={j.grants.refLabel}
                  value={shareRef}
                  onChange={(e) => setShareRef(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <input
                  className="input input-bordered input-sm flex-1"
                  placeholder={j.grants.label}
                  value={shareLabel}
                  onChange={(e) => setShareLabel(e.target.value)}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void doShare()} disabled={!shareRef.trim()}>
                  {j.grants.share}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {error ? <p className="px-3 text-sm text-error">{error}</p> : null}

        {/* Adjuntos pendientes */}
        {pendingAttachments.length ? (
          <div className="flex flex-wrap gap-2 px-3 pb-1">
            {pendingAttachments.map((a, i) => (
              <span key={i} className="badge badge-outline gap-1">
                {a.name || "file"}
                <button type="button" onClick={() => setPendingAttachments((prev) => prev.filter((_, idx) => idx !== i))} aria-label="x">×</button>
              </span>
            ))}
          </div>
        ) : null}

        {/* Composer */}
        <div className="flex items-end gap-2 border-t border-base-300 p-3">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label={j.channel.attach}
            title={j.channel.attach}
          >
            {uploading ? <span className="loading loading-spinner loading-xs" /> : <Paperclip size={16} />}
          </button>
          <textarea
            className="textarea textarea-bordered min-h-[2.5rem] flex-1 resize-none"
            rows={1}
            placeholder={j.channel.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
            }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm btn-square"
            onClick={() => void send()}
            disabled={sending || (!input.trim() && !pendingAttachments.length)}
            aria-label={j.channel.send}
            title={j.channel.send}
          >
            {sending ? <span className="loading loading-spinner loading-xs" /> : <Send size={16} />}
          </button>
        </div>
      </aside>
    </>
  );
}
