import AsyncStorage from "@react-native-async-storage/async-storage";

export type SessionState = {
  isDark: boolean;
  language: string;
};

const KEY_THEME = "lxp-theme";
const KEY_LANG = "lxp-language";

let cache: SessionState = { isDark: true, language: "en" };
let hydrated = false;
const listeners = new Set<() => void>();
export function subscribeSessionState(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function notifySessionState() { listeners.forEach(listener => listener()); }

export async function hydrateSessionState(): Promise<SessionState> {
  if (hydrated) return cache;
  try {
    const [theme, lang] = await Promise.all([
      AsyncStorage.getItem(KEY_THEME),
      AsyncStorage.getItem(KEY_LANG),
    ]);
    cache = {
      isDark: theme ? theme === "dark" : true,
      language: lang ?? "en",
    };
  } catch {
    /* keep defaults */
  }
  hydrated = true;
  notifySessionState();
  return cache;
}

export function loadSessionState(): SessionState {
  return cache;
}

export async function saveSessionState(state: Partial<SessionState>): Promise<void> {
  if (typeof state.isDark === "boolean") {
    cache = { ...cache, isDark: state.isDark };
    notifySessionState();
    try {
      await AsyncStorage.setItem(KEY_THEME, state.isDark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }
  if (typeof state.language === "string" && state.language.length > 0) {
    cache = { ...cache, language: state.language };
    notifySessionState();
    try {
      await AsyncStorage.setItem(KEY_LANG, state.language);
    } catch {
      /* ignore */
    }
  }
}
