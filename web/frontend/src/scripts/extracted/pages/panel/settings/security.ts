// Settings page — per-user auth: login methods, passkeys, recovery codes, 2FA/TOTP,
// the audit log, hCaptcha credential and audit-event labels. Gated by
// CAN_MANAGE_LOCAL_AUTH; managed sessions get read-only UI.
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm, openPrompt } from "/scripts/extracted/lib/confirm.js?v=3";
import QRCode from "/scripts/extracted/vendor/qrcode-browser.js?v=2";
import { t, fmt, showToast } from "./dom";
import { CAN_MANAGE_LOCAL_AUTH, S } from "./state";
import { bumpSecurityBadge } from "./tabs";
import { openDialog } from "/scripts/extracted/lib/dom.js";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";

export interface Passkey {
  id: string;
  label?: string;
  createdAt?: string | null;
  // Older targets may still return the previous field names.
  name?: string;
  created_at?: string | null;
}

function formatPasskeyRegistrationDate(passkey: Passkey): string {
  const value = passkey.createdAt ?? passkey.created_at;
  if (typeof value !== "string" || !value.trim()) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(document.documentElement.lang || undefined);
}

export interface AuditEntry {
  eventType: string;
  ip?: string | null;
  createdAt: string;
  severity?: string;
}

export function getActionLabels(): Record<string, string> {
  return {
    login: t("labels.auditLogin", "Inicio de sesión"),
    login_failed: t("labels.auditLoginFailed", "Intento de login fallido"),
    logout: t("labels.auditLogout", "Cierre de sesión"),
    password_change: t("labels.auditPasswordChange", "Cambio de contraseña"),
    passkey_register: t("labels.auditPasskeyRegister", "Passkey registrada"),
    passkey_delete: t("labels.auditPasskeyDelete", "Passkey eliminada"),
    recovery_code_used: t("labels.auditRecoveryCodeUsed", "Código de recuperación usado"),
    profile_update: t("labels.auditProfileUpdate", "Perfil actualizado"),
    settings_update: t("labels.auditSettingsUpdate", "Ajustes actualizados"),
    "2fa_enabled": t("labels.audit2faEnabled", "2FA habilitado"),
    "2fa_disabled": t("labels.audit2faDisabled", "2FA deshabilitado"),
  };
}

