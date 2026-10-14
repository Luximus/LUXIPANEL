import {registrationOptions,serializeRegistrationCredential} from "@/lib/webauthn";
  import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
  import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
  import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
  import { escapeHtml, escapeJsAttr } from "/scripts/extracted/lib/escape.js";
  import { openDialog } from "/scripts/extracted/lib/dom.js";
  import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";

  // ── i18n ───────────────────────────────────────────────────
  const { loadI18n, t, fmt } = createPageI18n("preferences-i18n");

  // ── Toast ──────────────────────────────────────────────────
  function showToast(msg: string, ok = true) {
    const t = document.getElementById("toast")!;
    const inner = document.getElementById("toast-inner")!;
    const icon = document.getElementById("toast-icon")!;
    document.getElementById("toast-msg")!.textContent = msg;
    inner.className = `flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm ${
      ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
         : "border-destructive/30 bg-destructive/10 text-destructive"
    }`;
    icon.className = `text-base ${ok ? "ti ti-circle-check" : "ti ti-circle-x"}`;
    t.classList.remove("hidden");
    setTimeout(() => t.classList.add("hidden"), 3500);
  }

  // ── Profile ────────────────────────────────────────────────
  document.getElementById("btn-save-profile")?.addEventListener("click", async () => {
    const displayName = (document.getElementById("pref-display-name") as HTMLInputElement).value.trim();
    const phone = (document.getElementById("pref-phone") as HTMLInputElement).value.trim();
    const payload: Record<string, unknown> = { displayName };
    payload.phoneE164 = phone.length > 0 ? phone : null;
    const res = await api.put<any>("/api/preferences", payload);
    if (res.ok) showToast(t("toasts.profileUpdated", "Perfil actualizado"));
    else showToast(res.error ?? t("toasts.errorUpdate", "Error al actualizar"), false);
  });

  // ── Change password ────────────────────────────────────────
  document.getElementById("btn-change-pw")?.addEventListener("click", async () => {
    const current = (document.getElementById("pw-current") as HTMLInputElement).value;
    const newPw = (document.getElementById("pw-new") as HTMLInputElement).value;
    const confirm = (document.getElementById("pw-confirm") as HTMLInputElement).value;
    const errEl = document.getElementById("pw-error")!;

    if (newPw !== confirm) {
      errEl.textContent = t("errors.passwordMismatch", "Las contraseñas no coinciden");
      errEl.classList.remove("hidden");
      return;
    }
    if (newPw.length < 8) {
      errEl.textContent = t("errors.passwordTooShort", "La contraseña debe tener al menos 8 caracteres");
      errEl.classList.remove("hidden");
      return;
    }
    errEl.classList.add("hidden");

    const res = await api.put<any>("/api/preferences/password", { currentPassword: current, newPassword: newPw });
    if (res.ok) {
      showToast(t("toasts.passwordUpdated", "Contraseña actualizada"));
      (document.getElementById("pw-current") as HTMLInputElement).value = "";
      (document.getElementById("pw-new") as HTMLInputElement).value = "";
      (document.getElementById("pw-confirm") as HTMLInputElement).value = "";
    } else {
      errEl.textContent = res.error ?? t("errors.passwordChangeError", "Error al cambiar contraseña");
      errEl.classList.remove("hidden");
    }
  });

  // ── Passkeys ───────────────────────────────────────────────
  interface Passkey {
    label?: string;
    createdAt?: string; id: string; name: string; created_at: string; last_used?: string; }

  async function loadPasskeys() {
    const res = await api.get<any>("/api/auth/passkeys");
    document.getElementById("passkeys-skeleton")!.classList.add("hidden");

    if (!res.ok || !Array.isArray(res.data)) {
      document.getElementById("passkeys-empty")!.classList.remove("hidden");
      return;
    }

    const keys: Passkey[] = res.data;
    if (keys.length === 0) {
      document.getElementById("passkeys-empty")!.classList.remove("hidden");
      return;
    }

    const list = document.getElementById("passkeys-list")!;
    list.classList.remove("hidden");
    list.innerHTML = keys.map((k) => `
      <div class="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-2.5">
        <div class="flex items-center gap-3">
          <i class="ti ti-fingerprint text-blue-500 text-base"></i>
          <div>
            <p class="text-sm font-medium">${escapeHtml(k.label || k.name || "Passkey")}</p>
            <p class="text-xs text-muted-foreground">${fmt(t("labels.passkeyRegistered", "Registrada {date}"), { date: new Date(k.createdAt || k.created_at).toLocaleDateString(document.documentElement.lang || undefined) })}</p>
          </div>
        </div>
        <button onclick="deletePasskey('${escapeJsAttr(k.id)}')"
          class="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
          <i class="ti ti-trash text-sm"></i>
        </button>
      </div>`).join("");
  }

  (window as any).deletePasskey = async (id: string) => {
    if (!await openConfirm(t("confirm.deletePasskey", "¿Eliminar esta passkey?"), { title: t("confirm.deletePasskeyTitle", "Eliminar passkey"), variant: "danger" })) return;
    const res = await api.delete<any>(`/api/auth/passkeys/${id}`);
    if (res.ok) { showToast(t("toasts.passkeyDeleted", "Passkey eliminada")); loadPasskeys(); }
    else showToast(res.error ?? t("toasts.error", "Error"), false);
  };

  // WebAuthn registration
  document.getElementById("btn-add-passkey")?.addEventListener("click", async () => {
    // Check WebAuthn support
    if (!navigator.credentials || typeof navigator.credentials.create !== "function") {
      showToast(t("errors.passkeyNotSupported", "Tu navegador no soporta Passkey. Por favor, usa Chrome, Firefox, Safari o Edge reciente."), false);
      return;
    }

    try {
      // 1. Get challenge from server
      const initRes = await api.post<any>("/api/auth/passkeys/register-options", {});
      if (!initRes.ok) { showToast(t("errors.passkeyInitFailed", "No se pudo iniciar el registro"), false); return; }

      const options = registrationOptions(initRes.data);

      // 2. Browser creates credential
      const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential | null;
      if (!credential) { showToast(t("toasts.registrationCancelled", "Registro cancelado"), false); return; }

      // 3. Send to server
      const finishRes = await api.post<any>("/api/auth/passkeys/register-verify", {
        response: serializeRegistrationCredential(credential),
      });

      if (finishRes.ok) { showToast(t("toasts.passkeyRegistered", "Passkey registrada correctamente")); loadPasskeys(); }
      else showToast(finishRes.error ?? t("errors.passkeyFinishError", "Error al finalizar registro"), false);
    } catch (err: any) {
      if (err.name === "NotAllowedError") showToast(t("toasts.registrationCancelledByUser", "Registro cancelado por el usuario"), false);
      else showToast(fmt(t("errors.genericWithMessage", "Error: {message}"), { message: err.message }), false);
    }
  });

  // ── Recovery codes ─────────────────────────────────────────
  let currentCodes: string[] = [];

  async function loadRecoveryCodes() {
    const res = await api.get<any>("/api/auth/recovery/status");
    const statusEl = document.getElementById("codes-status")!;
    if (res.ok) {
      const d = res.data as any;
      statusEl.textContent = d?.hasActiveCodes
        ? t("labels.hasActiveCodes", "Tienes códigos de recuperación activos.")
        : t("labels.noActiveCodes", "No tienes códigos de recuperación activos.");
    } else {
      statusEl.textContent = t("labels.notAvailable", "No disponible");
    }
  }

  function displayCodes(codes: string[]) {
    currentCodes = codes;
    const grid = document.getElementById("codes-grid")!;
    grid.className = "grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3";
    grid.innerHTML = codes.map(c => `
      <div class="rounded-lg border border-border bg-muted/50 px-3 py-2 text-center font-mono text-xs tracking-wider">${c}</div>
    `).join("");
    grid.classList.remove("hidden");
    document.getElementById("codes-warning")!.classList.remove("hidden");
    document.getElementById("codes-actions")!.classList.remove("hidden");
    document.getElementById("codes-status")!.textContent = fmt(t("labels.codesGenerated", "{count} códigos generados. Guárdalos en un lugar seguro."), { count: codes.length });
  }

  document.getElementById("btn-gen-codes")?.addEventListener("click", () => {
    openDialog("dlg-confirm-regen");
  });

  document.getElementById("btn-confirm-regen")?.addEventListener("click", async () => {
    (document.getElementById("dlg-confirm-regen") as HTMLDialogElement).close();
    const res = await api.post<any>("/api/auth/recovery/generate", {});
    const codes = Array.isArray(res.data?.codes) ? (res.data.codes as string[]) : Array.isArray(res.data) ? (res.data as string[]) : null;
    if (res.ok && codes) {
      displayCodes(codes);
    } else {
      showToast(res.error ?? t("errors.generateCodesError", "Error al generar códigos"), false);
    }
  });

  document.getElementById("btn-copy-codes")?.addEventListener("click", () => {
    navigator.clipboard.writeText(currentCodes.join("\n")).then(() => showToast(t("toasts.codesCopied", "Códigos copiados al portapapeles")));
  });

  document.getElementById("btn-print-codes")?.addEventListener("click", () => {
    const win = window.open("", "_blank")!;
    win.document.write(`<html><body style="font-family:monospace;padding:2rem"><h2>${t("labels.printTitle", "Códigos de recuperación — LUXIPANEL")}</h2>
    <p style="color:#666">${t("labels.printWarning", "Guarda estos códigos en un lugar seguro. Cada uno solo puede usarse una vez.")}</p>
    <ul style="list-style:none;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:0.5rem 2rem">
    ${currentCodes.map(c => `<li style="border:1px solid #ccc;padding:0.5rem 1rem;border-radius:4px">${c}</li>`).join("")}
    </ul></body></html>`);
    win.print();
    win.close();
  });

  // ── Audit log ──────────────────────────────────────────────
  interface AuditEntry { action?: string; eventType?: string; ip?: string; user_agent?: string; created_at?: string; createdAt?: string; severity?: string; success?: boolean; }

  function getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      login: t("actions.login", "Inicio de sesión"),
      logout: t("actions.logout", "Cierre de sesión"),
      password_change: t("actions.passwordChange", "Cambio de contraseña"),
      passkey_register: t("actions.passkeyRegister", "Passkey registrada"),
      passkey_delete: t("actions.passkeyDelete", "Passkey eliminada"),
      recovery_code_used: t("actions.recoveryCodeUsed", "Código de recuperación usado"),
      profile_update: t("actions.profileUpdate", "Perfil actualizado"),
      "2fa_enabled": t("actions.twoFaEnabled", "2FA habilitado"),
      "2fa_disabled": t("actions.twoFaDisabled", "2FA deshabilitado"),
    };
    return labels[action] ?? action;
  }

  async function loadAuditLog() {
    const res = await api.get<any>("/api/preferences/audit-log");
    document.getElementById("audit-skeleton")!.classList.add("hidden");

    if (!res.ok || !Array.isArray(res.data) || (res.data as AuditEntry[]).length === 0) {
      document.getElementById("audit-empty")!.classList.remove("hidden");
      return;
    }

    const entries: AuditEntry[] = res.data as AuditEntry[];
    const list = document.getElementById("audit-list")!;
    list.classList.remove("hidden");
    list.innerHTML = entries.slice(0, 20).map((e) => `
      <div class="flex items-center justify-between py-3 first:pt-0 last:pb-0">
        <div class="flex items-center gap-3">
          <span class="flex h-7 w-7 items-center justify-center rounded-full ${(e.success ?? !["warning", "error", "critical"].includes(e.severity || "")) ? "bg-emerald-500/10" : "bg-destructive/10"}">
            <i class="ti ${(e.success ?? !["warning", "error", "critical"].includes(e.severity || "")) ? "ti-check text-emerald-500" : "ti-x text-destructive"} text-xs"></i>
          </span>
          <div>
            <p class="text-sm">${escapeHtml(getActionLabel(e.eventType || e.action || ""))}</p>
            ${e.ip ? `<p class="text-xs text-muted-foreground">${escapeHtml(e.ip)}</p>` : ""}
          </div>
        </div>
        <span class="text-xs text-muted-foreground">${new Date(e.createdAt || e.created_at || "").toLocaleString(document.documentElement.lang || undefined, { dateStyle: "short", timeStyle: "short" })}</span>
      </div>`).join("");
  }

  // ── Two-Factor Authentication (2FA) ────────────────────────
  import QRCode from "/scripts/extracted/vendor/qrcode-browser.js?v=2";

  let setupSecret = "";

  async function load2FAStatus() {
    const res = await api.get<any>("/api/auth/totp/status");
    const enabled = res.ok && res.data?.enabled;

    const badge = document.getElementById("2fa-badge")!;
    const description = document.getElementById("2fa-description")!;
    const setupBtn = document.getElementById("btn-setup-2fa")!;
    const disableBtn = document.getElementById("btn-disable-2fa")!;

    if (enabled) {
      badge.className = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
      badge.innerHTML = `<i class="ti ti-circle-check text-sm"></i>${t("labels.twoFaBadgeEnabled", "Activado")}`;
      description.classList.remove("hidden");
      setupBtn.classList.add("hidden");
      disableBtn.classList.remove("hidden");
    } else {
      badge.className = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-muted text-muted-foreground";
      badge.innerHTML = `<i class="ti ti-circle-x text-sm"></i>${t("labels.twoFaBadgeDisabled", "Desactivado")}`;
      description.classList.add("hidden");
      setupBtn.classList.remove("hidden");
      disableBtn.classList.add("hidden");
    }
  }

  document.getElementById("btn-setup-2fa")?.addEventListener("click", async () => {
    const dlg = document.getElementById("dlg-setup-2fa") as HTMLDialogElement;
    const secretInput = document.getElementById("secret-text") as HTMLInputElement;
    const qrCanvas = document.getElementById("qr-canvas") as HTMLCanvasElement;

    // Request setup from backend
    const res = await api.get<any>("/api/auth/totp/setup");
    if (!res.ok) {
      showToast(res.error ?? t("errors.twoFaSetupError", "Error al iniciar configuración de 2FA"), false);
      return;
    }

    setupSecret = res.data.secret;
    const qrUri = res.data.qrUri;

    // Display secret
    secretInput.value = setupSecret;

    // Generate QR code
    try {
      await QRCode.toCanvas(qrCanvas, qrUri, { width: 200, errorCorrectionLevel: "H" });
    } catch (err) {
      console.error("Error generating QR:", err);
    }

    // Clear error and code input
    document.getElementById("2fa-setup-error")?.classList.add("hidden");
    (document.getElementById("verify-code-input") as HTMLInputElement).value = "";

    dlg.showModal();
  });

  document.getElementById("btn-copy-secret")?.addEventListener("click", () => {
    const secret = (document.getElementById("secret-text") as HTMLInputElement).value;
    navigator.clipboard.writeText(secret).then(() => showToast(t("toasts.secretCopied", "Secret copiado al portapapeles")));
  });

  document.getElementById("verify-code-input")?.addEventListener("input", (e) => {
    const inp = e.target as HTMLInputElement;
    if (inp.value.length === 6) {
      document.getElementById("btn-confirm-2fa-enable")?.click();
    }
  });

  document.getElementById("btn-confirm-2fa-enable")?.addEventListener("click", async () => {
    const code = (document.getElementById("verify-code-input") as HTMLInputElement).value.trim();
    const errorEl = document.getElementById("2fa-setup-error")!;

    if (code.length !== 6 || !/^\d+$/.test(code)) {
      errorEl.textContent = t("errors.enterSixDigits", "Ingresa los 6 dígitos del código");
      errorEl.classList.remove("hidden");
      return;
    }

    errorEl.classList.add("hidden");
    const btn = document.getElementById("btn-confirm-2fa-enable") as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader-2 animate-spin text-base"></i>';

    const res = await api.post<any>("/api/auth/totp/enable", { code });

    btn.disabled = false;
    btn.innerHTML = t("actions.activateTwoFa", "Activar 2FA");

    if (res.ok) {
      (document.getElementById("dlg-setup-2fa") as HTMLDialogElement).close();
      showToast(t("toasts.twoFaActivated", "2FA activado correctamente"));
      load2FAStatus();
    } else {
      errorEl.textContent = res.error ?? t("errors.invalidCode", "Código inválido");
      errorEl.classList.remove("hidden");
    }
  });

  document.getElementById("btn-disable-2fa")?.addEventListener("click", () => {
    openDialog("dlg-disable-2fa");
  });

  document.getElementById("btn-confirm-2fa-disable")?.addEventListener("click", async () => {
    (document.getElementById("dlg-disable-2fa") as HTMLDialogElement).close();
    const res = await api.patch<any>("/api/auth/totp/disable");
    if (res.ok) {
      showToast(t("toasts.twoFaDeactivated", "2FA desactivado"));
      load2FAStatus();
    } else {
      showToast(res.error ?? t("errors.twoFaDeactivateError", "Error al desactivar 2FA"), false);
    }
  });

  // ── Init ───────────────────────────────────────────────────
  // Cooldown: module-eval + after-swap + page-load = 3 fires/entrada.
  let initLastAt = 0;
  const INIT_COOLDOWN_MS = SCRIPT_INIT_COOLDOWN_MS;
  function init() {
    if (!document.getElementById("pref-root")) return;
    if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;
    initLastAt = Date.now();
    loadI18n();
    const view = new URLSearchParams(location.search).get("workspaceView");
    if (!view || view === "security") { loadPasskeys(); loadRecoveryCodes(); load2FAStatus(); }
    if (!view || view === "audit") loadAuditLog();
  }
  document.addEventListener("astro:page-load", init);
  document.addEventListener("astro:after-swap", init);
  init();
