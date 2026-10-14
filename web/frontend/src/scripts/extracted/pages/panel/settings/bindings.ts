// Settings page — bindEvents(): wires every DOM listener for all tabs. Uses an
// AbortController + a synchronous addEventListener monkey-patch so re-running
// init() after an SPA swap re-binds on the fresh DOM without duplicating.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import type { TabId } from "./state";
import { S } from "./state";
import { t, fmt, showToast, setupToggle } from "./dom";
import { activateTab } from "./tabs";
import { syncProviderCards, scheduleAutosave, bindAutoSaveField, bindDeferredCheckboxAutoSave, bindSystemTimezoneApply, resetLayoutToDefaults, loadSettings } from "./settings-io";
import { reapplyLiveTheme, wireRangeReadouts, wireRadiusControl, wireShadowControls, updateBackgroundSettingsVisibility, scheduleLoginPreview } from "./layout-theme";
import { bindLayoutPalettes } from "./layout-palettes";
import { bindLogoControls } from "./branding";
import { enforceAtLeastOneMethod, updateAuditLogButtonVisibility, loadAuditLogSettings, loadPasskeysSettings, registerPasskeyFromSettings, loadRecoveryStatusInDialog, generateRecoveryCodesFromSettings, saveHcaptchaCredential, open2FASetupDialog, enable2FAFromSettings, disable2FAFromSettings, activate2FAFromSettings, delete2FAFromSettings } from "./security";
import { openDialog } from "/scripts/extracted/lib/dom.js";

// AbortController para todos los listeners DOM atados en bindEvents.
// init() lo aborta y re-crea en cada entrada → los handlers viejos
// (atados al DOM anterior al swap SPA) se descartan limpiamente y los
// nuevos quedan sobre el DOM actual. Sin esto, init() llamado 2x dentro
// de la misma entrada (after-swap + page-load) duplicaba handlers, y
// dentro del cooldown de 4s ni siquiera re-bindeaba → tabs muertos.
export let bindingsController: AbortController | null = null;

