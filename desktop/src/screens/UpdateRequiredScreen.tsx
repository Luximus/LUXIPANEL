import { Download, RefreshCw, Sparkles } from "lucide-react";
import { getPageGradient } from "../features/app/utils";
import { formatMessage, getMessages } from "../i18n";
import type { ThemeMode } from "../features/app/types";
import { humanFileSize } from "../hooks/useTicketUploads";
import type { UpdateState } from "../hooks/useUpdateChecker";
import styles from "./UpdateRequiredScreen.module.css";

export function UpdateRequiredScreen({
  theme,
  language,
  state,
  onStart,
  onRetry,
}: {
  theme: ThemeMode;
  language: string;
  state: UpdateState;
  onStart: () => void;
  onRetry: () => void;
}) {
  const t = getMessages(language);
  const logoSrc = theme === "dark" ? "/logo_light.png" : "/logo.png";
  const isDark = theme === "dark";

  const info = state.info;
  const phase = state.phase;
  const isDownloading = phase === "downloading";
  const isInstalling = phase === "installing";
  const isError = phase === "error";

  const total = state.total > 0 ? state.total : info?.artifact.sizeBytes ?? 0;
  const received = state.received;
  const progressPct = total > 0 ? Math.max(0, Math.min(100, Math.round((received / total) * 100))) : 0;
  const progressLabel = total > 0
    ? formatMessage(t.update.progressOf, { received: humanFileSize(received), total: humanFileSize(total) })
    : formatMessage(t.update.progressUnknown, { received: humanFileSize(received) });

  return (
    <div
      data-theme={theme}
      className="fixed inset-0 z-[9998] grid place-items-center px-6"
      style={{ backgroundImage: getPageGradient(theme) }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="update-title"
    >
      <div
        className={`w-full max-w-[560px] rounded-3xl border p-9 shadow-2xl backdrop-blur-md ${
          isDark ? "border-zinc-700/70 bg-[#131924cc]" : "border-base-300/80 bg-white/92"
        }`}
      >
        <div className="flex flex-col items-center text-center">
          <img src="/logo2.png" alt={t.titleBar.logoAlt} className="h-14 w-auto object-contain drop-shadow-xs" />
          <img src={logoSrc} alt="Luxisoft" className="mt-2 h-5 w-auto object-contain drop-shadow-xs" />

          <div
            className={`mt-7 flex h-16 w-16 items-center justify-center rounded-full ${
              isDark ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-100 text-emerald-600"
            }`}
          >
            <Sparkles size={28} />
          </div>

          <span
            className={`mt-5 text-xs font-bold uppercase tracking-[0.18em] ${
              isDark ? "text-emerald-300" : "text-emerald-600"
            }`}
          >
            {t.update.eyebrow}
          </span>
          <h1
            id="update-title"
            className={`mt-2 text-2xl font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}
          >
            {t.update.title}
          </h1>
          <p className={`mt-3 text-sm leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            {t.update.message}
          </p>

          {/* Versions */}
          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            <div className={`rounded-xl border px-4 py-3 ${isDark ? "border-zinc-700/70 bg-zinc-900/30" : "border-base-300/70 bg-base-200/40"}`}>
              <div className={`text-[0.65rem] font-bold uppercase tracking-[0.12em] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                {t.update.currentLabel}
              </div>
              <div className={`mt-1 font-mono text-sm font-semibold ${isDark ? "text-zinc-200" : "text-zinc-900"}`}>
                {state.currentVersion ?? "—"}
              </div>
            </div>
            <div className={`rounded-xl border px-4 py-3 ${isDark ? "border-emerald-500/30 bg-emerald-500/10" : "border-emerald-200 bg-emerald-50"}`}>
              <div className={`text-[0.65rem] font-bold uppercase tracking-[0.12em] ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                {t.update.latestLabel}
              </div>
              <div className={`mt-1 font-mono text-sm font-bold ${isDark ? "text-emerald-200" : "text-emerald-900"}`}>
                {info?.version ?? "—"}
              </div>
            </div>
          </div>

          {/* Release notes */}
          {info?.releaseNotes ? (
            <div className={`mt-5 w-full rounded-xl border px-4 py-3 text-start ${isDark ? "border-zinc-700/70 bg-zinc-900/30" : "border-base-300/70 bg-white/60"}`}>
              <div className={`mb-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                {t.update.notesHeading}
              </div>
              <div className={`max-h-40 overflow-y-auto whitespace-pre-line text-sm leading-relaxed ${isDark ? "text-zinc-300" : "text-zinc-800"}`}>
                {info.releaseNotes}
              </div>
            </div>
          ) : null}

          {/* Progress bar */}
          {(isDownloading || isInstalling) ? (
            <div className="mt-6 w-full">
              <div className={`relative h-2 overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}>
                <div
                  className={`lp-progress-bar absolute inset-y-0 start-0 rounded-full transition-[width] duration-200 ${isDark ? "bg-emerald-400" : "bg-emerald-600"} ${total > 0 ? styles.progressBar : styles.progressBarIndeterminate}`}
                  style={total > 0 ? { ["--progress-w" as string]: `${progressPct}%` } : undefined}
                />
              </div>
              <div className={`mt-2 flex items-center justify-between text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                <span>{isDownloading ? t.update.downloading : t.update.installing}</span>
                <span className="font-mono">{isDownloading ? progressLabel : ""}</span>
              </div>
              {isInstalling ? (
                <p className={`mt-2 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{t.update.installingHint}</p>
              ) : null}
            </div>
          ) : null}

          {/* Error */}
          {isError && state.error ? (
            <div className={`mt-5 w-full rounded-xl border px-4 py-3 text-start ${isDark ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
              <div className="text-[0.7rem] font-bold uppercase tracking-[0.14em]">{t.update.errorTitle}</div>
              <div className="mt-1 break-words text-sm">{state.error}</div>
            </div>
          ) : null}

          {/* Actions */}
          <div className="mt-7 flex w-full flex-col gap-2">
            {!isDownloading && !isInstalling ? (
              <button
                type="button"
                onClick={onStart}
                disabled={!info}
                className="lp-modal-btn lp-modal-btn--primary w-full"
              >
                <Download size={16} />
                <span>{isError ? t.update.retry : t.update.download}</span>
              </button>
            ) : null}

            {isError ? (
              <button
                type="button"
                onClick={onRetry}
                className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm w-full"
              >
                <RefreshCw size={14} />
                <span>{t.update.checkAgain}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

    </div>
  );
}
