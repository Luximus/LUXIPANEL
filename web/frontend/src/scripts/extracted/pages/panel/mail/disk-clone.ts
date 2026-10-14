import { loadAccountCatalog } from "./account-catalog";
// Mail page — per-account disk usage dialog + mailbox clone dialog.
// Registers window.openDiskUsageDialog/diskDeleteByDate/diskCopyByDate/openCloneDialog.
import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
import { api,resolveTargetScope } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import type { DiskUsageFolder } from "./state";
import { S } from "./state";
import { fmt, showToast, t, toDateInputValue } from "./dom";
import { awaitMailJob, loadAccounts } from "./accounts";
import { loadDomains } from "./domains";
import { openDialog } from "/scripts/extracted/lib/dom.js";

function renderDiskUsageRows(folders: DiskUsageFolder[]) {
  const tbody = document.getElementById("disk-usage-tbody");
  if (!tbody) return;

  if (!folders.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-4 py-8 text-center text-sm text-muted-foreground">
          ${t("empty.noFolders", "No se encontraron carpetas para esta cuenta.")}
        </td>
      </tr>
    `;
    return;
  }

  const now = new Date();
  const fromDefault = new Date();
  fromDefault.setMonth(fromDefault.getMonth() - 1);
  const fromValue = toDateInputValue(fromDefault);
  const toValue = toDateInputValue(now);

  tbody.innerHTML = folders.map((folder, index) => {
    const rowId = `disk-row-${index}`;
    const encodedFolder = encodeURIComponent(folder.path);
    return `
      <tr class="border-b border-border last:border-0">
        <td class="px-4 py-2">${folder.path}</td>
        <td class="px-4 py-2 text-muted-foreground">${folder.messageCount}</td>
        <td class="px-4 py-2 text-muted-foreground">${folder.sizeFormatted}</td>
        <td class="px-4 py-2">
          <div class="flex items-center gap-2">
            <input id="${rowId}-from" type="date" value="${fromValue}" class="h-8 rounded-md border border-input bg-background px-2 text-xs" />
            <span class="text-xs text-muted-foreground">${t("labels.to", "a")}</span>
            <input id="${rowId}-to" type="date" value="${toValue}" class="h-8 rounded-md border border-input bg-background px-2 text-xs" />
          </div>
        </td>
        <td class="px-4 py-2 text-right">
          <div class="flex items-center justify-end gap-2">
            <button
              class="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
              onclick="diskCopyByDate('${encodedFolder}','${rowId}')"
            >
              ${t("actions.copy", "Copiar")}
            </button>
            <button
              class="rounded-md border border-destructive/40 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
              onclick="diskDeleteByDate('${encodedFolder}','${rowId}')"
            >
              ${t("actions.delete", "Eliminar")}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function fillDiskDestinationAccounts(excludeAccountId: number) {
  const destination = document.getElementById("disk-dest-account") as HTMLSelectElement | null;
  if (!destination) return;
  destination.innerHTML = "";
  destination.disabled = false;

  const candidates = (await loadAccountCatalog()).filter((account) => account.id !== excludeAccountId);
  if (!candidates.length) {
    destination.innerHTML = `<option value=''>${t("empty.noOtherAccount", "No hay otra cuenta disponible")}</option>`;
    destination.disabled = true;
    return;
  }

  for (const account of candidates) {
    const option = document.createElement("option");
    option.value = String(account.id);
    option.textContent = account.address;
    destination.append(option);
  }
}

const diskPages=createTablePages({tableId:"disk-usage-tbody",events:window,scope:resolveTargetScope,reload:()=>S.diskUsageAccountId && loadDiskUsage(S.diskUsageAccountId),field:"folders",rowKey:row=>row.path ?? row.folder ?? row.name});
async function loadDiskUsage(accountId: number) {
  const errorEl = document.getElementById("disk-usage-error");
  const totalEl = document.getElementById("disk-total-usage");
  if (errorEl) errorEl.classList.add("hidden");
  if (totalEl) totalEl.textContent = t("labels.loading", "Cargando...");

  const res = await diskPages.read<{ totalFormatted: string; folders: DiskUsageFolder[] }>(params=>api.get(`/api/mail/${accountId}/disk-usage`,{params}),String(accountId));
  if(res.code==="TARGET_SCOPE_CHANGED")return;
  if (!res.ok) {
    if (totalEl) totalEl.textContent = "";
    if (errorEl) {
      errorEl.textContent = res.error ?? t("errors.diskUsageLoadFailed", "No se pudo cargar el disk usage");
      errorEl.classList.remove("hidden");
    }
    renderDiskUsageRows([]);
    return;
  }

  const payload = res.data as any;
  const folders = Array.isArray(payload?.folders) ? payload.folders as DiskUsageFolder[] : [];
  if (totalEl) totalEl.textContent = `${t("labels.total", "Total")}: ${payload?.totalFormatted ?? "-"}`;
  renderDiskUsageRows(folders);
}

(window as any).openDiskUsageDialog = async (id: number) => {
  const account = S.accounts.find((a) => a.id === id);
  if (!account) {
    showToast(t("errors.accountNotFound", "No se encontró la cuenta"), false);
    return;
  }

  S.diskUsageAccountId = id;
  await fillDiskDestinationAccounts(id);
  (document.getElementById("disk-account-label") as HTMLElement).textContent = account.address;
  (document.getElementById("disk-dest-folder") as HTMLInputElement).value = "";
  await loadDiskUsage(id);
  openDialog("dialog-disk-usage");
};

(window as any).diskDeleteByDate = async (folder: string, rowId: string) => {
  if (!S.diskUsageAccountId) return;
  const decodedFolder = decodeURIComponent(folder);
  const dateFrom = (document.getElementById(`${rowId}-from`) as HTMLInputElement | null)?.value ?? "";
  const dateTo = (document.getElementById(`${rowId}-to`) as HTMLInputElement | null)?.value ?? "";
  if (!dateFrom || !dateTo) {
    showToast(t("errors.dateRangeRequired", "Debes seleccionar fecha inicial y final"), false);
    return;
  }

  const confirmed = await openConfirm(
    fmt(t("confirm.deleteByDate", "Se eliminarán correos de {folder} entre {from} y {to}. ¿Continuar?"), { folder: decodedFolder, from: dateFrom, to: dateTo }),
    { title: t("confirm.deleteByDateTitle", "Eliminar correos por fecha"), variant: "danger" },
  );
  if (!confirmed) return;

  const res = await api.post(`/api/mail/${S.diskUsageAccountId}/disk-usage/delete-by-date`, {
    folder: decodedFolder,
    dateFrom,
    dateTo,
  });
  if (!res.ok) {
    showToast(res.error ?? t("errors.deleteByRangeFailed", "No se pudo eliminar por rango"), false);
    return;
  }

  const deleted = Number((res.data as any)?.deleted ?? 0);
  showToast(fmt(t("toasts.emailsDeleted", "Eliminados {count} correos de {folder}"), { count: deleted, folder: decodedFolder }));
  await loadDiskUsage(S.diskUsageAccountId);
  loadAccounts();
};

(window as any).diskCopyByDate = async (folder: string, rowId: string) => {
  if (!S.diskUsageAccountId) return;
  const decodedFolder = decodeURIComponent(folder);
  const destinationAccountId = Number((document.getElementById("disk-dest-account") as HTMLSelectElement | null)?.value ?? "0");
  const destinationFolder = ((document.getElementById("disk-dest-folder") as HTMLInputElement | null)?.value ?? "").trim();
  const dateFrom = (document.getElementById(`${rowId}-from`) as HTMLInputElement | null)?.value ?? "";
  const dateTo = (document.getElementById(`${rowId}-to`) as HTMLInputElement | null)?.value ?? "";

  if (!destinationAccountId) {
    showToast(t("errors.selectDestAccount", "Selecciona una cuenta destino"), false);
    return;
  }
  if (!dateFrom || !dateTo) {
    showToast(t("errors.dateRangeRequired", "Debes seleccionar fecha inicial y final"), false);
    return;
  }

  const res = await api.post(`/api/mail/${S.diskUsageAccountId}/disk-usage/copy-by-date`, {
    folder: decodedFolder,
    dateFrom,
    dateTo,
    destinationAccountId,
    destinationFolder: destinationFolder || undefined,
  });
  if (!res.ok) {
    showToast(res.error ?? t("errors.copyByRangeFailed", "No se pudo copiar por rango"), false);
    return;
  }

  const copied = Number((res.data as any)?.copied ?? 0);
  showToast(fmt(t("toasts.emailsCopied", "Copiados {count} correos de {folder}"), { count: copied, folder: decodedFolder }));
};

function setCloneError(msg: string | null) {
  const el = document.getElementById("clone-error");
  if (!el) return;
  if (msg) { el.textContent = msg; el.classList.remove("hidden"); }
  else { el.textContent = ""; el.classList.add("hidden"); }
}

function setCloneMode(mode: "existing" | "new") {
  document.getElementById("clone-existing-block")?.classList.toggle("hidden", mode !== "existing");
  document.getElementById("clone-new-block")?.classList.toggle("hidden", mode !== "new");
}

async function fillCloneDestinationAccounts(excludeAccountId: number) {
  const select = document.getElementById("clone-dest-account") as HTMLSelectElement | null;
  if (!select) return;
  select.innerHTML = "";
  const candidates = (await loadAccountCatalog()).filter((a) => a.id !== excludeAccountId);
  if (!candidates.length) {
    select.innerHTML = `<option value=''>${t("empty.noOtherAccount", "No hay otra cuenta disponible")}</option>`;
    select.disabled = true;
    return;
  }
  select.disabled = false;
  for (const account of candidates) {
    const option = document.createElement("option");
    option.value = String(account.id);
    option.textContent = account.address;
    select.append(option);
  }
}

function fillCloneDomains() {
  const select = document.getElementById("clone-new-domain") as HTMLSelectElement | null;
  if (!select) return;
  select.innerHTML = S.domains.length ? "" : `<option value=''>${t("empty.noDomains", "Sin dominios")}</option>`;
  for (const domain of S.domains) {
    const option = document.createElement("option");
    option.value = domain;
    option.textContent = domain;
    select.append(option);
  }
}

(window as any).openCloneDialog = async (id: number, addr: string) => {
  S.cloneSourceId = id;
  document.getElementById("clone-source-label")!.textContent = fmt(t("labels.originColon", "Origen: {addr}"), { addr });
  setCloneError(null);
  document.getElementById("clone-result")?.classList.add("hidden");
  const existingRadio = document.querySelector<HTMLInputElement>('input[name="clone-mode"][value="existing"]');
  if (existingRadio) existingRadio.checked = true;
  setCloneMode("existing");
  await fillCloneDestinationAccounts(id);
  if (!S.domains.length) await loadDomains();
  fillCloneDomains();
  (document.getElementById("clone-new-local") as HTMLInputElement).value = "";
  (document.getElementById("clone-new-password") as HTMLInputElement).value = "";
  openDialog("dialog-clone");
};

async function submitClone() {
  if (S.cloneSubmitting || !S.cloneSourceId) return;
  setCloneError(null);
  const mode = (document.querySelector('input[name="clone-mode"]:checked') as HTMLInputElement | null)?.value ?? "existing";
  const submitBtn = document.getElementById("clone-submit") as HTMLButtonElement | null;
  const resultEl = document.getElementById("clone-result");

  S.cloneSubmitting = true;
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t("labels.cloning", "Clonando…"); }
  try {
    let destId = 0;

    if (mode === "new") {
      const localPart = (document.getElementById("clone-new-local") as HTMLInputElement).value.trim();
      const domain = (document.getElementById("clone-new-domain") as HTMLSelectElement).value;
      const password = (document.getElementById("clone-new-password") as HTMLInputElement).value;
      if (!localPart || !domain) { setCloneError(t("errors.cloneLocalAndDomainRequired", "Indica parte local y dominio.")); return; }
      if (password.length < 6) { setCloneError(t("errors.clonePasswordTooShort", "La contraseña debe tener al menos 6 caracteres.")); return; }

      const createRes = await api.post<{ id?: number; address?: string }>(
        "/api/accounts",
        { localPart, domain, password, quotaMb: 0 },
      );
      if (!createRes.ok) { setCloneError(createRes.error ?? t("errors.cloneCreateFailed", "No se pudo crear la cuenta nueva.")); return; }
      // The create endpoint returns the new account's id directly
      // (fnv1aId(address)). Use it instead of reloading + searching the list:
      // the accounts list is cache-first (Redis) and the just-created row may
      // not be in the cache yet (the targeted refresh is async), which is what
      // made the lookup fail with "no se pudo resolver su ID".
      destId = Number(createRes.data?.id ?? 0);
      if (!destId) { setCloneError(t("errors.cloneIdResolveFailed", "Cuenta creada, pero no se pudo resolver su ID. Reintenta como 'existente'.")); return; }
      await awaitMailJob(createRes);
      void loadAccounts();
    } else {
      destId = Number((document.getElementById("clone-dest-account") as HTMLSelectElement).value || "0");
      if (!destId) { setCloneError(t("errors.selectDestAccount", "Selecciona una cuenta destino.")); return; }
    }

    const res = await api.post<any>(`/api/mail/${S.cloneSourceId}/clone`, { destinationAccountId: destId });
    if (!res.ok) {
      resultEl?.classList.add("hidden");
      setCloneError(res.error ?? t("errors.cloneFailed", "No se pudo clonar el correo."));
      return;
    }
    // Heavy clones run in the background to avoid the 524 timeout; the server
    // reports start/done/fail via notifications (the bell). Inform and close.
    if (resultEl) {
      resultEl.classList.remove("hidden");
      resultEl.textContent = t("labels.cloneStartedBg", "Clonación iniciada en segundo plano. Te avisaremos por notificaciones cuando termine.");
    }
    showToast(t("toasts.cloneStarted", "Clonación iniciada — te notificaremos al terminar"));
    setTimeout(() => (document.getElementById("dialog-clone") as HTMLDialogElement | null)?.close(), 1500);
  } finally {
    S.cloneSubmitting = false;
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t("actions.clone", "Clonar"); }
  }
}

