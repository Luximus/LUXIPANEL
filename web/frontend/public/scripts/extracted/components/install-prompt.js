/* InstallPrompt client logic — PWA install button + iOS Safari hint. */
(() => {
  const DISMISS_KEY = "lxp.pwa.dismissedAt";
  const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  function isStandalone() {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isDismissed() {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      const at = Number(raw);
      return Number.isFinite(at) && Date.now() - at < DISMISS_TTL_MS;
    } catch {
      return false;
    }
  }

  function markDismissed() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  function isIOSSafari() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isSafari =
      /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isIOS && isSafari;
  }

  let deferredPrompt = null;

  function init() {
    if (isStandalone()) return;
    if (isDismissed()) return;

    const btn = document.getElementById("lxp-pwa-install-btn");
    const iosHint = document.getElementById("lxp-pwa-ios-hint");

    if (btn) {
      btn.addEventListener("click", async () => {
        if (!deferredPrompt) return;
        btn.disabled = true;
        try {
          deferredPrompt.prompt();
          const choice = await deferredPrompt.userChoice;
          if (choice?.outcome === "accepted") {
            btn.hidden = true;
            btn.classList.add("hidden");
          } else {
            markDismissed();
            btn.hidden = true;
            btn.classList.add("hidden");
          }
        } finally {
          deferredPrompt = null;
          btn.disabled = false;
        }
      });
    }

    if (iosHint) {
      iosHint.querySelector("[data-lxp-pwa-dismiss]")?.addEventListener("click", () => {
        markDismissed();
        iosHint.hidden = true;
        iosHint.classList.add("hidden");
      });
    }

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (btn) {
        btn.hidden = false;
        btn.classList.remove("hidden");
        btn.classList.add("flex");
      }
    });

    window.addEventListener("appinstalled", () => {
      if (btn) {
        btn.hidden = true;
        btn.classList.add("hidden");
      }
      if (iosHint) {
        iosHint.hidden = true;
        iosHint.classList.add("hidden");
      }
      deferredPrompt = null;
    });

    if (isIOSSafari() && iosHint) {
      // Slight delay so the hint doesn't compete with first paint.
      setTimeout(() => {
        if (isStandalone() || isDismissed()) return;
        iosHint.hidden = false;
        iosHint.classList.remove("hidden");
      }, 1500);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  // Re-run on Astro client-side navigation.
  document.addEventListener("astro:after-swap", init);
})();
