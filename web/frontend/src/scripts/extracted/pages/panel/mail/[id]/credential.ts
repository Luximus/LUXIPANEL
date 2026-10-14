// Mailbox inbox viewer — mailbox credential recovery. Two dialogs: "change
// password" (updates the account password, PUT /api/accounts/:id) and "use
// current password" (validates against IMAP, POST /api/mail/:id/credential).
// Both refresh folders+messages afterwards.
import { api } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { accountId, fallback, S } from "./state";
import { waitMs } from "./helpers";
import { loadFolders } from "./folders";
import { loadMessages } from "./messages";
import { openDialog } from "/scripts/extracted/lib/dom.js";

// ── Mail credential recovery ────────────────────────────────
function setMailCredentialError(message: string | null) {
  const errorEl = document.getElementById("mail-credential-error") as HTMLElement | null;
  if (!errorEl) return;
  if (!message) {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    return;
  }
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function setMailCredentialFeedback(message: string | null, isSuccess = true) {
  const feedbackEl = document.getElementById("mail-credential-feedback") as HTMLElement | null;
  if (!feedbackEl) return;
  if (!message) {
    feedbackEl.classList.add("hidden");
    feedbackEl.className = "hidden rounded-lg px-4 py-2 text-sm";
    feedbackEl.textContent = "";
    return;
  }

  feedbackEl.className = `rounded-lg px-4 py-2 text-sm ${
    isSuccess
      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
      : "border border-destructive/30 bg-destructive/10 text-destructive"
  }`;
  feedbackEl.textContent = message;
}

function setMailCredentialLoading(active: boolean, text = fallback("inbox.processing", "Procesando...")) {
  const loadingEl = document.getElementById("mail-credential-loading");
  if (loadingEl) {
    if (active) loadingEl.classList.remove("hidden");
    else loadingEl.classList.add("hidden");
  }
  const loadingText = document.getElementById("mail-credential-loading-text");
  if (loadingText && active) loadingText.textContent = text;

  const submitBtn = document.getElementById("mail-credential-submit") as HTMLButtonElement | null;
  if (submitBtn) {
    submitBtn.disabled = active;
    submitBtn.classList.toggle("opacity-70", active);
    submitBtn.classList.toggle("cursor-not-allowed", active);
  }
  const cancelBtn = document.getElementById("mail-credential-cancel") as HTMLButtonElement | null;
  const closeBtn = document.getElementById("mail-credential-dialog-close") as HTMLButtonElement | null;
  for (const id of ["mail-credential-password", "mail-credential-confirm"]) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.disabled = active;
  }
  if (cancelBtn) cancelBtn.disabled = active;
  if (closeBtn) closeBtn.disabled = active;
}

async function refreshMailboxAfterPasswordUpdate(): Promise<boolean> {
  // Allow remote Dovecot/Postfix reload operations to settle before IMAP reconnect checks.
  const attempts = 4;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await loadFolders();
    await loadMessages();

    if (!S.mailboxCredentialBroken && S.folders.length > 0) {
      return true;
    }

    if (attempt < attempts) {
      await waitMs(1500 * attempt);
    }
  }
  return !S.mailboxCredentialBroken && S.folders.length > 0;
}

function resetMailCredentialForm() {
  for (const id of ["mail-credential-password", "mail-credential-confirm"]) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = "";
  }
  setMailCredentialError(null);
  setMailCredentialLoading(false);
}

function openMailboxCredentialDialog() {
  const accountEmail = (document.getElementById("account-email")?.textContent || "").trim();
  const labelEl = document.getElementById("mail-credential-account-email");
  if (labelEl) {
    labelEl.textContent = accountEmail || `${fallback("inbox.accountLabelShort", "Cuenta")} #${accountId}`;
  }

  setMailCredentialFeedback(null);
  resetMailCredentialForm();
  openDialog("dlg-mail-credentials");
}

const closeMailboxCredentialDialog = () => {
  (document.getElementById("dlg-mail-credentials") as HTMLDialogElement | null)?.close();
};

(window as any).openMailboxCredentialDialog = openMailboxCredentialDialog;

// ── Mail credential events ──────────────────────────────────
document.getElementById("mail-credential-dialog-close")?.addEventListener("click", closeMailboxCredentialDialog);
document.getElementById("mail-credential-cancel")?.addEventListener("click", closeMailboxCredentialDialog);

let isMailCredentialSaving = false;

document.getElementById("mail-credential-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isMailCredentialSaving) return;

  const password = (document.getElementById("mail-credential-password") as HTMLInputElement).value;
  const confirm = (document.getElementById("mail-credential-confirm") as HTMLInputElement).value;

  if (password.length < 6) {
    setMailCredentialError(fallback("inbox.validation.passwordMinLength", "La contraseña debe tener al menos 6 caracteres."));
    return;
  }
  if (password !== confirm) {
    setMailCredentialError(fallback("inbox.validation.passwordMismatch", "La confirmación no coincide con la contraseña."));
    return;
  }

  setMailCredentialError(null);
  isMailCredentialSaving = true;
  setMailCredentialFeedback(null);
  setMailCredentialLoading(true);
  const res = await api.put(`/api/accounts/${accountId}`, { password });
  if (!res.ok) {
    isMailCredentialSaving = false;
    setMailCredentialLoading(false);
    setMailCredentialFeedback(res.error ?? fallback("inbox.error.updatePassword", "No se pudo actualizar la contraseña del buzón."), false);
    return;
  }

  setMailCredentialFeedback(fallback("inbox.success.passwordUpdated", "Contraseña actualizada. Recargando carpetas y mensajes..."));
  S.mailboxCredentialBroken = false;
  S.currentUid = null;
  S.currentPage = 1;
  S.folders = [];

  const refreshed = await refreshMailboxAfterPasswordUpdate();
  isMailCredentialSaving = false;
  setMailCredentialLoading(false);

  if (!refreshed) {
    setMailCredentialFeedback(
      fallback("inbox.error.imapNoResponse", "La contraseña se guardó, pero el servidor IMAP no respondió. Verifica conectividad IMAP y vuelve a intentar."),
      false,
    );
    return;
  }

  closeMailboxCredentialDialog();
});

