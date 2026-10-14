// Users page — SSH keys dialog. Importing this module registers
// window.openSshKeysDialog and window.deleteSshKey.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { capabilities } from "./state";
import { t, fmt, showToast, escapeHtml } from "./dom";
import { openDialog } from "/scripts/extracted/lib/dom.js";

// SSH-keys dialog target (the user whose authorized_keys we're managing).
let sshKeysUserId: number | null = null;
let sshKeysUsername = "";

function renderSshKeys(keys: any[]) {
  const list = document.getElementById("ssh-keys-list");
  if (!list) return;
  if (!Array.isArray(keys) || keys.length === 0) {
    list.innerHTML = `<li class="px-4 py-3 text-xs text-muted-foreground">${t("empty.noSshKeys", "No hay llaves registradas.")}</li>`;
    return;
  }
  list.innerHTML = keys
    .map((k: any) => {
      const comment = k.comment ? escapeHtml(k.comment) : t("labels.noComment", "(sin comentario)");
      const type = escapeHtml(k.type ?? "");
      const preview = escapeHtml(k.preview ?? "");
      const canDelete = capabilities.usersEdit
        ? `<button type="button" data-ssh-del="${escapeHtml(k.id)}" class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive" aria-label="${t("labels.deleteKey", "Eliminar llave")}"><i class="ti ti-trash"></i></button>`
        : "";
      return `
        <li class="flex items-center justify-between gap-3 px-4 py-2.5">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">${comment}</p>
            <p class="truncate font-mono text-xs text-muted-foreground">${type} …${preview}</p>
          </div>
          ${canDelete}
        </li>`;
    })
    .join("");
}

async function loadSshKeys() {
  const list = document.getElementById("ssh-keys-list");
  if (list) list.innerHTML = `<li class="px-4 py-3 text-xs text-muted-foreground">${t("labels.loading", "Cargando…")}</li>`;
  const res = await api.get<any>(`/api/users/${sshKeysUserId}/ssh-keys?username=${encodeURIComponent(sshKeysUsername)}`);
  if (res.ok) {
    renderSshKeys((res.data as any)?.items ?? res.data ?? []);
  } else if (list) {
    list.innerHTML = `<li class="px-4 py-3 text-xs text-destructive">${escapeHtml(res.error ?? t("errors.loadKeysFailed", "Error al cargar las llaves"))}</li>`;
  }
}

(window as any).openSshKeysDialog = (u: any) => {
  if (!capabilities.usersView) return;
  sshKeysUserId = u.id;
  sshKeysUsername = u.username;
  document.getElementById("ssh-keys-title")!.textContent = fmt(t("titles.sshKeys", "Llaves SSH · {username}"), { username: u.username });
  const input = document.getElementById("ssh-key-input") as HTMLTextAreaElement | null;
  if (input) input.value = "";
  const addForm = document.getElementById("form-ssh-key");
  if (addForm) addForm.classList.toggle("hidden", !capabilities.usersEdit);
  document.getElementById("ssh-keys-error")?.classList.add("hidden");
  openDialog("dialog-ssh-keys");
  void loadSshKeys();
};

(window as any).deleteSshKey = async (keyId: string) => {
  if (!capabilities.usersEdit) return;
  if (!await openConfirm(t("confirm.deleteSshKey", "¿Eliminar esta llave SSH?"), { title: t("titles.deleteSshKey", "Eliminar llave"), variant: "danger" })) return;
  const res = await api.delete(`/api/users/${sshKeysUserId}/ssh-keys`, { keyId, username: sshKeysUsername });
  if (res.ok) {
    showToast(t("toasts.keyDeleted", "Llave eliminada"));
    void loadSshKeys();
  } else {
    showToast(res.error ?? t("toasts.errorDeletingKey", "Error al eliminar la llave"), false);
  }
};

export function bindSshKeysDialog() {
  const close = () => (document.getElementById("dialog-ssh-keys") as HTMLDialogElement).close();
  document.getElementById("ssh-keys-close")?.addEventListener("click", close);

  document.getElementById("ssh-keys-list")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-ssh-del]");
    if (btn?.dataset.sshDel) void (window as any).deleteSshKey(btn.dataset.sshDel);
  });

  document.getElementById("form-ssh-key")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!capabilities.usersEdit) return;
    const errEl = document.getElementById("ssh-keys-error")!;
    errEl.classList.add("hidden");
    const input = document.getElementById("ssh-key-input") as HTMLTextAreaElement;
    const publicKey = input.value.trim();
    if (!publicKey) return;
    const res = await api.post(`/api/users/${sshKeysUserId}/ssh-keys`, { publicKey, username: sshKeysUsername });
    if (res.ok) {
      input.value = "";
      showToast(t("toasts.keyAdded", "Llave añadida"));
      void loadSshKeys();
    } else {
      errEl.textContent = res.error ?? t("errors.addKeyFailed", "Error al añadir la llave");
      errEl.classList.remove("hidden");
    }
  });
}
