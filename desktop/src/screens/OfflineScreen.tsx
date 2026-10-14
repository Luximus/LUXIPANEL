import { RefreshCw, WifiOff } from "lucide-react";
import { getPageGradient } from "../features/app/utils";
import { getMessages } from "../i18n";
import type { ThemeMode } from "../features/app/types";
import styles from "./OfflineScreen.module.css";

export function OfflineScreen({
  theme,
  language,
  checking,
  onRetry,
}: {
  theme: ThemeMode;
  language: string;
  checking: boolean;
  onRetry: () => void;
}) {
  const t = getMessages(language);
  const logoSrc = theme === "dark" ? "/logo_light.png" : "/logo.png";

  return (
    <div
      data-theme={theme}
      className="fixed inset-0 z-[9999] grid place-items-center px-6"
      style={{ backgroundImage: getPageGradient(theme) }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="offline-title"
    >
      <div
        className={`${styles.card} w-full max-w-[480px] rounded-3xl border p-10 shadow-2xl backdrop-blur-md`}
      >
        <div className="flex flex-col items-center text-center">
          <img src="/logo2.png" alt={t.titleBar.logoAlt} className="h-16 w-auto object-contain drop-shadow-xs" />
          <img src={logoSrc} alt="Luxisoft" className="mt-2 h-5 w-auto object-contain drop-shadow-xs" />

          <div
            className={`mt-8 flex h-16 w-16 items-center justify-center rounded-full ${
              theme === "dark" ? "bg-rose-500/15 text-rose-300" : "bg-rose-100 text-rose-600"
            }`}
          >
            <WifiOff size={28} />
          </div>

          <span
            className={`mt-6 text-xs font-bold uppercase tracking-[0.18em] ${
              theme === "dark" ? "text-rose-300" : "text-rose-600"
            }`}
          >
            {t.offline.eyebrow}
          </span>
          <h1
            id="offline-title"
            className={`mt-2 text-2xl font-extrabold ${theme === "dark" ? "text-zinc-100" : "text-zinc-900"}`}
          >
            {t.offline.title}
          </h1>
          <p className={`mt-3 text-sm leading-relaxed ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
            {t.offline.message}
          </p>

          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--primary mt-8"
            onClick={onRetry}
            disabled={checking}
          >
            <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
            <span>{checking ? t.offline.checking : t.offline.retry}</span>
          </button>

          <div className="mt-6 flex items-center gap-2">
            <span className={`h-2 w-2 animate-pulse rounded-full ${theme === "dark" ? "bg-rose-400" : "bg-rose-500"}`} />
            <span className={`text-xs uppercase tracking-[0.14em] ${theme === "dark" ? "text-zinc-500" : "text-zinc-500"}`}>
              {t.offline.waiting}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
