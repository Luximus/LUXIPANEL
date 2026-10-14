import { loadAccountCatalog } from "./account-catalog";
// Mail page — DataTable bridge: publishes rows to the mail DataTable islands,
// owns the READY handshake LISTENER + ready/cache state, and the encryption
// key view/delete row handlers. The REQUEST_READY emit stays in the entry.
import { api } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { MAIL_TABLE_IDS, S } from "./state";
import { callWin, showToast, t } from "./dom";
import { depurarCuentaConIa } from "./assistant";
import { handleMailAccountsBulkAction } from "./accounts";
import { loadEncryptionSettings } from "./settings";

const mailTableReady: Record<string, boolean> = {};

const mailTableCache: Record<string, any[]> = {};

export function publishMailTable(tableId: string, rows: any[]) {
  const safe = Array.isArray(rows) ? rows : [];
  mailTableCache[tableId] = safe;
  if (!mailTableReady[tableId]) return;
  window.dispatchEvent(
    new CustomEvent(DATATABLE_EVENTS.SET_DATA, { detail: { tableId, data: safe } }),
  );
}

async function encryptionViewKey(keyId: string) {
  const key = (S.mailEncryptionSettings?.keys ?? []).find((k) => k.keyId === keyId);
  const wrap = document.getElementById("mail-encryption-view-wrap");
  const text = document.getElementById("mail-encryption-view-text") as HTMLTextAreaElement | null;
  if (!wrap || !text || !key) return;
  text.value = key.publicKey;
  wrap.classList.remove("hidden");
}

async function encryptionDeleteKey(keyId: string) {
  if (!keyId) return;
  const key = (S.mailEncryptionSettings?.keys ?? []).find((item) => item.keyId === keyId);
  const isPrivate = key?.privateKeyMasked === "Protegida";
  if (!await openConfirm(isPrivate ? t("settingsRuntime.deleteProtectedKeyConfirm", "Eliminar esta clave impedirá abrir correos antiguos. Guarda antes su respaldo. ¿Eliminar?") : t("confirm.deleteEncryptionKey", "¿Eliminar esta llave de cifrado?"), { title: t("titles.deleteEncryptionKey", "Eliminar llave"), variant: "danger" })) return;
  const res = await api.delete(`/api/mail/encryption/keys/${encodeURIComponent(keyId)}`, { params: isPrivate ? { confirm: "true" } : {} });
  if (!res.ok) { showToast(res.error ?? t("settingsRuntime.deleteKeyError", "No se pudo eliminar la clave"), false); return; }
  showToast(t("toasts.keyDeleted", "Llave eliminada."));
  await loadEncryptionSettings();
}

let mailTableEventsBound = false;

export function bindMailTableEvents() {
  if (mailTableEventsBound) return;
  mailTableEventsBound = true;

  window.addEventListener(DATATABLE_EVENTS.READY, (event: Event) => {
    const detail = (event as CustomEvent<any>).detail;
    const tableId = detail?.tableId;
    if (!tableId || !MAIL_TABLE_IDS.includes(tableId)) return;
    mailTableReady[tableId] = true;
    if (mailTableCache[tableId]) publishMailTable(tableId, mailTableCache[tableId]);
  });

  window.addEventListener(DATATABLE_EVENTS.ROW_ACTION, (event: Event) => {
    const detail = (event as CustomEvent<any>).detail;
    if (!detail) return;
    const row = detail.row;
    const action = detail.actionId;
    if (!row) return;

    switch (detail.tableId) {
      case "mail-redirect-table":
        if (action === "edit") callWin("editMailDomainForward", row._domain);
        else if (action === "delete") callWin("deleteMailDomainForward", row._domain);
        break;
      case "mail-encryption-public-table":
      case "mail-encryption-private-table":
        if (action === "view") void encryptionViewKey(String(row.keyId));
        else if (action === "delete") void encryptionDeleteKey(String(row.keyId));
        break;
      case "mail-accounts-table": {
        const id = Number(row.id);
        const addr = String(row._address ?? row.address);
        if (action === "edit") callWin("openEditDialog", id);
        else if (action === "depurarIa") depurarCuentaConIa(id, addr);
        else if (action === "password") callWin("openPasswordDialog", id, addr);
        else if (action === "toggle") callWin("handleToggle", id, !!row._enabled);
        else if (action === "inbox")
          void loadAccountCatalog().then(accounts => window.dispatchEvent(new CustomEvent("lxp:mail:open-inbox", {
            detail: { id, address: addr, accounts: accounts.map((a) => ({ id: a.id, address: a.address })) },
          })));
        else if (action === "signatures")
          window.dispatchEvent(new CustomEvent("lxp:mail:open-signatures", { detail: { id, address: addr } }));
        else if (action === "default") callWin("setDefaultInboxAccount", id, addr);
        else if (action === "contacts") callWin("openContactsDialog", id);
        else if (action === "calendars") callWin("openCalendarsDialog", id);
        else if (action === "autoresponder") callWin("openAutoresponderDialog", id);
        else if (action === "filters") callWin("openFiltersDialog", id);
        else if (action === "forwards") callWin("openForwardsDialog", id);
        else if (action === "diskusage") callWin("openDiskUsageDialog", id);
        else if (action === "clone") callWin("openCloneDialog", id, addr);
        else if (action === "delete") callWin("deleteMailAccount", id, addr);
        break;
      }
      case "mail-global-filters-table":
        if (action === "edit") callWin("editGlobalMailFilter", row._id);
        else if (action === "delete") callWin("deleteGlobalMailFilter", row._id);
        break;
      case "mail-contacts-table":
        if (action === "edit") callWin("editContact", Number(row.id));
        else if (action === "delete") callWin("deleteContact", Number(row.id));
        break;
      case "mail-calendars-table":
        if (action === "edit") callWin("editCalendar", Number(row.id));
        else if (action === "delete") callWin("deleteCalendar", Number(row.id));
        break;
      case "mail-filters-table":
        if (action === "edit") callWin("editMailFilter", Number(row.id));
        else if (action === "delete") callWin("deleteMailFilter", Number(row.id));
        break;
    }
  });

  window.addEventListener(DATATABLE_EVENTS.QUICK_ACTION, (event: Event) => {
    const detail = (event as CustomEvent<any>).detail;
    if (!detail || detail.tableId !== "mail-accounts-table") return;
    const rows = Array.isArray(detail.rows) ? detail.rows : [];
    if (rows.length === 0) return;
    const targets = rows
      .map((r: any) => ({ id: Number(r?.id), address: String(r?.address ?? "") }))
      .filter((t: { id: number; address: string }) => Number.isFinite(t.id) && t.id > 0);
    if (targets.length === 0) return;
    void handleMailAccountsBulkAction(String(detail.actionId), targets);
  });
}
