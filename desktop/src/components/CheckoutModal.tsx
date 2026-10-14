import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, ExternalLink, X, XCircle } from "lucide-react";
import type { PaymentStatus } from "../api/billing";
import { openExternal } from "../features/app/utils";

export type CheckoutLabels = {
  checking: string;
  approvedTitle: string;
  approvedText: string;
  declinedTitle: string;
  declinedText: string;
  pendingTitle: string;
  pendingText: string;
  doneButton: string;
};

/** Checkout lives in the system browser; only the verified payment status is shown here. */
export function CheckoutModal({ url, title, closeLabel, labels, checkStatus, onClose, onPaid }: {
  url: string;
  title: string;
  closeLabel: string;
  labels: CheckoutLabels;
  checkStatus?: () => Promise<PaymentStatus>;
  onClose: () => void;
  onPaid: () => void;
}) {
  const openedRef = useRef(false);
  const paidRef = useRef(false);
  const checkRef = useRef(checkStatus);
  const paidCallbackRef = useRef(onPaid);
  useEffect(() => { checkRef.current = checkStatus; }, [checkStatus]);
  useEffect(() => { paidCallbackRef.current = onPaid; }, [onPaid]);
  const [phase, setPhase] = useState<"checking" | "result">("checking");
  const [status, setStatus] = useState<PaymentStatus>("pending");

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    openExternal(url);
  }, [url]);

  useEffect(() => {
    if (phase !== "checking") return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      attempts += 1;
      let next: PaymentStatus = "pending";
      try { next = await checkRef.current?.() ?? "pending"; }
      catch { /* transient request failure: retry */ }
      if (cancelled) return;
      if (next !== "pending" || attempts >= 120 || !checkRef.current) {
        setStatus(next);
        if (next === "approved" && !paidRef.current) {
          paidRef.current = true;
          paidCallbackRef.current();
        }
        setPhase("result");
      } else timer = setTimeout(poll, 2500);
    };
    timer = setTimeout(poll, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [phase]);

  const approved = status === "approved";
  const failed = status === "declined" || status === "voided" || status === "error";
  const Icon = approved ? CheckCircle2 : failed ? XCircle : Clock;
  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[200] grid place-items-center p-4">
      <div className="lp-modal-card flex w-full max-w-lg flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="lp-modal-header"><h3 className="lp-modal-title">{title}</h3><button type="button" className="lp-modal-close" onClick={onClose} aria-label={closeLabel}><X size={18} /></button></div>
        <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
          {phase === "checking" ? <span className="loading loading-spinner loading-lg text-primary" /> : <Icon size={54} className={approved ? "text-success" : failed ? "text-error" : "text-warning"} />}
          <h3 className="text-lg font-bold">{phase === "checking" ? labels.checking : approved ? labels.approvedTitle : failed ? labels.declinedTitle : labels.pendingTitle}</h3>
          <p className="max-w-sm text-sm opacity-70">{phase === "checking" ? labels.pendingText : approved ? labels.approvedText : failed ? labels.declinedText : labels.pendingText}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {phase === "result" && status === "pending" && checkStatus ? <button type="button" className="lp-modal-btn lp-modal-btn--primary lp-modal-btn--sm" onClick={() => setPhase("checking")}>{labels.checking}</button> : null}
            {!approved && !failed ? <button type="button" className="lp-modal-btn lp-modal-btn--sm" onClick={() => openExternal(url)}><ExternalLink size={15} />{title}</button> : null}
            <button type="button" className="lp-modal-btn lp-modal-btn--sm" onClick={onClose}>{labels.doneButton}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
