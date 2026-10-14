import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
const pathParts = window.location.pathname.split("/").filter(Boolean);
const accountId = decodeURIComponent(pathParts[pathParts.length - 2] ?? "");
let currentFolder = "INBOX";
let currentUid = null;
let currentPage = 1;
const PAGE_SIZE = 25;
let totalMessages = 0;
let folders = [];
let searchTimeout;
let loadedContacts = [];
let mailboxCredentialBroken = false;
let isMailCredentialSaving = false;
const collapsedSidebarFolders = /* @__PURE__ */ new Set();
const collapsedManagerFolders = /* @__PURE__ */ new Set();
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROTECTED_FOLDER_NAMES = /* @__PURE__ */ new Set(["inbox", "sent", "trash"]);
function normalizeFolderValue(value) {
  return (value || "").trim().toLowerCase();
}
function isProtectedFolder(folder) {
  const name = normalizeFolderValue(folder.name);
  const path = normalizeFolderValue(folder.path);
  const specialUse = normalizeFolderValue(folder.specialUse);
  return PROTECTED_FOLDER_NAMES.has(name) || PROTECTED_FOLDER_NAMES.has(path) || specialUse === "\\inbox" || specialUse === "\\sent" || specialUse === "\\trash";
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}
function renderMessagesLoading(text = "Cargando mensajes...") {
  const list = document.getElementById("messages-list");
  if (!list) return;
  list.innerHTML = `
    <div class="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 p-6 text-center">
      <div class="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-primary">
        <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
          <path class="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"></path>
        </svg>
        <span class="text-xs font-medium">${escapeHtml(text)}</span>
      </div>
    </div>
  `;
}
function isMailboxCredentialError(res) {
  if (res.ok || res.status !== 409) return false;
  const errorText = (res.error || "").toLowerCase();
  return errorText.includes("mail credential") || errorText.includes("mailbox password") || errorText.includes("not recoverable") || errorText.includes("could not be decrypted");
}
function isMailboxImapUnavailable(res) {
  if (res.ok) return false;
  if (res.status !== 500 && res.status !== 502 && res.status !== 503) return false;
  const errorText = (res.error || "").toLowerCase();
  return errorText.includes("imap") || errorText.includes("econnrefused") || errorText.includes("mail_imap_unreachable");
}
function renderMailboxCredentialBlockedState() {
  const foldersList = document.getElementById("folders-list");
  if (foldersList) {
    foldersList.innerHTML = `
      <div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
        Esta cuenta necesita restablecer contrase\xF1a para cargar carpetas.
      </div>
    `;
  }
  const messagesList = document.getElementById("messages-list");
  if (messagesList) {
    messagesList.innerHTML = `
      <div class="p-4">
        <div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center">
          <p class="text-sm font-medium text-amber-200">No se pueden cargar mensajes</p>
          <p class="mt-1 text-xs text-amber-100/90">La contrase\xF1a almacenada para este buz\xF3n no se puede recuperar.</p>
          <button type="button" onclick="openMailboxCredentialDialog()" class="mt-3 inline-flex items-center gap-2 rounded-md border border-amber-300/30 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-200/10">
            <i class="ti ti-key text-sm"></i>
            Restablecer contrase\xF1a del buz\xF3n
          </button>
        </div>
      </div>
    `;
  }
  document.getElementById("msg-pagination")?.classList.add("hidden");
  document.getElementById("folder-count")?.classList.add("hidden");
}
async function loadAccountInfo() {
  const res = await api.get(`/api/accounts`);
  if (res.ok) {
    const payload = res.data;
    const list = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
    const acc = list.find((a) => String(a.id) === String(accountId));
    if (acc) document.getElementById("account-email").textContent = acc.address;
  }
}
async function loadFolders() {
  const res = await api.get(`/api/mail/${accountId}/folders`);
  if (!res.ok || !Array.isArray(res.data)) {
    if (isMailboxCredentialError(res)) {
      mailboxCredentialBroken = true;
      renderMailboxCredentialBlockedState();
      return;
    }
    if (isMailboxImapUnavailable(res)) {
      const list2 = document.getElementById("folders-list");
      if (list2) {
        list2.innerHTML = `<div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">No se pudo conectar al servidor IMAP para cargar carpetas.</div>`;
      }
      return;
    }
    const list = document.getElementById("folders-list");
    if (list) {
      list.innerHTML = `<div class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">Error al cargar carpetas</div>`;
    }
    return;
  }
  mailboxCredentialBroken = false;
  folders = res.data;
  if (!folders.some((folder) => folder.path === currentFolder)) {
    currentFolder = folders[0]?.path || "INBOX";
    document.getElementById("folder-name").textContent = folders[0]?.name || "INBOX";
  }
  renderFolders();
}
const FOLDER_ICONS = {
  INBOX: "ti-inbox",
  Sent: "ti-send",
  Drafts: "ti-pencil",
  Trash: "ti-trash",
  Junk: "ti-alert-circle",
  Spam: "ti-alert-circle",
  Archive: "ti-archive"
};
function inferFolderDelimiter(folderPath, fallback = "/") {
  if (folderPath.includes("/")) return "/";
  if (folderPath.includes(".")) return ".";
  return fallback;
}
function getLastPathSegment(path, delimiter) {
  const idx = path.lastIndexOf(delimiter);
  return idx >= 0 ? path.slice(idx + delimiter.length) : path;
}
function isDescendantPath(path, maybeAncestorPath) {
  return path === maybeAncestorPath || path.startsWith(`${maybeAncestorPath}/`) || path.startsWith(`${maybeAncestorPath}.`);
}
function buildFolderTree(list) {
  const map = /* @__PURE__ */ new Map();
  const roots = [];
  const ensureNode = (path, delimiter) => {
    const existing = map.get(path);
    if (existing) return existing;
    const safeDelimiter = delimiter || inferFolderDelimiter(path, "/");
    const idx = path.lastIndexOf(safeDelimiter);
    const parentPath = idx > 0 ? path.slice(0, idx) : null;
    const node = {
      path,
      label: getLastPathSegment(path, safeDelimiter),
      delimiter: safeDelimiter,
      folder: null,
      children: [],
      parentPath
    };
    map.set(path, node);
    if (parentPath) {
      const parent = ensureNode(parentPath, safeDelimiter);
      if (!parent.children.some((child) => child.path === node.path)) {
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
    return node;
  };
  for (const folder of list) {
    const delimiter = folder.delimiter || inferFolderDelimiter(folder.path, "/");
    const node = ensureNode(folder.path, delimiter);
    node.folder = folder;
    node.delimiter = delimiter;
    node.label = folder.name || node.label;
  }
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => {
      const aProtected = a.folder ? isProtectedFolder(a.folder) : false;
      const bProtected = b.folder ? isProtectedFolder(b.folder) : false;
      if (aProtected !== bProtected) return aProtected ? -1 : 1;
      return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
    });
    for (const node of nodes) {
      if (node.children.length > 0) sortNodes(node.children);
    }
  };
  sortNodes(roots);
  return { roots, map };
}
function flattenFolderTree(nodes, depth = 0, result = []) {
  for (const node of nodes) {
    result.push({ node, depth });
    if (node.children.length > 0) {
      flattenFolderTree(node.children, depth + 1, result);
    }
  }
  return result;
}
function renderFolderParentOptions(selectedValue = "", editPath = "") {
  const parentSelect = document.getElementById("folders-manager-parent");
  if (!parentSelect) return;
  const { roots } = buildFolderTree(folders);
  const flat = flattenFolderTree(roots);
  const options = [`<option value="">Nivel principal</option>`];
  for (const { node, depth } of flat) {
    if (!node.folder) continue;
    if (editPath && (node.path === editPath || isDescendantPath(node.path, editPath))) continue;
    const label = `${"\xA0\xA0".repeat(depth)}${escapeHtml(node.folder.name || node.label)} (${escapeHtml(node.path)})`;
    options.push(`<option value="${escapeHtml(node.path)}" ${selectedValue === node.path ? "selected" : ""}>${label}</option>`);
  }
  parentSelect.innerHTML = options.join("");
}
function setFolderManagerParentMode(isEditing) {
  const parentSelect = document.getElementById("folders-manager-parent");
  const parentHelp = document.getElementById("folders-manager-parent-help");
  if (parentSelect) parentSelect.disabled = isEditing;
  if (parentHelp) {
    parentHelp.textContent = isEditing ? "Para renombrar una carpeta no se modifica su carpeta padre." : "Selecciona la carpeta padre para anidar la nueva carpeta.";
  }
}
function renderSidebarFolderNodes(nodes, depth = 0) {
  return nodes.map((node) => {
    const hasChildren = node.children.length > 0;
    const collapsed = hasChildren && collapsedSidebarFolders.has(node.path);
    const folder = node.folder;
    const active = folder ? node.path === currentFolder : false;
    const unseen = Number(folder?.unseen || 0);
    const displayName = escapeHtml(folder?.name || node.label);
    const icon = FOLDER_ICONS[folder?.name || node.label] ?? "ti-folder";
    const paddingLeft = 6 + depth * 12;
    return `
      <div class="space-y-0.5">
        <div class="flex items-center gap-1" style="padding-left:${paddingLeft}px;">
          ${hasChildren ? `<button type="button" onclick="toggleFolderCollapse('${encodeURIComponent(node.path)}')" class="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Mostrar u ocultar subcarpetas" aria-expanded="${collapsed ? "false" : "true"}">
                <i class="ti ti-chevron-right text-[10px] transition-transform ${collapsed ? "" : "rotate-90"}"></i>
              </button>` : `<span class="inline-block h-6 w-6"></span>`}
          ${folder ? `<button onclick="selectFolder('${encodeURIComponent(node.path)}')" class="folder-btn flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-left transition-all ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}">
                <i class="ti ${icon} text-sm shrink-0"></i>
                <span class="flex-1 truncate">${displayName}</span>
                ${unseen > 0 ? `<span class="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">${unseen}</span>` : ""}
              </button>` : `<div class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground/90">
                <i class="ti ${icon} text-sm shrink-0"></i>
                <span class="flex-1 truncate">${displayName}</span>
              </div>`}
        </div>
        ${hasChildren ? `<div class="${collapsed ? "hidden" : "space-y-0.5"}">${renderSidebarFolderNodes(node.children, depth + 1)}</div>` : ""}
      </div>
    `;
  }).join("");
}
function renderFolders() {
  const list = document.getElementById("folders-list");
  if (!list) return;
  if (folders.length === 0) {
    list.innerHTML = `<div class="rounded-lg border border-border p-3 text-xs text-muted-foreground">Sin carpetas disponibles.</div>`;
    return;
  }
  const { roots, map } = buildFolderTree(folders);
  let ancestorPath = map.get(currentFolder)?.parentPath ?? null;
  while (ancestorPath) {
    collapsedSidebarFolders.delete(ancestorPath);
    ancestorPath = map.get(ancestorPath)?.parentPath ?? null;
  }
  list.innerHTML = renderSidebarFolderNodes(roots);
}
window.toggleFolderCollapse = (encodedPath) => {
  const path = decodeURIComponent(encodedPath);
  if (collapsedSidebarFolders.has(path)) {
    collapsedSidebarFolders.delete(path);
  } else {
    collapsedSidebarFolders.add(path);
  }
  renderFolders();
};
window.selectFolder = function(encodedPath) {
  const path = decodeURIComponent(encodedPath);
  const folder = folders.find((item) => item.path === path);
  currentFolder = path;
  currentPage = 1;
  currentUid = null;
  document.getElementById("folder-name").textContent = folder?.name || path;
  document.getElementById("viewer-empty").classList.remove("hidden");
  document.getElementById("viewer-content").classList.add("hidden");
  renderFolders();
  loadMessages({ loadingText: `Cargando mensajes de ${folder?.name || path}...` });
};
async function loadMessages(options = {}) {
  const autoOpenLatest = options.autoOpenLatest ?? true;
  const showLoading = options.showLoading ?? true;
  const loadingText = options.loadingText ?? "Cargando mensajes...";
  if (mailboxCredentialBroken) {
    renderMailboxCredentialBlockedState();
    return;
  }
  if (showLoading) {
    renderMessagesLoading(loadingText);
  }
  const search = document.getElementById("msg-search").value.trim();
  const email = document.getElementById("msg-filter-email")?.value.trim() || "";
  const dateFrom = document.getElementById("msg-filter-date-from")?.value || "";
  const dateTo = document.getElementById("msg-filter-date-to")?.value || "";
  const sort = (document.getElementById("msg-sort-order")?.value || "desc").toLowerCase() === "asc" ? "asc" : "desc";
  const res = await api.get(`/api/mail/${accountId}/messages`, {
    params: {
      folder: currentFolder,
      page: currentPage,
      limit: PAGE_SIZE,
      search: search || void 0,
      email: email || void 0,
      dateFrom: dateFrom || void 0,
      dateTo: dateTo || void 0,
      sort
    }
  });
  const list = document.getElementById("messages-list");
  if (!res.ok || !res.data) {
    if (isMailboxCredentialError(res)) {
      mailboxCredentialBroken = true;
      renderMailboxCredentialBlockedState();
      return;
    }
    if (isMailboxImapUnavailable(res)) {
      list.innerHTML = `<div class="p-4 text-center text-xs text-amber-200">No se pudo conectar al servidor IMAP para cargar mensajes.</div>`;
      return;
    }
    list.innerHTML = `<div class="p-6 text-center text-xs text-muted-foreground">Error al cargar mensajes</div>`;
    return;
  }
  const data = res.data;
  const messages = Array.isArray(data) ? data : data.messages ?? [];
  totalMessages = data.total ?? messages.length;
  if (messages.length === 0) {
    currentUid = null;
    document.getElementById("viewer-empty").classList.remove("hidden");
    document.getElementById("viewer-content").classList.add("hidden");
    list.innerHTML = `<div class="flex flex-col items-center justify-center p-8 text-center">
      <i class="ti ti-inbox-off text-2xl text-muted-foreground/40 mb-2"></i>
      <p class="text-xs text-muted-foreground">Sin mensajes</p>
    </div>`;
  } else {
    list.innerHTML = messages.map((m) => renderMessageRow(m)).join("");
  }
  const countEl = document.getElementById("folder-count");
  if (totalMessages > 0) {
    countEl.textContent = String(totalMessages);
    countEl.classList.remove("hidden");
  } else {
    countEl.classList.add("hidden");
  }
  const pagEl = document.getElementById("msg-pagination");
  if (totalMessages > PAGE_SIZE) {
    pagEl.classList.remove("hidden");
    document.getElementById("page-info").textContent = `${(currentPage - 1) * PAGE_SIZE + 1}\u2013${Math.min(currentPage * PAGE_SIZE, totalMessages)} de ${totalMessages}`;
    document.getElementById("btn-prev-page").disabled = currentPage <= 1;
    document.getElementById("btn-next-page").disabled = currentPage * PAGE_SIZE >= totalMessages;
  } else {
    pagEl.classList.add("hidden");
  }
  if (!autoOpenLatest || messages.length === 0) return;
  const selectedStillVisible = currentUid !== null && messages.some((item) => Number(item.uid) === currentUid);
  if (!selectedStillVisible) {
    const firstUid = Number(messages[0]?.uid || 0);
    if (firstUid > 0) {
      await window.openMessage(firstUid);
    }
  }
}
function renderMessageRow(m) {
  const date = new Date(m.date ?? m.receivedAt ?? Date.now());
  const now = /* @__PURE__ */ new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const dateStr = sameDay ? date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) : date.toLocaleDateString("es", { day: "2-digit", month: "short" });
  const from = m.from?.name || m.from?.address || m.from || "Sin remitente";
  const unread = !m.seen && !m.flags?.includes("\\Seen");
  return `
    <div onclick="openMessage(${m.uid})"
      class="msg-row p-3 cursor-pointer transition-colors hover:bg-accent ${currentUid === m.uid ? "bg-primary/5 border-l-2 border-primary" : ""} ${unread ? "bg-muted/20" : ""}">
      <div class="flex items-center justify-between gap-2 mb-1">
        <span class="text-xs ${unread ? "font-semibold text-foreground" : "font-medium text-muted-foreground"} truncate">${from}</span>
        <span class="text-[10px] text-muted-foreground shrink-0">${dateStr}</span>
      </div>
      <p class="text-xs ${unread ? "font-medium text-foreground" : "text-muted-foreground"} truncate mb-0.5">${m.subject || "(Sin asunto)"}</p>
      <p class="text-[11px] text-muted-foreground/70 truncate">${m.preview || m.snippet || ""}</p>
      <div class="flex gap-1 mt-1">
        ${m.flags?.includes("\\Flagged") ? '<i class="ti ti-flag-filled text-[10px] text-amber-500"></i>' : ""}
        ${m.hasAttachments || m.attachments?.length ? '<i class="ti ti-paperclip text-[10px] text-muted-foreground"></i>' : ""}
        ${unread ? '<span class="ml-auto w-1.5 h-1.5 rounded-full bg-primary"></span>' : ""}
      </div>
    </div>`;
}
window.openMessage = async function(uid, refreshList = true) {
  if (mailboxCredentialBroken) {
    renderMailboxCredentialBlockedState();
    return;
  }
  currentUid = uid;
  if (refreshList) {
    await loadMessages({ autoOpenLatest: false, showLoading: false });
  }
  document.getElementById("viewer-empty").classList.add("hidden");
  document.getElementById("viewer-content").classList.remove("hidden");
  document.getElementById("msg-subject").textContent = "Cargando...";
  document.getElementById("msg-from").textContent = "";
  document.getElementById("msg-to").textContent = "";
  document.getElementById("msg-date").textContent = "";
  document.getElementById("msg-iframe").classList.add("hidden");
  document.getElementById("msg-text").classList.add("hidden");
  const res = await api.get(`/api/mail/${accountId}/messages/${uid}`, {
    params: { folder: currentFolder }
  });
  if (!res.ok || !res.data) {
    if (isMailboxCredentialError(res)) {
      mailboxCredentialBroken = true;
      renderMailboxCredentialBlockedState();
      return;
    }
    return;
  }
  const msg = res.data;
  document.getElementById("msg-subject").textContent = msg.subject || "(Sin asunto)";
  document.getElementById("msg-from").textContent = formatAddress(msg.from);
  document.getElementById("msg-to").textContent = formatAddress(msg.to);
  document.getElementById("msg-date").textContent = msg.date ? new Date(msg.date).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" }) : "";
  const ccRow = document.getElementById("msg-cc-row");
  if (msg.cc) {
    document.getElementById("msg-cc").textContent = formatAddress(msg.cc);
    ccRow.classList.remove("hidden");
  } else {
    ccRow.classList.add("hidden");
  }
  const iframe = document.getElementById("msg-iframe");
  const textEl = document.getElementById("msg-text");
  if (msg.html) {
    iframe.classList.remove("hidden");
    textEl.classList.add("hidden");
    const isDark = document.documentElement.classList.contains("dark");
    const iframeText = isDark ? "#e5e5e5" : "#0f172a";
    const iframeLink = isDark ? "#c084fc" : "#7c3aed";
    const iframeBg = isDark ? "#1a1a1a" : "#ffffff";
    iframe.srcdoc = `<!DOCTYPE html><html><head><style>
      body { font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.6; color: ${iframeText}; background: ${iframeBg}; margin: 1.5rem; }
      img { max-width: 100%; } a { color: ${iframeLink}; }
    </style></head><body>${msg.html}</body></html>`;
  } else {
    iframe.classList.add("hidden");
    textEl.classList.remove("hidden");
    textEl.textContent = msg.text || msg.body || "(Sin contenido)";
  }
  const attachDiv = document.getElementById("msg-attachments");
  const attachList = document.getElementById("attachments-list");
  if (msg.attachments?.length) {
    attachDiv.classList.remove("hidden");
    attachList.innerHTML = msg.attachments.map((a) => `
      <div class="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
        <i class="ti ti-paperclip text-muted-foreground text-xs"></i>
        <span class="text-xs">${a.filename ?? a.name ?? "adjunto"}</span>
        <span class="text-[10px] text-muted-foreground">${a.size ? formatBytes(a.size) : ""}</span>
      </div>`).join("");
  } else {
    attachDiv.classList.add("hidden");
  }
  window._currentUid = uid;
};
function formatAddress(addr) {
  if (!addr) return "";
  if (typeof addr === "string") return addr;
  if (Array.isArray(addr)) return addr.map(formatAddress).join(", ");
  return addr.name ? `${addr.name} <${addr.address}>` : addr.address ?? "";
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
function setMailCredentialError(message) {
  const errorEl = document.getElementById("mail-credential-error");
  if (!errorEl) return;
  if (!message) {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    return;
  }
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}
function setMailCredentialFeedback(message, isSuccess = true) {
  const feedbackEl = document.getElementById("mail-credential-feedback");
  if (!feedbackEl) return;
  if (!message) {
    feedbackEl.classList.add("hidden");
    feedbackEl.className = "hidden rounded-lg px-4 py-2 text-sm";
    feedbackEl.textContent = "";
    return;
  }
  feedbackEl.className = `rounded-lg px-4 py-2 text-sm ${isSuccess ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border border-destructive/30 bg-destructive/10 text-destructive"}`;
  feedbackEl.textContent = message;
}
function setMailCredentialLoading(active, text = "Procesando...") {
  const loadingEl = document.getElementById("mail-credential-loading");
  if (loadingEl) {
    if (active) loadingEl.classList.remove("hidden");
    else loadingEl.classList.add("hidden");
  }
  const loadingText = document.getElementById("mail-credential-loading-text");
  if (loadingText && active) loadingText.textContent = text;
  const btnIds = ["mail-credential-submit", "mail-credential-current-submit"];
  for (const id of btnIds) {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = active;
      btn.classList.toggle("opacity-70", active);
      btn.classList.toggle("cursor-not-allowed", active);
    }
  }
  const cancelBtn = document.getElementById("mail-credential-cancel");
  const closeBtn = document.getElementById("mail-credential-dialog-close");
  const inputs = ["mail-credential-password", "mail-credential-confirm", "mail-credential-current"];
  for (const id of inputs) {
    const el = document.getElementById(id);
    if (el) el.disabled = active;
  }
  if (cancelBtn) cancelBtn.disabled = active;
  if (closeBtn) closeBtn.disabled = active;
}
async function waitMs(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
async function refreshMailboxAfterPasswordUpdate() {
  const attempts = 4;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await loadFolders();
    await loadMessages();
    if (!mailboxCredentialBroken && folders.length > 0) {
      return true;
    }
    if (attempt < attempts) {
      await waitMs(1500 * attempt);
    }
  }
  return !mailboxCredentialBroken && folders.length > 0;
}
function resetMailCredentialForm() {
  const ids = ["mail-credential-password", "mail-credential-confirm", "mail-credential-current"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.value = "";
  }
  setMailCredentialError(null);
  setMailCredentialLoading(false);
}
function openMailboxCredentialDialog() {
  const accountEmail = (document.getElementById("account-email")?.textContent || "").trim();
  const labelEl = document.getElementById("mail-credential-account-email");
  if (labelEl) {
    labelEl.textContent = accountEmail || `Cuenta #${accountId}`;
  }
  setMailCredentialFeedback(null);
  resetMailCredentialForm();
  document.getElementById("dlg-mail-credentials")?.showModal();
}
const closeMailboxCredentialDialog = () => {
  document.getElementById("dlg-mail-credentials")?.close();
};
window.openMailboxCredentialDialog = openMailboxCredentialDialog;
function setFoldersManagerError(message) {
  const errorEl = document.getElementById("folders-manager-error");
  if (!errorEl) return;
  if (!message) {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    return;
  }
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}
function setFoldersManagerFeedback(message, isSuccess = true) {
  const feedbackEl = document.getElementById("folders-manager-feedback");
  if (!feedbackEl) return;
  if (!message) {
    feedbackEl.classList.add("hidden");
    feedbackEl.className = "hidden rounded-lg px-4 py-2 text-sm";
    feedbackEl.textContent = "";
    return;
  }
  feedbackEl.className = `rounded-lg px-4 py-2 text-sm ${isSuccess ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border border-destructive/30 bg-destructive/10 text-destructive"}`;
  feedbackEl.textContent = message;
}
function resetFolderManagerForm() {
  document.getElementById("folders-manager-edit-path").value = "";
  document.getElementById("folders-manager-name").value = "";
  renderFolderParentOptions();
  setFolderManagerParentMode(false);
  setFoldersManagerError(null);
}
function fillFolderManagerForm(folder) {
  document.getElementById("folders-manager-edit-path").value = folder.path;
  document.getElementById("folders-manager-name").value = folder.name;
  renderFolderParentOptions("", folder.path);
  setFolderManagerParentMode(true);
  setFoldersManagerError(null);
}
function renderManagerFolderNodes(nodes, depth = 0) {
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
          ${hasChildren ? `<button type="button" onclick="toggleManagerFolderCollapse('${encodeURIComponent(node.path)}')" class="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Mostrar u ocultar subcarpetas" aria-expanded="${collapsed ? "false" : "true"}">
                <i class="ti ti-chevron-right text-[10px] transition-transform ${collapsed ? "" : "rotate-90"}"></i>
              </button>` : `<span class="inline-block h-6 w-6"></span>`}
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium">${label}</div>
            <div class="truncate text-[11px] text-muted-foreground">${path}</div>
          </div>
          ${folder ? protectedFolder ? `<span class="inline-flex rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">Protegida</span>` : `<div class="inline-flex items-center gap-1">
                  <button type="button" onclick="editMailboxFolder('${encodeURIComponent(node.path)}')" class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Renombrar carpeta">
                    <i class="ti ti-edit text-sm"></i>
                  </button>
                  <button type="button" onclick="deleteMailboxFolder('${encodeURIComponent(node.path)}')" class="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Eliminar carpeta">
                    <i class="ti ti-trash text-sm"></i>
                  </button>
                </div>` : `<span class="text-[10px] text-muted-foreground">Grupo</span>`}
        </div>
        ${hasChildren ? `<div class="${collapsed ? "hidden" : "space-y-1"}">${renderManagerFolderNodes(node.children, depth + 1)}</div>` : ""}
      </div>
    `;
  }).join("");
}
function renderFolderManagerList() {
  const container = document.getElementById("folders-manager-list-body");
  if (!container) return;
  if (folders.length === 0) {
    container.innerHTML = `<div class="rounded-lg border border-border p-3 text-center text-xs text-muted-foreground">Sin carpetas disponibles</div>`;
    return;
  }
  const { roots } = buildFolderTree(folders);
  container.innerHTML = renderManagerFolderNodes(roots);
}
async function openFoldersManagerDialog() {
  const accountEmail = (document.getElementById("account-email")?.textContent || "").trim();
  const label = accountEmail || `Cuenta #${accountId}`;
  const labelEl = document.getElementById("folders-manager-account-email");
  if (labelEl) labelEl.textContent = label;
  collapsedManagerFolders.clear();
  setFoldersManagerFeedback(null);
  resetFolderManagerForm();
  renderFolderManagerList();
  document.getElementById("dlg-folders-manager")?.showModal();
}
const closeFoldersManagerDialog = () => {
  document.getElementById("dlg-folders-manager")?.close();
};
window.toggleManagerFolderCollapse = (encodedPath) => {
  const path = decodeURIComponent(encodedPath);
  if (collapsedManagerFolders.has(path)) {
    collapsedManagerFolders.delete(path);
  } else {
    collapsedManagerFolders.add(path);
  }
  renderFolderManagerList();
};
window.editMailboxFolder = (encodedPath) => {
  const path = decodeURIComponent(encodedPath);
  const folder = folders.find((item) => item.path === path);
  if (!folder) {
    setFoldersManagerFeedback("No se encontr\xF3 la carpeta seleccionada.", false);
    return;
  }
  if (isProtectedFolder(folder)) {
    setFoldersManagerFeedback("Esta carpeta est\xE1 protegida y no se puede renombrar.", false);
    return;
  }
  fillFolderManagerForm(folder);
  setFoldersManagerFeedback(`Renombrando ${folder.path}`);
};
window.deleteMailboxFolder = async (encodedPath) => {
  const path = decodeURIComponent(encodedPath);
  const folder = folders.find((item) => item.path === path);
  if (!folder) {
    setFoldersManagerFeedback("No se encontr\xF3 la carpeta seleccionada.", false);
    return;
  }
  if (isProtectedFolder(folder)) {
    setFoldersManagerFeedback("Esta carpeta est\xE1 protegida y no se puede eliminar.", false);
    return;
  }
  const confirmed = await openConfirm(`\xBFEliminar carpeta "${folder.path}"?`, {
    title: "Eliminar carpeta",
    variant: "danger"
  });
  if (!confirmed) return;
  const res = await api.delete(`/api/mail/${accountId}/folders`, {
    params: { path: folder.path }
  });
  if (!res.ok) {
    setFoldersManagerFeedback(res.error ?? "No se pudo eliminar la carpeta.", false);
    return;
  }
  setFoldersManagerFeedback("Carpeta eliminada correctamente.");
  if (currentFolder === folder.path) {
    currentUid = null;
  }
  await loadFolders();
  renderFolderManagerList();
  await loadMessages();
};
function setContactsError(message) {
  const errorEl = document.getElementById("contacts-error");
  if (!errorEl) return;
  if (!message) {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    return;
  }
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}
function setContactsFeedback(message, isSuccess = true) {
  const feedbackEl = document.getElementById("contacts-feedback");
  if (!feedbackEl) return;
  if (!message) {
    feedbackEl.classList.add("hidden");
    feedbackEl.className = "hidden rounded-lg px-4 py-2 text-sm";
    feedbackEl.textContent = "";
    return;
  }
  feedbackEl.className = `rounded-lg px-4 py-2 text-sm ${isSuccess ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border border-destructive/30 bg-destructive/10 text-destructive"}`;
  feedbackEl.textContent = message;
}
function resetContactForm() {
  document.getElementById("contacts-edit-id").value = "";
  document.getElementById("contacts-email").value = "";
  document.getElementById("contacts-name").value = "";
  setContactsError(null);
}
function fillContactForm(contact) {
  document.getElementById("contacts-edit-id").value = String(contact.id);
  document.getElementById("contacts-email").value = contact.email;
  document.getElementById("contacts-name").value = contact.displayName ?? "";
  setContactsError(null);
}
function renderContactsList() {
  const tbody = document.getElementById("contacts-list-body");
  if (!tbody) return;
  if (loadedContacts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="px-3 py-6 text-center text-xs text-muted-foreground">Sin contactos guardados</td></tr>`;
    return;
  }
  tbody.innerHTML = loadedContacts.map((contact) => `
    <tr class="border-b border-border last:border-0">
      <td class="px-3 py-2">${escapeHtml(contact.email)}</td>
      <td class="px-3 py-2">${escapeHtml(contact.displayName || "-")}</td>
      <td class="px-3 py-2 text-right">
        <button type="button" onclick="editMailboxContact(${contact.id})" class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Editar contacto">
          <i class="ti ti-edit text-sm"></i>
        </button>
        <button type="button" onclick="deleteMailboxContact(${contact.id})" class="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Eliminar contacto">
          <i class="ti ti-trash text-sm"></i>
        </button>
      </td>
    </tr>
  `).join("");
}
async function loadContacts() {
  const res = await api.get(`/api/accounts/${accountId}/contacts`);
  loadedContacts = res.ok && Array.isArray(res.data) ? res.data : [];
  renderContactsList();
}
async function openContactsDialog() {
  const accountEmail = (document.getElementById("account-email")?.textContent || "").trim();
  const label = accountEmail || `Cuenta #${accountId}`;
  const labelEl = document.getElementById("contacts-account-email");
  if (labelEl) labelEl.textContent = label;
  setContactsFeedback(null);
  resetContactForm();
  await loadContacts();
  document.getElementById("dlg-contacts")?.showModal();
}
const closeContactsDialog = () => {
  document.getElementById("dlg-contacts")?.close();
};
window.editMailboxContact = (contactId) => {
  const contact = loadedContacts.find((item) => item.id === contactId);
  if (!contact) {
    setContactsFeedback("No se encontr\xF3 el contacto seleccionado.", false);
    return;
  }
  fillContactForm(contact);
  setContactsFeedback(`Editando ${contact.email}`);
};
window.deleteMailboxContact = async (contactId) => {
  const contact = loadedContacts.find((item) => item.id === contactId);
  const label = contact?.email ?? `#${contactId}`;
  const confirmed = await openConfirm(`\xBFEliminar contacto "${label}"?`, {
    title: "Eliminar contacto",
    variant: "danger"
  });
  if (!confirmed) return;
  const res = await api.delete(`/api/accounts/${accountId}/contacts/${contactId}`);
  if (!res.ok) {
    setContactsFeedback(res.error ?? "No se pudo eliminar el contacto.", false);
    return;
  }
  setContactsFeedback("Contacto eliminado correctamente.");
  await loadContacts();
};
document.getElementById("btn-delete-msg")?.addEventListener("click", async () => {
  const uid = window._currentUid;
  if (!uid || !await openConfirm("\xBFEliminar este mensaje?", { title: "Eliminar mensaje", variant: "danger" })) return;
  const res = await api.delete(`/api/mail/${accountId}/messages/${uid}`, { params: { folder: currentFolder } });
  if (res.ok) {
    currentUid = null;
    document.getElementById("viewer-empty").classList.remove("hidden");
    document.getElementById("viewer-content").classList.add("hidden");
    loadMessages();
  }
});
document.getElementById("btn-reply")?.addEventListener("click", () => {
  const uid = window._currentUid;
  if (!uid) return;
  window.location.href = `/panel/mail/compose?from=${accountId}&replyTo=${uid}&folder=${currentFolder}`;
});
document.getElementById("btn-forward")?.addEventListener("click", () => {
  const uid = window._currentUid;
  if (!uid) return;
  window.location.href = `/panel/mail/compose?from=${accountId}&forward=${uid}&folder=${currentFolder}`;
});
document.getElementById("btn-move")?.addEventListener("click", () => {
  const moveList = document.getElementById("move-folders-list");
  moveList.innerHTML = folders.filter((f) => f.path !== currentFolder).map((f) => `
      <button onclick="moveToFolder('${encodeURIComponent(f.path)}')"
        class="w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors">
        <i class="ti ti-folder text-muted-foreground text-sm"></i>${f.name}
      </button>`).join("");
  document.getElementById("dlg-move").showModal();
});
window.moveToFolder = async function(encodedTargetFolder) {
  const targetFolder = decodeURIComponent(encodedTargetFolder);
  document.getElementById("dlg-move").close();
  const uid = window._currentUid;
  if (!uid) return;
  const res = await api.post(`/api/mail/${accountId}/messages/${uid}/move`, {
    folder: currentFolder,
    destFolder: targetFolder
  });
  if (res.ok) {
    currentUid = null;
    document.getElementById("viewer-empty").classList.remove("hidden");
    document.getElementById("viewer-content").classList.add("hidden");
    loadMessages();
    loadFolders();
  }
};
document.getElementById("btn-refresh")?.addEventListener("click", () => {
  loadFolders();
  loadMessages();
});
document.getElementById("btn-mark-all-read")?.addEventListener("click", async () => {
  if (!await openConfirm(`\xBFMarcar todos como le\xEDdos en "${currentFolder}"?`, { title: "Marcar como le\xEDdos", confirmText: "S\xED, marcar todos" })) return;
  await api.post(`/api/mail/${accountId}/messages/mark-all-read`, { folder: currentFolder });
  loadMessages();
});
document.getElementById("mail-credential-dialog-close")?.addEventListener("click", closeMailboxCredentialDialog);
document.getElementById("mail-credential-cancel")?.addEventListener("click", closeMailboxCredentialDialog);
document.getElementById("mail-credential-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isMailCredentialSaving) return;
  const password = document.getElementById("mail-credential-password").value;
  const confirm = document.getElementById("mail-credential-confirm").value;
  if (password.length < 6) {
    setMailCredentialError("La contrase\xF1a debe tener al menos 6 caracteres.");
    return;
  }
  if (password !== confirm) {
    setMailCredentialError("La confirmaci\xF3n no coincide con la contrase\xF1a.");
    return;
  }
  setMailCredentialError(null);
  isMailCredentialSaving = true;
  setMailCredentialFeedback(null);
  setMailCredentialLoading(true);
  const res = await api.put(`/api/accounts/${accountId}`, { password });
  if (!res.ok) {
    isMailCredentialSaving = false;
    setMailCredentialLoading(false);
    setMailCredentialFeedback(res.error ?? "No se pudo actualizar la contrase\xF1a del buz\xF3n.", false);
    return;
  }
  setMailCredentialFeedback("Contrase\xF1a actualizada. Recargando carpetas y mensajes...");
  mailboxCredentialBroken = false;
  currentUid = null;
  currentPage = 1;
  folders = [];
  const refreshed = await refreshMailboxAfterPasswordUpdate();
  isMailCredentialSaving = false;
  setMailCredentialLoading(false);
  if (!refreshed) {
    setMailCredentialFeedback(
      "La contrase\xF1a se guard\xF3, pero el servidor IMAP no respondi\xF3. Verifica conectividad IMAP y vuelve a intentar.",
      false
    );
    return;
  }
  closeMailboxCredentialDialog();
});
document.getElementById("mail-credential-current-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isMailCredentialSaving) return;
  const password = document.getElementById("mail-credential-current").value;
  if (!password) {
    setMailCredentialError("Ingresa la contrase\xF1a actual del buz\xF3n.");
    return;
  }
  setMailCredentialError(null);
  isMailCredentialSaving = true;
  setMailCredentialFeedback(null);
  setMailCredentialLoading(true, "Validando contrase\xF1a con el servidor...");
  const res = await api.post(`/api/mail/${accountId}/credential`, { password });
  if (!res.ok) {
    isMailCredentialSaving = false;
    setMailCredentialLoading(false);
    setMailCredentialFeedback(res.error ?? "No se pudo validar la contrase\xF1a.", false);
    return;
  }
  setMailCredentialFeedback("Contrase\xF1a validada. Cargando carpetas y mensajes...");
  mailboxCredentialBroken = false;
  currentUid = null;
  currentPage = 1;
  folders = [];
  const refreshed = await refreshMailboxAfterPasswordUpdate();
  isMailCredentialSaving = false;
  setMailCredentialLoading(false);
  if (!refreshed) {
    setMailCredentialFeedback(
      "La contrase\xF1a se guard\xF3, pero el buz\xF3n a\xFAn no responde. Reintenta en unos segundos.",
      false
    );
    return;
  }
  closeMailboxCredentialDialog();
});
document.getElementById("dlg-mail-credentials")?.addEventListener("close", () => {
  isMailCredentialSaving = false;
  resetMailCredentialForm();
  setMailCredentialFeedback(null);
});
document.getElementById("btn-open-folders-manager")?.addEventListener("click", () => {
  openFoldersManagerDialog();
});
document.getElementById("folders-manager-close")?.addEventListener("click", closeFoldersManagerDialog);
document.getElementById("folders-manager-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const editPath = document.getElementById("folders-manager-edit-path").value.trim();
  const name = document.getElementById("folders-manager-name").value.trim();
  const parentPath = document.getElementById("folders-manager-parent").value.trim();
  if (!name) {
    setFoldersManagerError("Debes indicar el nombre de la carpeta.");
    return;
  }
  setFoldersManagerError(null);
  const res = editPath ? await api.put(`/api/mail/${accountId}/folders`, { path: editPath, name }) : await api.post(`/api/mail/${accountId}/folders`, { name, parentPath: parentPath || void 0 });
  if (!res.ok) {
    setFoldersManagerFeedback(res.error ?? "No se pudo guardar la carpeta.", false);
    return;
  }
  setFoldersManagerFeedback(editPath ? "Carpeta renombrada correctamente." : "Carpeta creada correctamente.");
  resetFolderManagerForm();
  await loadFolders();
  renderFolderManagerList();
  await loadMessages();
});
document.getElementById("dlg-folders-manager")?.addEventListener("close", () => {
  resetFolderManagerForm();
  setFoldersManagerFeedback(null);
});
document.getElementById("btn-open-contacts")?.addEventListener("click", () => {
  openContactsDialog();
});
document.getElementById("contacts-dialog-close")?.addEventListener("click", closeContactsDialog);
document.getElementById("contacts-cancel")?.addEventListener("click", closeContactsDialog);
document.getElementById("contacts-new")?.addEventListener("click", () => {
  resetContactForm();
  setContactsFeedback("Formulario listo para crear un nuevo contacto.");
});
document.getElementById("contacts-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const contactId = document.getElementById("contacts-edit-id").value.trim();
  const email = document.getElementById("contacts-email").value.trim().toLowerCase();
  const displayName = document.getElementById("contacts-name").value.trim();
  if (!email) {
    setContactsError("Debes indicar el correo del contacto.");
    return;
  }
  if (!SIMPLE_EMAIL_RE.test(email)) {
    setContactsError("Ingresa un correo v\xE1lido.");
    return;
  }
  setContactsError(null);
  const payload = {
    email,
    displayName: displayName || void 0
  };
  const res = contactId ? await api.put(`/api/accounts/${accountId}/contacts/${contactId}`, payload) : await api.post(`/api/accounts/${accountId}/contacts`, payload);
  if (!res.ok) {
    setContactsFeedback(res.error ?? "No se pudo guardar el contacto.", false);
    return;
  }
  setContactsFeedback(contactId ? "Contacto actualizado correctamente." : "Contacto creado correctamente.");
  resetContactForm();
  await loadContacts();
});
document.getElementById("dlg-contacts")?.addEventListener("close", () => {
  resetContactForm();
  setContactsFeedback(null);
});
document.getElementById("btn-prev-page")?.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    loadMessages();
  }
});
document.getElementById("btn-next-page")?.addEventListener("click", () => {
  if (currentPage * PAGE_SIZE < totalMessages) {
    currentPage++;
    loadMessages();
  }
});
function queueMessageRefresh() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage = 1;
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
  const emailInput = document.getElementById("msg-filter-email");
  const dateFromInput = document.getElementById("msg-filter-date-from");
  const dateToInput = document.getElementById("msg-filter-date-to");
  const sortSelect = document.getElementById("msg-sort-order");
  const searchInput = document.getElementById("msg-search");
  if (emailInput) emailInput.value = "";
  if (dateFromInput) dateFromInput.value = "";
  if (dateToInput) dateToInput.value = "";
  if (sortSelect) sortSelect.value = "desc";
  if (searchInput) searchInput.value = "";
  currentPage = 1;
  loadMessages();
});
let initLastAt = 0;
const INIT_COOLDOWN_MS = 4e3;
function init() {
  if (!document.getElementById("messages-list") && !document.getElementById("inbox-container")) return;
  if (!accountId) return;
  if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;
  initLastAt = Date.now();
  loadAccountInfo();
  loadFolders();
  loadMessages();
}
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
init();
