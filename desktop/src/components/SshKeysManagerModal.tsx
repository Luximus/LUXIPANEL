import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { SshKeysTab, type DataTableSettingsAdvanced } from "./DataTableSettings";
import { getMessages } from "../i18n";

// Gestión de SSH keys como modal independiente. Se usa apilado ENCIMA del
// editor de panel (que vive en z-[140]) desde su tab SSH; por eso usa z-[160]
// y un portal a document.body, para no quedar atrapado en el stacking context
// del modal de configuración. Reutiliza SshKeysTab (mismo CRUD que el modal de
// ajustes de la tabla de servidores) para no duplicar lógica.
export function SshKeysManagerModal({
  open,
  onClose,
  advanced,
  language,
}: {
  open: boolean;
  onClose: () => void;
  advanced: DataTableSettingsAdvanced;
  language?: string;
}) {
  const t = getMessages(language);
  if (!open) return null;

  return createPortal(
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[160] grid place-items-center p-4"
    >
      <div
        className="lp-modal-card flex max-h-full w-full max-w-2xl flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{t.dataTableSettings.tabs.sshKeys}</h3>
          <button
            type="button"
            className="lp-modal-close"
            onClick={onClose}
            aria-label={t.dataTableSettings.closeAria}
          >
            <X size={18} />
          </button>
        </div>
        <div className="lp-modal-body">
          <SshKeysTab advanced={advanced} t={t} language={language} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
