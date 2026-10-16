import { getClientMessages } from "/scripts/extracted/lib/i18n-client.js";
import { notifyNativeTheme, notifyNativeLanguage, isAppWebView } from "/scripts/extracted/lib/native-bridge.js";
import { getCsrfToken, CSRF_HEADER_NAME, BRIDGE_SESSION_SESSION_KEY, TARGET_SCOPE_SESSION_KEY } from "/scripts/extracted/lib/api-client.js";

// Persist the chosen UI locale in `lxp-locale`. Served on a dynamic/rotating
// luxipanel.com subdomain and read ONLY from this cookie by the SSR (first match
// in the header). A host-only cookie is lost on subdomain rotation and the
// commercial site's `.luxipanel.com` cookie would shadow the choice (older entry
// read first) → language reverted. Fix: write the locale to host-only AND every
// registrable parent-domain scope (overrides the commercial cookie + survives
// rotation). Setting a value overrides the same scope; invalid (public-suffix)
// scopes are rejected by the browser.
function persistLocaleCookie(code: string): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const value = encodeURIComponent(code);
  const maxAge = "; Max-Age=31536000"; // 1-year cookie Max-Age (31536000s)
  const scopes = ["Path=/"];
  const parts = location.hostname.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const domain = parts.slice(i).join(".");
    scopes.push(`Path=/; Domain=${domain}`);
    scopes.push(`Path=/; Domain=.${domain}`);
  }
  for (const scope of scopes) {
    // MUST match i18n/config.ts localeCookieName (inline/define-vars script).
    document.cookie = `lxp-locale=${value}; ${scope}${maxAge}; SameSite=Lax${secure}`;
  }
}

type InitArgs = {
  locale: string;
};

