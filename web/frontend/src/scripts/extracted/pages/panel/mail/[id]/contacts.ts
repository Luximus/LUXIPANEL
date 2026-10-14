// Mailbox inbox viewer — contacts dialog (list / create / edit / delete saved
// contacts for this account). Owns its own loaded-contacts cache; independent of
// the folder/message state hub.
import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
import { api,resolveTargetScope } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { accountId, fallback, type MailContact } from "./state";
import { escapeHtml } from "./helpers";
import { openDialog } from "/scripts/extracted/lib/dom.js";
import { SIMPLE_EMAIL_RE } from "../state";

let loadedContacts: MailContact[] = [];
const contactPages=createTablePages({tableId:"contacts-list-body",events:window,scope:resolveTargetScope,reload:()=>loadContacts(),field:"auto"});

function setContactsError(message: string | null) {
  const errorEl = document.getElementById("contacts-error") as HTMLElement | null;
  if (!errorEl) return;
  if (!message) {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    return;
  }
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function setContactsFeedback(message: string | null, isSuccess = true) {
  const feedbackEl = document.getElementById("contacts-feedback") as HTMLElement | null;
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

function resetContactForm() {
  (document.getElementById("contacts-edit-id") as HTMLInputElement).value = "";
  (document.getElementById("contacts-email") as HTMLInputElement).value = "";
  (document.getElementById("contacts-name") as HTMLInputElement).value = "";
  setContactsError(null);
}

function fillContactForm(contact: MailContact) {
  (document.getElementById("contacts-edit-id") as HTMLInputElement).value = String(contact.id);
  (document.getElementById("contacts-email") as HTMLInputElement).value = contact.email;
  (document.getElementById("contacts-name") as HTMLInputElement).value = contact.displayName ?? "";
  setContactsError(null);
}

function renderContactsList() {
  const tbody = document.getElementById("contacts-list-body") as HTMLElement | null;
  if (!tbody) return;

  if (loadedContacts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="px-3 py-6 text-center text-xs text-muted-foreground">${fallback("inbox.noContacts", "Sin contactos guardados")}</td></tr>`;
    return;
  }

  tbody.innerHTML = loadedContacts.map((contact) => `
    <tr class="border-b border-border last:border-0">
      <td class="px-3 py-2">${escapeHtml(contact.email)}</td>
      <td class="px-3 py-2">${escapeHtml(contact.displayName || "-")}</td>
      <td class="px-3 py-2 text-right">
        <button type="button" onclick="editMailboxContact(${contact.id})" class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="${fallback("inbox.titleEditContact", "Editar contacto")}">
          <i class="ti ti-edit text-sm"></i>
        </button>
        <button type="button" onclick="deleteMailboxContact(${contact.id})" class="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="${fallback("inbox.titleDeleteContact", "Eliminar contacto")}">
          <i class="ti ti-trash text-sm"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

async function loadContacts() {
  const res = await contactPages.read<MailContact[]>(params=>api.get<MailContact[]>(`/api/accounts/${accountId}/contacts`,{params}),String(accountId));
  if(res.code==="TARGET_SCOPE_CHANGED")return;
  loadedContacts = res.ok && Array.isArray(res.data) ? res.data : [];
  renderContactsList();
}

async function openContactsDialog() {
  const accountEmail = (document.getElementById("account-email")?.textContent || "").trim();
  const label = accountEmail || `${fallback("inbox.accountLabelShort", "Cuenta")} #${accountId}`;
  const labelEl = document.getElementById("contacts-account-email") as HTMLElement | null;
  if (labelEl) labelEl.textContent = label;

  setContactsFeedback(null);
  resetContactForm();
  await loadContacts();

  openDialog("dlg-contacts");
}

const closeContactsDialog = () => {
  (document.getElementById("dlg-contacts") as HTMLDialogElement | null)?.close();
};

(window as any).editMailboxContact = (contactId: number) => {
  const contact = loadedContacts.find((item) => item.id === contactId);
  if (!contact) {
    setContactsFeedback(fallback("inbox.error.contactNotFound", "No se encontró el contacto seleccionado."), false);
    return;
  }
  fillContactForm(contact);
  setContactsFeedback(fallback("inbox.contactEditing", "Editando {email}").replace("{email}", () => contact.email));
};

(window as any).deleteMailboxContact = async (contactId: number) => {
  const contact = loadedContacts.find((item) => item.id === contactId);
  const label = contact?.email ?? `#${contactId}`;
  const confirmed = await openConfirm(fallback("inbox.confirm.deleteContact", "¿Eliminar contacto \"{contact}\"?").replace("{contact}", () => label), {
    title: fallback("inbox.confirm.deleteContactTitle", "Eliminar contacto"),
    variant: "danger",
  });

  if (!confirmed) return;

  const res = await api.delete(`/api/accounts/${accountId}/contacts/${contactId}`);
  if (!res.ok) {
    setContactsFeedback(res.error ?? fallback("inbox.error.deleteContact", "No se pudo eliminar el contacto."), false);
    return;
  }

  setContactsFeedback(fallback("inbox.success.contactDeleted", "Contacto eliminado correctamente."));
  await loadContacts();
};

// ── Contacts events ─────────────────────────────────────────
document.getElementById("btn-open-contacts")?.addEventListener("click", () => {
  openContactsDialog();
});

document.getElementById("contacts-dialog-close")?.addEventListener("click", closeContactsDialog);
document.getElementById("contacts-cancel")?.addEventListener("click", closeContactsDialog);
document.getElementById("contacts-new")?.addEventListener("click", () => {
  resetContactForm();
  setContactsFeedback(fallback("inbox.contactFormReady", "Formulario listo para crear un nuevo contacto."));
});

document.getElementById("contacts-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const contactId = (document.getElementById("contacts-edit-id") as HTMLInputElement).value.trim();
  const email = (document.getElementById("contacts-email") as HTMLInputElement).value.trim().toLowerCase();
  const displayName = (document.getElementById("contacts-name") as HTMLInputElement).value.trim();

  if (!email) {
    setContactsError(fallback("inbox.validation.email", "Debes indicar el correo del contacto."));
    return;
  }

  if (!SIMPLE_EMAIL_RE.test(email)) {
    setContactsError(fallback("inbox.validation.emailValid", "Ingresa un correo válido."));
    return;
  }

  setContactsError(null);

  const payload = {
    email,
    displayName: displayName || undefined,
  };

  const res = contactId
    ? await api.put(`/api/accounts/${accountId}/contacts/${contactId}`, payload)
    : await api.post(`/api/accounts/${accountId}/contacts`, payload);

  if (!res.ok) {
    setContactsFeedback(res.error ?? fallback("inbox.error.saveContact", "No se pudo guardar el contacto."), false);
    return;
  }

  setContactsFeedback(contactId ? fallback("inbox.success.contactUpdated", "Contacto actualizado correctamente.") : fallback("inbox.success.contactCreated", "Contacto creado correctamente."));
  resetContactForm();
  await loadContacts();
});

(document.getElementById("dlg-contacts") as HTMLDialogElement | null)?.addEventListener("close", () => {
  resetContactForm();
  setContactsFeedback(null);
});