export function bindEvents() {
  bindingsController?.abort();
  bindingsController = new AbortController();
  const signal = bindingsController.signal;

  // Monkey-patch SÍNCRONO de addEventListener durante este scope para
  // inyectar `{ signal }` en las 26 llamadas siguientes sin reescribir
  // cada una. El patch se revierte en el finally; ningún código
  // asíncrono corre dentro de este bloque, así que solo afecta a las
  // llamadas de bindEvents. Cuando init() corre de nuevo y aborta el
  // controller, todos los listeners atados aquí se descartan limpios.
  const _aelProto = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (
      this: EventTarget,
    type: any,
    listener: any,
    options?: any,
  ) {
    const merged =
      options && typeof options === "object" ? { ...options, signal } : { signal };
    return _aelProto.call(this, type, listener, merged);
  } as any;

  try {

  document.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab as TabId));
  });

  document.querySelectorAll<HTMLInputElement>("input[name='ai-provider-radio']").forEach((radio) => {
    radio.addEventListener("change", () => {
      syncProviderCards(radio.value);
      scheduleAutosave(true);
    });
  });
  document.getElementById("s-ai-provider")?.addEventListener("change", () => {
    const select = document.getElementById("s-ai-provider") as HTMLSelectElement | null;
    if (!select) return;
    syncProviderCards(select.value);
    scheduleAutosave(true);
  });
  bindAutoSaveField(document.getElementById("s-panel-name") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-timezone") as HTMLSelectElement | null);
  bindAutoSaveField(document.getElementById("s-language") as HTMLSelectElement | null);
  bindSystemTimezoneApply();
  bindAutoSaveField(document.getElementById("s-layout-logo") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-layout-login-background-enabled") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-layout-login-background-fallback-color") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-layout-login-background-type") as HTMLSelectElement | null);
  bindAutoSaveField(document.getElementById("s-layout-panel-background-enabled") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-layout-panel-background-fallback-color") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-layout-panel-background-type") as HTMLSelectElement | null);
  document.querySelectorAll<HTMLInputElement>(".layout-login-bg-field, .layout-panel-bg-field").forEach((el) => {
    bindAutoSaveField(el);
  });
  bindAutoSaveField(document.getElementById("s-layout-radius") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-layout-shadow") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-layout-modal-shadow") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-layout-modal-backdrop") as HTMLInputElement | null);
  // Radius/shadow/modal feed buildLayoutCss too — live-preview them site-wide
  // (and persist for SPA nav), same as palette colors.
  for (const id of ["s-layout-radius", "s-layout-shadow", "s-layout-modal-shadow", "s-layout-modal-backdrop"]) {
    document.getElementById(id)?.addEventListener("input", reapplyLiveTheme);
  }
  // Visible derived controls -> canonical inputs. These dispatch `input` on the
  // hidden canonicals so the bindings above (autosave + reapplyLiveTheme) fire.
  wireRangeReadouts();
  wireRadiusControl();
  wireShadowControls();
  // Layout colors are driven by palette cards (bindLayoutPalettes), not per-field inputs.
  bindAutoSaveField(document.getElementById("s-smtp-host") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-smtp-port") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-smtp-user") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-smtp-password") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-smtp-from") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-smtp-tls") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-session-ttl") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-max-login-attempts") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-require-2fa") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-hcaptcha-enabled") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-audit-log") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-switch-new-tab") as HTMLInputElement | null);
  bindDeferredCheckboxAutoSave(document.getElementById("s-login-allow-password") as HTMLInputElement | null);
  bindDeferredCheckboxAutoSave(document.getElementById("s-login-allow-passkey") as HTMLInputElement | null);
  bindDeferredCheckboxAutoSave(document.getElementById("s-login-allow-recovery") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-backup-dir") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-backup-retention") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-s3-endpoint") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-s3-bucket") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-s3-key") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-s3-secret") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-ai-enabled") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-ai-model") as HTMLInputElement | null);
  bindAutoSaveField(document.getElementById("s-ai-key") as HTMLInputElement | null);

  setupToggle("toggle-smtp-pw", "s-smtp-password");
  setupToggle("toggle-ai-key", "s-ai-key");
  setupToggle("cred-hcaptcha-secret-toggle", "cred-hcaptcha-secret");
  document.getElementById("cred-hcaptcha-save")?.addEventListener("click", () => {
    void saveHcaptchaCredential();
  });

  bindLogoControls();
  bindLayoutPalettes();
  document.getElementById("s-layout-login-background-enabled")?.addEventListener("change", () => {
    updateBackgroundSettingsVisibility("login");
    scheduleLoginPreview();
  });
  document.getElementById("s-layout-login-background-type")?.addEventListener("change", () => {
    updateBackgroundSettingsVisibility("login");
    scheduleLoginPreview();
  });
  document.getElementById("s-layout-login-background-fallback-color")?.addEventListener("input", scheduleLoginPreview);
  document.getElementById("layout-login-background-settings")?.addEventListener("input", scheduleLoginPreview);
  document.getElementById("layout-login-background-settings")?.addEventListener("change", scheduleLoginPreview);
  document.getElementById("s-layout-panel-background-enabled")?.addEventListener("change", () => {
    updateBackgroundSettingsVisibility("panel");
  });
  document.getElementById("s-layout-panel-background-type")?.addEventListener("change", () => {
    updateBackgroundSettingsVisibility("panel");
  });

  document.querySelectorAll<HTMLInputElement>(".login-method-check").forEach((c) => {
    c.addEventListener("change", enforceAtLeastOneMethod);
  });
  setTimeout(() => enforceAtLeastOneMethod(), 100);

  document.getElementById("s-audit-log")?.addEventListener("change", updateAuditLogButtonVisibility);

  document.getElementById("btn-open-audit-log")?.addEventListener("click", async () => {
    openDialog("dlg-audit-log-settings");
    await loadAuditLogSettings();
  });

  document.getElementById("btn-manage-passkeys")?.addEventListener("click", async () => {
    openDialog("dlg-passkeys-settings");
    await loadPasskeysSettings();
  });

  document.getElementById("btn-add-passkey-settings")?.addEventListener("click", registerPasskeyFromSettings);

  document.getElementById("btn-manage-recovery")?.addEventListener("click", async () => {
    openDialog("dlg-recovery-settings");
    await loadRecoveryStatusInDialog();
  });

  document.getElementById("btn-gen-codes-settings")?.addEventListener("click", generateRecoveryCodesFromSettings);
  document.getElementById("btn-copy-codes-settings")?.addEventListener("click", () => {
    navigator.clipboard.writeText(S.recoveryCodes.join("\n")).then(() => showToast(t("toasts.codesCopied", "Codigos copiados")));
  });
  document.getElementById("btn-print-codes-settings")?.addEventListener("click", () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><body style="font-family:monospace;padding:2rem"><h2>${t("labels.printRecoveryCodesTitle", "Codigos de recuperacion - LUXIPANEL")}</h2>
      <p style="color:#666">${t("labels.printRecoveryCodesDesc", "Guarda estos codigos en un lugar seguro. Cada uno solo puede usarse una vez.")}</p>
      <ul style="list-style:none;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:0.5rem 2rem">
      ${S.recoveryCodes.map((c) => `<li style="border:1px solid #ccc;padding:0.5rem 1rem;border-radius:4px">${c}</li>`).join("")}
      </ul></body></html>`);
    win.print();
    win.close();
  });

  document.getElementById("btn-setup-2fa-settings")?.addEventListener("click", open2FASetupDialog);
  document.getElementById("btn-disable-2fa-settings")?.addEventListener("click", () => {
    openDialog("dlg-delete-2fa-settings");
  });
  document.getElementById("btn-deactivate-2fa-settings")?.addEventListener("click", async () => {
    if (S.currentTotpState.enabled) {
      await disable2FAFromSettings();
      return;
    }

    if (!S.currentTotpState.configured) {
      await open2FASetupDialog();
      return;
    }

    await activate2FAFromSettings();
  });
  document.getElementById("btn-confirm-2fa-enable-settings")?.addEventListener("click", enable2FAFromSettings);
  document.getElementById("verify-code-input-settings")?.addEventListener("input", (e) => {
    const input = e.target as HTMLInputElement;
    if (input.value.length === 6) {
      document.getElementById("btn-confirm-2fa-enable-settings")?.click();
    }
  });
  document.getElementById("btn-copy-secret-settings")?.addEventListener("click", () => {
    const secret = (document.getElementById("secret-text-settings") as HTMLInputElement).value;
    navigator.clipboard.writeText(secret).then(() => showToast(t("toasts.secretCopied", "Secret copiado")));
  });
  document.getElementById("btn-confirm-2fa-delete-settings")?.addEventListener("click", async () => {
    (document.getElementById("dlg-delete-2fa-settings") as HTMLDialogElement).close();
    await delete2FAFromSettings();
  });

  document.getElementById("btn-test-smtp")?.addEventListener("click", () => {
    openDialog("dlg-test-smtp");
  });
  document.getElementById("btn-send-test")?.addEventListener("click", async () => {
    const to = (document.getElementById("test-smtp-to") as HTMLInputElement).value.trim();
    if (!to) return;
    const btn = document.getElementById("btn-send-test") as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = t("actions.sending", "Enviando...");
    const res = await api.post<any>("/api/settings/test-smtp", { to });
    btn.disabled = false;
    btn.textContent = t("actions.send", "Enviar");
    (document.getElementById("dlg-test-smtp") as HTMLDialogElement).close();
    if (res.ok) showToast(fmt(t("toasts.smtpTestSent", "Correo de prueba enviado a {to}"), { to }));
    else showToast(res.error ?? t("toasts.smtpTestError", "Error al enviar"), false);
  });

  document.getElementById("btn-reset-layout")?.addEventListener("click", async () => {
    if (!await openConfirm(t("confirm.resetLayoutBody", "¿Restablecer los estilos de la interfaz a los valores por defecto de LUXIPANEL? Se perderán logos, colores, sombras y fondos personalizados."), { title: t("confirm.resetLayoutTitle", "Restablecer estilos"), confirmText: t("confirm.resetLayoutConfirm", "Sí, restablecer"), variant: "danger" })) return;
    const btn = document.getElementById("btn-reset-layout") as HTMLButtonElement;
    btn.disabled = true;
    const prev = btn.innerHTML;
    btn.innerHTML = `<i class="ti ti-loader-2 animate-spin text-sm"></i> <span>${t("actions.resetting", "Restableciendo...")}</span>`;
    try {
      resetLayoutToDefaults();
      showToast(t("toasts.layoutReset", "Estilos restablecidos a los valores por defecto"));
    } finally {
      btn.disabled = false;
      btn.innerHTML = prev;
    }
  });

  document.getElementById("btn-factory-reset")?.addEventListener("click", async () => {
    if (!await openConfirm(t("confirm.factoryResetBody", "¿Estás seguro? Esto restablecerá todos los ajustes del panel."), { title: t("confirm.factoryResetTitle", "Restablecer ajustes"), confirmText: t("confirm.factoryResetConfirm", "Sí, restablecer"), variant: "danger" })) return;
    const btn = document.getElementById("btn-factory-reset") as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = `<i class="ti ti-loader-2 animate-spin text-base"></i> ${t("actions.resetting", "Restableciendo...")}`;
    const res = await api.post<any>("/api/settings/reset", {});
    btn.disabled = false;
    btn.innerHTML = `<i class="ti ti-refresh text-base"></i> ${t("actions.factoryReset", "Restablecer ajustes de fabrica")}`;
    if (res.ok) {
      showToast(t("toasts.settingsReset", "Ajustes restablecidos"));
      await loadSettings();
    } else {
      showToast(res.error ?? t("toasts.settingsResetError", "Error al restablecer"), false);
    }
  });

  } finally {
    // Restaurar addEventListener original (el patch era solo para el scope
    // síncrono de bindEvents).
    EventTarget.prototype.addEventListener = _aelProto;
  }
}
