// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Credenciales Git (gestión movida desde el módulo Files) ─────────────────────
// Misma CRUD que tenía el modal del módulo Files, ahora aquí. Endpoints propios
// del módulo files (gateados por su permiso; el tab Credenciales es admin-only).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { escapeHtmlCred, showToast, t } from "./cred-dom";

let gitCredsBound = false;
let gitCredsCache: Array<{ id: string; label: string; type: string; host: string; username?: string }> = [];
let gitEditingId: string | null = null;
// When set, the form edits a DETECTED server ~/.git-credentials entry (not a
// panel-stored one). matchHost/matchUser identify the line to replace.
let gitServerEdit: { matchHost: string; matchUser: string } | null = null;

async function loadGitCreds(): Promise<void> {
  const list = document.getElementById("git-creds-list");
  if (!list) return;
  let res: any;
  try { res = await api.get("/api/files/git/credentials"); }
  catch { list.innerHTML = `<div class="text-sm text-destructive">${t("git.loadError", "No se pudieron cargar las credenciales")}</div>`; return; }
  if (!res?.ok) { list.innerHTML = `<div class="text-sm text-destructive">${escapeHtmlCred(res?.error || t("git.errorFallback", "Error"))}</div>`; return; }
  if (res.data?.enabled === false) {
    list.innerHTML = `<div class="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">${t("git.disabled", "Las credenciales están deshabilitadas: configura")} <span class="font-mono">GIT_ENCRYPTION_KEY</span> ${t("git.disabledSuffix", "en el backend.")}</div>`;
    return;
  }
  const creds: Array<{ id: string; label: string; type: string; host: string; username?: string }> = res.data?.credentials || [];
  gitCredsCache = creds;
  if (creds.length === 0) { list.innerHTML = `<div class="text-xs text-muted-foreground">${t("git.empty", "Sin credenciales guardadas.")}</div>`; return; }
  list.innerHTML = creds.map((c) => `
    <div class="flex items-center justify-between gap-2 border-b border-border py-1.5 last:border-0${gitEditingId === c.id ? " rounded-md bg-primary/5" : ""}">
      <span class="min-w-0 truncate text-sm"><span class="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">${escapeHtmlCred(c.type)}</span> <span class="font-medium">${escapeHtmlCred(c.label)}</span> <span class="text-xs text-muted-foreground">${escapeHtmlCred(c.host)}${c.username ? " · " + escapeHtmlCred(c.username) : ""}</span></span>
      <span class="flex shrink-0 items-center gap-1">
        <button type="button" data-git-cred-edit="${escapeHtmlCred(c.id)}" class="rounded-md border border-border px-2 py-0.5 text-xs font-medium hover:bg-accent">${t("git.edit", "Editar")}</button>
        <button type="button" data-git-cred-del="${escapeHtmlCred(c.id)}" class="rounded-md border border-border px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10">${t("git.delete", "Eliminar")}</button>
      </span>
    </div>`).join("");
}

/** Reset the add/edit form back to "create" mode (clear fields + edit state). */
function resetGitForm(): void {
  gitEditingId = null;
  gitServerEdit = null;
  const ids = ["git-cred-label", "git-cred-host", "git-cred-user", "git-cred-secret"];
  for (const id of ids) {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el) el.value = "";
  }
  const typeEl = document.getElementById("git-cred-type") as HTMLSelectElement | null;
  if (typeEl) typeEl.value = "https";
  const submit = document.getElementById("git-cred-submit");
  if (submit) submit.textContent = t("git.btnSave", "Guardar credencial");
  const secret = document.getElementById("git-cred-secret") as HTMLTextAreaElement | null;
  if (secret) secret.placeholder = t("git.placeholderSecret", "Token de acceso (https) o clave privada SSH");
  document.getElementById("git-cred-cancel")?.classList.add("hidden");
}