/** Human-readable label for any audit event, even ones not in the map. */
export function auditLabel(eventType: string | undefined): string {
  if (!eventType) return t("labels.auditEventDefault", "Evento");
  const labels = getActionLabels();
  if (labels[eventType]) return labels[eventType]!;
  return eventType.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

// Disable only the passkey + recovery cards (used for non-admin managed users).
export function applyManagedPasskeyRecoveryUi() {
  const passkeyStatus = document.getElementById("passkey-status-text");
  const passkeyManageBtn = document.getElementById("btn-manage-passkeys") as HTMLButtonElement | null;
  const recoveryStatus = document.getElementById("recovery-status-text");
  const recoveryManageBtn = document.getElementById("btn-manage-recovery") as HTMLButtonElement | null;

  if (passkeyStatus) passkeyStatus.textContent = t("labels.managedByLp", "Gestionado por LP-LICENSE-SERVER");
  if (recoveryStatus) recoveryStatus.textContent = t("labels.managedByLp", "Gestionado por LP-LICENSE-SERVER");

  if (passkeyManageBtn) {
    passkeyManageBtn.disabled = true;
    passkeyManageBtn.textContent = t("labels.notAvailable", "No disponible");
    passkeyManageBtn.classList.add("opacity-60", "cursor-not-allowed");
  }

  if (recoveryManageBtn) {
    recoveryManageBtn.disabled = true;
    recoveryManageBtn.textContent = t("labels.notAvailable", "No disponible");
    recoveryManageBtn.classList.add("opacity-60", "cursor-not-allowed");
  }
}

// Show the 2FA/TOTP section as externally managed. Only used when the session
// has no local-auth capability (CAN_MANAGE_LOCAL_AUTH is false) — i.e. a bridged
// managed session that is neither direct-SSH nor a sudo-group admin. Capable
// sessions get the full 2FA controls (load2FAStatusSettings), exactly like
// passkeys and recovery codes.
export function applyManaged2faUi() {
  const self2faBadge = document.getElementById("s-self-2fa-badge");
  const self2faText = document.getElementById("s-self-2fa-text");
  const self2faSetupBtn = document.getElementById("btn-setup-2fa-settings") as HTMLButtonElement | null;
  const self2faDeleteBtn = document.getElementById("btn-disable-2fa-settings") as HTMLButtonElement | null;
  const self2faToggleBtn = document.getElementById("btn-deactivate-2fa-settings") as HTMLButtonElement | null;

  if (self2faBadge) {
    self2faBadge.className = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-muted text-muted-foreground";
    self2faBadge.innerHTML = `<i class="ti ti-link text-sm"></i>${t("labels.managedExternally", "Gestionado externamente")}`;
  }

  if (self2faText) {
    self2faText.textContent = t("labels.twoFaManagedByLp", "La autenticación se administra desde LP-LICENSE-SERVER en este modo.");
  }

  [self2faSetupBtn, self2faDeleteBtn, self2faToggleBtn].forEach((btn) => {
    if (!btn) return;
    btn.disabled = true;
    btn.classList.add("opacity-60", "cursor-not-allowed");
  });
}

export function enforceAtLeastOneMethod() {
  const checks = Array.from(document.querySelectorAll<HTMLInputElement>(".login-method-check"));
  const enabled = checks.filter((c) => c.checked);
  const warning = document.getElementById("login-methods-warning")!;

  if (enabled.length === 1) {
    enabled[0].disabled = true;
    warning.classList.add("hidden");
  } else {
    checks.forEach((c) => (c.disabled = false));
    warning.classList.add("hidden");
  }

  if (enabled.length === 0) {
    checks.forEach((c) => {
      if (!c.disabled) c.checked = true;
    });
    warning.classList.remove("hidden");
  }
}

export function updateAuditLogButtonVisibility() {
  const toggle = document.getElementById("s-audit-log") as HTMLInputElement | null;
  const btn = document.getElementById("btn-open-audit-log");
  if (!toggle || !btn) return;
  btn.classList.toggle("hidden", !toggle.checked);
}

export function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function serializeRegistrationCredential(credential: PublicKeyCredential): Record<string, unknown> {
  const response = credential.response as AuthenticatorAttestationResponse;
  const credentialId = arrayBufferToBase64url(credential.rawId);

  return {
    id: credentialId,
    rawId: credentialId,
    type: credential.type,
    response: {
      clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
      attestationObject: arrayBufferToBase64url(response.attestationObject),
    },
  };
}

let authStatusGeneration = 0;
let totpStatusGeneration = 0;

export async function loadAuthMethodStatus() {
  // Passkeys, recovery codes AND 2FA/TOTP are all per-user credentials stored on
  // the connected server, so any session with local-auth capability (direct-SSH
  // or a sudo-group admin in a bridged session) manages the three of them right
  // here. The 2FA status itself is loaded separately by load2FAStatusSettings().
  if (!CAN_MANAGE_LOCAL_AUTH) {
    applyManagedPasskeyRecoveryUi();
    return;
  }

  const passkeyStatus = document.getElementById("passkey-status-text");
  const passkeyManageBtn = document.getElementById("btn-manage-passkeys");
  const recoveryStatus = document.getElementById("recovery-status-text");
  const recoveryManageBtn = document.getElementById("btn-manage-recovery");
  const generation = ++authStatusGeneration;
  const scope = resolveTargetScope();
  const root = document.getElementById("settings-content");
  const isCurrent = () => generation === authStatusGeneration && scope === resolveTargetScope()
    && root === document.getElementById("settings-content");

  const pkRequest = api.get<any>("/api/auth/passkeys");
  const rcRequest = api.get<any>("/api/auth/recovery/status");
  const pkRes = await pkRequest;
  if (!isCurrent()) return;
  const passkeyCount = pkRes.ok && Array.isArray(pkRes.data) ? pkRes.data.length : 0;
  if (passkeyStatus) {
    passkeyStatus.textContent =
      passkeyCount > 0
        ? fmt(t("labels.passkeyCount", "{count} passkey(s) registrada(s)"), { count: passkeyCount })
        : t("labels.noPasskeys", "Sin passkeys registradas");
  }
  if (passkeyManageBtn) {
    passkeyManageBtn.textContent = passkeyCount > 0 ? t("actions.manage", "Administrar") : t("actions.configure", "Configurar");
  }

  const rcRes = await rcRequest;
  if (!isCurrent()) return;
  const hasCodes = rcRes.ok ? Boolean(rcRes.data?.hasActiveCodes) : false;
  if (recoveryStatus) {
    recoveryStatus.textContent = hasCodes
      ? t("labels.recoveryCodesGenerated", "Codigos de recuperacion generados")
      : t("labels.noRecoveryCodes", "Sin codigos generados");
  }
  if (recoveryManageBtn) {
    recoveryManageBtn.textContent = hasCodes ? t("actions.viewOrRegenerate", "Ver / regenerar") : t("actions.generate", "Generar");
  }
}

// ── hCaptcha credential (site key + secret) ───────────────────────────────
// Unlike the toggle (`s-hcaptcha-enabled`, driven automatically via FIELDS),
// the site key + secret are handled by hand: the secret comes back masked (or
// absent) from GET /api/settings, so it must NEVER be echoed back verbatim or
// pushed on the generic autosave (that would overwrite the real secret with a
// mask). We only paint the site key, show a "configured/not configured" state
// for the secret, and save via an explicit button.
export let hcaptchaSecretConfigured = false;

export function setHcaptchaSecretConfigured(configured: boolean) {
  hcaptchaSecretConfigured = configured;
  const badge = document.getElementById("cred-hcaptcha-status");
  const hint = document.getElementById("cred-hcaptcha-secret-hint");
  if (badge) {
    badge.className = configured
      ? "inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
      : "inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground";
    badge.innerHTML = configured
      ? `<i class="ti ti-circle-check text-xs"></i> ${t("credentials.hcaptcha.statusConfigured", "Configured")}`
      : `<i class="ti ti-circle-x text-xs"></i> ${t("credentials.hcaptcha.statusMissing", "Not configured")}`;
  }
  hint?.classList.toggle("hidden", !configured);
}

export function applyHcaptchaCredential(data: Record<string, unknown>) {
  const sitekeyEl = document.getElementById("cred-hcaptcha-sitekey") as HTMLInputElement | null;
  if (sitekeyEl) sitekeyEl.value = String(data.hcaptcha_sitekey ?? "");
  const secretRaw = data.hcaptcha_secret;
  const configured = typeof secretRaw === "string" && secretRaw.trim() !== "";
  setHcaptchaSecretConfigured(configured);
}

export async function saveHcaptchaCredential() {
  const sitekeyEl = document.getElementById("cred-hcaptcha-sitekey") as HTMLInputElement | null;
  const secretEl = document.getElementById("cred-hcaptcha-secret") as HTMLInputElement | null;
  const btn = document.getElementById("cred-hcaptcha-save") as HTMLButtonElement | null;
  if (!sitekeyEl || !secretEl) return;

  const settings: Array<{ key: string; value: string; category: string }> = [
    { key: "hcaptcha_sitekey", value: sitekeyEl.value.trim(), category: "security" },
  ];
  // Only push the secret when the admin typed a NEW one. Leaving it blank keeps
  // the stored secret untouched (never overwrite it with "").
  const secretVal = secretEl.value.trim();
  if (secretVal) settings.push({ key: "hcaptcha_secret", value: secretVal, category: "security" });

  if (btn) btn.disabled = true;
  try {
    const res = await api.put<any>("/api/settings/bulk", { settings });
    if (res.ok) {
      secretEl.value = "";
      if (secretVal) setHcaptchaSecretConfigured(true);
      showToast(t("credentials.hcaptcha.saved", "hCaptcha settings saved"));
    } else {
      showToast(res.error ?? t("credentials.error", "An error occurred"), false);
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function requestPasskeyName(currentName = ""): Promise<string | null> {
  const pending = openPrompt(t("passkeyName.hint", "Usa un nombre que te ayude a reconocer el dispositivo."), {
    title: t("passkeyName.title", "Nombre de la passkey"),
    placeholder: t("passkeyName.placeholder", "Ej. Portátil personal"),
    defaultValue: currentName,
    okText: t("passkeyName.save", "Guardar nombre"),
    cancelText: t("passkeyName.cancel", "Cancelar"),
  });
  const input = document.getElementById("prompt-modal-input") as HTMLInputElement | null;
  const previousMaxLength = input?.getAttribute("maxlength");
  const previousRequired = input?.required ?? false;
  if (input) { input.maxLength = 128; input.required = true; }
  let result: string | null;
  try { result = await pending; }
  finally {
    if (input) {
      if (previousMaxLength == null) input.removeAttribute("maxlength");
      else input.setAttribute("maxlength", previousMaxLength);
      input.required = previousRequired;
    }
  }
  if (result === null) return null;
  const value = result.trim();
  if (value.length > 0 && value.length <= 128) return value;
  showToast(t("passkeyName.invalid", "Escribe un nombre de 1 a 128 caracteres."), false);
  return null;
}

export async function renamePasskeySettings(id: string, currentName: string) {
  const scope = resolveTargetScope();
  const label = await requestPasskeyName(currentName);
  if (label === null || label === currentName || scope !== resolveTargetScope()) return;
  const res = await api.patch(`/api/auth/passkeys/${encodeURIComponent(id)}`, { label });
  if (scope !== resolveTargetScope()) return;
  if (!res.ok) {
    showToast(t("passkeyName.error", "No se pudo guardar el nombre."), false);
    return;
  }
  showToast(t("passkeyName.saved", "Nombre actualizado"));
  await loadPasskeysSettings();
}

export async function loadPasskeysSettings() {
  if (!CAN_MANAGE_LOCAL_AUTH) {
    showToast(t("toasts.passkeysInLp", "Passkeys se gestionan en LP-LICENSE-SERVER"), false);
    return;
  }

  const skeleton = document.getElementById("passkeys-settings-skeleton")!;
  const list = document.getElementById("passkeys-settings-list")!;
  const empty = document.getElementById("passkeys-settings-empty")!;
  skeleton.classList.remove("hidden");
  list.classList.add("hidden");
  empty.classList.add("hidden");

  const res = await api.get<any>("/api/auth/passkeys");
  skeleton.classList.add("hidden");

  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) {
    empty.classList.remove("hidden");
    bumpSecurityBadge(0);
    return;
  }

  const keys = res.data as Passkey[];
  bumpSecurityBadge(keys.length);
  list.classList.remove("hidden");
  list.innerHTML = keys
    .map(
      (k) => `
      <div class="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-2.5">
        <div class="flex min-w-0 items-center gap-3">
          <i class="ti ti-fingerprint text-blue-500 text-base"></i>
          <div class="min-w-0">
            <p class="text-sm font-medium break-words">${escapeHtml(k.label || k.name || "Passkey")}</p>
            <p class="text-xs text-muted-foreground">${fmt(t("labels.passkeyRegistered", "Registrada {date}"), { date: formatPasskeyRegistrationDate(k) })}</p>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-1">
        <button data-passkey-id="${escapeHtml(k.id)}" aria-label="${escapeHtml(t("passkeyName.edit", "Editar nombre"))}" title="${escapeHtml(t("passkeyName.edit", "Editar nombre"))}" class="btn-rename-passkey-settings rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <i class="ti ti-pencil text-sm" aria-hidden="true"></i>
        </button>
        <button data-passkey-id="${escapeHtml(k.id)}" aria-label="${escapeHtml(t("confirm.deletePasskeyTitle", "Eliminar passkey"))}" class="btn-delete-passkey-settings rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
          <i class="ti ti-trash text-sm" aria-hidden="true"></i>
        </button>
        </div>
      </div>`
    )
    .join("");

  list.querySelectorAll<HTMLButtonElement>(".btn-rename-passkey-settings").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = keys.find((k) => k.id === btn.dataset.passkeyId);
      if (!key || btn.disabled) return;
      btn.disabled = true;
      try { await renamePasskeySettings(key.id, key.label || key.name || "Passkey"); }
      finally { btn.disabled = false; }
    });
  });

  list.querySelectorAll<HTMLButtonElement>(".btn-delete-passkey-settings").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.passkeyId;
      if (!id) return;
      const key = keys.find((k) => k.id === id);
      if (!await openConfirm(`${t("confirm.deletePasskeyBody", "¿Eliminar esta passkey?")}\n${key?.label || key?.name || "Passkey"}`, { title: t("confirm.deletePasskeyTitle", "Eliminar passkey"), variant: "danger" })) return;
      const delRes = await api.delete<any>(`/api/auth/passkeys/${id}`);
      if (delRes.ok) {
        showToast(t("toasts.passkeyDeleted", "Passkey eliminada"));
        await loadPasskeysSettings();
        await loadAuthMethodStatus();
      } else {
        showToast(delRes.error ?? t("toasts.passkeyDeleteError", "Error al eliminar passkey"), false);
      }
    });
  });
}

