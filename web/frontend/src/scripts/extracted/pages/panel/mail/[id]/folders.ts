// Mailbox inbox viewer — account header + IMAP folder sidebar (load folders,
// build/render the collapsible tree, folder selection). Owns the sidebar
// collapse state and the folder-icon map.
import { api } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { accountId, fallback, type FolderTreeNode, type MailFolder, S } from "./state";
import { buildFolderTree, escapeHtml } from "./helpers";
import {
  isMailboxCredentialError,
  isMailboxImapUnavailable,
  rememberCredentialFailure,
  renderMailboxCredentialBlockedState,
} from "./status-render";
import { loadMessages } from "./messages";

const collapsedSidebarFolders = new Set<string>();

// ── Load account info ──────────────────────────────────────
export async function loadAccountInfo() {
  const res = await api.get<any>(`/api/accounts`);
  if (res.ok) {
    const payload = res.data as any;
    const list = (Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : []) as any[];
    const acc = list.find((a: any) => String(a.id) === String(accountId));
    if (acc) document.getElementById("account-email")!.textContent = acc.address;
  }
}

// ── Folders ────────────────────────────────────────────────
export async function loadFolders() {
  const res = await api.get<any>(`/api/mail/${accountId}/folders`);
  if (!res.ok || !Array.isArray(res.data)) {
    if (isMailboxCredentialError(res)) {
      rememberCredentialFailure(res);
      S.mailboxCredentialBroken = true;
      renderMailboxCredentialBlockedState();
      return;
    }

    if (isMailboxImapUnavailable(res)) {
      const list = document.getElementById("folders-list");
      if (list) {
        list.innerHTML = `<div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">${fallback("inbox.imapUnavailable", "No se pudo conectar al servidor IMAP para cargar carpetas.")}</div>`;
      }
      return;
    }

    const list = document.getElementById("folders-list");
    if (list) {
      list.innerHTML = `<div class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">${fallback("inbox.error.loadFolders", "Error al cargar carpetas")}</div>`;
    }
    return;
  }

  S.mailboxCredentialBroken = false;
  S.folders = res.data as MailFolder[];
  if (!S.folders.some((folder) => folder.path === S.currentFolder)) {
    S.currentFolder = S.folders[0]?.path || "INBOX";
    document.getElementById("folder-name")!.textContent = S.folders[0]?.name || fallback("inbox.defaultFolder", "INBOX");
  }
  renderFolders();
}

const FOLDER_ICONS: Record<string, string> = {
  INBOX: "ti-inbox",
  Sent: "ti-send",
  Drafts: "ti-pencil",
  Trash: "ti-trash",
  Junk: "ti-alert-circle",
  Spam: "ti-alert-circle",
  Archive: "ti-archive",
};

function renderSidebarFolderNodes(nodes: FolderTreeNode[], depth = 0): string {
  return nodes.map((node) => {
    const hasChildren = node.children.length > 0;
    const collapsed = hasChildren && collapsedSidebarFolders.has(node.path);
    const folder = node.folder;
    const active = folder ? node.path === S.currentFolder : false;
    const unseen = Number(folder?.unseen || 0);
    const displayName = escapeHtml(folder?.name || node.label);
    const icon = FOLDER_ICONS[folder?.name || node.label] ?? "ti-folder";
    const paddingLeft = 6 + depth * 12;

    return `
      <div class="space-y-0.5">
        <div class="flex items-center gap-1" style="padding-left:${paddingLeft}px;">
          ${hasChildren
            ? `<button type="button" onclick="toggleFolderCollapse('${encodeURIComponent(node.path)}')" class="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="${fallback("inbox.toggleSubfolders", "Mostrar u ocultar subcarpetas")}" aria-expanded="${collapsed ? "false" : "true"}">
                <i class="ti ti-chevron-right text-[10px] transition-transform ${collapsed ? "" : "rotate-90"}"></i>
              </button>`
            : `<span class="inline-block h-6 w-6"></span>`}
          ${folder
            ? `<button onclick="selectFolder('${encodeURIComponent(node.path)}')" class="folder-btn flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-left transition-all ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}">
                <i class="ti ${icon} text-sm shrink-0"></i>
                <span class="flex-1 truncate">${displayName}</span>
                ${unseen > 0 ? `<span class="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">${unseen}</span>` : ""}
              </button>`
            : `<div class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground/90">
                <i class="ti ${icon} text-sm shrink-0"></i>
                <span class="flex-1 truncate">${displayName}</span>
              </div>`}
        </div>
        ${hasChildren
          ? `<div class="${collapsed ? "hidden" : "space-y-0.5"}">${renderSidebarFolderNodes(node.children, depth + 1)}</div>`
          : ""}
      </div>
    `;
  }).join("");
}

function renderFolders() {
  const list = document.getElementById("folders-list") as HTMLElement | null;
  if (!list) return;
  if (S.folders.length === 0) {
    list.innerHTML = `<div class="rounded-lg border border-border p-3 text-xs text-muted-foreground">${fallback("inbox.noFolders", "Sin carpetas disponibles.")}</div>`;
    return;
  }

  const { roots, map } = buildFolderTree(S.folders);
  let ancestorPath = map.get(S.currentFolder)?.parentPath ?? null;
  while (ancestorPath) {
    collapsedSidebarFolders.delete(ancestorPath);
    ancestorPath = map.get(ancestorPath)?.parentPath ?? null;
  }

  list.innerHTML = renderSidebarFolderNodes(roots);
}

(window as any).toggleFolderCollapse = (encodedPath: string) => {
  const path = decodeURIComponent(encodedPath);
  if (collapsedSidebarFolders.has(path)) {
    collapsedSidebarFolders.delete(path);
  } else {
    collapsedSidebarFolders.add(path);
  }
  renderFolders();
};

(window as any).selectFolder = function(encodedPath: string) {
  const path = decodeURIComponent(encodedPath);
  const folder = S.folders.find((item) => item.path === path);
  S.currentFolder = path;
  S.currentPage = 1;
  S.currentUid = null;
  document.getElementById("folder-name")!.textContent = folder?.name || path;
  document.getElementById("viewer-empty")!.classList.remove("hidden");
  document.getElementById("viewer-content")!.classList.add("hidden");
  renderFolders();
  loadMessages({ loadingText: fallback("inbox.loadingFolder", "Cargando mensajes de {folder}...").replace("{folder}", () => folder?.name || path) });
};
