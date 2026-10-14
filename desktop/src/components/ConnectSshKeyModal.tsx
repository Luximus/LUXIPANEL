import { KeyRound, X } from "lucide-react";
import type { ConnectKeyState } from "../features/app/viewModels";
import { getMessages } from "../i18n";
import styles from "./ConnectSshKeyModal.module.css";

export function ConnectSshKeyModal({
  state,
  onSelect,
  onClose,
  onConfirm,
  language,
}: {
  state: ConnectKeyState;
  onSelect: (keyId: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  language?: string;
}) {
  if (!state.open) return null;
  const t = getMessages(language);

  return (
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4"
    >
      <div
        className="lp-modal-card flex max-h-full w-full max-w-md flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{t.connectSshKey.title}{state.panelName ? `${t.connectMethod.separator}${state.panelName}` : ""}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={t.common.close}>
            <X size={18} />
          </button>
        </div>

        <div className="lp-modal-body flex flex-col gap-3">
          <p className={styles.description}>
            {t.connectSshKey.description}
          </p>

          <div className="flex flex-col gap-2">
            {state.keys.map((key) => {
              const selected = state.selectedKeyId === key.id;
              return (
                <button
                  key={key.id}
                  type="button"
                  className="lp-connect-method-option"
                  onClick={() => onSelect(key.id)}
                  aria-pressed={selected}
                  style={selected
                    ? {
                        borderColor: "var(--lp-brand)",
                        background: "color-mix(in srgb, var(--lp-brand) 8%, var(--lp-surface))",
                      }
                    : undefined}
                >
                  <span className="lp-connect-method-option__icon">
                    <KeyRound size={18} />
                  </span>
                  <span className="lp-connect-method-option__body">
                    <strong>{key.linuxUsername || t.panelEditor.noSshUser}</strong>
                    {key.fingerprint ? <span>{key.fingerprint}</span> : null}
                  </span>
                  <span
                    aria-hidden
                    className={styles.radioDot}
                    style={{
                      background: selected ? "var(--lp-brand)" : "transparent",
                      boxShadow: selected ? "inset 0 0 0 2px var(--lp-surface)" : "none",
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--primary"
            onClick={onConfirm}
            disabled={!state.selectedKeyId}
          >
            {t.panelTable.actions.connect}
          </button>
        </div>
      </div>
    </div>
  );
}
