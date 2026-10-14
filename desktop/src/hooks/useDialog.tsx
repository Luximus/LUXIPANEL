import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { getMessages } from "../i18n";
import styles from "./useDialog.module.css";

type DialogTone = "default" | "danger";

type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

type AlertOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  tone?: DialogTone;
};

type PromptOptions = {
  title: string;
  message?: ReactNode;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  maxLength?: number;
  required?: boolean;
  tone?: DialogTone;
};

type DialogState =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: "alert"; opts: AlertOptions; resolve: () => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (value: string | null) => void };

export type DialogApi = {
  /** Ask the user to confirm/cancel. Resolves `true` when confirmed. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Show an informational message with a single dismiss button. */
  alert: (opts: AlertOptions) => Promise<void>;
  /** Ask the user for a text value. Resolves the string, or `null` if cancelled. */
  prompt: (opts: PromptOptions) => Promise<string | null>;
  /** Render this inside the component tree to surface the active dialog. */
  element: ReactNode;
};

/**
 * Promise-based, in-app replacement for `window.confirm` / `window.alert` /
 * `window.prompt`. Reuses the shared `lp-modal-*` design system so dialogs match
 * the rest of the desktop UI instead of the bare Electron/Chromium chrome.
 *
 * Usage:
 *   const dialog = useDialog();
 *   if (!(await dialog.confirm({ title: "…", tone: "danger" }))) return;
 *   // …and render {dialog.element} somewhere in the returned JSX.
 */
export function useDialog(language?: string): DialogApi {
  const t = getMessages(language);
  const [state, setState] = useState<DialogState | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({ kind: "confirm", opts, resolve })),
    [],
  );

  const alert = useCallback(
    (opts: AlertOptions) =>
      new Promise<void>((resolve) => setState({ kind: "alert", opts, resolve })),
    [],
  );

  const prompt = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue(opts.defaultValue ?? "");
        setState({ kind: "prompt", opts, resolve });
      }),
    [],
  );

  const settle = useCallback(
    (confirmed: boolean) => {
      if (!state) return;
      if (state.kind === "confirm") state.resolve(confirmed);
      else if (state.kind === "alert") state.resolve();
      else state.resolve(confirmed ? value.trim() : null);
      setState(null);
    },
    [state, value],
  );

  // Move focus to the most useful control once a dialog opens: the input for a
  // prompt, otherwise the confirm button (so Enter works immediately). Los
  // diálogos NO se cierran con Escape ni con click en el backdrop: solo por
  // los botones (X / Cancelar) para no perder lo que el usuario escribe.
  useEffect(() => {
    if (!state) return;
    const id = window.setTimeout(() => {
      if (state.kind === "prompt") inputRef.current?.focus();
      else confirmBtnRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [state]);

  let element: ReactNode = null;
  if (state) {
    const { opts } = state;
    const tone = opts.tone ?? "default";
    const isPrompt = state.kind === "prompt";
    const isAlert = state.kind === "alert";
    const cancelLabel = !isAlert ? (state.opts as ConfirmOptions | PromptOptions).cancelLabel ?? t.common.cancel : "";
    const confirmLabel = opts.confirmLabel ?? (isAlert ? t.common.understood : t.common.confirm);
    const confirmDisabled = isPrompt && (state.opts.required ?? false) && value.trim().length === 0;

    element = (
      <div
        className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[200] grid place-items-center p-4"
      >
        <div
          className="lp-modal-card flex w-full max-w-md flex-col"
          role="dialog"
          aria-modal="true"
          onKeyDown={(event) => {
            if (event.key === "Enter" && isPrompt && !confirmDisabled) settle(true);
          }}
        >
          <div className="lp-modal-header">
            <h3 className={`lp-modal-title ${styles.modalTitle}`}>
              {tone === "danger" ? <AlertTriangle size={18} className={styles.dangerIcon} /> : null}
              <span>{opts.title}</span>
            </h3>
            <button type="button" className="lp-modal-close" onClick={() => settle(false)} aria-label={t.common.close}>
              <X size={18} />
            </button>
          </div>

          <div className={`lp-modal-body ${styles.modalBodyInner}`}>
            {opts.message ? (
              <p className={styles.message}>{opts.message}</p>
            ) : null}
            {isPrompt ? (
              <label className={`lp-modal-label ${styles.promptLabel}`}>
                {state.opts.label ? <span>{state.opts.label}</span> : null}
                <input
                  ref={inputRef}
                  className="lp-modal-input"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={value}
                  maxLength={state.opts.maxLength}
                  placeholder={state.opts.placeholder}
                  onChange={(event) => setValue(event.target.value)}
                />
              </label>
            ) : null}
          </div>

          <div className="lp-modal-footer">
            {!isAlert ? (
              <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => settle(false)}>
                {cancelLabel}
              </button>
            ) : null}
            <button
              ref={confirmBtnRef}
              type="button"
              className={`lp-modal-btn ${tone === "danger" ? "lp-modal-btn--danger" : "lp-modal-btn--primary"}`}
              onClick={() => settle(true)}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return { confirm, alert, prompt, element };
}
