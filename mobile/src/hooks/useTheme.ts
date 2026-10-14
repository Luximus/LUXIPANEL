import { useEffect, useState } from "react";
import type { ThemeMode } from "../features/app/types";
import { hydrateSessionState, loadSessionState, saveSessionState } from "../lib/session-state";
import { subscribeActivePalette } from "../theme/panel-palette";

import type { ThemeOrigin } from "../theme/theme-transition";

type Listener = (theme: ThemeMode) => void;

let currentTheme: ThemeMode = loadSessionState().isDark ? "dark" : "light";
const listeners = new Set<Listener>();
let userRevision = 0;
let transition: ((apply: () => void, origin?: ThemeOrigin) => void) | null = null;
let cancelTransition: (() => void) | null = null;
export function installThemeTransition(run: NonNullable<typeof transition>, cancel: () => void) {
  transition = run; cancelTransition = cancel;
  return () => { if (transition === run) { cancel(); transition = null; cancelTransition = null; } };
}
export function cancelThemeTransition() { cancelTransition?.(); }
function requestTheme(next: ThemeMode, origin?: ThemeOrigin) {
  if (next === currentTheme) return;
  ++userRevision;
  const apply = () => setGlobalTheme(next);
  if (transition) transition(apply, origin); else apply();
}

function setGlobalTheme(next: ThemeMode) {
  if (next === currentTheme) return;
  currentTheme = next;
  void saveSessionState({ isDark: next === "dark" });
  listeners.forEach((listener) => listener(next));
}

// Stable identities so consumers can rely on referential equality across renders.
const setThemeStable = (next: ThemeMode, origin?: ThemeOrigin) => requestTheme(next, origin);
const toggleThemeStable = (origin?: ThemeOrigin) => requestTheme(currentTheme === "light" ? "dark" : "light", origin);

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(currentTheme);
  // Fuerza re-render cuando cambia la PALETA del panel activo (los tokens los
  // resuelve getThemeTokens leyendo la paleta global), no solo el modo claro/oscuro.
  const [, bumpPalette] = useState(0);

  useEffect(() => {
    const listener: Listener = (next) => setThemeState(next);
    listeners.add(listener);
    const unsubPalette = subscribeActivePalette(() => bumpPalette((n) => n + 1));
    const revision = userRevision;
    void hydrateSessionState().then((s) => {
      if (revision !== userRevision || userRevision > 0) return;
      const hydrated: ThemeMode = s.isDark ? "dark" : "light";
      if (hydrated !== currentTheme) {
        currentTheme = hydrated;
        listeners.forEach((l) => l(hydrated));
      } else {
        setThemeState(hydrated);
      }
    });
    return () => {
      listeners.delete(listener);
      unsubPalette();
    };
  }, []);

  return { theme, setTheme: setThemeStable, toggleTheme: toggleThemeStable };
}
