import type { ThemeOrigin } from "../../theme/theme-transition";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "../useTheme";
import type { ThemeMode } from "../../features/app/types";
import { getMessages, type Messages } from "../../i18n";
import { hydrateSessionState, loadSessionState, saveSessionState } from "../../lib/session-state";

/**
 * Sub-hook COHESIVO extraído del controlador `useMainTabController` (fase de
 * refactor >500 líneas): tema + idioma + sus sincronizaciones con
 * `session-state`. Totalmente autocontenido (no comparte refs ni setState con el
 * núcleo de sesión/conexión); el controlador lo compone y consume `t`, `language`,
 * `theme`, `isDark` como antes. Cero cambio de comportamiento.
 */
export function useThemeLanguage(): {
  theme: ThemeMode;
  isDark: boolean;
  language: string;
  t: Messages;
  toggleTheme: (origin?: ThemeOrigin) => void;
  setTheme: (next: ThemeMode) => void;
  setLanguage: (next: string) => void;
} {
  const { theme, setTheme } = useTheme();
  const [language, setLanguageState] = useState<string>(() => loadSessionState().language);
  const t = getMessages(language);

  useEffect(() => {
    void hydrateSessionState().then((s) => setLanguageState(s.language));
  }, []);

  const toggleThemeAndSync = useCallback((origin?: ThemeOrigin) => {
    const newIsDark = theme === "light";
    setTheme(newIsDark ? "dark" : "light", origin);
  }, [theme, setTheme]);

  // Aplica un tema explícito (usado cuando el WebView de LUXIPANEL pide cambiar
  // el tema desde su propio toggle: web → app). No-op si ya está aplicado.
  const setThemeAndSync = useCallback((next: ThemeMode) => {
    if (next === theme) return;
    setTheme(next);
  }, [theme, setTheme]);

  const setLanguageAndSync = useCallback((next: string) => {
    if (!next || next === language) return;
    setLanguageState(next);
    void saveSessionState({ language: next });
  }, [language]);

  const isDark = theme === "dark";

  return {
    theme,
    isDark,
    language,
    t,
    toggleTheme: toggleThemeAndSync,
    setTheme: setThemeAndSync,
    setLanguage: setLanguageAndSync,
  };
}
