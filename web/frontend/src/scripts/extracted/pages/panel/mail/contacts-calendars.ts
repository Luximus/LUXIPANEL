import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
// Mail page — per-account contacts, calendars and autoresponder dialogs/forms.
// Registers the contacts/calendars/autoresponder window.* globals on import.
import { api, resolveTargetScope } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import type { MailAutoresponder, MailCalendar, MailContact } from "./state";
import { LOCAL_PART_RE, S } from "./state";
import { fmt, parseLocalAndDomain, showToast, t, toDateTimeLocalValue } from "./dom";
import { publishMailTable } from "./table-bridge";
import { openDialog } from "/scripts/extracted/lib/dom.js";
const calendarPages = createTablePages({ tableId: "mail-calendars-table", events: window, scope: resolveTargetScope, reload: () => loadCalendars(S.calendarsAccountId!), field: "auto", aliases: {estado:"enabled"}, values: () => ({estado:{[t("status.active","Activo")]:"true",[t("status.inactive","Inactivo")]:"false"}}) });
const contactPages = createTablePages({ tableId: "mail-contacts-table", events: window, scope: resolveTargetScope, reload: () => loadContacts(S.contactsAccountId!), field: "auto", aliases: {name:"displayName"} });

async function ensureAutoresponderCharsets() {
  if (S.autoresponderCharsets.length > 0) return;
  const res = await api.get<string[]>("/api/accounts/autoresponder/charsets");
  S.autoresponderCharsets = (res.ok && Array.isArray(res.data) ? res.data : ["utf-8"]).map((item) => String(item).toLowerCase());
}

function fillAutoresponderDomainSelect(selectedDomain: string) {
  const select = document.getElementById("autoresponder-domain") as HTMLSelectElement | null;
  if (!select) return;
  select.innerHTML = "";

  const values = S.domains.length > 0 ? [...S.domains] : [];
  if (selectedDomain && !values.includes(selectedDomain)) {
    values.unshift(selectedDomain);
  }
  for (const domain of values) {
    const option = document.createElement("option");
    option.value = domain;
    option.textContent = domain;
    if (domain === selectedDomain) option.selected = true;
    select.append(option);
  }
}

function fillAutoresponderCharsetSelect(selectedCharset: string) {
  const select = document.getElementById("autoresponder-charset") as HTMLSelectElement | null;
  if (!select) return;
  select.innerHTML = "";
  const normalized = selectedCharset.toLowerCase();
  const values = S.autoresponderCharsets.length > 0 ? [...S.autoresponderCharsets] : ["utf-8"];
  if (!values.includes(normalized)) values.unshift(normalized);

  for (const charset of values) {
    const option = document.createElement("option");
    option.value = charset;
    option.textContent = charset;
    if (charset === normalized) option.selected = true;
    select.append(option);
  }
}

function resetAutoresponderForm(address: string) {
  const { localPart, domain } = parseLocalAndDomain(address);
  S.autoresponderExists = false;
  (document.getElementById("autoresponder-enabled") as HTMLInputElement).checked = true;
  (document.getElementById("autoresponder-interval") as HTMLInputElement).value = "24";
  (document.getElementById("autoresponder-local") as HTMLInputElement).value = localPart;
  (document.getElementById("autoresponder-from") as HTMLInputElement).value = address;
  (document.getElementById("autoresponder-subject") as HTMLInputElement).value = "Autoresponder";
  (document.getElementById("autoresponder-body") as HTMLTextAreaElement).value = "";
  (document.getElementById("autoresponder-is-html") as HTMLInputElement).checked = false;
  (document.getElementById("autoresponder-start") as HTMLInputElement).value = "";
  (document.getElementById("autoresponder-stop") as HTMLInputElement).value = "";
  fillAutoresponderDomainSelect(domain);
  fillAutoresponderCharsetSelect("utf-8");
  document.getElementById("autoresponder-error")?.classList.add("hidden");
}

