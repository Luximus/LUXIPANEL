import { X } from "lucide-react";
import type { ConnectionErrorState } from "../features/app/viewModels";
import { formatMessage, getMessages } from "../i18n";
import styles from "./ConnectionErrorModal.module.css";

export function ConnectionErrorModal({
  state,
  onClose,
  language,
}: {
  state: ConnectionErrorState;
  onClose: () => void;
  language?: string;
}) {
  const t = getMessages(language);
  if (!state.open) return null;

  // Cuando el backend envía un motivo concreto (p. ej. llave SSH dañada o
  // rechazada por el servidor), mostramos ese mensaje accionable y NO la frase
  // genérica de "verifica que el servidor esté disponible e inténtalo de nuevo"
  // — sería engañosa porque el problema no se resuelve reintentando.
  const hasReason = Boolean(state.message);
  const description = state.panelName
    ? formatMessage(
        hasReason ? t.connectionError.descriptionShort : t.connectionError.description,
        { name: state.panelName },
      )
    : hasReason
      ? ""
      : t.connectionError.descriptionNoName;

  return (
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4"
    >
      <div
        className="lp-modal-card flex max-h-full w-full max-w-lg flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{t.connectionError.title}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={t.connectionError.closeAria}>
            <X size={18} />
          </button>
        </div>

        <div className="lp-modal-body">
          {description ? <p className={styles.description}>{description}</p> : null}
          {state.message ? <p className="lp-modal-error">{state.message}</p> : null}
        </div>

        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={onClose}>
            {t.connectionError.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
