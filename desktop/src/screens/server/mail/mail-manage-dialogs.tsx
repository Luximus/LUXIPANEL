/**
 * mail-manage-dialogs (desktop) — subcomponentes autocontenidos de
 * `mail-manage`: formulario de Autorespuesta y diálogos de Firma, Contacto,
 * Calendario y Carpetas IMAP (crear/renombrar). Todos reciben su estado por
 * props; solo los consume `AccountManageScreen` (`mail-manage.tsx`).
 */
import { useEffect, useMemo, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { callServerApi } from "../../../api/serverApi";
import { getMessages } from "../../../i18n";
import type {
  MailAccount,
  Autoresponder,
  Signature as MailSignature,
  Contact,
  Calendar as MailCalendar,
  ManageFolder,
} from "./mail-types";
import {
  Modal,
  DialogFooter,
  Field,
  TextInput,
  TextArea,
  SelectInput,
  CheckboxRow,
  InfoBox,
  runServerMutation,
} from "./mail-ui";

const enc = encodeURIComponent;

// ── Autorespuesta ────────────────────────────────────────────────────────────
export function AutoresponderForm({
  serverId,
  account,
  language,
  current,
  loading,
  onSaved,
  onDelete,
  onError,
}: {
  serverId: string;
  account: MailAccount;
  language?: string;
  current: Autoresponder | null;
  loading: boolean;
  onSaved: () => void;
  onDelete: () => void;
  onError: (msg?: string) => void;
}) {
  const ar = getMessages(language).serverMail.manage.autoresponder;
  const [localPart, domainPart] = useMemo(() => {
    const at = account.address.indexOf("@");
    return at > 0 ? [account.address.slice(0, at), account.address.slice(at + 1)] : [account.address, ""];
  }, [account.address]);

  const [enabled, setEnabled] = useState(current?.enabled !== false);
  const [subject, setSubject] = useState(current?.subject ?? "");
  const [body, setBody] = useState(current?.body ?? "");
  const [interval, setIntervalH] = useState(current?.intervalHours != null ? String(current.intervalHours) : "24");
  const [fromName, setFromName] = useState(current?.fromName ?? "");
  const [busy, setBusy] = useState(false);
  const exists = !!current;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    setEnabled(current?.enabled !== false);
    setSubject(current?.subject ?? "");
    setBody(current?.body ?? "");
    setIntervalH(current?.intervalHours != null ? String(current.intervalHours) : "24");
    setFromName(current?.fromName ?? "");
  }, [current]);

  const submit = async () => {
    if (!subject.trim()) return onError(ar.errSubject);
    if (!body.trim()) return onError(ar.errBody);
    setBusy(true);
    const payload = {
      enabled,
      charset: current?.charset?.trim() || "utf-8",
      intervalHours: Number(interval) || 24,
      localPart: (current?.localPart || localPart).toLowerCase(),
      domain: (current?.domain || domainPart).toLowerCase(),
      fromName: fromName.trim() || null,
      subject: subject.trim(),
      body,
      isHtml: current?.isHtml === true,
    };
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "PUT", `/api/accounts/${enc(String(account.id))}/autoresponder`, payload));
    setBusy(false);
    if (out.ok) onSaved();
    else onError(out.error);
  };

  if (loading) return <div className="flex justify-center py-10"><span className="loading loading-spinner loading-md text-primary" /></div>;

  return (
    <div className="flex max-w-2xl flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
      <InfoBox>{exists ? ar.intro : ar.none}</InfoBox>
      <CheckboxRow checked={enabled} onChange={setEnabled} label={ar.labelEnabled} />
      <Field label={ar.labelFor}>
        <TextInput value={account.address} />
      </Field>
      <Field label={ar.labelSubject}>
        <TextInput value={subject} onChange={setSubject} placeholder={ar.placeholderSubject} />
      </Field>
      <Field label={ar.labelBody}>
        <TextArea value={body} onChange={setBody} placeholder={ar.placeholderBody} rows={5} />
      </Field>
      <Field label={ar.labelFromName}>
        <TextInput value={fromName ?? ""} onChange={setFromName} placeholder={ar.placeholderFromName} />
      </Field>
      <Field label={ar.labelInterval} hint={ar.intervalHint}>
        <TextInput value={interval} onChange={setIntervalH} type="number" placeholder="24" />
      </Field>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => void submit()} disabled={busy}>
          {busy ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />} {ar.save}
        </button>
        {exists ? (
          <button type="button" className="btn btn-error btn-sm gap-1.5" onClick={onDelete}>
            <Trash2 size={14} /> {ar.delete}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Diálogo de firma ─────────────────────────────────────────────────────────
export function SignatureDialog({
  serverId,
  accountId,
  account,
  language,
  mode,
  row,
  onClose,
  onSaved,
  onError,
}: {
  serverId: string;
  accountId: string;
  account: MailAccount;
  language?: string;
  mode: "create" | "edit";
  row?: MailSignature;
  onClose: () => void;
  onSaved: (created: boolean) => void;
  onError: (msg?: string) => void;
}) {
  const s = getMessages(language).serverMail.manage.signatures;
  const isCreate = mode === "create";
  const [senderName, setSenderName] = useState(row?.senderName ?? "");
  const [senderEmail, setSenderEmail] = useState(row?.senderEmail ?? "");
  const [linkToSender, setLinkToSender] = useState(row?.linkToSender === true);
  const [html, setHtml] = useState(row?.html ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const email = senderEmail.trim();
    const payload = { senderName: senderName.trim(), linkToSender, html, ...(email ? { senderEmail: email.toLowerCase() } : {}) };
    const op =
      !isCreate && row
        ? () => callServerApi(serverId, "", "PUT", `/api/accounts/${enc(accountId)}/signatures/${enc(String(row.id))}`, payload)
        : () => callServerApi(serverId, "", "POST", `/api/accounts/${enc(accountId)}/signatures`, payload);
    const out = await runServerMutation(serverId, op);
    setBusy(false);
    if (out.ok) onSaved(isCreate);
    else onError(out.error);
  };

  return (
    <Modal
      title={isCreate ? s.createTitle : s.editTitle}
      onClose={onClose}
      footer={<DialogFooter onCancel={onClose} cancelLabel={s.cancel} onSubmit={() => void submit()} submitLabel={isCreate ? s.create : s.save} submitting={busy} />}
    >
      <Field label={s.labelSenderName}>
        <TextInput value={senderName} onChange={setSenderName} placeholder={s.placeholderSenderName} />
      </Field>
      <Field label={s.labelSenderEmail}>
        <TextInput value={senderEmail} onChange={setSenderEmail} placeholder={account.address || s.placeholderSenderEmail} />
      </Field>
      <CheckboxRow checked={linkToSender} onChange={setLinkToSender} label={s.labelLinked} />
      <Field label={s.labelHtml} hint={s.htmlHint}>
        <TextArea value={html} onChange={setHtml} placeholder={s.placeholderHtml} rows={5} mono />
      </Field>
    </Modal>
  );
}

// ── Diálogo de contacto ──────────────────────────────────────────────────────
export function ContactDialog({
  serverId,
  accountId,
  language,
  mode,
  row,
  onClose,
  onSaved,
  onError,
}: {
  serverId: string;
  accountId: string;
  language?: string;
  mode: "create" | "edit";
  row?: Contact;
  onClose: () => void;
  onSaved: (created: boolean) => void;
  onError: (msg?: string) => void;
}) {
  const c = getMessages(language).serverMail.manage.contacts;
  const isCreate = mode === "create";
  const [email, setEmail] = useState(row?.email ?? "");
  const [name, setName] = useState(row?.displayName ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = email.trim();
    if (!e || !e.includes("@")) return onError(c.errEmail);
    setBusy(true);
    const payload = { email: e.toLowerCase(), displayName: name.trim() || null };
    const op =
      !isCreate && row
        ? () => callServerApi(serverId, "", "PUT", `/api/accounts/${enc(accountId)}/contacts/${enc(String(row.id))}`, payload)
        : () => callServerApi(serverId, "", "POST", `/api/accounts/${enc(accountId)}/contacts`, payload);
    const out = await runServerMutation(serverId, op);
    setBusy(false);
    if (out.ok) onSaved(isCreate);
    else onError(out.error);
  };

  return (
    <Modal
      title={isCreate ? c.createTitle : c.editTitle}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={<DialogFooter onCancel={onClose} cancelLabel={c.cancel} onSubmit={() => void submit()} submitLabel={isCreate ? c.create : c.save} submitting={busy} disabled={!email.trim()} />}
    >
      <Field label={c.labelEmail}>
        <TextInput value={email} onChange={setEmail} placeholder={c.placeholderEmail} />
      </Field>
      <Field label={c.labelName}>
        <TextInput value={name ?? ""} onChange={setName} placeholder={c.placeholderName} />
      </Field>
    </Modal>
  );
}

// ── Diálogo de calendario ────────────────────────────────────────────────────
export function CalendarDialog({
  serverId,
  accountId,
  language,
  mode,
  row,
  onClose,
  onSaved,
  onError,
}: {
  serverId: string;
  accountId: string;
  language?: string;
  mode: "create" | "edit";
  row?: MailCalendar;
  onClose: () => void;
  onSaved: (created: boolean) => void;
  onError: (msg?: string) => void;
}) {
  const c = getMessages(language).serverMail.manage.calendars;
  const isCreate = mode === "create";
  const [name, setName] = useState(row?.name ?? "");
  const [color, setColor] = useState(row?.color ?? "#3b82f6");
  const [description, setDescription] = useState(row?.description ?? "");
  const [timezone, setTimezone] = useState(row?.timezone ?? "UTC");
  const [enabled, setEnabled] = useState(row?.enabled !== false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const nm = name.trim();
    if (!nm) return onError(c.errName);
    setBusy(true);
    const payload = { name: nm, color: color.trim() || "#3b82f6", timezone: timezone.trim() || "UTC", description: description.trim() || null, enabled };
    const op =
      !isCreate && row
        ? () => callServerApi(serverId, "", "PUT", `/api/accounts/${enc(accountId)}/calendars/${enc(String(row.id))}`, payload)
        : () => callServerApi(serverId, "", "POST", `/api/accounts/${enc(accountId)}/calendars`, payload);
    const out = await runServerMutation(serverId, op);
    setBusy(false);
    if (out.ok) onSaved(isCreate);
    else onError(out.error);
  };

  return (
    <Modal
      title={isCreate ? c.createTitle : c.editTitle}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={<DialogFooter onCancel={onClose} cancelLabel={c.cancel} onSubmit={() => void submit()} submitLabel={isCreate ? c.create : c.save} submitting={busy} disabled={!name.trim()} />}
    >
      <Field label={c.labelName}>
        <TextInput value={name} onChange={setName} placeholder={c.placeholderName} />
      </Field>
      <Field label={c.labelColor} hint={c.colorHint}>
        <div className="flex items-center gap-2">
          <input type="color" className="h-9 w-12 shrink-0 rounded border border-base-300 bg-base-100" value={color || "#3b82f6"} onChange={(e) => setColor(e.target.value)} />
          <div className="flex-1">
            <TextInput value={color} onChange={setColor} placeholder="#3b82f6" />
          </div>
        </div>
      </Field>
      <Field label={c.labelDescription}>
        <TextArea value={description ?? ""} onChange={setDescription} placeholder={c.placeholderDescription} rows={3} />
      </Field>
      <Field label={c.labelTimezone}>
        <TextInput value={timezone} onChange={setTimezone} placeholder={c.placeholderTimezone} />
      </Field>
      <CheckboxRow checked={enabled} onChange={setEnabled} label={c.labelEnabled} />
    </Modal>
  );
}

// ── Crear carpeta IMAP ───────────────────────────────────────────────────────
export function FolderDialog({
  serverId,
  accountId,
  language,
  folders,
  onClose,
  onSaved,
  onError,
}: {
  serverId: string;
  accountId: string;
  language?: string;
  folders: ManageFolder[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg?: string) => void;
}) {
  const f = getMessages(language).serverMail.manage.folders;
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [busy, setBusy] = useState(false);
  const parentOptions = [{ value: "", label: f.parentNone }, ...folders.filter((x) => !x.isProtected).map((x) => ({ value: x.path, label: x.path }))];

  const submit = async () => {
    const nm = name.trim();
    if (!nm) return onError(f.errName);
    setBusy(true);
    const payload = { name: nm, ...(parent ? { parentPath: parent } : {}) };
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "POST", `/api/mail/${enc(accountId)}/folders`, payload));
    setBusy(false);
    if (out.ok) onSaved();
    else onError(out.error);
  };

  return (
    <Modal
      title={f.createTitle}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={<DialogFooter onCancel={onClose} cancelLabel={f.cancel} onSubmit={() => void submit()} submitLabel={f.create} submitting={busy} disabled={!name.trim()} />}
    >
      <Field label={f.labelName}>
        <TextInput value={name} onChange={setName} placeholder={f.placeholderName} />
      </Field>
      <Field label={f.labelParent} hint={f.parentHint}>
        <SelectInput value={parent} options={parentOptions} onChange={setParent} />
      </Field>
    </Modal>
  );
}

// ── Renombrar carpeta IMAP ───────────────────────────────────────────────────
export function FolderRenameDialog({
  serverId,
  accountId,
  language,
  folder,
  onClose,
  onSaved,
  onError,
}: {
  serverId: string;
  accountId: string;
  language?: string;
  folder: ManageFolder;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg?: string) => void;
}) {
  const f = getMessages(language).serverMail.manage.folders;
  const [name, setName] = useState(folder.name);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const nm = name.trim();
    if (!nm) return onError(f.errName);
    setBusy(true);
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "PUT", `/api/mail/${enc(accountId)}/folders`, { path: folder.path, name: nm }));
    setBusy(false);
    if (out.ok) onSaved();
    else onError(out.error);
  };

  return (
    <Modal
      title={f.renameTitle}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={<DialogFooter onCancel={onClose} cancelLabel={f.cancel} onSubmit={() => void submit()} submitLabel={f.rename} submitting={busy} disabled={!name.trim()} />}
    >
      <Field label={f.labelNewName}>
        <TextInput value={name} onChange={setName} placeholder={f.placeholderName} />
      </Field>
    </Modal>
  );
}
