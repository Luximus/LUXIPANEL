import { getPageGradient } from "../features/app/utils";
import { getMessages } from "../i18n";
import type { ThemeMode } from "../features/app/types";
import styles from "./LoadingPanelScreen.module.css";

export function LoadingPanelScreen({ theme, language }: { theme: ThemeMode; language?: string }) {
  const t = getMessages(language);
  return (
    <div data-theme={theme} className={`${styles.root} h-screen w-full grid place-items-center px-4`} style={{ ["--lps-bg-image" as string]: getPageGradient(theme) }}>
      <div className="card bg-base-100/90 backdrop-blur border border-base-300 shadow-xs w-full max-w-sm">
        <div className="card-body items-center text-center">
          <span className="loading loading-spinner loading-md text-primary"></span>
          <p className="font-medium">{t.splash.loadingPanel}</p>
        </div>
      </div>
    </div>
  );
}
