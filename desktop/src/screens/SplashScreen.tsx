import { getPageGradient } from "../features/app/utils";
import { getMessages } from "../i18n";
import type { ThemeMode } from "../features/app/types";
import styles from "./SplashScreen.module.css";

export function SplashScreen({ theme, language }: { theme: ThemeMode; language?: string }) {
  const logoSrc = theme === "dark" ? "/logo_light.png" : "/logo.png";
  const t = getMessages(language);

  return (
    <div data-theme={theme} className="h-screen w-full grid place-items-center px-6" style={{ backgroundImage: getPageGradient(theme) }}>
      <div className={`${styles.card} w-full max-w-[460px] rounded-3xl border p-10 shadow-2xl backdrop-blur-md`}>
        <div className="flex flex-col items-center text-center">
          <img src="/logo2.png" alt={t.titleBar.logoAlt} className="h-22 w-auto object-contain drop-shadow-xs" />
          <img src={logoSrc} alt="Luxisoft" className="mt-3 h-6 w-auto object-contain drop-shadow-xs" />
          <h1 className={`mt-10 font-bold ${theme === "dark" ? "text-zinc-100" : "text-zinc-900"}`}>{t.splash.loading}</h1>
          <div className="mt-3 flex items-center gap-2">
            <span className={`h-2 w-2 animate-pulse rounded-full ${theme === "dark" ? "bg-emerald-400" : "bg-emerald-600"}`} />
            <span className={`${styles.dot2} h-2 w-2 animate-pulse rounded-full ${theme === "dark" ? "bg-emerald-400/80" : "bg-emerald-600/80"}`} />
            <span className={`${styles.dot3} h-2 w-2 animate-pulse rounded-full ${theme === "dark" ? "bg-emerald-400/60" : "bg-emerald-600/60"}`} />
          </div>
          <p className={`mt-10 text-sm tracking-[0.14em] uppercase ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}>{t.splash.copyright}</p>
        </div>
      </div>
    </div>
  );
}
