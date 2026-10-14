export type SessionState = {
  isDark: boolean;
  language: string;
};

const KEY_THEME = "lxp-theme";   // "dark" | "light"
const KEY_LANG = "lxp-language"; // "es" | "en" | ...

export function loadSessionState(): SessionState {
  // Migrate from old desktop-theme key if lxp-theme not set yet
  const stored = localStorage.getItem(KEY_THEME);
  if (stored === null) {
    const legacy = localStorage.getItem("desktop-theme");
    if (legacy) {
      localStorage.setItem(KEY_THEME, legacy);
      return { isDark: legacy === "dark", language: localStorage.getItem(KEY_LANG) ?? "en" };
    }
  }
  const isDark = stored === "dark";
  const language = localStorage.getItem(KEY_LANG) ?? "en";
  return { isDark, language };
}

export function saveSessionState(state: Partial<SessionState>): void {
  if (typeof state.isDark === "boolean") {
    const value = state.isDark ? "dark" : "light";
    localStorage.setItem(KEY_THEME, value);
    localStorage.setItem("desktop-theme", value); // backward compat
  }
  if (typeof state.language === "string" && state.language.length > 0) {
    localStorage.setItem(KEY_LANG, state.language);
  }
}