function fillAutoresponderForm(data: MailAutoresponder, accountAddress: string) {
  S.autoresponderExists = true;
  (document.getElementById("autoresponder-enabled") as HTMLInputElement).checked = data.enabled;
  (document.getElementById("autoresponder-interval") as HTMLInputElement).value = String(data.intervalHours ?? 24);
  (document.getElementById("autoresponder-local") as HTMLInputElement).value = data.localPart ?? parseLocalAndDomain(accountAddress).localPart;
  (document.getElementById("autoresponder-from") as HTMLInputElement).value = data.fromName ?? accountAddress;
  (document.getElementById("autoresponder-subject") as HTMLInputElement).value = data.subject ?? "Autoresponder";
  (document.getElementById("autoresponder-body") as HTMLTextAreaElement).value = data.body ?? "";
  (document.getElementById("autoresponder-is-html") as HTMLInputElement).checked = Boolean(data.isHtml);
  (document.getElementById("autoresponder-start") as HTMLInputElement).value = toDateTimeLocalValue(data.startAt);
  (document.getElementById("autoresponder-stop") as HTMLInputElement).value = toDateTimeLocalValue(data.stopAt);
  fillAutoresponderDomainSelect(data.domain ?? parseLocalAndDomain(accountAddress).domain);
  fillAutoresponderCharsetSelect(data.charset ?? "utf-8");
  document.getElementById("autoresponder-error")?.classList.add("hidden");
}

function renderContactsList() {
  publishMailTable("mail-contacts-table", S.loadedContacts.map((contact) => ({
    id: contact.id,
    email: contact.email,
    name: contact.displayName || "-",
  })));
}

async function loadContacts(accountId: number) {
  const res = await contactPages.read<MailContact[]>(params => api.get<MailContact[]>(`/api/accounts/${accountId}/contacts`, {params}), String(accountId));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  S.loadedContacts = res.ok && Array.isArray(res.data) ? res.data : [];
  renderContactsList();
}

function resetContactForm() {
  (document.getElementById("contacts-edit-id") as HTMLInputElement).value = "";
  (document.getElementById("contacts-email") as HTMLInputElement).value = "";
  (document.getElementById("contacts-name") as HTMLInputElement).value = "";
  document.getElementById("contacts-error")?.classList.add("hidden");
}

function fillContactForm(contact: MailContact) {
  (document.getElementById("contacts-edit-id") as HTMLInputElement).value = String(contact.id);
  (document.getElementById("contacts-email") as HTMLInputElement).value = contact.email;
  (document.getElementById("contacts-name") as HTMLInputElement).value = contact.displayName || "";
  document.getElementById("contacts-error")?.classList.add("hidden");
}

function renderCalendarsList() {
  publishMailTable("mail-calendars-table", S.loadedCalendars.map((calendar) => ({
    id: calendar.id,
    name: calendar.name,
    timezone: calendar.timezone,
    estado: calendar.enabled ? t("status.active", "Activo") : t("status.inactive", "Inactivo"),
  })));
}

async function loadCalendars(accountId: number) {
  const res = await calendarPages.read<MailCalendar[]>(params => api.get<MailCalendar[]>(`/api/accounts/${accountId}/calendars`, {params}), String(accountId));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  S.loadedCalendars = res.ok && Array.isArray(res.data) ? res.data : [];
  renderCalendarsList();
}

function resetCalendarForm() {
  (document.getElementById("calendars-edit-id") as HTMLInputElement).value = "";
  (document.getElementById("calendars-name") as HTMLInputElement).value = "";
  (document.getElementById("calendars-description") as HTMLTextAreaElement).value = "";
  (document.getElementById("calendars-color") as HTMLInputElement).value = "#3b82f6";
  (document.getElementById("calendars-timezone") as HTMLInputElement).value = "UTC";
  (document.getElementById("calendars-enabled") as HTMLInputElement).checked = true;
  document.getElementById("calendars-error")?.classList.add("hidden");
}

function fillCalendarForm(calendar: MailCalendar) {
  (document.getElementById("calendars-edit-id") as HTMLInputElement).value = String(calendar.id);
  (document.getElementById("calendars-name") as HTMLInputElement).value = calendar.name;
  (document.getElementById("calendars-description") as HTMLTextAreaElement).value = calendar.description || "";
  (document.getElementById("calendars-color") as HTMLInputElement).value = calendar.color || "#3b82f6";
  (document.getElementById("calendars-timezone") as HTMLInputElement).value = calendar.timezone || "UTC";
  (document.getElementById("calendars-enabled") as HTMLInputElement).checked = Boolean(calendar.enabled);
  document.getElementById("calendars-error")?.classList.add("hidden");
}

