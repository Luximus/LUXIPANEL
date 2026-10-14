import { getMessages } from "../i18n";
import { FormSheet } from "./ui/FormSheet";
import { StepUpCodeForm } from "./StepUpCodeForm";

/**
 * Drawer de formularios de re-verificación 2FA (step-up) para scopes de ACCIÓN (export,
 * eliminar, etc.). Es una envoltura fina sobre `StepUpCodeForm` (el cuerpo multi-método). El
 * gate de entrada a Seguridad ya NO usa este drawer: se muestra inline dentro del
 * panel de Seguridad con el mismo `StepUpCodeForm`.
 */
export function StepUpCodeModal({
  open,
  token,
  language,
  scope = "data-export",
  onClose,
  onVerified,
}: {
  open: boolean;
  token: string;
  language?: string;
  /** Operación que desbloquea el token (debe coincidir con el gate del backend). */
  scope?: string;
  onClose: () => void;
  onVerified: (stepUpToken: string) => void;
}) {
  const t = getMessages(language);
  return (
    <FormSheet visible={open} onClose={onClose} title={t.importExport.stepUp.title} language={language}>
      {open ? (
        <StepUpCodeForm
          token={token}
          scope={scope}
          language={language}
          onVerified={onVerified}
          onCancel={onClose}
        />
      ) : null}
    </FormSheet>
  );
}

export default StepUpCodeModal;