document.querySelectorAll<HTMLInputElement>('input[name="clone-mode"]').forEach((radio) => {
  radio.addEventListener("change", () => setCloneMode(radio.value === "new" ? "new" : "existing"));
});

document.getElementById("clone-submit")?.addEventListener("click", () => void submitClone());

document.getElementById("clone-cancel")?.addEventListener("click", () =>
  (document.getElementById("dialog-clone") as HTMLDialogElement | null)?.close(),
);

document.getElementById("clone-dialog-close")?.addEventListener("click", () =>
  (document.getElementById("dialog-clone") as HTMLDialogElement | null)?.close(),
);

document.getElementById("dialog-clone")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) (e.currentTarget as HTMLDialogElement).close();
});

const closeDiskUsageDialog = () => (document.getElementById("dialog-disk-usage") as HTMLDialogElement).close();

document.getElementById("disk-dialog-close")?.addEventListener("click", closeDiskUsageDialog);

document.getElementById("disk-refresh")?.addEventListener("click", async () => {
  if (!S.diskUsageAccountId) return;
  await loadDiskUsage(S.diskUsageAccountId);
});

(document.getElementById("dialog-disk-usage") as HTMLDialogElement | null)?.addEventListener("close", () => {
  S.diskUsageAccountId = null;
});
