import { useEffect, useState } from "react";
import { Clock, X } from "lucide-react";
import { formatMessage, getMessages } from "../i18n";
import { onRateLimited } from "../lib/rate-limit-notice";

/** Formatea segundos como m:ss (p. ej. 905 → "15:05"). Neutral por locale. */
function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Modal global del límite de peticiones (HTTP 429). Escucha el bus
 * `rate-limit-notice`; cuando llega un aviso muestra el motivo y una cuenta
 * atrás (según `retryAfter` del backend) hasta que se pueda reintentar. Se monta
 * una sola vez en `App`. NO se puede cerrar durante la cuenta atrás (sin X ni
 * botón); al terminar aparece el botón que recarga la SPA para refrescar datos.
 */
export function RateLimitModal({ language }: { language?: string }) {
  const t = getMessages(language).rateLimit;
  // Epoch (ms) en que se podrá reintentar; null = modal cerrado.
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  // Suscripción a los avisos globales de 429. Si llega otro mientras está
  // abierto, conserva el reintento MÁS lejano (espera más conservadora).
  useEffect(() => {
    return onRateLimited((notice) => {
      setRetryAt((prev) => (prev !== null && prev > notice.retryAt ? prev : notice.retryAt));
    });
  }, []);

  // Cuenta atrás de 1s mientras el modal está abierto.
  useEffect(() => {
    if (retryAt === null) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [retryAt]);

  if (retryAt === null) return null;

  const ready = remaining <= 0;
  // El modal NO se puede cerrar durante la cuenta atrás (sin X ni botón). Solo
  // al terminar aparece el botón, que RECARGA la SPA para refrescar los datos
  // (re-dispara las peticiones iniciales ya sin el límite activo).
  const reload = () => {
    setRetryAt(null);
    window.location.reload();
  };

  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[200] grid place-items-center p-4">
      <div className="lp-modal-card flex max-h-full w-full max-w-md flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{t.title}</h3>
          {ready ? (
            <button type="button" className="lp-modal-close" onClick={reload} aria-label={t.closeAria}>
              <X size={18} />
            </button>
          ) : null}
        </div>

        <div className="lp-modal-body">
          <p>{t.description}</p>
          <p className={`mt-2 inline-flex items-center gap-2 font-semibold ${ready ? "text-success" : "text-base-content"}`}>
            <Clock size={15} className="shrink-0" />
            {ready ? t.ready : formatMessage(t.retryIn, { time: formatCountdown(remaining) })}
          </p>
        </div>

        {ready ? (
          <div className="lp-modal-footer">
            <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={reload}>
              {t.reload}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
