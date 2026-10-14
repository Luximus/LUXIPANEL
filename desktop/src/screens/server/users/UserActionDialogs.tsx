/**
 * Diálogos de acciones de usuario (desktop) — cambiar contraseña (2FA), llaves
 * SSH y generar llave de acceso. Port React DOM de
 * `app/src/screens/server/users/UserActionDialogs.tsx`, conservando i18n
 * (`getMessages(...).serverUsers`), contrato (`callServerApi` directo, token `""`)
 * y los MISMOS endpoints del panel. El portapapeles usa `navigator.clipboard`.
 */
import { useEffect, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { getMessages, formatMessage } from "../../../i18n";
import { callServerApi, unwrap } from "../../../api/serverApi";
import { ModalShell, DialogFooter, Field, InfoBox } from "./dialog-kit";
import type { ServerUser } from "./types";

type Ctx = {
  serverId: string;
  user: ServerUser;
  language?: string;
  onClose: () => void;
  onToast: (msg: string, err?: boolean) => void;
};

// ── Cambiar contraseña ──────────────────────────────────────────────────────
export function ChangePwDialog({ serverId, user, language, onClose, onToast }: Ctx) {
  const t = getMessages(language).serverUsers;
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    const res = await callServerApi(serverId, "", "PUT", `/api/users/${encodeURIComponent(String(user.id))}/password`, {
      password,
      totpCode: totp,
    });
    setSubmitting(false);
    const panel = res.data as { ok?: boolean; error?: string; code?: string } | undefined;
    if (res.ok && panel?.ok !== false) {
      onToast(t.toasts.passwordChanged);
      onClose();
    } else {
      onToast(panel?.error ?? t.toasts.saveFailed, true);
    }
  };

  return (
    <ModalShell
      title={formatMessage(t.titles.changePassword, { username: user.username })}
      onClose={onClose}
      closeLabel={t.changePwDialog.btnCancel}
      footer={
        <DialogFooter
          onCancel={onClose}
          cancelLabel={t.changePwDialog.btnCancel}
          onSubmit={() => void submit()}
          submitLabel={t.changePwDialog.btnSubmit}
          submitting={submitting}
        />
      }
    >
      <InfoBox tone="warn">{t.changePwDialog.infoText}</InfoBox>
      <Field label={t.changePwDialog.labelNewPassword} hint={t.changePwDialog.passwordStrengthHint}>
        <input type="password" className="lp-modal-input" value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label={t.changePwDialog.labelTotp}>
        <input type="text" inputMode="numeric" maxLength={10} className="lp-modal-input" value={totp} placeholder="000000" onChange={(e) => setTotp(e.target.value)} />
      </Field>
      <p className="text-[11px] text-base-content/50">{t.changePwDialog.twoFaHintBody}</p>
    </ModalShell>
  );
}

// ── Llaves SSH ──────────────────────────────────────────────────────────────
type SshKey = { id: string; comment?: string; type?: string; preview?: string };

