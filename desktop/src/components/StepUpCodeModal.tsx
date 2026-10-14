import { ShieldCheck, X } from "lucide-react";
import { getMessages } from "../i18n";
import { StepUpCodeForm } from "./StepUpCodeForm";

type Props = {
  open: boolean;
  /** JWT de portal para autenticar la verificación step-up. */
  token: string;
  language?: string;
  /** Operación que desbloquea el token (debe coincidir con el gate del backend).
   *  Por defecto "data-export" para no romper el flujo de export existente. */
  scope?: string;
  onClose: () => void;
  /** Se invoca con el `stepUpToken` corto cuando cualquier método es válido. */
  onVerified: (stepUpToken: string) => void;
};

/**
 * Modal de re-verificación 2FA (step-up) para scopes de ACCIÓN (export, eliminar,
 * etc.). Envoltura fina sobre `StepUpCodeForm` (cuerpo multi-método). El gate de
 * entrada a Seguridad ya NO usa este modal: se muestra inline en el panel con el
 * mismo `StepUpCodeForm`. Reutiliza los estilos `lp-modal-*`.
 */
export function StepUpCodeModal({ open, token, language, scope = "data-export", onClose, onVerified }: Props) {
  const t = getMessages(language);
  if (!open) return null;
  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[170] grid place-items-center p-4">
      <div className="lp-modal-card flex max-h-full w-full max-w-sm flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">
            <ShieldCheck size={16} />
            {t.importExport.stepUp.title}
          </h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={t.common.close}>
            <X size={18} />
          </button>
        </div>
        <StepUpCodeForm token={token} scope={scope} language={language} onVerified={onVerified} onCancel={onClose} />
      </div>
    </div>
  );
}

export default StepUpCodeModal;