(window as any).openContactsDialog = async (id: number) => {
  const account = S.accounts.find((a) => a.id === id);
  if (!account) {
    showToast(t("errors.accountNotFound", "No se encontró la cuenta"), false);
    return;
  }
  S.contactsAccountId = id;
  (document.getElementById("contacts-account-label") as HTMLElement).textContent = account.address;
  await loadContacts(id);
  resetContactForm();
  openDialog("dialog-contacts");
};

(window as any).editContact = (contactId: number) => {
  const contact = S.loadedContacts.find((item) => item.id === contactId);
  if (!contact) {
    showToast(t("errors.contactNotFound", "No se encontró el contacto"), false);
    return;
  }
  fillContactForm(contact);
};

(window as any).deleteContact = async (contactId: number) => {
  if (!S.contactsAccountId) return;
  const contact = S.loadedContacts.find((item) => item.id === contactId);
  const label = contact?.email ?? `#${contactId}`;
  const confirmed = await openConfirm(fmt(t("confirm.deleteContact", "¿Eliminar contacto \"{label}\"?"), { label }), { title: t("confirm.deleteContactTitle", "Eliminar contacto"), variant: "danger" });
  if (!confirmed) return;

  const res = await api.delete(`/api/accounts/${S.contactsAccountId}/contacts/${contactId}`);
  if (!res.ok) {
    showToast(res.error ?? t("errors.contactDeleteFailed", "No se pudo eliminar contacto"), false);
    return;
  }
  showToast(t("toasts.contactDeleted", "Contacto eliminado"));
  await loadContacts(S.contactsAccountId);
  resetContactForm();
};

(window as any).openCalendarsDialog = async (id: number) => {
  const account = S.accounts.find((a) => a.id === id);
  if (!account) {
    showToast(t("errors.accountNotFound", "No se encontró la cuenta"), false);
    return;
  }
  S.calendarsAccountId = id;
  (document.getElementById("calendars-account-label") as HTMLElement).textContent = account.address;
  await loadCalendars(id);
  resetCalendarForm();
  openDialog("dialog-calendars");
};

(window as any).editCalendar = (calendarId: number) => {
  const calendar = S.loadedCalendars.find((item) => item.id === calendarId);
  if (!calendar) {
    showToast(t("errors.calendarNotFound", "No se encontró el calendario"), false);
    return;
  }
  fillCalendarForm(calendar);
};

(window as any).deleteCalendar = async (calendarId: number) => {
  if (!S.calendarsAccountId) return;
  const calendar = S.loadedCalendars.find((item) => item.id === calendarId);
  const label = calendar?.name ?? `#${calendarId}`;
  const confirmed = await openConfirm(fmt(t("confirm.deleteCalendar", "¿Eliminar calendario \"{label}\"?"), { label }), { title: t("confirm.deleteCalendarTitle", "Eliminar calendario"), variant: "danger" });
  if (!confirmed) return;

  const res = await api.delete(`/api/accounts/${S.calendarsAccountId}/calendars/${calendarId}`);
  if (!res.ok) {
    showToast(res.error ?? t("errors.calendarDeleteFailed", "No se pudo eliminar calendario"), false);
    return;
  }
  showToast(t("toasts.calendarDeleted", "Calendario eliminado"));
  await loadCalendars(S.calendarsAccountId);
  resetCalendarForm();
};

(window as any).openAutoresponderDialog = async (id: number) => {
  const account = S.accounts.find((a) => a.id === id);
  if (!account) {
    showToast(t("errors.accountNotFound", "No se encontró la cuenta"), false);
    return;
  }
  S.autoresponderAccountId = id;
  (document.getElementById("autoresponder-account-label") as HTMLElement).textContent = account.address;
  await ensureAutoresponderCharsets();
  resetAutoresponderForm(account.address);

  const res = await api.get<MailAutoresponder | null>(`/api/accounts/${id}/autoresponder`);
  if (res.ok && res.data) {
    fillAutoresponderForm(res.data, account.address);
  }

  openDialog("dialog-autoresponder");
};

const closeAutoresponderDialog = () => (document.getElementById("dialog-autoresponder") as HTMLDialogElement).close();

const closeContactsDialog = () => (document.getElementById("dialog-contacts") as HTMLDialogElement).close();