export function SshKeysDialog({ serverId, user, language, onClose, onToast }: Ctx) {
  const t = getMessages(language).serverUsers;
  const [keys, setKeys] = useState<SshKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await callServerApi(serverId, "", "GET", `/api/users/${encodeURIComponent(String(user.id))}/ssh-keys`);
    const list = unwrap<SshKey[]>(res);
    setKeys(Array.isArray(list) ? list : []);
    setLoading(false);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    if (!newKey.trim()) return;
    setBusy(true);
    const res = await callServerApi(serverId, "", "POST", `/api/users/${encodeURIComponent(String(user.id))}/ssh-keys`, { key: newKey.trim() });
    setBusy(false);
    if (res.ok) {
      setNewKey("");
      onToast(t.toasts.keyAdded);
      void load();
    } else {
      onToast(t.toasts.saveFailed, true);
    }
  };
  const remove = async (id: string) => {
    const res = await callServerApi(serverId, "", "DELETE", `/api/users/${encodeURIComponent(String(user.id))}/ssh-keys/${encodeURIComponent(id)}`);
    if (res.ok) {
      onToast(t.toasts.keyDeleted);
      void load();
    } else {
      onToast(t.toasts.errorDeleting, true);
    }
  };

  return (
    <ModalShell title={formatMessage(t.titles.sshKeys, { username: user.username })} onClose={onClose} closeLabel={t.userDialog.btnCancel}>
      <InfoBox>{t.sshKeysDialog.info}</InfoBox>
      {loading ? (
        <p className="py-2 text-sm text-base-content/60">{t.sshKeysDialog.loadingKeys}</p>
      ) : keys.length === 0 ? (
        <p className="py-2 text-sm text-base-content/60">{t.empty.noSshKeys}</p>
      ) : (
        <div className="flex flex-col">
          {keys.map((k, idx) => (
            <div
              key={k.id}
              className={`flex items-center gap-2 py-2.5 ${idx === keys.length - 1 ? "" : "border-b border-base-300"}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-base-content">{k.comment || k.type || "ssh-key"}</p>
                {k.preview ? <p className="truncate text-[11px] text-base-content/50">{k.type} {k.preview}</p> : null}
              </div>
              <button type="button" className="btn btn-ghost btn-xs btn-circle text-error" onClick={() => void remove(k.id)} aria-label={t.labels.deleteKey}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3">
        <Field label={t.sshKeysDialog.labelAddKey}>
          <textarea className="lp-modal-textarea" value={newKey} placeholder={t.sshKeysDialog.placeholderKey} onChange={(e) => setNewKey(e.target.value)} />
        </Field>
        <button type="button" className="lp-modal-btn lp-modal-btn--primary mt-2" onClick={() => void add()} disabled={busy}>
          {busy ? <span className="loading loading-spinner loading-xs" /> : null}
          {t.sshKeysDialog.btnAddKey}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Generar llave de acceso (+ resultado) ───────────────────────────────────
type GenResult = { privateKey?: string; publicKey?: string; fingerprint?: string };

export function GenKeyDialog({ serverId, user, language, onClose, onToast }: Ctx) {
  const t = getMessages(language).serverUsers;
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);

  const generate = async () => {
    setSubmitting(true);
    const res = await callServerApi(serverId, "", "POST", `/api/users/${encodeURIComponent(String(user.id))}/login-key`, {
      passphrase: password,
      username: user.username,
    });
    setSubmitting(false);
    const data = unwrap<GenResult>(res);
    if (res.ok && data && (data.privateKey || data.publicKey)) {
      setResult(data);
    } else {
      const panel = res.data as { error?: string } | undefined;
      onToast(panel?.error ?? t.toasts.saveFailed, true);
    }
  };

  const copy = async (value: string | undefined) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      onToast(t.toasts.copied);
    } catch {
      onToast(t.toasts.saveFailed, true);
    }
  };

  if (result) {
    return (
      <ModalShell
        title={t.keyResultDialog.title}
        onClose={onClose}
        closeLabel={t.keyResultDialog.btnDone}
        footer={
          <button type="button" className="lp-modal-btn lp-modal-btn--primary w-full" onClick={onClose}>
            {t.keyResultDialog.btnDone}
          </button>
        }
      >
        <InfoBox tone="warn">{t.keyResultDialog.warning}</InfoBox>
        <Field label={t.keyResultDialog.labelPrivateKey}>
          <KeyBox value={result.privateKey ?? ""} />
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm mt-2" onClick={() => void copy(result.privateKey)}>
            <Copy size={14} /> {t.keyResultDialog.btnCopyPrivate}
          </button>
        </Field>
        <Field label={t.keyResultDialog.labelPublicKey}>
          <KeyBox value={result.publicKey ?? ""} />
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm mt-2" onClick={() => void copy(result.publicKey)}>
            <Copy size={14} /> {t.keyResultDialog.btnCopyPublic}
          </button>
        </Field>
        {result.fingerprint ? (
          <p className="text-[11px] text-base-content/50">
            {t.keyResultDialog.fingerprintLabel} {result.fingerprint}
          </p>
        ) : null}
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title={formatMessage(t.titles.genKey, { username: user.username })}
      onClose={onClose}
      closeLabel={t.genKeyDialog.btnCancel}
      footer={
        <DialogFooter
          onCancel={onClose}
          cancelLabel={t.genKeyDialog.btnCancel}
          onSubmit={() => void generate()}
          submitLabel={t.genKeyDialog.btnGenerate}
          submitting={submitting}
        />
      }
    >
      <InfoBox>{t.genKeyDialog.info}</InfoBox>
      <Field label={t.genKeyDialog.labelPassword} hint={t.genKeyDialog.passwordHelp}>
        <input type="password" className="lp-modal-input" value={password} autoComplete="off" onChange={(e) => setPassword(e.target.value)} />
      </Field>
    </ModalShell>
  );
}

function KeyBox({ value }: { value: string }) {
  return (
    <pre className="max-h-32 overflow-auto rounded-lg border border-base-300 bg-base-200/40 p-2 text-[11px] leading-relaxed text-base-content/80 whitespace-pre-wrap break-all">
      {value}
    </pre>
  );
}
