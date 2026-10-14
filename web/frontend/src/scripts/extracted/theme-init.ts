(() => {
  // This is the early anti-flash inline script (`is:inline src=…`, classic
  // script — NOT a module), so it cannot import. Keep these literals in lockstep:
  //   MUST match lib/api-client.ts TARGET_SCOPE_SESSION_KEY
  //   MUST match lib/api-client.ts TARGET_UI_PREFS_STORAGE_KEY
  //   MUST match lib/api-client.ts LOCAL_TARGET_SCOPE (the `|| "local"` fallback)
  //   MUST match lib/theme-storage-keys.ts LXP_THEME_KEY / LXP_THEME_USER_SET_KEY
  const TARGET_SCOPE_SESSION_KEY = "panel-active-target-scope";
  const TARGET_UI_PREFS_STORAGE_KEY = "panel-target-ui-prefs-v1";

  // Backend-synced anti-flash cache. The `lxp-theme` cookie is written on the
  // registrable parent-domain scopes (see writeScopedCookie in the panel layout
  // script), so — unlike localStorage, which is per-origin — it survives the
  // dynamic/rotating login subdomains and mirrors the authoritative preference
  // from GET /api/preferences/ui. When present it wins here so the very first
  // paint already matches the user's real theme with no flash.
  function readThemeCookie(): string {
    try {
      const raw = document.cookie
        .split("; ")
        .find((c) => c.startsWith("lxp-theme="))
        ?.split("=")[1];
      return raw ? decodeURIComponent(raw) : "";
    } catch {
      return "";
    }
  }
  const cookieTheme = readThemeCookie();

  let storedTheme = localStorage.getItem("lxp-theme");
  try {
    const scope = (sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY) || "").trim() || "local";
    const rawPrefs = localStorage.getItem(TARGET_UI_PREFS_STORAGE_KEY);
    const prefsMap = rawPrefs ? JSON.parse(rawPrefs) : null;
    const targetTheme = prefsMap?.[scope]?.theme;
    if (targetTheme === "dark" || targetTheme === "light") {
      storedTheme = targetTheme;
      localStorage.setItem("lxp-theme", targetTheme);
      localStorage.setItem("lxp-theme-user-set", "1");
    }
  } catch {
    // Ignore storage/JSON issues and fall back to the global theme.
  }

  let isDark: boolean;
  if (cookieTheme === "dark" || cookieTheme === "light") {
    // Authoritative backend-synced value: apply it and keep the localStorage
    // cache aligned so the toggle and per-target prefs agree from here on.
    isDark = cookieTheme === "dark";
    localStorage.setItem("lxp-theme", cookieTheme);
    localStorage.setItem("lxp-theme-user-set", "1");
  } else if (cookieTheme === "system") {
    // Explicit "follow the OS" preference from the backend.
    isDark = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  } else {
    // No backend-synced cookie yet: preserve the original localStorage behavior.
    const userSelectedTheme = localStorage.getItem("lxp-theme-user-set") === "1";
    isDark = userSelectedTheme && storedTheme === "dark";

    if (!userSelectedTheme && storedTheme !== "light") {
      localStorage.setItem("lxp-theme", "light");
    }
  }

  document.documentElement.classList.toggle("dark", isDark);
})();