const closeCalendarsDialog = () => (document.getElementById("dialog-calendars") as HTMLDialogElement).close();

document.getElementById("autoresponder-dialog-close")?.addEventListener("click", closeAutoresponderDialog);

document.getElementById("autoresponder-cancel")?.addEventListener("click", closeAutoresponderDialog);

document.getElementById("contacts-dialog-close")?.addEventListener("click", closeContactsDialog);

document.getElementById("contacts-cancel")?.addEventListener("click", closeContactsDialog);

document.getElementById("contacts-new")?.addEventListener("click", resetContactForm);

document.getElementById("calendars-dialog-close")?.addEventListener("click", closeCalendarsDialog);

document.getElementById("calendars-cancel")?.addEventListener("click", closeCalendarsDialog);

document.getElementById("calendars-new")?.addEventListener("click", resetCalendarForm);

(document.getElementById("dialog-contacts") as HTMLDialogElement | null)?.addEventListener("close", () => {
  S.contactsAccountId = null;
  S.loadedContacts = [];
});

(document.getElementById("dialog-calendars") as HTMLDialogElement | null)?.addEventListener("close", () => {
  S.calendarsAccountId = null;
  S.loadedCalendars = [];
});

(document.getElementById("dialog-autoresponder") as HTMLDialogElement | null)?.addEventListener("close", () => {
  S.autoresponderAccountId = null;
  S.autoresponderExists = false;
});

document.getElementById("contacts-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!S.contactsAccountId) return;

  const errEl = document.getElementById("contacts-error") as HTMLElement;
  errEl.classList.add("hidden");
  const contactId = (document.getElementById("contacts-edit-id") as HTMLInputElement).value.trim();
  const email = (document.getElementById("contacts-email") as HTMLInputElement).value.trim().toLowerCase();
  const displayName = (document.getElementById("contacts-name") as HTMLInputElement).value.trim();

  if (!email) {
    errEl.textContent = t("errors.mustIndicateContactEmail", "Debes indicar el correo del contacto.");
    errEl.classList.remove("hidden");
    return;
  }

  const payload = { email, displayName: displayName || null };
  const res = contactId
    ? await api.put(`/api/accounts/${S.contactsAccountId}/contacts/${contactId}`, payload)
    : await api.post(`/api/accounts/${S.contactsAccountId}/contacts`, payload);

  if (!res.ok) {
    errEl.textContent = res.error ?? t("errors.contactSaveFailed", "No se pudo guardar el contacto.");
    errEl.classList.remove("hidden");
    return;
  }

  showToast(contactId ? t("toasts.contactUpdated", "Contacto actualizado") : t("toasts.contactCreated", "Contacto creado"));
  await loadContacts(S.contactsAccountId);
  resetContactForm();
});

document.getElementById("calendars-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!S.calendarsAccountId) return;

  const errEl = document.getElementById("calendars-error") as HTMLElement;
  errEl.classList.add("hidden");
  const calendarId = (document.getElementById("calendars-edit-id") as HTMLInputElement).value.trim();
  const name = (document.getElementById("calendars-name") as HTMLInputElement).value.trim();
  const description = (document.getElementById("calendars-description") as HTMLTextAreaElement).value.trim();
  const color = (document.getElementById("calendars-color") as HTMLInputElement).value.trim();
  const timezone = (document.getElementById("calendars-timezone") as HTMLInputElement).value.trim();
  const enabled = (document.getElementById("calendars-enabled") as HTMLInputElement).checked;

  if (!name) {
    errEl.textContent = t("errors.mustIndicateCalendarName", "Debes indicar nombre de calendario.");
    errEl.classList.remove("hidden");
    return;
  }

  const payload = {
    name,
    description: description || null,
    color: color || "#3b82f6",
    timezone: timezone || "UTC",
    enabled,
  };
  const res = calendarId
    ? await api.put(`/api/accounts/${S.calendarsAccountId}/calendars/${calendarId}`, payload)
    : await api.post(`/api/accounts/${S.calendarsAccountId}/calendars`, payload);

  if (!res.ok) {
    errEl.textContent = res.error ?? t("errors.calendarSaveFailed", "No se pudo guardar el calendario.");
    errEl.classList.remove("hidden");
    return;
  }

  showToast(calendarId ? t("toasts.calendarUpdated", "Calendario actualizado") : t("toasts.calendarCreated", "Calendario creado"));
  await loadCalendars(S.calendarsAccountId);
  resetCalendarForm();
});

