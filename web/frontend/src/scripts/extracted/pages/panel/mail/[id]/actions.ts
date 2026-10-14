// Mailbox inbox viewer — viewer toolbar actions (delete / reply / forward / move
// / refresh / mark-all-read), the move-to-folder dialog, pagination controls and
// the filters + search bar. Owns the debounce timer for search/filter refresh.
import { api } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { accountId, fallback, PAGE_SIZE, S } from "./state";
import { escapeHtml } from "./helpers";
import { loadFolders } from "./folders";
import { loadMessages } from "./messages";
import { openDialog } from "/scripts/extracted/lib/dom.js";

// ── Actions ────────────────────────────────────────────────
document.getElementById("btn-delete-msg")?.addEventListener("click", async () => {
  const uid = (window as any)._currentUid;
  if (!uid || !await openConfirm(fallback("inbox.confirm.deleteMessage", "¿Eliminar este mensaje?"), { title: fallback("inbox.confirm.deleteMessageTitle", "Eliminar mensaje"), variant: "danger" })) return;
  const res = await api.delete<any>(`/api/mail/${accountId}/messages/${uid}`, { params: { folder: S.currentFolder } });
  if (res.ok) {
    S.currentUid = null;
    document.getElementById("viewer-empty")!.classList.remove("hidden");
    document.getElementById("viewer-content")!.classList.add("hidden");
    loadMessages();
  }
});

document.getElementById("btn-reply")?.addEventListener("click", () => {
  const uid = (window as any)._currentUid;
  if (!uid) return;
  window.location.href = `/panel/mail/compose?from=${accountId}&replyTo=${uid}&folder=${S.currentFolder}`;
});

document.getElementById("btn-edit-draft")?.addEventListener("click", () => {
  const uid = (window as any)._currentUid;
  if (!uid) return;
  window.location.href = `/panel/mail/compose?from=${encodeURIComponent(accountId)}&draftUid=${uid}&folder=${encodeURIComponent(S.currentFolder)}`;
});

document.getElementById("btn-forward")?.addEventListener("click", () => {
  const uid = (window as any)._currentUid;
  if (!uid) return;
  window.location.href = `/panel/mail/compose?from=${accountId}&forward=${uid}&folder=${S.currentFolder}`;
});

document.getElementById("btn-move")?.addEventListener("click", () => {
  const moveList = document.getElementById("move-folders-list")!;
  moveList.innerHTML = S.folders
    .filter((f) => f.path !== S.currentFolder)
    .map((f) => {
      const fname = escapeHtml(String(f.name ?? ""));
      return `
      <button onclick="moveToFolder('${encodeURIComponent(f.path)}')"
        class="w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors">
        <i class="ti ti-folder text-muted-foreground text-sm"></i>${fname}
      </button>`;
    })
    .join("");
  openDialog("dlg-move");
});

(window as any).moveToFolder = async function(encodedTargetFolder: string) {
  const targetFolder = decodeURIComponent(encodedTargetFolder);
  (document.getElementById("dlg-move") as HTMLDialogElement).close();
  const uid = (window as any)._currentUid;
  if (!uid) return;
  const res = await api.post<any>(`/api/mail/${accountId}/messages/${uid}/move`, {
    folder: S.currentFolder,
    destFolder: targetFolder,
  });
  if (res.ok) {
    S.currentUid = null;
    document.getElementById("viewer-empty")!.classList.remove("hidden");
    document.getElementById("viewer-content")!.classList.add("hidden");
    loadMessages();
    loadFolders();
  }
};

document.getElementById("btn-refresh")?.addEventListener("click", () => {
  loadFolders();
  loadMessages();
});

document.getElementById("btn-mark-all-read")?.addEventListener("click", async () => {
  if (!await openConfirm(fallback("inbox.confirm.markAllRead", "¿Marcar todos como leídos en \"{folder}\"?").replace("{folder}", () => S.currentFolder), { title: fallback("inbox.confirm.markAllReadTitle", "Marcar como leídos"), confirmText: fallback("inbox.confirm.markAllReadBtn", "Sí, marcar todos") })) return;
  await api.post<any>(`/api/mail/${accountId}/messages/mark-all-read`, { folder: S.currentFolder });
  loadMessages();
});

// ── Pagination ─────────────────────────────────────────────
document.getElementById("btn-prev-page")?.addEventListener("click", () => {
  if (S.currentPage > 1) {
    S.currentPage--;
    loadMessages();
  }
});
document.getElementById("btn-next-page")?.addEventListener("click", () => {
  if (S.currentPage * PAGE_SIZE < S.totalMessages) {
    S.currentPage++;
    loadMessages();
  }
});

// ── Filters & Search ───────────────────────────────────────
let searchTimeout: ReturnType<typeof setTimeout>;
function queueMessageRefresh() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    S.currentPage = 1;
    loadMessages();
  }, 400);
}

document.getElementById("msg-search")?.addEventListener("input", () => {
  queueMessageRefresh();
});
document.getElementById("msg-filter-email")?.addEventListener("input", queueMessageRefresh);
document.getElementById("msg-filter-date-from")?.addEventListener("change", queueMessageRefresh);
document.getElementById("msg-filter-date-to")?.addEventListener("change", queueMessageRefresh);
document.getElementById("msg-sort-order")?.addEventListener("change", queueMessageRefresh);

document.getElementById("btn-clear-filters")?.addEventListener("click", () => {
  const emailInput = document.getElementById("msg-filter-email") as HTMLInputElement | null;
  const dateFromInput = document.getElementById("msg-filter-date-from") as HTMLInputElement | null;
  const dateToInput = document.getElementById("msg-filter-date-to") as HTMLInputElement | null;
  const sortSelect = document.getElementById("msg-sort-order") as HTMLSelectElement | null;
  const searchInput = document.getElementById("msg-search") as HTMLInputElement | null;

  if (emailInput) emailInput.value = "";
  if (dateFromInput) dateFromInput.value = "";
  if (dateToInput) dateToInput.value = "";
  if (sortSelect) sortSelect.value = "desc";
  if (searchInput) searchInput.value = "";

  S.currentPage = 1;
  loadMessages();
});
