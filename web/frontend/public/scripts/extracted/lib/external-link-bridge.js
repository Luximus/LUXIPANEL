/**
 * external-link-bridge — opens external links in the device's default browser
 * when the page is loaded inside an embedded wrapper (React Native WebView,
 * Electron desktop, or the desktop's nested webframe). Without this bridge,
 * `target="_blank"` links open inside the same webview, which traps the user
 * inside the app.
 *
 * Activation criteria (must match `detectUiClientSource` in ui-sync.js):
 *   - `window.ReactNativeWebView` present, OR UA contains "reactnativewebview"
 *     → app.
 *   - UA contains "lpsdesktopwebframe" or ("electron" AND "webview")
 *     → desktop nested webframe.
 *   - UA contains "electron" or `window.electronApi` present
 *     → desktop.
 *
 * Targets: any `<a data-lxp-external-link>` (rendered by SetupWizardFooter
 * etc.). The script runs once per page load — clicks are intercepted in the
 * capture phase so other handlers don't navigate the webview first.
 */

(function () {
  if (window.__lxpExternalLinkBridgeInit) return;
  window.__lxpExternalLinkBridgeInit = true;

  const ua = String((navigator && navigator.userAgent) || "").toLowerCase();
  const isApp = typeof window.ReactNativeWebView !== "undefined" || ua.includes("reactnativewebview");
  const isWebframe = ua.includes("lpsdesktopwebframe") || (ua.includes("electron") && ua.includes("webview"));
  const isDesktop = ua.includes("electron") || typeof window.electronApi !== "undefined";
  const isEmbedded = isApp || isWebframe || isDesktop;

  if (!isEmbedded) return;

  /** Send the URL to the native wrapper so it opens it in the default browser. */
  function openExternal(url) {
    try {
      if (isApp && window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "open-external-url", url }));
        return;
      }
      // Electron preload exposing { openExternal } — try a few common shapes.
      if (window.electronApi && typeof window.electronApi.openExternal === "function") {
        window.electronApi.openExternal(url);
        return;
      }
      if (window.electron && typeof window.electron.openExternal === "function") {
        window.electron.openExternal(url);
        return;
      }
      if (window.lpsDesktop && typeof window.lpsDesktop.openExternal === "function") {
        window.lpsDesktop.openExternal(url);
        return;
      }
      // Fallback for Electron without a custom preload: a plain window.open
      // with `noopener` typically triggers Electron's `setWindowOpenHandler`,
      // which opens externally when configured. If the wrapper hasn't done
      // that, we have no other option from inside the page.
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      // Last-resort fallback — at worst the link opens inside the webview,
      // which is the original (unwanted) behaviour we're trying to avoid.
      try {
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        /* swallow */
      }
      console.warn("[lxp] external-link-bridge: failed to delegate URL", err);
    }
  }

  function handleClick(event) {
    const anchor = event.target && event.target.closest ? event.target.closest("a[data-lxp-external-link]") : null;
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;
    // Allow modifier-clicks to behave as the platform expects when the user
    // explicitly asks for new tab / new window.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    openExternal(href);
  }

  document.addEventListener("click", handleClick, true);
})();