(document.getElementById("dlg-mail-credentials") as HTMLDialogElement | null)?.addEventListener("close", () => {
  isMailCredentialSaving = false;
  resetMailCredentialForm();
  setMailCredentialFeedback(null);
});

// ── "Usar contraseña actual" modal (separate dialog) ────────
let isMailCurSaving = false;

function setCurError(msg: string | null) {
  const el = document.getElementById("mailcur-error");
  if (!el) return;
  if (!msg) { el.classList.add("hidden"); el.textContent = ""; return; }
  el.textContent = msg;
  el.classList.remove("hidden");
}

function setCurFeedback(msg: string | null, isSuccess = true) {
  const el = document.getElementById("mailcur-feedback");
  if (!el) return;
  if (!msg) { el.classList.add("hidden"); el.className = "hidden rounded-lg px-4 py-2 text-sm"; el.textContent = ""; return; }
  el.className = `rounded-lg px-4 py-2 text-sm ${isSuccess ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border border-destructive/30 bg-destructive/10 text-destructive"}`;
  el.textContent = msg;
}

function setCurLoading(active: boolean) {
  document.getElementById("mailcur-loading")?.classList.toggle("hidden", !active);
  const submitBtn = document.getElementById("mailcur-submit") as HTMLButtonElement | null;
  if (submitBtn) {
    submitBtn.disabled = active;
    submitBtn.classList.toggle("opacity-70", active);
    submitBtn.classList.toggle("cursor-not-allowed", active);
  }
  const cancelBtn = document.getElementById("mailcur-cancel") as HTMLButtonElement | null;
  const closeBtn = document.getElementById("mailcur-close") as HTMLButtonElement | null;
  const input = document.getElementById("mailcur-password") as HTMLInputElement | null;
  if (cancelBtn) cancelBtn.disabled = active;
  if (closeBtn) closeBtn.disabled = active;
  if (input) input.disabled = active;
}

function openMailboxCurrentCredentialDialog() {
  const accountEmail = (document.getElementById("account-email")?.textContent || "").trim();
  const labelEl = document.getElementById("mailcur-account-email");
  if (labelEl) labelEl.textContent = accountEmail || `${fallback("inbox.accountLabelShort", "Cuenta")} #${accountId}`;
  setCurFeedback(null);
  setCurError(null);
  setCurLoading(false);
  (document.getElementById("mailcur-password") as HTMLInputElement).value = "";
  openDialog("dlg-mail-credential-current");
}
(window as any).openMailboxCurrentCredentialDialog = openMailboxCurrentCredentialDialog;

const closeMailboxCurrentCredentialDialog = () =>
  (document.getElementById("dlg-mail-credential-current") as HTMLDialogElement | null)?.close();

document.getElementById("mailcur-close")?.addEventListener("click", closeMailboxCurrentCredentialDialog);
document.getElementById("mailcur-cancel")?.addEventListener("click", closeMailboxCurrentCredentialDialog);

document.getElementById("mailcur-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isMailCurSaving) return;

  const password = (document.getElementById("mailcur-password") as HTMLInputElement).value;
  if (!password) {
    setCurError(fallback("inbox.validation.passwordRequired", "Ingresa la contraseña actual del buzón."));
    return;
  }

  setCurError(null);
  isMailCurSaving = true;
  setCurFeedback(null);
  setCurLoading(true);
  const res = await api.post(`/api/mail/${accountId}/credential`, { password });
  if (!res.ok) {
    isMailCurSaving = false;
    setCurLoading(false);
    setCurFeedback(res.error ?? fallback("inbox.error.validatePassword", "No se pudo validar la contraseña."), false);
    return;
  }

  setCurFeedback(fallback("inbox.success.passwordValidated", "Contraseña validada. Cargando carpetas y mensajes..."));
  S.mailboxCredentialBroken = false;
  S.currentUid = null;
  S.currentPage = 1;
  S.folders = [];

  const refreshed = await refreshMailboxAfterPasswordUpdate();
  isMailCurSaving = false;
  setCurLoading(false);

  if (!refreshed) {
    setCurFeedback(fallback("inbox.error.mailboxNoResponse", "La contraseña se guardó, pero el buzón aún no responde. Reintenta en unos segundos."), false);
    return;
  }

  closeMailboxCurrentCredentialDialog();
});

(document.getElementById("dlg-mail-credential-current") as HTMLDialogElement | null)?.addEventListener("close", () => {
  isMailCurSaving = false;
  (document.getElementById("mailcur-password") as HTMLInputElement).value = "";
  setCurError(null);
  setCurFeedback(null);
  setCurLoading(false);
});
