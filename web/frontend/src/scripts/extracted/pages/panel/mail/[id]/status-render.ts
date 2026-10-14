// Mailbox inbox viewer — shared status/error rendering: the "loading messages"
// placeholder, IMAP/credential error detectors, and the credential-blocked panel.
// Used by both the folders and messages loaders.
import { fallback } from "./state";
import { escapeHtml } from "./helpers";

export function renderMessagesLoading(text?: string) {
  const list = document.getElementById("messages-list");
  if (!list) return;
  const displayText = text || fallback("inbox.loading", "Cargando mensajes...");
  list.innerHTML = `
    <div class="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 p-6 text-center">
      <div class="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-primary">
        <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
          <path class="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"></path>
        </svg>
        <span class="text-xs font-medium">${escapeHtml(displayText)}</span>
      </div>
    </div>
  `;
}

/** Backend codes (typed AppError) that mean "the panel has no working login for this mailbox". */
const MAILBOX_CREDENTIAL_CODES = new Set([
  "MAIL_PASSWORD_NOT_SET",
  "MAIL_CREDENTIAL_INVALID",
  "MAIL_CREDENTIAL_UNRECOVERABLE",
  "MAIL_CREDENTIAL_DECRYPT_FAILED",
]);

export function isMailboxCredentialError(res: { ok: boolean; status: number; error?: string; code?: string }): boolean {
  if (res.ok || res.status !== 409) return false;
  if (res.code && MAILBOX_CREDENTIAL_CODES.has(res.code)) return true;
  const errorText = (res.error || "").toLowerCase();
  return errorText.includes("mail credential")
    || errorText.includes("mailbox password")
    || errorText.includes("not recoverable")
    || errorText.includes("could not be decrypted");
}

/** Last credential failure (code + backend detail) so the blocked panel can say WHY. */
let lastCredentialFailure: { code?: string; error?: string } | null = null;
export function rememberCredentialFailure(res: { code?: string; error?: string }) {
  lastCredentialFailure = { code: res.code, error: res.error };
}

export function isMailboxImapUnavailable(res: { ok: boolean; status: number; error?: string }): boolean {
  if (res.ok) return false;
  if (res.status !== 500 && res.status !== 502 && res.status !== 503) return false;
  const errorText = (res.error || "").toLowerCase();
  return errorText.includes("imap")
    || errorText.includes("econnrefused")
    || errorText.includes("mail_imap_unreachable");
}

function describeCredentialFailure(): string {
  const code = lastCredentialFailure?.code;
  if (code === "MAIL_CREDENTIAL_INVALID") {
    return fallback(
      "inbox.credentialStaleDesc",
      "La contraseña guardada en LUXIPANEL ya no coincide con la del buzón (se cambió fuera del panel) y el acceso maestro no está disponible en este servidor. Introduce la contraseña actual o cámbiala.",
    );
  }
  if (code === "MAIL_PASSWORD_NOT_SET") {
    return fallback(
      "inbox.credentialMasterUnavailableDesc",
      "LUXIPANEL no tiene ninguna contraseña guardada para este buzón y no pudo activar su acceso maestro en este servidor. Introduce la contraseña actual o cámbiala.",
    );
  }
  return fallback("inbox.credentialBlockedDesc", "El panel necesita la contraseña del buzón para conectarse por IMAP.");
}

export function renderMailboxCredentialBlockedState() {
  const foldersList = document.getElementById("folders-list");
  if (foldersList) {
    foldersList.innerHTML = `
      <div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
        ${fallback("inbox.credentialBlockedFolders", "Esta cuenta necesita registrar su contraseña de correo para cargar carpetas.")}
      </div>
    `;
  }

  const messagesList = document.getElementById("messages-list");
  if (messagesList) {
    messagesList.innerHTML = `
      <div class="p-4">
        <div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center">
          <p class="text-sm font-medium text-amber-200">${fallback("inbox.credentialBlockedTitle", "No se pueden cargar mensajes")}</p>
          <p class="mt-1 text-xs text-amber-100/90">${describeCredentialFailure()}</p>
          ${lastCredentialFailure?.error ? `<p class="mt-1 text-[11px] text-amber-100/60 break-words">${escapeHtml(lastCredentialFailure.error)}</p>` : ""}
          <div class="mt-3 flex flex-col gap-2">
            <button type="button" onclick="openMailboxCurrentCredentialDialog()" class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
              <i class="ti ti-login text-sm"></i>
              ${fallback("inbox.btnUseCurrentPassword", "Usar contraseña actual")}
            </button>
            <button type="button" onclick="openMailboxCredentialDialog()" class="inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-300/30 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-200/10">
              <i class="ti ti-key text-sm"></i>
              ${fallback("inbox.btnChangePassword", "Cambiar contraseña")}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  document.getElementById("msg-pagination")?.classList.add("hidden");
  document.getElementById("folder-count")?.classList.add("hidden");
}
