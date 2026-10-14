// Puente web → app nativa (React Native WebView).
//
// En el WebView móvil de la app (UA "ReactNativeWebView" / window.ReactNativeWebView)
// el panel y el login postean los cambios de tema/idioma que hace el usuario en la
// web para que la app NATIVA se sincronice (status bar, chrome nativo, pantallas
// que no son el WebView, persistencia en AsyncStorage). Fuera del WebView no existe
// `window.ReactNativeWebView` → todo es no-op silencioso.
//
// El sentido inverso (app → web) ya lo cubre la app inyectando en el WebView
// `buildThemeSyncScript` / `buildLanguageSyncScript` (ver
// LP-LICENSE-SERVER/app/src/screens/SshScreen.tsx). Esas inyecciones tocan el DOM
// directamente y NO pasan por `applyTheme`/el handler del <select>, por lo que NO
// re-disparan estas notificaciones: no hay bucle.

type NativeMessage =
  | { type: "set-theme"; theme: "dark" | "light" }
  | { type: "set-language"; language: string };

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
  }
}

/** True solo dentro del WebView de la app móvil (React Native). */
export function isAppWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  return /ReactNativeWebView/i.test(navigator.userAgent) || !!window.ReactNativeWebView;
}

function postToNativeApp(message: NativeMessage): void {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify(message));
  } catch {
    /* fuera del WebView: no-op */
  }
}

/** Avisa a la app nativa del modo de tema elegido por el usuario en la web. */
export function notifyNativeTheme(dark: boolean): void {
  postToNativeApp({ type: "set-theme", theme: dark ? "dark" : "light" });
}

/** Avisa a la app nativa del idioma elegido por el usuario en la web. */
export function notifyNativeLanguage(language: string): void {
  if (!language) return;
  postToNativeApp({ type: "set-language", language });
}