/** Load a stored credential into the form for editing (secret stays blank — it
 *  is never shown; leaving it blank on save keeps the stored secret). */
function startGitEdit(id: string): void {
  const c = gitCredsCache.find((x) => x.id === id);
  if (!c) return;
  gitEditingId = id;
  (document.getElementById("git-cred-label") as HTMLInputElement).value = c.label || "";
  (document.getElementById("git-cred-type") as HTMLSelectElement).value = c.type || "https";
  (document.getElementById("git-cred-host") as HTMLInputElement).value = c.host || "";
  (document.getElementById("git-cred-user") as HTMLInputElement).value = c.username || "";
  const secret = document.getElementById("git-cred-secret") as HTMLTextAreaElement | null;
  if (secret) { secret.value = ""; secret.placeholder = t("git.secretKeep", "Dejar en blanco para mantener el secreto actual"); }
  const submit = document.getElementById("git-cred-submit");
  if (submit) submit.textContent = t("git.btnUpdate", "Actualizar credencial");
  document.getElementById("git-cred-cancel")?.classList.remove("hidden");
  void loadGitCreds(); // re-render to highlight the row being edited
  document.getElementById("git-cred-label")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function submitGitCred(): Promise<void> {
  const label = (document.getElementById("git-cred-label") as HTMLInputElement | null)?.value?.trim() || "";
  const type = (document.getElementById("git-cred-type") as HTMLSelectElement | null)?.value || "https";
  const host = (document.getElementById("git-cred-host") as HTMLInputElement | null)?.value?.trim() || "";
  const username = (document.getElementById("git-cred-user") as HTMLInputElement | null)?.value?.trim() || "";
  const secret = (document.getElementById("git-cred-secret") as HTMLTextAreaElement | null)?.value || "";
  const editing = gitEditingId;

  // Editing a DETECTED server ~/.git-credentials entry: host+user+token required
  // (the server secret is never shown, so it must be re-entered). Targets the
  // server endpoint, not the panel store.
  if (gitServerEdit) {
    if (!host || !username || !secret) { showToast(t("git.completeServerEdit", "Completa host, usuario y token"), false); return; }
    let r: any;
    try { r = await api.post("/api/files/git/server/https", { host, username, secret, matchHost: gitServerEdit.matchHost, matchUser: gitServerEdit.matchUser }); }
    catch { showToast(t("git.saveError", "No se pudo guardar"), false); return; }
    if (!r?.ok) { showToast(r?.error || t("git.saveError", "No se pudo guardar"), false); return; }
    showToast(t("git.updated", "Credencial actualizada"));
    resetGitForm();
    await loadGitDetected();
    return;
  }

  // On create the secret is required; on edit it's optional (blank = keep).
  if (!label || !host || (!editing && !secret)) {
    showToast(t("git.completeFields", "Completa etiqueta, host y secreto"), false);
    return;
  }
  let res: any;
  try {
    res = editing
      ? await api.put(`/api/files/git/credentials/${encodeURIComponent(editing)}`, { label, type, host, username, ...(secret ? { secret } : {}) })
      : await api.post("/api/files/git/credentials", { label, type, host, username: username || undefined, secret });
  } catch { showToast(t("git.saveError", "No se pudo guardar"), false); return; }
  if (!res?.ok) { showToast(res?.error || t("git.saveError", "No se pudo guardar"), false); return; }
  showToast(editing ? t("git.updated", "Credencial actualizada") : t("git.saved", "Credencial guardada"));
  resetGitForm();
  await loadGitCreds();
}

async function onGitCredDelete(ev: Event): Promise<void> {
  const target = (ev.target as HTMLElement | null)?.closest("[data-git-cred-del]") as HTMLElement | null;
  if (!target) return;
  const id = target.getAttribute("data-git-cred-del") || "";
  const ok = await openConfirm(t("git.confirmDelete", "¿Eliminar esta credencial Git?"), { title: t("git.confirmDeleteTitle", "Eliminar credencial"), variant: "danger" });
  if (!ok) return;
  let res: any;
  try { res = await api.delete(`/api/files/git/credentials/${encodeURIComponent(id)}`); }
  catch { showToast(t("git.deleteError", "No se pudo eliminar"), false); return; }
  if (res?.ok) {
    showToast(t("git.deleted", "Credencial eliminada"));
    if (gitEditingId === id) resetGitForm();
    await loadGitCreds();
  } else showToast(res?.error || t("git.deleteError", "No se pudo eliminar"), false);
}

// Credenciales/identidades git YA configuradas en el SERVIDOR. Se detectan sin
// secretos (GET /api/files/git/detect) y aquí se pueden EDITAR/ELIMINAR, lo que
// modifica archivos reales del servidor (~/.git-credentials, ~/.ssh), `gh` y git
// config — vía endpoints /api/files/git/server/*.
async function loadGitDetected(): Promise<void> {
  const box = document.getElementById("git-detected");
  if (!box) return;
  let res: any;
  try { res = await api.get("/api/files/git/detect"); }
  catch { box.innerHTML = ""; return; }
  if (!res?.ok) { box.innerHTML = ""; return; }
  const d: any = res.data || {};
  const https: Array<{ host: string; username?: string }> = Array.isArray(d.gitCredentials) ? d.gitCredentials : [];
  const ghAccounts: Array<{ host: string; user?: string }> = d.gh?.authenticated && Array.isArray(d.gh?.accounts) ? d.gh.accounts : [];
  const sshKeys: Array<{ name: string }> = Array.isArray(d.sshKeys) ? d.sshKeys : [];
  const cfg = d.gitConfig || {};
  const helper = typeof cfg.credentialHelper === "string" ? cfg.credentialHelper : "";
  const hasAny = https.length || ghAccounts.length || sshKeys.length || helper || cfg.userName || cfg.userEmail;
  if (!hasAny) {
    box.innerHTML = `<div class="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">${t("git.detectedNone", "No se detectaron credenciales git configuradas en el servidor.")}</div>`;
    return;
  }

  const httpsRows = https.filter((c) => c.host).map((c) => {
    const host = c.host.toLowerCase(); const user = c.username || "";
    return `<div class="flex items-center justify-between gap-2 border-b border-border py-1.5 last:border-0">
      <span class="min-w-0 truncate text-sm"><span class="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase text-emerald-600 dark:text-emerald-400">https</span> <span class="font-medium">${escapeHtmlCred(host)}</span>${user ? ` <span class="text-xs text-muted-foreground">· ${escapeHtmlCred(user)}</span>` : ""}</span>
      <span class="flex shrink-0 items-center gap-1">
        <button type="button" data-srv-https-edit="1" data-host="${escapeHtmlCred(host)}" data-user="${escapeHtmlCred(user)}" class="rounded-md border border-border px-2 py-0.5 text-xs font-medium hover:bg-accent">${t("git.edit", "Editar")}</button>
        <button type="button" data-srv-https-del="1" data-host="${escapeHtmlCred(host)}" data-user="${escapeHtmlCred(user)}" class="rounded-md border border-border px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10">${t("git.delete", "Eliminar")}</button>
      </span></div>`;
  }).join("");
  const ghRows = ghAccounts.filter((a) => a.host).map((a) => {
    const host = a.host.toLowerCase();
    return `<div class="flex items-center justify-between gap-2 border-b border-border py-1.5 last:border-0">
      <span class="min-w-0 truncate text-sm"><span class="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">gh</span> <span class="font-medium">${escapeHtmlCred(host)}</span>${a.user ? ` <span class="text-xs text-muted-foreground">· ${escapeHtmlCred(a.user)}</span>` : ""}</span>
      <button type="button" data-srv-gh-logout="1" data-host="${escapeHtmlCred(host)}" class="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10">${t("git.ghLogout", "Cerrar sesión")}</button>
    </div>`;
  }).join("");
  const sshRows = sshKeys.filter((k) => k.name).map((k) =>
    `<div class="flex items-center justify-between gap-2 border-b border-border py-1.5 last:border-0">
      <span class="min-w-0 truncate text-sm"><i class="ti ti-key text-xs"></i> <span class="font-medium">${escapeHtmlCred(k.name)}</span></span>
      <button type="button" data-srv-ssh-del="1" data-name="${escapeHtmlCred(k.name)}" class="shrink-0 rounded-md border border-destructive/40 px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10">${t("git.delete", "Eliminar")}</button>
    </div>`).join("");

  const sec = (title: string, rows: string) => rows ? `<div><div class="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">${title}</div>${rows}</div>` : "";
  const cfgBlock = `
    <div class="rounded-lg border border-border bg-background p-2.5">
      <div class="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">${t("git.identity", "Identidad git (global)")}</div>
      <div class="flex flex-wrap gap-2">
        <input id="git-cfg-name" type="text" value="${escapeHtmlCred(String(cfg.userName || ""))}" placeholder="${t("git.cfgName", "Nombre (user.name)")}" class="h-8 min-w-0 flex-1 rounded-lg border border-input bg-card px-2 text-sm" />
        <input id="git-cfg-email" type="text" value="${escapeHtmlCred(String(cfg.userEmail || ""))}" placeholder="${t("git.cfgEmail", "Email (user.email)")}" class="h-8 min-w-0 flex-1 rounded-lg border border-input bg-card px-2 text-sm" />
        <button type="button" id="git-cfg-save" class="h-8 shrink-0 rounded-lg border border-border px-3 text-xs font-medium hover:bg-accent">${t("git.btnSaveShort", "Guardar")}</button>
      </div>
      ${helper ? `<div class="mt-1.5 text-[11px] text-muted-foreground">helper: ${escapeHtmlCred(helper)}</div>` : ""}
    </div>`;

  box.innerHTML = `
    <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
      <div class="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400"><i class="ti ti-server-cog text-sm"></i> ${t("git.detectedTitle", "Configuradas en el servidor (se usan automáticamente)")}</div>
      ${sec(t("git.detectedHttps", "HTTPS (~/.git-credentials)"), httpsRows)}
      ${sec(t("git.detectedGh", "GitHub CLI"), ghRows)}
      ${sec(t("git.detectedSsh", "Llaves SSH"), sshRows)}
      ${cfgBlock}
    </div>`;
}

/** POST a server-side mutation, toast the result, and refresh the detected box. */
async function gitServerCall(url: string, body: unknown, okMsg: string): Promise<void> {
  let res: any;
  try { res = await api.post(url, body); }
  catch { showToast(t("git.serverOpError", "No se pudo aplicar el cambio en el servidor"), false); return; }
  if (!res?.ok) { showToast(res?.error || t("git.serverOpError", "No se pudo aplicar el cambio en el servidor"), false); return; }
  showToast(okMsg);
  await loadGitDetected();
}

/** Load a detected HTTPS entry into the form to edit it ON THE SERVER. */
function startServerHttpsEdit(host: string, user: string): void {
  gitEditingId = null;
  gitServerEdit = { matchHost: host, matchUser: user };
  (document.getElementById("git-cred-type") as HTMLSelectElement).value = "https";
  (document.getElementById("git-cred-host") as HTMLInputElement).value = host;
  (document.getElementById("git-cred-user") as HTMLInputElement).value = user;
  const labelEl = document.getElementById("git-cred-label") as HTMLInputElement | null;
  if (labelEl && !labelEl.value.trim()) labelEl.value = host;
  const secret = document.getElementById("git-cred-secret") as HTMLTextAreaElement | null;
  if (secret) { secret.value = ""; secret.placeholder = t("git.secretServerEdit", "Token requerido para actualizar la entrada del servidor"); }
  const submit = document.getElementById("git-cred-submit");
  if (submit) submit.textContent = t("git.btnUpdateServer", "Actualizar en el servidor");
  document.getElementById("git-cred-cancel")?.classList.remove("hidden");
  document.getElementById("git-cred-host")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function onGitDetectedClick(ev: Event): Promise<void> {
  const el = ev.target as HTMLElement | null;
  if (!el) return;
  if (el.closest("#git-cfg-save")) {
    const userName = (document.getElementById("git-cfg-name") as HTMLInputElement | null)?.value ?? "";
    const userEmail = (document.getElementById("git-cfg-email") as HTMLInputElement | null)?.value ?? "";
    await gitServerCall("/api/files/git/server/config", { userName, userEmail }, t("git.cfgSaved", "Identidad git actualizada"));
    return;
  }
  const edit = el.closest("[data-srv-https-edit]") as HTMLElement | null;
  if (edit) { startServerHttpsEdit(edit.getAttribute("data-host") || "", edit.getAttribute("data-user") || ""); return; }
  const del = el.closest("[data-srv-https-del]") as HTMLElement | null;
  if (del) {
    const host = del.getAttribute("data-host") || ""; const user = del.getAttribute("data-user") || "";
    if (!await openConfirm(t("git.confirmDelHttps", "¿Eliminar esta credencial HTTPS del servidor (~/.git-credentials)?"), { title: t("git.confirmDeleteTitle", "Eliminar credencial"), variant: "danger" })) return;
    if (gitServerEdit && gitServerEdit.matchHost === host) resetGitForm();
    await gitServerCall("/api/files/git/server/https/delete", { host, username: user || undefined }, t("git.deleted", "Credencial eliminada"));
    return;
  }
  const ssh = el.closest("[data-srv-ssh-del]") as HTMLElement | null;
  if (ssh) {
    const name = ssh.getAttribute("data-name") || "";
    if (!await openConfirm(t("git.confirmDelSsh", "Vas a ELIMINAR esta llave SSH del servidor. Es destructivo y puede romper accesos/deploys. ¿Continuar?"), { title: t("git.confirmDeleteTitle", "Eliminar credencial"), variant: "danger" })) return;
    await gitServerCall("/api/files/git/server/ssh/delete", { name }, t("git.deleted", "Llave eliminada"));
    return;
  }
  const gh = el.closest("[data-srv-gh-logout]") as HTMLElement | null;
  if (gh) {
    const host = gh.getAttribute("data-host") || "";
    if (!await openConfirm(t("git.confirmGhLogout", "¿Cerrar la sesión de GitHub CLI para este host?"), { title: t("git.ghLogout", "Cerrar sesión"), variant: "danger" })) return;
    await gitServerCall("/api/files/git/server/gh/logout", { host }, t("git.ghLoggedOut", "Sesión de gh cerrada"));
    return;
  }
}

export function bindGitCreds(): void {
  if (gitCredsBound) return;
  const form = document.getElementById("form-git-creds");
  const list = document.getElementById("git-creds-list");
  if (!form || !list) return;
  gitCredsBound = true;
  form.addEventListener("submit", (ev) => { ev.preventDefault(); void submitGitCred(); });
  list.addEventListener("click", (ev) => {
    const editBtn = (ev.target as HTMLElement | null)?.closest("[data-git-cred-edit]") as HTMLElement | null;
    if (editBtn) { startGitEdit(editBtn.getAttribute("data-git-cred-edit") || ""); return; }
    void onGitCredDelete(ev);
  });
  document.getElementById("git-detected")?.addEventListener("click", (ev) => { void onGitDetectedClick(ev); });
  document.getElementById("git-cred-cancel")?.addEventListener("click", () => resetGitForm());
}

export { loadGitCreds, loadGitDetected };
