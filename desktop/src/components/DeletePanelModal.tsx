import { X } from "lucide-react";
import type { DeletePanelState } from "../features/app/viewModels";
import { formatMessage, getMessages } from "../i18n";
import styles from "./DeletePanelModal.module.css";

export function DeletePanelModal({
  deletePanel,
  closeDeletePanel,
  confirmDeletePanel,
  language,
}: {
  deletePanel: DeletePanelState;
  closeDeletePanel: () => void;
  confirmDeletePanel: () => void;
  language?: string;
}) {
  const t = getMessages(language);
  if (!deletePanel.open) return null;

  // Description splits around the panel name so we can render it as <strong>.
  const descTemplate = t.deletePanel.description;
  const placeholder = "{name}";
  const placeholderIdx = descTemplate.indexOf(placeholder);
  const descBefore = placeholderIdx >= 0 ? descTemplate.slice(0, placeholderIdx) : descTemplate;
  const descAfter = placeholderIdx >= 0 ? descTemplate.slice(placeholderIdx + placeholder.length) : "";
  const fullDescription = formatMessage(descTemplate, { name: deletePanel.panelName });
  void fullDescription;

  return (
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4"
    >
      <div
        className="lp-modal-card flex max-h-full w-full max-w-lg flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{t.deletePanel.title}</h3>
          <button type="button" className="lp-modal-close" onClick={closeDeletePanel} aria-label={t.deletePanel.closeAria}>
            <X size={18} />
          </button>
        </div>

        <div className="lp-modal-body">
          <p className={styles.description}>
            {descBefore}
            <strong>{deletePanel.panelName}</strong>
            {descAfter}
          </p>
          {deletePanel.error ? <p className="lp-modal-error">{deletePanel.error}</p> : null}
        </div>

        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={closeDeletePanel}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--danger"
            disabled={deletePanel.saving}
            onClick={confirmDeletePanel}
          >
            {deletePanel.saving ? t.deletePanel.processing : t.deletePanel.delete}
          </button>
        </div>
      </div>
    </div>
  );
}
