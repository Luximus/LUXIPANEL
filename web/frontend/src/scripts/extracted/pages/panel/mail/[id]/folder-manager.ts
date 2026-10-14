// Mailbox inbox viewer — folder manager dialog (create / rename / delete IMAP
// folders, parent-folder select population, collapsible manager tree). Owns the
// manager-tree collapse state.
import { api } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { accountId, fallback, type FolderTreeNode, type MailFolder, S } from "./state";
import { buildFolderTree, escapeHtml, flattenFolderTree, isDescendantPath, isProtectedFolder } from "./helpers";
import { loadFolders } from "./folders";
import { loadMessages } from "./messages";
import { openDialog } from "/scripts/extracted/lib/dom.js";

const collapsedManagerFolders = new Set<string>();

function renderFolderParentOptions(selectedValue = "", editPath = "") {
  const parentSelect = document.getElementById("folders-manager-parent") as HTMLSelectElement | null;
  if (!parentSelect) return;

  const { roots } = buildFolderTree(S.folders);
  const flat = flattenFolderTree(roots);
  const options = [`<option value="">${fallback("inbox.selectFolderParentDefault", "Nivel principal")}</option>`];

  for (const { node, depth } of flat) {
    if (!node.folder) continue;
    if (editPath && (node.path === editPath || isDescendantPath(node.path, editPath))) continue;
    const label = `${"  ".repeat(depth)}${escapeHtml(node.folder.name || node.label)} (${escapeHtml(node.path)})`;
    options.push(`<option value="${escapeHtml(node.path)}" ${selectedValue === node.path ? "selected" : ""}>${label}</option>`);
  }

  parentSelect.innerHTML = options.join("");
}

function setFolderManagerParentMode(isEditing: boolean) {
  const parentSelect = document.getElementById("folders-manager-parent") as HTMLSelectElement | null;
  const parentHelp = document.getElementById("folders-manager-parent-help") as HTMLElement | null;
  if (parentSelect) parentSelect.disabled = isEditing;
  if (parentHelp) {
    parentHelp.textContent = isEditing
      ? fallback("inbox.folderParentHelpEdit", "Para renombrar una carpeta no se modifica su carpeta padre.")
      : fallback("inbox.folderParentHelp", "Selecciona la carpeta padre para anidar la nueva carpeta.");
  }
}

