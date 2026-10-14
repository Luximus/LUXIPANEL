import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { getMessages } from "../i18n";
import { loadSessionState } from "../lib/session-state";

export type ToastVariant = "success" | "error" | "info" | "warning";

export type ToastOptions = {
  /**
   * Heading shown above the message. Omit to use the per-variant default
   * (e.g. "Éxito"/"Error"); pass `null` or `""` to render the message alone.
   */
  title?: string | null;
  /** Auto-dismiss delay in ms. `0` keeps the toast until dismissed manually. */
  duration?: number;
};

type ToastEntry = {
  id: string;
  variant: ToastVariant;
  title: string | null;
  message: ReactNode;
  duration: number;
};

export type ToastApi = {
  success: (message: ReactNode, opts?: ToastOptions) => string;
  error: (message: ReactNode, opts?: ToastOptions) => string;
  info: (message: ReactNode, opts?: ToastOptions) => string;
  warning: (message: ReactNode, opts?: ToastOptions) => string;
  /** Generic entry point; the convenience helpers above delegate to this. */
  show: (input: { variant: ToastVariant; message: ReactNode } & ToastOptions) => string;
  /** Remove a specific toast (by the id returned when it was shown). */
  dismiss: (id: string) => void;
  /** Remove every visible toast. */
  clear: () => void;
};

// Errors linger longer than confirmations so the user can read what failed.
const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  info: 4500,
  warning: 5500,
  error: 6000,
};

// Cap the stack: extra toasts evict the oldest so the screen never floods.
const MAX_VISIBLE = 4;

// Keep in sync with the `lp-toast-out` animation duration in index.css.
const EXIT_MS = 200;

const VARIANT_META: Record<
  ToastVariant,
  { alertClass: string; Icon: typeof CheckCircle2; role: "status" | "alert"; live: "polite" | "assertive" }
> = {
  success: { alertClass: "alert-success", Icon: CheckCircle2, role: "status", live: "polite" },
  error: { alertClass: "alert-error", Icon: XCircle, role: "alert", live: "assertive" },
  info: { alertClass: "alert-info", Icon: Info, role: "status", live: "polite" },
  warning: { alertClass: "alert-warning", Icon: AlertTriangle, role: "alert", live: "polite" },
};

const ToastContext = createContext<ToastApi | null>(null);

/**
 * App-wide notifications built on daisyUI's `toast` + `alert` components.
 * Use for form / auth response feedback (success and error) and other
 * transient messages.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success(t.toast.saved);
 *   toast.error(err instanceof Error ? err.message : t.toast.error);
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => setToasts([]), []);

  const push = useCallback(
    (variant: ToastVariant, message: ReactNode, opts?: ToastOptions): string => {
      const id = `toast-${(counterRef.current += 1)}`;
      // Resolve the default title against the language active *now* (at trigger
      // time), so it stays correct without the viewport tracking language state.
      const tt = getMessages(loadSessionState().language).toast;
      const title = opts?.title === undefined ? tt[variant] : opts.title || null;
      const duration = opts?.duration ?? DEFAULT_DURATION[variant];
      setToasts((cur) => {
        const next = [...cur, { id, variant, title, message, duration }];
        return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
      });
      return id;
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, opts) => push("success", message, opts),
      error: (message, opts) => push("error", message, opts),
      info: (message, opts) => push("info", message, opts),
      warning: (message, opts) => push("warning", message, opts),
      show: ({ variant, message, ...opts }) => push(variant, message, opts),
      dismiss,
      clear,
    }),
    [push, dismiss, clear],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== "undefined"
        ? createPortal(<ToastViewport toasts={toasts} onDismiss={dismiss} />, document.body)
        : null}
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastEntry[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  // Read once per render; close is an aria-only label so capturing the language
  // at render time (rather than reactively) is sufficient.
  const closeLabel = getMessages(loadSessionState().language).toast.close;
  return (
    <div className="toast toast-end toast-bottom lp-toast-region">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} closeLabel={closeLabel} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
  closeLabel,
}: {
  toast: ToastEntry;
  onDismiss: (id: string) => void;
  closeLabel: string;
}) {
  const meta = VARIANT_META[toast.variant];
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<number | null>(null);
  const remainingRef = useRef(toast.duration);
  const startRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Play the exit animation, then drop the toast from state once it finishes.
  const beginExit = useCallback(() => {
    clearTimer();
    setLeaving(true);
    window.setTimeout(() => onDismiss(toast.id), EXIT_MS);
  }, [clearTimer, onDismiss, toast.id]);

  const startTimer = useCallback(() => {
    if (toast.duration <= 0) return; // sticky
    startRef.current = Date.now();
    timerRef.current = window.setTimeout(beginExit, remainingRef.current);
  }, [beginExit, toast.duration]);

  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [startTimer, clearTimer]);

  // Pause the countdown while hovered/focused so it can be read in full.
  const pause = useCallback(() => {
    if (toast.duration <= 0 || timerRef.current === null) return;
    clearTimer();
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startRef.current));
  }, [clearTimer, toast.duration]);

  const resume = useCallback(() => {
    if (toast.duration <= 0 || timerRef.current !== null) return;
    startTimer();
  }, [startTimer, toast.duration]);

  const { Icon } = meta;
  return (
    <div
      className={`alert ${meta.alertClass} lp-toast${leaving ? " lp-toast--leaving" : ""}`}
      role={meta.role}
      aria-live={meta.live}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <Icon size={20} className="lp-toast__icon" aria-hidden="true" />
      <div className="lp-toast__content">
        {toast.title ? <span className="lp-toast__title">{toast.title}</span> : null}
        <span className="lp-toast__message">{toast.message}</span>
      </div>
      <button type="button" className="lp-toast__close" onClick={beginExit} aria-label={closeLabel}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