export async function registerPasskeyFromSettings() {
  if (!CAN_MANAGE_LOCAL_AUTH) {
    showToast(t("toasts.passkeysInLp", "Passkeys se gestionan en LP-LICENSE-SERVER"), false);
    return;
  }

  if (!navigator.credentials || typeof navigator.credentials.create !== "function") {
    showToast(t("toasts.passkeyBrowserUnsupported", "Tu navegador no soporta Passkey"), false);
    return;
  }

  try {
    const scope = resolveTargetScope();
    const label = await requestPasskeyName();
    if (label === null || scope !== resolveTargetScope()) return;
    const initRes = await api.post<any>("/api/auth/passkeys/register-options", {});
    if (!initRes.ok) {
      showToast(initRes.error ?? t("toasts.passkeyRegisterInitError", "No se pudo iniciar el registro"), false);
      return;
    }

    if (scope !== resolveTargetScope()) return;
    const options = initRes.data as any;
    options.challenge = base64urlToUint8Array(options.challenge);
    options.user.id = base64urlToUint8Array(options.user.id);

    const credential = (await navigator.credentials.create({
      publicKey: options,
    })) as PublicKeyCredential | null;

    if (!credential) {
      showToast(t("toasts.passkeyRegisterCancelled", "Registro cancelado"), false);
      return;
    }

    if (scope !== resolveTargetScope()) return;
    const finishRes = await api.post<any>("/api/auth/passkeys/register-verify", {
      label,
      response: serializeRegistrationCredential(credential),
    });

    if (!finishRes.ok) {
      showToast(finishRes.error ?? t("toasts.passkeyRegisterFinishError", "Error al finalizar registro"), false);
      return;
    }

    showToast(t("toasts.passkeyRegistered", "Passkey registrada correctamente"));
    await loadPasskeysSettings();
    await loadAuthMethodStatus();
  } catch (err: any) {
    if (err?.name === "NotAllowedError") showToast(t("toasts.passkeyRegisterUserCancelled", "Registro cancelado por el usuario"), false);
    else showToast(err?.message ?? t("toasts.passkeyRegisterError", "Error al registrar passkey"), false);
  }
}

