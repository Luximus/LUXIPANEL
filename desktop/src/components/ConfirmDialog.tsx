import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import styles from "./ConfirmDialog.module.css";

export type ConfirmOptions = {
  /** Título del diálogo. Si se omite no se muestra encabezado de texto. */
  title?: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** Resalta la acción como destructiva (icono + botón rojo). */
  danger?: boolean;
};

type InternalState = ConfirmOptions & { resolve: (value: boolean) => void };

/**
 * Confirmación basada en modal (reemplaza el `confirm()` nativo). Devuelve una
 * promesa `boolean`, así que se usa igual que el global:
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ message, confirmLabel, cancelLabel, danger: true }))) return;
 *   ...
 *   return (<>{dialog}{resto}</>);
 *
 * El JSX `dialog` debe renderizarse una vez en el componente que usa el hook.
 * Se monta en un portal con z-index por encima de los modales de settings
 * (z-150) y step-up (z-170).
 */
export function useConfirm() {
  const [state, setState] = useState<InternalState | null>(null);
  const closingRef = useRef(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      closingRef.current = false;
      setState({ ...options, resolve });
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    setState((current) => {
      if (current && !closingRef.current) {
        closingRef.current = true;
        current.resolve(result);
      }
      return null;
    });
  }, []);

  const dialog = state
    ? createPortal(
        <div
          className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[185] grid place-items-center p-4"
        >
          <div
            className="lp-modal-card flex max-h-full w-full max-w-sm flex-col"
          >
            <div className="lp-modal-header">
              <h3 className="lp-modal-title">
                {state.danger ? (
                  <AlertTriangle
                    size={16}
                    className={styles.dangerIcon}
                  />
                ) : null}
                {state.title ?? ""}
              </h3>
              <button type="button" className="lp-modal-close" onClick={() => settle(false)} aria-label={state.cancelLabel}>
                <X size={18} />
              </button>
            </div>

            <div className="lp-modal-body">
              <p className={styles.messageText}>{state.message}</p>
            </div>

            <div className="lp-modal-footer">
              <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => settle(false)}>
                {state.cancelLabel}
              </button>
              <button
                type="button"
                className={`lp-modal-btn ${state.danger ? "lp-modal-btn--danger" : "lp-modal-btn--primary"}`}
                onClick={() => settle(true)}
                autoFocus
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return { confirm, dialog };
}
