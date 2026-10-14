// Mail page — per-account forwards dialog (DataTable-free) + the shared forward
// row helpers (createForwardRowHtml / collectForwards / addForwardRow) reused by
// the create/edit account dialogs. Registers window.openForwardsDialog on import.
import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
import { api,resolveTargetScope } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import type { MailForward } from "./state";
import { S, SIMPLE_EMAIL_RE } from "./state";
import { escapeAttr, fmt, showToast, t } from "./dom";
import { loadAccounts } from "./accounts";
import { openDialog } from "/scripts/extracted/lib/dom.js";

let forwardsDialogAccountId: number | null = null;

let forwardsDialogRows: MailForward[] = [];
let forwardsView:MailForward[]=[];
const forwardPages=createTablePages({tableId:"forwards-tbody",events:window,scope:resolveTargetScope,reload:()=>forwardsDialogAccountId!==null && reloadForwardsFromServer(forwardsDialogAccountId),field:"auto",catalog:["destination","keepCopy"],rowKey:row=>row.destination});

function renderForwardsTable() {
  const tbody = document.getElementById("forwards-tbody");
  const empty = document.getElementById("forwards-empty");
  if (!tbody) return;
  if (forwardsDialogRows.length === 0) {
    tbody.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }
  empty?.classList.add("hidden");
  tbody.innerHTML = forwardsView
    .map(
      (f) => {const i=forwardsDialogRows.findIndex(row=>row.destination===f.destination);return `
    <tr class="border-b border-border last:border-0">
      <td class="px-4 py-2">${escapeAttr(f.destination)}</td>
      <td class="px-4 py-2">${f.keepCopy ? t("labels.yes", "Sí") : t("labels.no", "No")}</td>
      <td class="px-4 py-2 text-right whitespace-nowrap">
        <button type="button" data-fwd-edit="${i}" class="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">${t("actions.edit", "Editar")}</button>
        <button type="button" data-fwd-del="${i}" class="ml-1 rounded-md border border-destructive/50 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">${t("actions.remove", "Eliminar")}</button>
      </td>
    </tr>`;},
    )
    .join("");
}

function setForwardsError(msg: string | null) {
  const errEl = document.getElementById("forwards-error");
  if (!errEl) return;
  if (msg) { errEl.textContent = msg; errEl.classList.remove("hidden"); }
  else errEl.classList.add("hidden");
}

function resetForwardsForm() {
  (document.getElementById("forwards-edit-idx") as HTMLInputElement).value = "";
  (document.getElementById("forwards-dest") as HTMLInputElement).value = "";
  (document.getElementById("forwards-keepcopy") as HTMLInputElement).checked = true;
  setForwardsError(null);
}

async function reloadForwardsFromServer(id: number): Promise<void> {
  const res = await forwardPages.read<MailForward[]>(params=>api.get<MailForward[]>(`/api/accounts/${id}/forwards`,{params}),String(id));
  if(res.code==="TARGET_SCOPE_CHANGED")return;
  const fwds = res.ok && Array.isArray(res.data) ? res.data : [];
  forwardsView=fwds;
  forwardsDialogRows = (forwardPages.catalog ?? fwds).map((f:MailForward) => ({
    destination: String(f.destination ?? "").trim(),
    keepCopy: f.keepCopy !== false,
  }));
  renderForwardsTable();
}

async function persistForwards(): Promise<boolean> {
  if (forwardsDialogAccountId === null) return false;
  const res = await api.put(`/api/accounts/${forwardsDialogAccountId}/forwards`, {
    forwards: forwardsDialogRows,
  });
  if (!res.ok) {
    setForwardsError(t("errors.forwardsSaveFailed", "No se pudieron guardar los reenvíos en el servidor"));
    return false;
  }
  // Re-leer del servidor (/etc/postfix/virtual) para reflejar el estado real.
  await reloadForwardsFromServer(forwardsDialogAccountId);
  await loadAccounts();
  return true;
}

(window as any).openForwardsDialog = async (id: number) => {
  const account = S.accounts.find((a) => a.id === id);
  if (!account) {
    showToast(t("errors.accountNotFound", "No se encontró la cuenta"), false);
    return;
  }
  forwardsDialogAccountId = id;
  const label = document.getElementById("forwards-account-label");
  if (label) label.textContent = fmt(t("labels.accountColon", "Cuenta: {address}"), { address: account.address });

  resetForwardsForm();
  await reloadForwardsFromServer(id);
  openDialog("dialog-forwards");
};

function editForwardAt(idx: number) {
  const f = forwardsDialogRows[idx];
  if (!f) return;
  (document.getElementById("forwards-edit-idx") as HTMLInputElement).value = String(idx);
  (document.getElementById("forwards-dest") as HTMLInputElement).value = f.destination;
  (document.getElementById("forwards-keepcopy") as HTMLInputElement).checked = f.keepCopy;
  setForwardsError(null);
  document.getElementById("forwards-dest")?.focus();
}

