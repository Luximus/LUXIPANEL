import { KeyRound, Link as LinkIcon, X } from "lucide-react";
import { getMessages } from "../i18n";
import styles from "./ConnectMethodModal.module.css";

export type ConnectMethodState = {
  open: boolean;
  panelId: string | null;
  panelName: string;
  hasSavedSsh: boolean;
};

export function ConnectMethodModal({
  state,
  onClose,
  onUseSaved,
  onUseLocalKey,
  language,
}: {
  state: ConnectMethodState;
  onClose: () => void;
  onUseSaved: () => void;
  onUseLocalKey: () => void;
  language?: string;
}) {
  if (!state.open) return null;
  const t = getMessages(language);

  return (
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4"
    >
      <div
        className="lp-modal-card flex max-h-full w-full max-w-sm flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{t.panelTable.actions.connect}{state.panelName ? `${t.connectMethod.separator}${state.panelName}` : ""}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={t.common.close}>
            <X size={18} />
          </button>
        </div>

        <div className="lp-modal-body flex flex-col gap-3">
          <p className={styles.description}>
            {t.connectMethod.description}
          </p>

          {state.hasSavedSsh ? (
            <button
              type="button"
              className="lp-connect-method-option"
              onClick={onUseSaved}
            >
              <span className="lp-connect-method-option__icon">
                <LinkIcon size={18} />
              </span>
              <span className="lp-connect-method-option__body">
                <strong>{t.connectMethod.savedTitle}</strong>
                <span>{t.connectMethod.savedSub}</span>
              </span>
            </button>
          ) : null}

          <button
            type="button"
            className="lp-connect-method-option"
            onClick={onUseLocalKey}
          >
            <span className="lp-connect-method-option__icon">
              <KeyRound size={18} />
            </span>
            <span className="lp-connect-method-option__body">
              <strong>{t.connectMethod.localTitle}</strong>
              <span>{t.connectMethod.localSub}</span>
            </span>
          </button>
        </div>

        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