function setFoldersManagerError(message: string | null) {
  const errorEl = document.getElementById("folders-manager-error") as HTMLElement | null;
  if (!errorEl) return;
  if (!message) {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    return;
  }
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function setFoldersManagerFeedback(message: string | null, isSuccess = true) {
  const feedbackEl = document.getElementById("folders-manager-feedback") as HTMLElement | null;
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

function resetFolderManagerForm() {
  (document.getElementById("folders-manager-edit-path") as HTMLInputElement).value = "";
  (document.getElementById("folders-manager-name") as HTMLInputElement).value = "";
  renderFolderParentOptions();
  setFolderManagerParentMode(false);
  setFoldersManagerError(null);
}

function fillFolderManagerForm(folder: MailFolder) {
  (document.getElementById("folders-manager-edit-path") as HTMLInputElement).value = folder.path;
  (document.getElementById("folders-manager-name") as HTMLInputElement).value = folder.name;
  renderFolderParentOptions("", folder.path);
  setFolderManagerParentMode(true);
  setFoldersManagerError(null);
}

function renderManagerFolderNodes(nodes: FolderTreeNode[], depth = 0): string {
  return nodes.map((node) => {
    const hasChildren = node.children.length > 0;
    const collapsed = hasChildren && collapsedManagerFolders.has(node.path);
    const folder = node.folder;
    const protectedFolder = folder ? isProtectedFolder(folder) : false;
    const paddingLeft = depth * 14;
    const label = escapeHtml(folder?.name || node.label);
    const path = escapeHtml(node.path);

    return `
      <div class="space-y-1">
        <div class="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5" style="margin-left:${paddingLeft}px;">
          ${hasChildren
            ? `<button type="button" onclick="toggleManagerFolderCollapse('${encodeURIComponent(node.path)}')" class="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="${fallback("inbox.toggleSubfolders", "Mostrar u ocultar subcarpetas")}" aria-expanded="${collapsed ? "false" : "true"}">
                <i class="ti ti-chevron-right text-[10px] transition-transform ${collapsed ? "" : "rotate-90"}"></i>
              </button>`
            : `<span class="inline-block h-6 w-6"></span>`}
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium">${label}</div>
            <div class="truncate text-[11px] text-muted-foreground">${path}</div>
          </div>
          ${folder
            ? (protectedFolder
              ? `<span class="inline-flex rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">${fallback("inbox.folderProtectedBadge", "Protegida")}</span>`
              : `<div class="inline-flex items-center gap-1">
                  <button type="button" onclick="editMailboxFolder('${encodeURIComponent(node.path)}')" class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="${fallback("inbox.titleRenameFolder", "Renombrar carpeta")}">
                    <i class="ti ti-edit text-sm"></i>
                  </button>
                  <button type="button" onclick="deleteMailboxFolder('${encodeURIComponent(node.path)}')" class="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="${fallback("inbox.titleDeleteFolder", "Eliminar carpeta")}">
                    <i class="ti ti-trash text-sm"></i>
                  </button>
                </div>`)
            : `<span class="text-[10px] text-muted-foreground">${fallback("inbox.folderGroupBadge", "Grupo")}</span>`}
        </div>
        ${hasChildren
          ? `<div class="${collapsed ? "hidden" : "space-y-1"}">${renderManagerFolderNodes(node.children, depth + 1)}</div>`
          : ""}
      </div>
    `;
  }).join("");
}

function renderFolderManagerList() {
  const container = document.getElementById("folders-manager-list-body") as HTMLElement | null;
  if (!container) return;

  if (S.folders.length === 0) {
    container.innerHTML = `<div class="rounded-lg border border-border p-3 text-center text-xs text-muted-foreground">${fallback("inbox.noFolders", "Sin carpetas disponibles")}</div>`;
    return;
  }

  const { roots } = buildFolderTree(S.folders);
  container.innerHTML = renderManagerFolderNodes(roots);
}

async function openFoldersManagerDialog() {
  const accountEmail = (document.getElementById("account-email")?.textContent || "").trim();
  const label = accountEmail || `${fallback("inbox.accountLabelShort", "Cuenta")} #${accountId}`;
  const labelEl = document.getElementById("folders-manager-account-email");
  if (labelEl) labelEl.textContent = label;

  collapsedManagerFolders.clear();
  setFoldersManagerFeedback(null);
  resetFolderManagerForm();
  renderFolderManagerList();
  openDialog("dlg-folders-manager");
}

const closeFoldersManagerDialog = () => {
  (document.getElementById("dlg-folders-manager") as HTMLDialogElement | null)?.close();
};

(window as any).toggleManagerFolderCollapse = (encodedPath: string) => {
  const path = decodeURIComponent(encodedPath);
  if (collapsedManagerFolders.has(path)) {
    collapsedManagerFolders.delete(path);
  } else {
    collapsedManagerFolders.add(path);
  }
  renderFolderManagerList();
};

(window as any).editMailboxFolder = (encodedPath: string) => {
  const path = decodeURIComponent(encodedPath);
  const folder = S.folders.find((item) => item.path === path);
  if (!folder) {
    setFoldersManagerFeedback(fallback("inbox.error.folderNotFound", "No se encontró la carpeta seleccionada."), false);
    return;
  }

  if (isProtectedFolder(folder)) {
    setFoldersManagerFeedback(fallback("inbox.error.folderProtected", "Esta carpeta está protegida y no se puede renombrar."), false);
    return;
  }

  fillFolderManagerForm(folder);
  setFoldersManagerFeedback(fallback("inbox.folderRenaming", "Renombrando {path}").replace("{path}", () => folder.path));
};

(window as any).deleteMailboxFolder = async (encodedPath: string) => {
  const path = decodeURIComponent(encodedPath);
  const folder = S.folders.find((item) => item.path === path);
  if (!folder) {
    setFoldersManagerFeedback(fallback("inbox.error.folderNotFound", "No se encontró la carpeta seleccionada."), false);
    return;
  }
  if (isProtectedFolder(folder)) {
    setFoldersManagerFeedback(fallback("inbox.error.folderProtected", "Esta carpeta está protegida y no se puede eliminar."), false);
    return;
  }

  const confirmed = await openConfirm(fallback("inbox.confirm.deleteFolder", "¿Eliminar carpeta \"{folder}\"?").replace("{folder}", () => folder.path), {
    title: fallback("inbox.confirm.deleteFolderTitle", "Eliminar carpeta"),
    variant: "danger",
  });
  if (!confirmed) return;

  const res = await api.delete(`/api/mail/${accountId}/folders`, {
    params: { path: folder.path },
  });
  if (!res.ok) {
    setFoldersManagerFeedback(res.error ?? fallback("inbox.error.deleteFolder", "No se pudo eliminar la carpeta."), false);
    return;
  }

  setFoldersManagerFeedback(fallback("inbox.success.folderDeleted", "Carpeta eliminada correctamente."));
  if (S.currentFolder === folder.path) {
    S.currentUid = null;
  }
  await loadFolders();
  renderFolderManagerList();
  await loadMessages();
};

// ── Folder manager events ──────────────────────────────────
document.getElementById("btn-open-folders-manager")?.addEventListener("click", () => {
  openFoldersManagerDialog();
});

document.getElementById("folders-manager-close")?.addEventListener("click", closeFoldersManagerDialog);

document.getElementById("folders-manager-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const editPath = (document.getElementById("folders-manager-edit-path") as HTMLInputElement).value.trim();
  const name = (document.getElementById("folders-manager-name") as HTMLInputElement).value.trim();
  const parentPath = (document.getElementById("folders-manager-parent") as HTMLSelectElement).value.trim();

  if (!name) {
    setFoldersManagerError(fallback("inbox.validation.folderName", "Debes indicar el nombre de la carpeta."));
    return;
  }

  setFoldersManagerError(null);

  const res = editPath
    ? await api.put(`/api/mail/${accountId}/folders`, { path: editPath, name })
    : await api.post(`/api/mail/${accountId}/folders`, { name, parentPath: parentPath || undefined });

  if (!res.ok) {
    setFoldersManagerFeedback(res.error ?? fallback("inbox.error.saveFolder", "No se pudo guardar la carpeta."), false);
    return;
  }

  setFoldersManagerFeedback(editPath ? fallback("inbox.success.folderRenamed", "Carpeta renombrada correctamente.") : fallback("inbox.success.folderCreated", "Carpeta creada correctamente."));
  resetFolderManagerForm();
  await loadFolders();
  renderFolderManagerList();
  await loadMessages();
});

(document.getElementById("dlg-folders-manager") as HTMLDialogElement | null)?.addEventListener("close", () => {
  resetFolderManagerForm();
  setFoldersManagerFeedback(null);
});
