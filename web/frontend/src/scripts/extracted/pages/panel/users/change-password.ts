// Users page — change-password dialog (ADMIN only, gated by the admin's own
// 2FA). Importing this module registers window.openChangePasswordDialog.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { awaitJob } from "/scripts/extracted/lib/job-poll.js?v=1";
import { capabilities } from "./state";
import { t, fmt, showToast, escapeHtml } from "./dom";
import { loadUsers } from "./users-data";
import { openDialog } from "/scripts/extracted/lib/dom.js";

// ── Change password (ADMIN only, gated by the admin's own 2FA) ────────────
let changePwUserId: number | null = null;
let changePwUsername = "";

/** Show/hide the "you need 2FA" notice and enable/disable the form fields. */
function setChangePwTwoFaState(needs2fa: boolean) {
  document.getElementById("change-pw-2fa-hint")?.classList.toggle("hidden", !needs2fa);
  const fields = document.getElementById("change-pw-fields");
  if (fields) fields.classList.toggle("hidden", needs2fa);
  const submit = document.getElementById("change-pw-submit") as HTMLButtonElement | null;
  if (submit) submit.disabled = needs2fa;
}

(window as any).openChangePasswordDialog = async (u: any) => {
  if (!capabilities.canChangePw) {
    showToast(t("toasts.sudoOnlyPassword", "Solo los usuarios del grupo sudo pueden cambiar contraseñas"), false);
    return;
  }
  changePwUserId = u.id;
  changePwUsername = u.username;
  document.getElementById("change-pw-title")!.innerHTML =
    `<i class="ti ti-lock-password text-lg text-primary"></i>${escapeHtml(fmt(t("titles.changePassword", "Cambiar contraseña · {username}"), { username: u.username }))}`;
  (document.getElementById("change-pw-password") as HTMLInputElement).value = "";
  (document.getElementById("change-pw-totp") as HTMLInputElement).value = "";
  const pw = document.getElementById("change-pw-password") as HTMLInputElement;
  pw.type = "password";
  document.getElementById("change-pw-pass-toggle-icon")?.classList.add("ti-eye");
  document.getElementById("change-pw-pass-toggle-icon")?.classList.remove("ti-eye-off");
  document.getElementById("change-pw-error")?.classList.add("hidden");
  // Optimistically show the form; the status check below corrects it.
  setChangePwTwoFaState(false);
  openDialog("dialog-change-pw");

  // Proactively check the CALLER's own 2FA: if it isn't active, show the notice
  // with a link to Ajustes › Seguridad › 2FA and block the form. (The backend
  // also enforces this with TWOFA_REQUIRED.)
  try {
    const st = await api.get<any>("/api/auth/totp/status");
    const enabled = Boolean((st.data as any)?.enabled ?? st.data);
    if (st.ok && !enabled) setChangePwTwoFaState(true);
  } catch {
    /* leave the form usable; the submit will surface TWOFA_REQUIRED if needed */
  }
};

export function bindChangePasswordDialog() {
  const dlg = () => document.getElementById("dialog-change-pw") as HTMLDialogElement;
  const close = () => dlg().close();
  document.getElementById("change-pw-close")?.addEventListener("click", close);
  document.getElementById("change-pw-cancel")?.addEventListener("click", close);
  document.getElementById("change-pw-pass-toggle")?.addEventListener("click", () => {
    const input = document.getElementById("change-pw-password") as HTMLInputElement;
    const icon = document.getElementById("change-pw-pass-toggle-icon");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    icon?.classList.toggle("ti-eye", !show);
    icon?.classList.toggle("ti-eye-off", show);
  });

  document.getElementById("form-change-pw")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (changePwUserId == null) return;
    const errEl = document.getElementById("change-pw-error")!;
    errEl.classList.add("hidden");
    const password = (document.getElementById("change-pw-password") as HTMLInputElement).value;
    const totpCode = (document.getElementById("change-pw-totp") as HTMLInputElement).value.trim();
    if (!password || !totpCode) return;
    const submit = document.getElementById("change-pw-submit") as HTMLButtonElement;
    submit.disabled = true;
    try {
      const res = await api.put(`/api/users/${changePwUserId}/password`, { password, totpCode });
      if (res.ok) {
        close();
        showToast(t("toasts.passwordChanged", "Contraseña actualizada"));
        await awaitJob(res);
        void loadUsers();
        return;
      }
      if ((res.data as any)?.code === "TWOFA_REQUIRED") {
        // The caller has no active 2FA — show the notice + link and block form.
        setChangePwTwoFaState(true);
        return;
      }
      errEl.textContent = res.error ?? t("errors.changePasswordFailed", "No se pudo cambiar la contraseña");
      errEl.classList.remove("hidden");
      submit.disabled = false; // allow retry (e.g. wrong code)
    } catch {
      errEl.textContent = t("errors.changePasswordFailed", "No se pudo cambiar la contraseña");
      errEl.classList.remove("hidden");
      submit.disabled = false;
    }
  });
}