export async function loadRecoveryStatusInDialog() {
  if (!CAN_MANAGE_LOCAL_AUTH) {
    const statusEl = document.getElementById("codes-status-settings");
    if (statusEl) statusEl.textContent = t("labels.managedByLp", "Gestionado por LP-LICENSE-SERVER");
    return;
  }

  const statusEl = document.getElementById("codes-status-settings")!;
  const res = await api.get<any>("/api/auth/recovery/status");
  if (!res.ok) {
    statusEl.textContent = t("labels.notAvailable", "No disponible");
    return;
  }
  statusEl.textContent = res.data?.hasActiveCodes
    ? t("labels.recoveryCodesActive", "Tienes codigos de recuperacion activos.")
    : t("labels.recoveryCodesNone", "No tienes codigos de recuperacion activos.");
}

export function displayRecoveryCodes(codes: string[]) {
  S.recoveryCodes = codes;
  const grid = document.getElementById("codes-grid-settings")!;
  grid.innerHTML = codes
    .map(
      (c) =>
        `<div class="rounded-lg border border-border bg-muted/50 px-3 py-2 text-center font-mono text-xs tracking-wider">${c}</div>`
    )
    .join("");
  grid.classList.remove("hidden");
  document.getElementById("codes-warning-settings")!.classList.remove("hidden");
  document.getElementById("codes-actions-settings")!.classList.remove("hidden");
  document.getElementById("codes-status-settings")!.textContent = fmt(t("labels.recoveryCodesDisplayed", "{count} codigos generados. Guardalos en un lugar seguro."), { count: codes.length });
}

