      if (window.self === window.top && "serviceWorker" in navigator) {
        // When a new service worker version takes control (e.g. after a deploy
        // bumps SW_VERSION), reload ONCE so the page picks up fresh assets/i18n
        // instead of the previously-cached bundle. The guard prevents loops.
        let lxpSwRefreshing = false;
        let lxpSwControlled = Boolean(navigator.serviceWorker.controller);
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!navigator.serviceWorker.controller) return;
          // First installation claims the page that has already loaded the
          // current assets. Keep it running instead of fetching everything twice.
          if (!lxpSwControlled) {
            lxpSwControlled = true;
            return;
          }
          if (lxpSwRefreshing) return;
          lxpSwRefreshing = true;
          window.location.reload();
        });
        const registerServiceWorker = () => {
          navigator.serviceWorker
            .register("/sw.js", { scope: "/" })
            .then((reg) => {
              // Proactively check for a newer SW on every load.
              reg.update().catch(() => undefined);
              // If one is already waiting, ask it to activate immediately.
              if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
              reg.addEventListener("updatefound", () => {
                const nw = reg.installing;
                if (!nw) return;
                nw.addEventListener("statechange", () => {
                  if (nw.state === "installed" && navigator.serviceWorker.controller) {
                    nw.postMessage({ type: "SKIP_WAITING" });
                  }
                });
              });
            })
            .catch(() => {
              // best effort
            });
        };
        if (document.readyState === "complete") {
          registerServiceWorker();
        } else {
          window.addEventListener("load", registerServiceWorker, { once: true });
        }
      }
