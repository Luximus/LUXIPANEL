/**
 * settings-dialogs (desktop) — diálogos del módulo Ajustes, extraídos de
 * `SettingsModule.tsx` (espejo de `settings-dialogs` de la app): alta TOTP,
 * guardar token de conector, credencial de almacenamiento (R2/S3), detalle de
 * ticket a soporte y asignación de imagen de branding. Mutaciones vía
 * `runServerMutation` (contrato idéntico al de la app, token `""`).
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Send } from "lucide-react";
import { callServerApi, serverSettingsApi, unwrap } from "../../../api/serverApi";
import {
  DialogFooter,
  Field,
  fmtDate,
  ModalShell,
  pillClass,
  runServerMutation,
  statusKind,
  statusLabel,
  type StorageCred,
  type TicketDetail,
  type TokenConnector,
  type Tt,
} from "./settings-shared";

export function TotpSetupDialog({
  serverId,
  t,
  closeLabel,
  secret,
  onClose,
  onDone,
  onError,
}: {
  serverId: string;
  t: Tt;
  closeLabel: string;
  secret?: string;
  onClose: () => void;
  onDone: () => void;
  onError: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const enable = async () => {
    setBusy(true);
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "POST", "/api/auth/totp/enable", { code, token: code }));
    setBusy(false);
    if (out.ok) onDone();
    else onError();
  };
  return (
    <ModalShell
      title={t.security.twoFaTitle}
      onClose={onClose}
      closeLabel={closeLabel}
      maxW="max-w-md"
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.security.cancel} onSubmit={() => void enable()} submitLabel={t.security.enable} submitting={busy} />}
    >
      {secret ? (
        <Field label={t.security.secretLabel}>
          <code className="block select-all break-all rounded-md border border-base-300 bg-base-200 p-2.5 font-mono text-sm">{secret}</code>
        </Field>
      ) : (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">{t.toasts.error}</div>
      )}
      <Field label={t.security.codeLabel}>
        <input className="input input-bordered input-sm w-full" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" inputMode="numeric" maxLength={10} />
      </Field>
    </ModalShell>
  );
}

export function TokenCredDialog({
  serverId,
  t,
  closeLabel,
  connector,
  onClose,
  onSaved,
  onError,
}: {
  serverId: string;
  t: Tt;
  closeLabel: string;
  connector: TokenConnector;
  onClose: () => void;
  onSaved: () => void;
  onError: (e?: string) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "PUT", connector.base, { [connector.putKey]: value }));
    setBusy(false);
    if (out.ok) onSaved();
    else onError(out.error);
  };
  return (
    <ModalShell
      title={`${t.credentials.saveTitle} · ${connector.label}`}
      onClose={onClose}
      closeLabel={closeLabel}
      maxW="max-w-md"
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.credentials.cancel} onSubmit={() => void submit()} submitLabel={t.credentials.save} submitting={busy} disabled={!value.trim()} />}
    >
      <Field label={t.credentials.tokenLabel}>
        <input type="password" className="input input-bordered input-sm w-full" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t.credentials.tokenPlaceholder} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      </Field>
    </ModalShell>
  );
}

export function StorageCredDialog({
  serverId,
  t,
  closeLabel,
  provider,
  label,
  existing,
  onClose,
  onSaved,
  onError,
}: {
  serverId: string;
  t: Tt;
  closeLabel: string;
  provider: string;
  label: string;
  existing?: StorageCred;
  onClose: () => void;
  onSaved: () => void;
  onError: (e?: string) => void;
}) {
  const isR2 = provider === "r2";
  const [accountId, setAccountId] = useState(existing?.accountId ?? "");
  const [endpoint, setEndpoint] = useState(existing?.endpoint ?? "");
  const [region, setRegion] = useState(existing?.region ?? "");
  const [accessKeyId, setAccessKeyId] = useState(existing?.accessKeyId ?? "");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const body: Record<string, string> = { accessKeyId };
    if (isR2) body.accountId = accountId;
    else {
      body.endpoint = endpoint;
      body.region = region;
    }
    if (secret) body.secretAccessKey = secret;
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "PUT", `/api/backups/provider-creds/${provider}`, body));
    setBusy(false);
    if (out.ok) onSaved();
    else onError(out.error);
  };
  return (
    <ModalShell
      title={`${t.credentials.saveTitle} · ${label}`}
      onClose={onClose}
      closeLabel={closeLabel}
      maxW="max-w-md"
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.credentials.cancel} onSubmit={() => void submit()} submitLabel={t.credentials.save} submitting={busy} disabled={!accessKeyId.trim()} />}
    >
      {isR2 ? (
        <Field label={t.credentials.accountId}>
          <input className="input input-bordered input-sm w-full" value={accountId} onChange={(e) => setAccountId(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </Field>
      ) : (
        <>
          <Field label={t.credentials.endpoint}>
            <input className="input input-bordered input-sm w-full" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://s3.amazonaws.com" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          </Field>
          <Field label={t.credentials.region}>
            <input className="input input-bordered input-sm w-full" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="us-east-1" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          </Field>
        </>
      )}
      <Field label={t.credentials.accessKeyId}>
        <input className="input input-bordered input-sm w-full" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      </Field>
      <Field label={t.credentials.secretAccessKey} hint={existing?.hasSecret ? t.credentials.secretKeep : undefined}>
        <input type="password" className="input input-bordered input-sm w-full" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={existing?.hasSecret ? "••••••••" : ""} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      </Field>
    </ModalShell>
  );
}

export function TicketDetailModal({
  serverId,
  t,
  closeLabel,
  confirm,
  ticketId,
  onClose,
  onToast,
  onChanged,
}: {
  serverId: string;
  t: Tt;
  closeLabel: string;
  confirm: (opts: { title?: string; message: ReactNode; confirmLabel: string; cancelLabel: string; danger?: boolean }) => Promise<boolean>;
  ticketId: string;
  onClose: () => void;
  onToast: (m: string, err?: boolean) => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await callServerApi(serverId, "", "GET", `/api/report/tickets/${encodeURIComponent(ticketId)}`);
    setDetail(unwrap<TicketDetail>(res));
    setLoading(false);
  }, [serverId, ticketId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    void load();
  }, [load]);

  const sendReply = async () => {
    const content = reply.trim();
    if (!content) return;
    setBusy(true);
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "POST", `/api/report/tickets/${encodeURIComponent(ticketId)}/messages`, { content }));
    setBusy(false);
    if (out.ok) {
      setReply("");
      onToast(t.report.replyToast);
      void load();
      onChanged();
    } else onToast(out.error ?? t.toasts.error, true);
  };

  const closeTicket = async () => {
    const accepted = await confirm({ title: t.report.closeConfirmTitle, message: t.report.closeConfirm, confirmLabel: t.report.close, cancelLabel: t.report.cancel });
    if (!accepted) return;
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "PUT", `/api/report/tickets/${encodeURIComponent(ticketId)}/status`, { status: "closed" }));
    if (out.ok) {
      onToast(t.report.closedToast);
      void load();
      onChanged();
    } else onToast(out.error ?? t.toasts.error, true);
  };

  const isClosed = detail?.status === "closed";
  return (
    <ModalShell title={detail?.title ?? t.report.loading} onClose={onClose} closeLabel={closeLabel}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] text-base-content/50">{fmtDate(detail?.createdAt)}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${pillClass(statusKind(detail?.status))}`}>{statusLabel(t, detail?.status)}</span>
      </div>

      {loading ? (
        <p className="py-5 text-center text-sm text-base-content/50">{t.report.loading}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {(detail?.messages ?? []).map((m, i) => (
            <div key={i} className={`flex flex-col gap-1 ${m.isAdmin ? "items-start" : "items-end"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.isAdmin ? "bg-base-200 text-base-content/80" : "bg-primary/10 text-base-content/80"}`}>{m.content ?? ""}</div>
              <span className="text-[10px] text-base-content/50">{(m.isAdmin ? t.report.support : t.report.you) + " · " + fmtDate(m.createdAt)}</span>
            </div>
          ))}
          {(detail?.messages ?? []).length === 0 ? <p className="text-center text-xs text-base-content/50">—</p> : null}
        </div>
      )}

      {!loading && !isClosed ? (
        <div className="mt-3 flex flex-col gap-2">
          <textarea className="textarea textarea-bordered w-full" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t.report.replyPlaceholder} maxLength={5000} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm btn-ghost flex-1" onClick={() => void closeTicket()}>
              {t.report.close}
            </button>
            <button type="button" className="btn btn-sm btn-primary flex-1 gap-1.5" onClick={() => void sendReply()} disabled={busy || !reply.trim()}>
              {busy ? <span className="loading loading-spinner loading-xs" /> : <Send size={15} />} {t.report.reply}
            </button>
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}

export function AssignImageDialog({
  serverId,
  t,
  closeLabel,
  image,
  onClose,
  onAssigned,
  onError,
}: {
  serverId: string;
  t: Tt;
  closeLabel: string;
  image: { url: string; name: string };
  onClose: () => void;
  onAssigned: () => void;
  onError: (e?: string) => void;
}) {
  const [target, setTarget] = useState("layout_logo_primary");
  const [busy, setBusy] = useState(false);
  const options = [
    { value: "layout_logo_primary", label: t.appearance.targetLogoPrimary },
    { value: "layout_logo_sidebar", label: t.appearance.targetLogoSidebar },
    { value: "layout_logo_login", label: t.appearance.targetLogoLogin },
    { value: "layout_logo_footer", label: t.appearance.targetLogoFooter },
    { value: "layout_favicon", label: t.appearance.targetFavicon },
  ];
  const submit = async () => {
    setBusy(true);
    const out = await runServerMutation(serverId, () => serverSettingsApi.set(serverId, "", { key: target, value: image.url, category: "layout" }));
    setBusy(false);
    if (out.ok) onAssigned();
    else onError(out.error);
  };
  return (
    <ModalShell
      title={t.appearance.assignTitle}
      onClose={onClose}
      closeLabel={closeLabel}
      maxW="max-w-md"
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.appearance.cancel} onSubmit={() => void submit()} submitLabel={t.appearance.assign} submitting={busy} />}
    >
      <Field label={image.name}>
        <code className="block select-all break-all rounded-md border border-base-300 bg-base-200 p-2.5 font-mono text-xs">{image.url}</code>
      </Field>
      <Field label={t.appearance.assignTargetLabel}>
        <select className="select select-bordered select-sm w-full" value={target} onChange={(e) => setTarget(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
    </ModalShell>
  );
}
