import { useCallback, useEffect, useState } from "react";
import { useTheme } from "../useTheme";
import { loadSessionState, saveSessionState } from "../../lib/session-state";

/**
 * Tema + idioma del controlador de pestaña principal. Aislado de la sesión /
 * conexión: solo toca el tema (persistido en `sessionState.isDark`), el idioma
 * (`sessionState.language`) y los atributos de `<html>` (locale / dir / lang).
 *
 * Comportamiento idéntico al original en `useMainTabController`:
 *  - `toggleTheme` alterna claro/oscuro y persiste `isDark`.
 *  - `setLanguage` ignora valores vacíos o iguales al actual y persiste.
 *  - el efecto de `<html>` corre en cada cambio de idioma (RTL para `ar`).
 */
export function useThemeLanguage() {
  const { theme, setTheme } = useTheme();
  const [language, setLanguageState] = useState<string>(() => loadSessionState().language);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.locale = language;
    root.lang = language;
    root.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const toggleTheme = useCallback(() => {
    const newIsDark = theme === "light";
    setTheme(newIsDark ? "dark" : "light");
    saveSessionState({ isDark: newIsDark });
  }, [theme, setTheme]);

  const setLanguage = useCallback((next: string) => {
    if (!next || next === language) return;
    setLanguageState(next);
    saveSessionState({ language: next });
  }, [language]);

  const isDark = theme === "dark";

  return { theme, isDark, language, toggleTheme, setLanguage };
}
