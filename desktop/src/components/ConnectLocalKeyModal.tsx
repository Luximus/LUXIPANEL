import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import type React from "react";
import type { ConnectLocalKeyState } from "../features/app/viewModels";
import { formatMessage, getMessages } from "../i18n";
import styles from "./ConnectLocalKeyModal.module.css";

const MAX_KEY_BYTES = 32 * 1024;

export function ConnectLocalKeyModal({
  state,
  setState,
  close,
  submit,
  language,
}: {
  state: ConnectLocalKeyState;
  setState: React.Dispatch<React.SetStateAction<ConnectLocalKeyState>>;
  close: () => void;
  submit: () => void;
  language?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const privateKeyRef = useRef<HTMLTextAreaElement>(null);
  const [showPassphrase, setShowPassphrase] = useState(false);

  // Enfoca el primer campo obligatorio que falló al enviar.
  useEffect(() => {
    if (state.failedField === "username") usernameRef.current?.focus();
    else if (state.failedField === "privateKey") privateKeyRef.current?.focus();
  }, [state.failedField]);

  if (!state.open) return null;
  const t = getMessages(language);

  function patch(values: Partial<ConnectLocalKeyState>) {
    // Cualquier edición limpia la marca de campo fallido.
    setState((current) => ({ ...current, failedField: null, ...values }));
  }

  async function pickFromDevice() {
    // Prefer the native dialog (Electron). The file is read into memory once
    // and never copied into app storage.
    const api = window.electronApi;
    if (api?.pickKeyFile) {
      const result = await api.pickKeyFile();
      if (result.ok) patch({ privateKey: result.content.trim(), error: "" });
      else if (result.error) patch({ error: result.error });
      return;
    }
    fileInputRef.current?.click();
  }

  function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_KEY_BYTES) {
      patch({ error: t.connectLocalKey.fileTooLarge });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch({ privateKey: String(reader.result ?? "").trim(), error: "" });
    reader.onerror = () => patch({ error: t.connectLocalKey.fileReadFailed });
    reader.readAsText(file);
  }

  // El botón ya no se deshabilita por campos vacíos: al enviar se enfoca y
  // resalta el primer obligatorio que falte (en vez de quedar inerte).
  // La passphrase es OBLIGATORIA (2º factor del login managed). Sin ella no se envía.
  const canSubmit = !state.busy && state.passphrase.trim().length > 0;

  return (
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4"
    >
      <div
        className="lp-modal-card flex max-h-full w-full max-w-lg flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{t.connectLocalKey.title}</h3>
          <button
            type="button"
            className="lp-modal-close"
            onClick={close}
            aria-label={t.common.close}
            disabled={state.busy}
          >
            <X size={18} />
          </button>
        </div>

        <div className={`lp-modal-body ${styles.body}`}>
          <p className={styles.hint}>
            {formatMessage(t.connectLocalKey.hint, {
              panelName: state.panelName ? formatMessage(t.connectLocalKey.hintWith, { panelName: state.panelName }) : "",
            })}
          </p>

          <label className={`lp-modal-label ${styles.labelCol}`}>
            <span>{t.connectLocalKey.sshUserLabel}</span>
            <input
              ref={usernameRef}
              className={`lp-modal-input${state.failedField === "username" ? " lp-modal-input--error" : ""}`}
              aria-invalid={state.failedField === "username" || undefined}
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder={t.connectLocalKey.sshUserPlaceholder}
              value={state.username}
              disabled={state.busy}
              onChange={(e) => patch({ username: e.target.value.trim() })}
            />
          </label>

          <label className={`lp-modal-label ${styles.labelCol}`}>
            <span>{t.connectLocalKey.privateKeyLabel}</span>
            <textarea
              ref={privateKeyRef}
              className={`lp-modal-input${state.failedField === "privateKey" ? " lp-modal-input--error" : ""} ${styles.textarea}`}
              aria-invalid={state.failedField === "privateKey" || undefined}
              rows={6}
              autoComplete="off"
              spellCheck={false}
              placeholder={t.connectLocalKey.privateKeyPlaceholder}
              value={state.privateKey}
              disabled={state.busy}
              onChange={(e) => patch({ privateKey: e.target.value })}
            />
          </label>

          <div>
            <button
              type="button"
              className="lp-modal-btn lp-modal-btn--ghost"
              onClick={() => void pickFromDevice()}
              disabled={state.busy}
            >
              {t.connectLocalKey.pickFile}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pem,.key,.txt,.ppk,.openssh,*/*"
              className={styles.fileHidden}
              onChange={onFileChosen}
            />
          </div>

          <label className={`lp-modal-label ${styles.labelCol}`}>
            <span>{t.connectLocalKey.passphraseLabel}</span>
            <div className={styles.passphraseWrap}>
              <input
                className={`lp-modal-input ${styles.passphraseInput}`}
                type={showPassphrase ? "text" : "password"}
                autoComplete="off"
                placeholder={t.connectLocalKey.passphrasePlaceholder}
                value={state.passphrase}
                disabled={state.busy}
                onChange={(e) => patch({ passphrase: e.target.value })}
              />
              <button
                type="button"
                className={`lp-input-reveal ${styles.revealBtn} tooltip tooltip-left`}
                onClick={() => setShowPassphrase((v) => !v)}
                disabled={state.busy}
                aria-label={showPassphrase ? t.connectLocalKey.hidePassphraseAria : t.connectLocalKey.showPassphraseAria}
                data-tip={showPassphrase ? t.connectLocalKey.hideTooltip : t.connectLocalKey.showTooltip}
                style={{ ["--reveal-cursor" as string]: state.busy ? "not-allowed" : "pointer" }}
              >
                {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {state.error ? <p className="lp-modal-error">{state.error}</p> : null}
        </div>

        <div className="lp-modal-footer">
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--ghost"
            onClick={close}
            disabled={state.busy}
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--primary"
            onClick={submit}
            disabled={!canSubmit}
          >
            {state.busy ? t.connectLocalKey.connecting : t.connectLocalKey.connect}
          </button>
        </div>
      </div>
    </div>
  );
}