async function deleteForwardAt(idx: number) {
  const f = forwardsDialogRows[idx];
  if (!f) return;
  const confirmed = await openConfirm(fmt(t("confirm.deleteForward", "¿Eliminar el reenvío a {destination}?"), { destination: f.destination }), {
    title: t("titles.deleteForward", "Eliminar reenvío"),
    variant: "danger",
    confirmText: t("confirm.yesDelete", "Sí, eliminar"),
  });
  if (!confirmed) return;
  forwardsDialogRows.splice(idx, 1);
  if (await persistForwards()) {
    resetForwardsForm();
    showToast(t("toasts.forwardDeleted", "Reenvío eliminado"), true);
  }
}

document.getElementById("forwards-tbody")?.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-fwd-edit],[data-fwd-del]");
  if (!btn) return;
  const editIdx = btn.getAttribute("data-fwd-edit");
  const delIdx = btn.getAttribute("data-fwd-del");
  if (editIdx !== null) editForwardAt(Number(editIdx));
  else if (delIdx !== null) void deleteForwardAt(Number(delIdx));
});

document.getElementById("forwards-new")?.addEventListener("click", resetForwardsForm);

document.getElementById("forwards-cancel")?.addEventListener("click", () =>
  (document.getElementById("dialog-forwards") as HTMLDialogElement | null)?.close(),
);

document.getElementById("forwards-dialog-close")?.addEventListener("click", () =>
  (document.getElementById("dialog-forwards") as HTMLDialogElement | null)?.close(),
);

document.getElementById("dialog-forwards")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    (e.currentTarget as HTMLDialogElement).close();
  }
});

document.getElementById("forwards-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (forwardsDialogAccountId === null) return;
  const destination = (document.getElementById("forwards-dest") as HTMLInputElement)
    .value.trim().toLowerCase();
  const keepCopy = (document.getElementById("forwards-keepcopy") as HTMLInputElement).checked;
  const editIdxRaw = (document.getElementById("forwards-edit-idx") as HTMLInputElement).value;
  const editIdx = editIdxRaw === "" ? -1 : Number(editIdxRaw);

  if (!SIMPLE_EMAIL_RE.test(destination)) {
    setForwardsError(t("errors.destEmailInvalid", "Correo destino inválido"));
    return;
  }
  const dupIdx = forwardsDialogRows.findIndex(
    (f) => f.destination.trim().toLowerCase() === destination,
  );
  if (dupIdx !== -1 && dupIdx !== editIdx) {
    setForwardsError(fmt(t("errors.forwardAlreadyExists", "Ya existe un reenvío a {destination}"), { destination }));
    return;
  }

  if (editIdx >= 0 && forwardsDialogRows[editIdx]) {
    forwardsDialogRows[editIdx] = { destination, keepCopy };
  } else {
    forwardsDialogRows.push({ destination, keepCopy });
  }
  if (await persistForwards()) {
    resetForwardsForm();
    showToast(t("toasts.forwardsUpdated", "Reenvíos actualizados"), true);
  }
});

function createForwardRowHtml(prefix: "new" | "edit" | "fwd", forward: MailForward = { destination: "", keepCopy: true }): string {
  const destination = escapeAttr(forward.destination ?? "");
  const checked = forward.keepCopy ? "checked" : "";
  return `
    <div class="forward-row grid grid-cols-1 gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
      <input
        type="email"
        class="${prefix}-forward-destination h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        placeholder="destino@dominio.com"
        value="${destination}"
      />
      <label class="inline-flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
        <input type="checkbox" class="${prefix}-forward-keepcopy h-4 w-4 rounded border-input" ${checked} />
        ${t("labels.keepCopy", "Guardar copia")}
      </label>
      <button type="button" class="${prefix}-forward-remove rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
        ${t("actions.remove", "Quitar")}
      </button>
    </div>
  `;
}

function bindForwardRowRemove(prefix: "new" | "edit" | "fwd") {
  document.querySelectorAll(`.${prefix}-forward-remove`).forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = (btn as HTMLElement).closest(".forward-row");
      row?.remove();
    });
  });
}

export function collectForwards(prefix: "new" | "edit" | "fwd"): MailForward[] {
  const rows = Array.from(document.querySelectorAll(`#${prefix}-forwards-list .forward-row`));
  const out: MailForward[] = [];

  for (const row of rows) {
    const destinationInput = row.querySelector(`.${prefix}-forward-destination`) as HTMLInputElement | null;
    const keepCopyInput = row.querySelector(`.${prefix}-forward-keepcopy`) as HTMLInputElement | null;
    const destination = destinationInput?.value.trim().toLowerCase() ?? "";
    if (!destination) continue;
    out.push({
      destination,
      keepCopy: keepCopyInput?.checked ?? true,
    });
  }

  return out;
}

export function addForwardRow(prefix: "new" | "edit" | "fwd", forward?: MailForward) {
  const list = document.getElementById(`${prefix}-forwards-list`)!;
  list.insertAdjacentHTML("beforeend", createForwardRowHtml(prefix, forward));
  bindForwardRowRemove(prefix);
}