document.getElementById("autoresponder-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!S.autoresponderAccountId) return;

  const errEl = document.getElementById("autoresponder-error") as HTMLElement;
  errEl.classList.add("hidden");

  const localPart = (document.getElementById("autoresponder-local") as HTMLInputElement).value.trim().toLowerCase();
  const domain = (document.getElementById("autoresponder-domain") as HTMLSelectElement).value.trim().toLowerCase();
  const charset = (document.getElementById("autoresponder-charset") as HTMLSelectElement).value.trim().toLowerCase();
  const intervalHours = Number((document.getElementById("autoresponder-interval") as HTMLInputElement).value || "24");
  const fromName = (document.getElementById("autoresponder-from") as HTMLInputElement).value.trim();
  const subject = (document.getElementById("autoresponder-subject") as HTMLInputElement).value.trim();
  const body = (document.getElementById("autoresponder-body") as HTMLTextAreaElement).value;
  const enabled = (document.getElementById("autoresponder-enabled") as HTMLInputElement).checked;
  const isHtml = (document.getElementById("autoresponder-is-html") as HTMLInputElement).checked;
  const startAtRaw = (document.getElementById("autoresponder-start") as HTMLInputElement).value;
  const stopAtRaw = (document.getElementById("autoresponder-stop") as HTMLInputElement).value;

  if (!LOCAL_PART_RE.test(localPart)) {
    errEl.textContent = t("errors.localPartInvalid", "El usuario antes de @ tiene un formato inválido.");
    errEl.classList.remove("hidden");
    return;
  }
  if (!domain) {
    errEl.textContent = t("errors.mustSelectDomain", "Debes seleccionar un dominio.");
    errEl.classList.remove("hidden");
    return;
  }
  if (!subject) {
    errEl.textContent = t("errors.mustEnterSubject", "Debes ingresar un asunto.");
    errEl.classList.remove("hidden");
    return;
  }
  if (!body.trim()) {
    errEl.textContent = t("errors.mustEnterBody", "Debes ingresar el contenido del mensaje.");
    errEl.classList.remove("hidden");
    return;
  }

  const startAt = startAtRaw ? new Date(startAtRaw).toISOString() : null;
  const stopAt = stopAtRaw ? new Date(stopAtRaw).toISOString() : null;
  const res = await api.put(`/api/accounts/${S.autoresponderAccountId}/autoresponder`, {
    enabled,
    charset,
    intervalHours: Number.isFinite(intervalHours) ? Math.max(0, Math.floor(intervalHours)) : 24,
    localPart,
    domain,
    fromName: fromName || null,
    subject,
    body,
    isHtml,
    startAt,
    stopAt,
  });

  if (!res.ok) {
    errEl.textContent = res.error ?? t("errors.autoresponderSaveFailed", "No se pudo guardar el autoresponder.");
    errEl.classList.remove("hidden");
    return;
  }

  S.autoresponderExists = true;
  showToast(t("toasts.autoresponderSaved", "Autoresponder guardado"));
});

document.getElementById("autoresponder-delete")?.addEventListener("click", async () => {
  if (!S.autoresponderAccountId) return;
  if (!S.autoresponderExists) {
    showToast(t("errors.noAutoresponderToDelete", "No hay autoresponder para eliminar"), false);
    return;
  }
  const confirmed = await openConfirm(t("confirm.deleteAutoresponder", "¿Eliminar autoresponder de esta cuenta?"), { title: t("titles.deleteAutoresponder", "Eliminar autoresponder"), variant: "danger" });
  if (!confirmed) return;

  const res = await api.delete(`/api/accounts/${S.autoresponderAccountId}/autoresponder`);
  if (!res.ok) {
    showToast(res.error ?? t("errors.autoresponderDeleteFailed", "No se pudo eliminar autoresponder"), false);
    return;
  }
  const account = S.accounts.find((a) => a.id === S.autoresponderAccountId);
  if (account) resetAutoresponderForm(account.address);
  S.autoresponderExists = false;
  showToast(t("toasts.autoresponderDeleted", "Autoresponder eliminado"));
});
