import { useEffect, useState } from "react";
import type { ThemeMode } from "../features/app/types";
import { loadSessionState, saveSessionState } from "../lib/session-state";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const { isDark } = loadSessionState();
    const resolved: ThemeMode = isDark ? "dark" : "light";
    // Set the attribute synchronously on first mount so portaled content
    // (modals rendered on document.body) inherits the variables right away.
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", resolved);
    }
    return resolved;
  });

  useEffect(() => {
    saveSessionState({ isDark: theme === "dark" });
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = (next: ThemeMode) => setThemeState(next);
  const toggleTheme = () => setThemeState((prev) => (prev === "light" ? "dark" : "light"));

  return { theme, setTheme, toggleTheme };
}