export default async function initScript({ locale }: InitArgs) {
  const { login: i18nLogin } = await getClientMessages(locale, ["login"]) as { login: any };
  const REMEMBER_STORAGE_KEY = "lxp_login_remember";

  function arrayBufferToBase64url(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function serializeAuthenticationCredential(credential: PublicKeyCredential): Record<string, unknown> {
    const response = credential.response as AuthenticatorAssertionResponse;
    const credentialId = arrayBufferToBase64url(credential.rawId);

    return {
      id: credentialId,
      rawId: credentialId,
      type: credential.type,
      response: {
        clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
        authenticatorData: arrayBufferToBase64url(response.authenticatorData),
        signature: arrayBufferToBase64url(response.signature),
        userHandle: response.userHandle ? arrayBufferToBase64url(response.userHandle) : null,
      },
    };
  }

  // Helpers
  const loginError = document.getElementById("login-error");
  const loginMethodTabs = document.getElementById("login-method-tabs");
  const twoFactorForm = document.getElementById("form-2fa");
  const rememberInput = document.getElementById("remember");

  function getRememberValue() {
    return rememberInput instanceof HTMLInputElement ? rememberInput.checked : false;
  }

  function initRememberPreference() {
    if (!(rememberInput instanceof HTMLInputElement)) return;
    try {
      const raw = window.localStorage.getItem(REMEMBER_STORAGE_KEY);
      if (raw !== null) rememberInput.checked = raw === "1";
    } catch {
      // ignore storage errors
    }

    rememberInput.addEventListener("change", () => {
      try {
        window.localStorage.setItem(REMEMBER_STORAGE_KEY, rememberInput.checked ? "1" : "0");
      } catch {
        // ignore storage errors
      }
    });
  }

  function getCsrf() {
    return getCsrfToken();
  }

  function showError(msg: string) {
    if (!loginError) return;
    loginError.textContent = msg;
    loginError.classList.remove("hidden");
  }

  // Backend auth failures carry a stable `code` (e.g. "NO_SSH_KEY"). Prefer the
  // localized message for that code (login.authErrors[<CODE>]) over the raw
  // server string so errors render in the user's language; fall back to the
  // server text, then a generic message.
  function serverErrorMessage(data: { code?: string; error?: string } | null | undefined, fallback: string) {
    const code = typeof data?.code === "string" ? data.code : "";
    const localized = code && i18nLogin.authErrors ? i18nLogin.authErrors[code] : "";
    return localized || data?.error || fallback || i18nLogin.authError;
  }

  function clearError() {
    loginError?.classList.add("hidden");
  }

  function setLoading(btn: HTMLButtonElement | null, loading: boolean) {
    if (!btn) return;
    btn.disabled = loading;
    btn.querySelector(".btn-text")?.classList.toggle("hidden", loading);
    btn.querySelector(".btn-spinner")?.classList.toggle("hidden", !loading);
  }

  function resetLoadingStates() {
    const ids = ["btn-password", "btn-passkey", "btn-recovery", "btn-2fa"];
    ids.forEach((id) => {
      const btn = document.getElementById(id);
      if (btn instanceof HTMLButtonElement) setLoading(btn, false);
    });
    const passkeyStatus = document.getElementById("passkey-status");
    passkeyStatus?.classList.add("hidden");
  }

  async function ensureCsrfCookie() {
    try {
      // MUST match lib/api-routes.ts LOGIN_METHODS_PATH (inline/define-vars
      // script — keep the literal in lockstep; api-routes.ts is not a runtime lib).
      await fetch("/api/auth/login-methods", { credentials: "include" });
    } catch {
      // ignore
    }
  }

  function hideFirstFactorScreens() {
    METHODS.forEach(m => document.getElementById(`form-${m}`)?.classList.add("hidden"));
  }

  ensureCsrfCookie();
  initRememberPreference();

  // ── hCaptcha (optional) ────────────────────────────────────────────────
  // The backend reports whether hCaptcha guards the login and, if so, the
  // public site key (never the secret). Config is read from the #login-card
  // data-attributes set by the SSR page; when disabled (the default) the login
  // flow is completely untouched and `hcaptchaToken` stays "".
  let hcaptchaEnabled = false;
  let hcaptchaSitekey = "";
  let hcaptchaWidgetId: string | null = null;

  // Load the hCaptcha API script once (explicit render) and resolve with the
  // global `hcaptcha` object. Idempotent: a second call reuses the loaded API.
  function loadHcaptchaApi(): Promise<any> {
    return new Promise((resolve) => {
      const w = window as any;
      if (w.hcaptcha && typeof w.hcaptcha.render === "function") {
        resolve(w.hcaptcha);
        return;
      }
      const cbName = "__lxpHcaptchaOnload";
      const prev = w[cbName];
      w[cbName] = () => {
        if (typeof prev === "function") { try { prev(); } catch { /* ignore */ } }
        resolve(w.hcaptcha);
      };
      if (!document.querySelector("script[data-lxp-hcaptcha]")) {
        const s = document.createElement("script");
        s.src = `https://js.hcaptcha.com/1/api.js?render=explicit&onload=${cbName}`;
        s.async = true;
        s.defer = true;
        s.setAttribute("data-lxp-hcaptcha", "1");
        document.head.appendChild(s);
      }
    });
  }

  async function setupHcaptcha() {
    if (!hcaptchaEnabled || !hcaptchaSitekey) return;
    const container = document.getElementById("login-hcaptcha");
    if (!container || container.dataset.rendered === "1") return;
    const hcaptcha = await loadHcaptchaApi();
    if (!hcaptcha || typeof hcaptcha.render !== "function") return;
    if (container.dataset.rendered === "1") return; // guard against races
    try {
      hcaptchaWidgetId = hcaptcha.render("login-hcaptcha", { sitekey: hcaptchaSitekey });
      container.dataset.rendered = "1";
    } catch {
      // Already rendered / invalid site key — ignore so login stays usable.
    }
  }

  function getHcaptchaToken(): string {
    if (!hcaptchaEnabled) return "";
    const w = window as any;
    try {
      if (w.hcaptcha && typeof w.hcaptcha.getResponse === "function") {
        return (hcaptchaWidgetId !== null ? w.hcaptcha.getResponse(hcaptchaWidgetId) : w.hcaptcha.getResponse()) || "";
      }
    } catch {
      // no-op
    }
    return "";
  }

  function resetHcaptcha() {
    if (!hcaptchaEnabled) return;
    const w = window as any;
    try {
      if (w.hcaptcha && typeof w.hcaptcha.reset === "function") {
        if (hcaptchaWidgetId !== null) w.hcaptcha.reset(hcaptchaWidgetId);
        else w.hcaptcha.reset();
      }
    } catch {
      // no-op
    }
  }

  const nativeRequest = new URLSearchParams(window.location.search).get("nativeRequest");
  let authorizingNative = false;
  async function completeNativeLogin(): Promise<void> {
    if (authorizingNative || !nativeRequest) return;
    authorizingNative = true;
    try {
      if (!/^[A-Za-z0-9_-]{43}$/.test(nativeRequest)) throw new Error("Invalid native request");
      await ensureCsrfCookie();
      const csrf = document.cookie.split("; ").find(value => value.startsWith("luxipanel_csrf="))?.split("=").slice(1).join("=") ?? "";
      const response = await fetch("/api/auth/native/authorize", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": decodeURIComponent(csrf) }, body: JSON.stringify({ requestId: nativeRequest }) });
      const result = await response.json();
      const callback = result.data?.callbackUrl;
      if (!response.ok || !result.ok || typeof callback !== "string") throw new Error(result.error || i18nLogin.authError);
      const url = new URL(callback);
      if (url.protocol !== "luxipanel:" || url.username || url.password || url.port || url.hash || url.hostname !== "auth" || url.pathname !== "/callback" || !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get("code") ?? "") || !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get("state") ?? "")) throw new Error("Invalid native callback");
      window.location.href = callback;
    } catch (error) {
      authorizingNative = false;
      showError(i18nLogin.authErrors?.INVALID_AUTH_RESPONSE || i18nLogin.authError);
      resetLoadingStates();
    }
  }
  // An existing full browser session may authorize the app; partial sessions are refused by the backend.
  if (nativeRequest) void fetch("/api/session", { credentials: "include" }).then(response => { if (response.ok) void completeNativeLogin(); }).catch(() => {});
  function completeLogin(): void {
    if (nativeRequest) { void completeNativeLogin(); return; }
    // A new authenticated session must not inherit the previous session's
    // per-tab server override. The panel will seed its scope from the new SSR.
    // Reset only after all authentication factors have succeeded.
    try {
      window.sessionStorage.removeItem(BRIDGE_SESSION_SESSION_KEY);
      window.sessionStorage.removeItem(TARGET_SCOPE_SESSION_KEY);
    } catch {
      // Restricted storage must not prevent a successful login.
    }
    window.dispatchEvent(new Event("luxipanel:session-started"));
    try { sessionStorage.removeItem("lxp.assistant.paneState.v2"); sessionStorage.removeItem("luxipanel.bootstrap-read.v2"); } catch {}
    if ((window as any).__lxpAuthNavigate) void (window as any).__lxpAuthNavigate("/", { history: "replace" });
    else window.location.href = "/";
  }

  async function postLogin(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrf() },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.ok && data.mfaPending) { showTotpScreen(); return "mfa"; }
    if (data.ok) { completeLogin(); return "ok"; }
    showError(serverErrorMessage(data, i18nLogin.authError));
    return false;
  }

  function showTotpScreen() {
    loginMethodTabs?.classList.add("hidden");
    hideFirstFactorScreens();
    twoFactorForm?.classList.remove("hidden");
    document.getElementById("totp-code")?.focus();
  }

  function resetToFirstFactor() {
    twoFactorForm?.classList.add("hidden");
    loginMethodTabs?.classList.remove("hidden");
    resetLoadingStates();
    clearError();
    const firstAllowed = METHODS.find(m => ALLOWED[m]);
    if (firstAllowed) switchMethod(firstAllowed);
  }

  // Password should be first priority, then passkey, then recovery
  type LoginMethod = "password" | "passkey" | "recovery";
  const METHODS: LoginMethod[] = ["password", "passkey", "recovery"];

  function switchMethod(method: LoginMethod) {
    if (!ALLOWED[method]) return;
    METHODS.forEach(m => {
      const tab = document.getElementById(`tab-${m}`);
      const form = document.getElementById(`form-${m}`);
      if (!tab || !form) return;
      const active = m === method;
      tab.classList.toggle("bg-background", active);
      tab.classList.toggle("text-foreground", active);
      tab.classList.toggle("shadow-sm", active);
      tab.classList.toggle("text-muted-foreground", !active);
      tab.setAttribute("aria-pressed", active ? "true" : "false");
      form.classList.toggle("hidden", !active);
    });
    clearError();
  }

  const card = document.getElementById("login-card");
  if (!card) throw new Error("Missing login-card element");
  const ALLOWED = {
    password: card.dataset.allowPassword === "true",
    passkey: card.dataset.allowPasskey === "true",
    recovery: card.dataset.allowRecovery === "true",
  };

  // Pick up hCaptcha config and render the widget (no-op when disabled).
  hcaptchaEnabled = card.dataset.hcaptchaEnabled === "true";
  hcaptchaSitekey = card.dataset.hcaptchaSitekey ?? "";
  if (ALLOWED.password) void setupHcaptcha();

  // Hide tabs for disabled methods
  for (const [method, allowed] of Object.entries(ALLOWED)) {
    if (!allowed) {
      document.getElementById(`tab-${method}`)?.classList.add("hidden");
      document.getElementById(`form-${method}`)?.classList.add("hidden");
    }
  }

  // Activate first allowed method
  const firstAllowed = METHODS.find(m => ALLOWED[m]);
  if (firstAllowed) {
    switchMethod(firstAllowed);
  } else {
    showError(i18nLogin.authError);
  }

  document.querySelectorAll<HTMLElement>(".method-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const method = tab.dataset.method as LoginMethod | undefined;
      if (method) switchMethod(method);
    });
  });

  // Password toggle
  document.getElementById("toggle-password")?.addEventListener("click", () => {
    const inp = document.getElementById("password");
    const icon = document.getElementById("eye-icon");
    if (!(inp instanceof HTMLInputElement) || !icon) return;
    inp.type = inp.type === "password" ? "text" : "password";
    icon.className = inp.type === "password" ? "ti ti-eye text-lg" : "ti ti-eye-off text-lg";
  });

  // Password
  document.getElementById("form-password")?.addEventListener("submit", async e => {
    e.preventDefault();
    if (!ALLOWED.password) return;
    clearError();
    const btn = document.getElementById("btn-password");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    if (
      !(btn instanceof HTMLButtonElement) ||
      !(usernameInput instanceof HTMLInputElement) ||
      !(passwordInput instanceof HTMLInputElement)
    ) return;
    setLoading(btn, true);
    // When hCaptcha guards the login, require a solved challenge before posting.
    const hcaptchaToken = getHcaptchaToken();
    if (hcaptchaEnabled && !hcaptchaToken) {
      showError(i18nLogin.errors.captchaRequired);
      setLoading(btn, false);
      return;
    }
    const user = usernameInput.value;
    const pass = passwordInput.value;
    const remember = getRememberValue();
    const result = await postLogin("/api/login", { user, pass, remember, hcaptchaToken }).catch(() => false);
    if (result === "mfa") {
      // 2FA required. The 2FA view is already shown.
    } else if (!result) {
      setLoading(btn, false);
      // hCaptcha tokens are single-use; reset so the user can retry.
      resetHcaptcha();
    }
  });

  // Focus the active method, without focusing a hidden password form.
  const usernameField = document.getElementById(firstAllowed === "password" ? "username" : `${firstAllowed}-username`);
  if (usernameField instanceof HTMLInputElement) usernameField.focus();

  // Passkey
  document.getElementById("btn-passkey")?.addEventListener("click", async () => {
    if (!ALLOWED.passkey) return;
    clearError();

    // Check WebAuthn support
    if (!navigator.credentials || typeof navigator.credentials.get !== "function") {
      showError(i18nLogin.errors.browserNoPasskey);
      return;
    }

    const btn = document.getElementById("btn-passkey");
    const statusEl = document.getElementById("passkey-status");
    const passkeyUsername = document.getElementById("passkey-username");
    if (
      !(btn instanceof HTMLButtonElement) ||
      !statusEl ||
      !(passkeyUsername instanceof HTMLInputElement)
    ) return;
    const username = passkeyUsername.value.trim();

    setLoading(btn, true);
    statusEl.textContent = i18nLogin.status.passkeyInit;
    statusEl.classList.remove("hidden");

    try {
      // 1. Get challenge from server
      const initRes = await fetch("/api/auth/passkeys/auth-options", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrf() },
        body: JSON.stringify({ ...(username ? { username } : {}) }),
      });
      if (!initRes.ok) throw new Error(i18nLogin.errors.passkeyOptionsFailed);
      const options = await initRes.json();

      // 2. Decode base64url
      options.challenge = Uint8Array.from(atob(options.challenge.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
      if (options.allowCredentials) {
        options.allowCredentials = options.allowCredentials.map((c: { id: string }) => ({
          ...c,
          id: Uint8Array.from(atob(c.id.replace(/-/g, "+").replace(/_/g, "/")), x => x.charCodeAt(0)),
        }));
      }

      statusEl.textContent = i18nLogin.status.passkeyWaiting;

      // 3. Get assertion from authenticator
      const assertion = await navigator.credentials.get({ publicKey: options });
      if (!assertion) throw new Error(i18nLogin.errors.passkeyCanceled);
      const credential = assertion as PublicKeyCredential;
      const response = credential.response;
      if (!(response instanceof AuthenticatorAssertionResponse)) {
        throw new Error(i18nLogin.errors.passkeyError);
      }

      statusEl.textContent = i18nLogin.status.passkeyVerifying;

      // 4. Send to server
      const result = await postLogin("/api/auth/passkeys/auth-verify", {
        remember: getRememberValue(),
        ...serializeAuthenticationCredential(credential),
      });
      if (result === "mfa") {
        // 2FA required. The 2FA view is already shown.
      } else if (!result) {
        setLoading(btn, false);
        statusEl.classList.add("hidden");
      }
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e.name === "NotAllowedError") showError(i18nLogin.errors.passkeyCanceledByUser);
      else showError(e.message ?? i18nLogin.errors.passkeyError);
      setLoading(btn, false);
      statusEl.classList.add("hidden");
    }
  });

  // Recovery code
  document.getElementById("form-recovery")?.addEventListener("submit", async e => {
    e.preventDefault();
    if (!ALLOWED.recovery) return;
    clearError();
    const btn = document.getElementById("btn-recovery");
    const recoveryUsername = document.getElementById("recovery-username");
    const recoveryCode = document.getElementById("recovery-code");
    if (
      !(btn instanceof HTMLButtonElement) ||
      !(recoveryUsername instanceof HTMLInputElement) ||
      !(recoveryCode instanceof HTMLInputElement)
    ) return;
    setLoading(btn, true);
    const username = recoveryUsername.value.trim();
    const code = recoveryCode.value.trim();
    if (!username || !code) {
      showError(i18nLogin.errors.enterUserRecoveryCode);
      setLoading(btn, false);
      return;
    }
    const result = await postLogin("/api/auth/recovery/verify", { username, code, remember: getRememberValue() }).catch(() => false);
    if (result === "mfa") {
      // 2FA required. The 2FA view is already shown.
    } else if (!result) {
      setLoading(btn, false);
    }
  });

  // Format recovery code input: uppercase + auto-dash
  document.getElementById("recovery-code")?.addEventListener("input", e => {
    const inp = e.target;
    if (!(inp instanceof HTMLInputElement)) return;
    let val = inp.value.replace(/[^A-Z0-9a-z]/g, "").toUpperCase();
    // Insert dash every 4 chars
    val = val.match(/.{1,4}/g)?.join("-") ?? val;
    inp.value = val.slice(0, 14); // XXXX-XXXX-XXXX = 14 chars
  });

  // Verify TOTP code
  document.getElementById("btn-2fa")?.addEventListener("click", async () => {
    const totpCodeInput = document.getElementById("totp-code");
    if (!(totpCodeInput instanceof HTMLInputElement)) return;
    const code = totpCodeInput.value.trim();
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      showError(i18nLogin.errors.enterTotp6Digits);
      return;
    }

    const btn = document.getElementById("btn-2fa");
    if (!(btn instanceof HTMLButtonElement)) return;
    setLoading(btn, true);
    clearError();

    const res = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrf() },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (data.ok) {
      completeLogin();
    } else {
      showError(serverErrorMessage(data, i18nLogin.errors.invalidTotpCode));
      setLoading(btn, false);
    }
  });

  // Auto-submit 2FA form when 6 digits entered
  document.getElementById("totp-code")?.addEventListener("input", (e) => {
    const inp = e.target;
    if (!(inp instanceof HTMLInputElement)) return;
    if (inp.value.length === 6) {
      document.getElementById("btn-2fa")?.click();
    }
  });

  // Cancel 2FA
  document.getElementById("btn-2fa-cancel")?.addEventListener("click", () => {
    const totpCodeInput = document.getElementById("totp-code");
    if (totpCodeInput instanceof HTMLInputElement) {
      totpCodeInput.value = "";
    }
    resetToFirstFactor();
  });

  // ── Theme toggle ──────────────────────────────────────────────────────────
  // El login (AuthLayout) no carga el theme-init del panel, así que aquí mismo
  // restauramos y cableamos el toggle con el MISMO contrato (`lxp-theme` +
  // `lxp-theme-user-set`) para que la elección persista y sea coherente con el
  // resto del panel. El icono/label reflejan el modo actual (sol=claro,
  // luna=oscuro).
  const themeRoot = document.documentElement;
  function syncThemeButtons(dark: boolean) {
    document.querySelectorAll<HTMLElement>(".setup-theme-toggle").forEach((btn) => {
      const icon = btn.querySelector<HTMLElement>(".setup-theme-toggle__icon");
      const label = btn.querySelector<HTMLElement>(".setup-theme-toggle__label");
      if (icon) {
        icon.classList.toggle("ti-sun", !dark);
        icon.classList.toggle("ti-moon", dark);
      }
      if (label) {
        const next = dark ? btn.dataset.themeLabelDark : btn.dataset.themeLabelLight;
        if (next) label.textContent = next;
      }
    });
  }
  function applyLoginTheme(dark: boolean, persist = false) {
    themeRoot.classList.toggle("dark", dark);
    if (persist) {
      // MUST match lib/theme-storage-keys.ts LXP_THEME_KEY / LXP_THEME_USER_SET_KEY
      // (inline/define-vars script — keep the literals in lockstep).
      localStorage.setItem("lxp-theme", dark ? "dark" : "light");
      localStorage.setItem("lxp-theme-user-set", "1");
      // En el WebView de la app móvil, propaga la elección a la app nativa.
      // No-op fuera del WebView. Ver native-bridge.ts.
      notifyNativeTheme(dark);
    }
    syncThemeButtons(dark);
  }
  // Restaura solo si el usuario eligió oscuro explícitamente (mismo gate que
  // theme-init/restoreTheme); en otro caso, claro por defecto.
  applyLoginTheme(
    localStorage.getItem("lxp-theme-user-set") === "1" &&
      localStorage.getItem("lxp-theme") === "dark",
  );
  document.querySelectorAll(".setup-theme-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyLoginTheme(!themeRoot.classList.contains("dark"), true);
    });
  });

  document.querySelectorAll(".setup-language-selector").forEach((selector) => {
    selector.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      const nextLocale = target.value;
      // En el WebView de la app móvil la APP conduce el cambio de idioma: solo le
      // notificamos. Fijar la cookie + recargar aquí compite con la re-inyección
      // de la app (languageRef viejo) que reescribe la cookie al idioma anterior
      // tras onLoadEnd → la UI revertía ~1s después. La app navega al nuevo idioma.
      if (isAppWebView()) {
        notifyNativeLanguage(nextLocale);
        return;
      }
      // Demás dispositivos (navegador): flujo normal. Clear lxp-locale on host +
      // parent domains first so a broader-scoped stale cookie can't shadow the new
      // choice; then set it fresh host-only and reload.
      persistLocaleCookie(nextLocale);
      window.location.reload();
    });
  });
}