export async function generateRecoveryCodesFromSettings() {
  if (!CAN_MANAGE_LOCAL_AUTH) {
    showToast(t("toasts.recoveryCodesInLp", "Los codigos de recuperacion se gestionan en LP-LICENSE-SERVER"), false);
    return;
  }

  const btn = document.getElementById("btn-gen-codes-settings") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ti ti-loader-2 animate-spin text-sm"></i> ${t("actions.generating", "Generando...")}`;
  }

  const res = await api.post<any>("/api/auth/recovery/generate", {});
  const codes = Array.isArray(res.data?.codes) ? (res.data.codes as string[]) : Array.isArray(res.data) ? (res.data as string[]) : null;

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<i class="ti ti-refresh text-sm"></i> ${t("actions.generateOrRegenerate", "Generar / regenerar")}`;
  }

  if (res.ok && codes) {
    displayRecoveryCodes(codes);
    await loadAuthMethodStatus();
  } else {
    showToast(res.error ?? t("toasts.recoveryCodesGenerateError", "Error al generar codigos"), false);
  }
}

export async function load2FAStatusSettings() {
  // 2FA is locally manageable wherever passkeys/recovery are (per-user secret on
  // the connected server). Only show it as externally managed when the session
  // truly has no local-auth capability.
  if (!CAN_MANAGE_LOCAL_AUTH) {
    applyManaged2faUi();
    bumpSecurityBadge(0);
    return;
  }

  const badge = document.getElementById("s-self-2fa-badge");
  const text = document.getElementById("s-self-2fa-text");
  const setupBtn = document.getElementById("btn-setup-2fa-settings");
  const deleteBtn = document.getElementById("btn-disable-2fa-settings");
  const toggleBtn = document.getElementById("btn-deactivate-2fa-settings");
  if (!badge || !text || !setupBtn || !deleteBtn || !toggleBtn) return;

  const generation = ++totpStatusGeneration;
  const scope = resolveTargetScope();
  const res = await api.get<any>("/api/auth/totp/status");
  if (generation !== totpStatusGeneration || scope !== resolveTargetScope()
    || badge !== document.getElementById("s-self-2fa-badge")) return;
  const enabled = res.ok && Boolean(res.data?.enabled);
  const configured = res.ok && Boolean(res.data?.configured);
  S.currentTotpState = { enabled, configured };
  bumpSecurityBadge(configured ? 1 : 0);

  // Visibility rule:
  //   • Not configured           → only "Configurar" visible
  //   • Configured (any state)   → "Eliminar" + "Activar/Desactivar" visible,
  //                                "Configurar" hidden
  if (configured) {
    setupBtn.classList.add("hidden");
    deleteBtn.classList.remove("hidden");
    toggleBtn.classList.remove("hidden");

    if (enabled) {
      badge.className = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
      badge.innerHTML = `<i class="ti ti-circle-check text-sm"></i>${t("labels.twoFaEnabled", "Activado")}`;
      text.textContent = t("labels.twoFaEnabledDesc", "Se pedirá este 2FA en el siguiente inicio de sesión. Puedes deshabilitarlo sin borrar el secreto.");
      toggleBtn.className =
        "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors";
      toggleBtn.innerHTML = `<i class="ti ti-power text-sm"></i>${t("actions.disable", "Deshabilitar")}`;
    } else {
      badge.className = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-muted text-muted-foreground";
      badge.innerHTML = `<i class="ti ti-circle-x text-sm"></i>${t("labels.twoFaDisabled", "Desactivado")}`;
      text.textContent = t("labels.twoFaDisabledDesc", "El secreto sigue guardado, pero no se pedirá en login hasta que lo actives de nuevo.");
      toggleBtn.className =
        "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors";
      toggleBtn.innerHTML = `<i class="ti ti-power text-sm"></i>${t("actions.activate", "Activar")}`;
    }
  } else {
    setupBtn.classList.remove("hidden");
    setupBtn.innerHTML = `<i class="ti ti-plus text-sm"></i>${t("actions.configure", "Configurar")}`;
    deleteBtn.classList.add("hidden");
    toggleBtn.classList.add("hidden");

    badge.className = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-muted text-muted-foreground";
    badge.innerHTML = `<i class="ti ti-circle-x text-sm"></i>${t("labels.twoFaDisabled", "Desactivado")}`;
    text.textContent = t("labels.twoFaSetupPrompt", "Activa 2FA para proteger esta cuenta administrativa.");
  }
}

export async function open2FASetupDialog() {
  if (!CAN_MANAGE_LOCAL_AUTH) {
    showToast(t("toasts.twoFaInLp", "2FA se gestiona en LP-LICENSE-SERVER"), false);
    return;
  }

  const res = await api.get<any>("/api/auth/totp/setup");
  if (!res.ok) {
    showToast(res.error ?? t("toasts.twoFaSetupInitError", "Error al iniciar configuracion de 2FA"), false);
    return;
  }

  const secretInput = document.getElementById("secret-text-settings") as HTMLInputElement;
  const qrCanvas = document.getElementById("qr-canvas-settings") as HTMLCanvasElement;
  const codeInput = document.getElementById("verify-code-input-settings") as HTMLInputElement;
  const errEl = document.getElementById("2fa-setup-error-settings")!;
  secretInput.value = res.data.secret;
  codeInput.value = "";
  errEl.classList.add("hidden");

  try {
    await QRCode.toCanvas(qrCanvas, res.data.qrUri, { width: 200, errorCorrectionLevel: "H" });
  } catch {
    showToast(t("toasts.twoFaQrError", "No se pudo generar el QR"), false);
  }

  openDialog("dlg-setup-2fa-settings");
}

export async function enable2FAFromSettings() {
  if (!CAN_MANAGE_LOCAL_AUTH) {
    showToast(t("toasts.twoFaInLp", "2FA se gestiona en LP-LICENSE-SERVER"), false);
    return;
  }

  const code = (document.getElementById("verify-code-input-settings") as HTMLInputElement).value.trim();
  const errEl = document.getElementById("2fa-setup-error-settings")!;
  const btn = document.getElementById("btn-confirm-2fa-enable-settings") as HTMLButtonElement;

  if (!/^\d{6}$/.test(code)) {
    errEl.textContent = t("errors.twoFaEnter6Digits", "Ingresa los 6 digitos del codigo");
    errEl.classList.remove("hidden");
    return;
  }

  errEl.classList.add("hidden");
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2 animate-spin text-base"></i>';
  const res = await api.post<any>("/api/auth/totp/enable", { code });
  btn.disabled = false;
  btn.textContent = t("actions.activate2fa", "Activar 2FA");

  if (res.ok) {
    (document.getElementById("dlg-setup-2fa-settings") as HTMLDialogElement).close();
    showToast(t("toasts.twoFaActivated", "2FA activado correctamente"));
    await load2FAStatusSettings();
  } else {
    errEl.textContent = res.error ?? t("errors.twoFaInvalidCode", "Codigo invalido");
    errEl.classList.remove("hidden");
  }
}

export async function disable2FAFromSettings() {
  if (!CAN_MANAGE_LOCAL_AUTH) {
    showToast(t("toasts.twoFaInLp", "2FA se gestiona en LP-LICENSE-SERVER"), false);
    return;
  }

  const res = await api.patch<any>("/api/auth/totp/disable");
  if (res.ok) {
    showToast(t("toasts.twoFaDisabled", "2FA deshabilitado para el inicio de sesión"));
    await load2FAStatusSettings();
  } else {
    showToast(res.error ?? t("toasts.twoFaDisableError", "Error al desactivar 2FA"), false);
  }
}

export async function activate2FAFromSettings() {
  if (!CAN_MANAGE_LOCAL_AUTH) {
    showToast(t("toasts.twoFaInLp", "2FA se gestiona en LP-LICENSE-SERVER"), false);
    return;
  }

  const res = await api.patch<any>("/api/auth/totp/activate");
  if (res.ok) {
    showToast(t("toasts.twoFaReactivated", "2FA activado para el inicio de sesión"));
    await load2FAStatusSettings();
  } else {
    showToast(res.error ?? t("toasts.twoFaActivateError", "Error al activar 2FA"), false);
  }
}

export async function delete2FAFromSettings() {
  if (!CAN_MANAGE_LOCAL_AUTH) {
    showToast(t("toasts.twoFaInLp", "2FA se gestiona en LP-LICENSE-SERVER"), false);
    return;
  }

  const res = await api.delete<any>("/api/auth/totp/delete");
  if (res.ok) {
    showToast(t("toasts.twoFaDeleted", "2FA eliminado"));
    await load2FAStatusSettings();
  } else {
    showToast(res.error ?? t("toasts.twoFaDeleteError", "Error al eliminar 2FA"), false);
  }
}

export async function loadAuditLogSettings() {
  const skeleton = document.getElementById("audit-settings-skeleton")!;
  const list = document.getElementById("audit-settings-list")!;
  const empty = document.getElementById("audit-settings-empty")!;
  skeleton.classList.remove("hidden");
  list.classList.add("hidden");
  empty.classList.add("hidden");

  const res = await api.get<any>("/api/preferences/audit-log");
  skeleton.classList.add("hidden");

  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  const entries = res.data as AuditEntry[];
  list.classList.remove("hidden");
  list.innerHTML = entries
    .slice(0, 50)
    .map((e) => {
      const ok = !e.severity || e.severity === "info";
      const parsed = new Date(e.createdAt);
      const when = Number.isNaN(parsed.getTime())
        ? ""
        : parsed.toLocaleString(document.documentElement.lang || undefined, { dateStyle: "short", timeStyle: "short" });
      return `
      <div class="flex items-center justify-between py-3 first:pt-0 last:pb-0">
        <div class="flex items-center gap-3">
          <span class="flex h-7 w-7 items-center justify-center rounded-full ${ok ? "bg-emerald-500/10" : "bg-destructive/10"}">
            <i class="ti ${ok ? "ti-check text-emerald-500" : "ti-x text-destructive"} text-xs"></i>
          </span>
          <div>
            <p class="text-sm">${auditLabel(e.eventType)}</p>
            ${e.ip ? `<p class="text-xs text-muted-foreground">${e.ip}</p>` : ""}
          </div>
        </div>
        <span class="text-xs text-muted-foreground">${when}</span>
      </div>`;
    })
    .join("");
}
