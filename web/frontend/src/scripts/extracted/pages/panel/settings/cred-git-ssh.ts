// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// GitHub · SSH manager (migrado desde el módulo repository-store) ─────────────
// Diagnostica/configura la llave SSH que un usuario Linux usa para git. Reusa
// los endpoints del módulo files (/api/files/git/ssh/*). El helper `api` ya
// inyecta CSRF y resuelve la ruta panel; `res.data` es el payload interno.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { escapeHtmlCred, t } from "./cred-dom";

type SshKeyRef = { path: string; name: string; hasPublic: boolean };
let gitSshKeys: SshKeyRef[] = [];
let gitSshBound = false;

function gitSshTargetUser(): string {
  return (document.getElementById("git-ssh-user") as HTMLSelectElement | null)?.value || "";
}

function gitSshStatus(id: string, msg: string, kind: "ok" | "err" | "info" = "info") {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("hidden", "text-emerald-600", "text-destructive", "text-muted-foreground");
  el.classList.add(kind === "ok" ? "text-emerald-600" : kind === "err" ? "text-destructive" : "text-muted-foreground");
  el.innerHTML = msg;
}

function gitSshKeyOptions(includeAuto: boolean): string {
  const auto = includeAuto ? `<option value="">${t("sshDialog.keyAutoOption", "Llave automática (agente / config)")}</option>` : "";
  return auto + gitSshKeys.map((k) => `<option value="${escapeHtmlCred(k.path)}">${escapeHtmlCred(k.name)}${k.hasPublic ? " (+.pub)" : ""}</option>`).join("");
}

function gitSshPopulateKeySelects() {
  const test = document.getElementById("git-ssh-test-key") as HTMLSelectElement | null;
  const cfg = document.getElementById("git-ssh-config-key") as HTMLSelectElement | null;
  const repo = document.getElementById("git-ssh-repo-key") as HTMLSelectElement | null;
  if (test) test.innerHTML = gitSshKeyOptions(true);
  if (cfg) cfg.innerHTML = gitSshKeys.length ? gitSshKeyOptions(false) : `<option value="">${t("sshDialog.sinLlavesDetectadas", "Sin llaves detectadas")}</option>`;
  if (repo) repo.innerHTML = gitSshKeys.length ? gitSshKeyOptions(false) : `<option value="">${t("sshDialog.sinLlavesDetectadas", "Sin llaves detectadas")}</option>`;
}

async function loadGitSshUsers() {
  const sel = document.getElementById("git-ssh-user") as HTMLSelectElement | null;
  if (!sel) return;
  const cur = sel.value;
  try {
    const res = await api.get<Array<{ user: string; home: string }>>("/api/files/git/ssh/users");
    const users = (res.ok && Array.isArray(res.data) ? res.data : []) as Array<{ user: string; home: string }>;
    sel.innerHTML = `<option value="">${t("sshDialog.usuarioActual", "Usuario actual")}</option>` +
      users.map((u) => `<option value="${escapeHtmlCred(u.user)}">${escapeHtmlCred(u.user)}</option>`).join("");
    sel.value = cur;
  } catch { /* keep "Usuario actual" */ }
}

async function loadGitSshConfig() {
  const box = document.getElementById("git-ssh-config-current");
  if (!box) return;
  try {
    const res = await api.get<any>("/api/files/git/ssh/config", { params: { user: gitSshTargetUser() } });
    const d: any = (res.ok ? res.data : null) ?? {};
    const hosts = (d.hosts ?? []) as Array<{ host: string; hostName?: string; identityFile?: string; identitiesOnly?: boolean }>;
    const gh = hosts.find((h) => /github\.com/i.test(h.host)) || hosts[0];
    if (gh) {
      box.innerHTML = `<span class="font-mono text-[11px]"><strong>Host ${escapeHtmlCred(gh.host)}</strong>${gh.identityFile ? ` → IdentityFile <span class="text-primary">${escapeHtmlCred(gh.identityFile)}</span>` : ""}${gh.identitiesOnly ? " · IdentitiesOnly yes" : ""}</span>`;
    } else {
      box.innerHTML = `<span class="text-muted-foreground">${t("sshDialog.sinBloqueHost", "Sin bloque <code>Host</code> en")} <span class="font-mono">${escapeHtmlCred(d.path || "~/.ssh/config")}</span></span>`;
    }
  } catch {
    box.innerHTML = `<span class="text-destructive">${t("sshDialog.configReadFailed", "No se pudo leer la config.")}</span>`;
  }
}

async function loadGitSshEnv() {
  const env = document.getElementById("git-ssh-env");
  const ls = document.getElementById("git-ssh-ls") as HTMLPreElement | null;
  if (!env) return;
  env.innerHTML = `<div class="text-muted-foreground">${t("sshDialog.inspeccionando", "Inspeccionando el servidor…")}</div>`;
  if (ls) ls.classList.add("hidden");
  try {
    const res = await api.get<any>("/api/files/git/ssh/env", { params: { user: gitSshTargetUser() } });
    const d: any = (res.ok ? res.data : null) ?? {};
    gitSshKeys = (d.keys ?? []) as SshKeyRef[];
    gitSshPopulateKeySelects();
    const keysHtml = gitSshKeys.length
      ? gitSshKeys.map((k) => `<span class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]"><i class="ti ti-key text-primary"></i>${escapeHtmlCred(k.name)}</span>`).join(" ")
      : `<span class="text-amber-600 dark:text-amber-400">${t("sshDialog.sinLlavesPrivadas", "Sin llaves privadas en <code>~/.ssh</code>")}</span>`;
    env.innerHTML = `
      <div class="flex flex-wrap gap-x-6 gap-y-1">
        <div><span class="text-muted-foreground">${t("sshDialog.conectado", "Conectado:")} </span> <strong>${escapeHtmlCred(d.connectedUser || "?")}</strong></div>
        <div><span class="text-muted-foreground">${t("sshDialog.objetivo", "Objetivo:")} </span> <strong>${escapeHtmlCred(d.targetUser || "?")}</strong></div>
        <div><span class="text-muted-foreground">HOME:</span> <span class="font-mono">${escapeHtmlCred(d.home || "?")}</span></div>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-1.5">${keysHtml}</div>`;
    if (ls && d.listing) { ls.textContent = d.listing; ls.classList.remove("hidden"); }
    void loadGitSshConfig();
  } catch {
    env.innerHTML = `<div class="text-destructive">${t("sshDialog.inspeccionFailed", "No se pudo inspeccionar el servidor.")}</div>`;
  }
}

async function runGitSshTest() {
  const btn = document.getElementById("git-ssh-test-btn") as HTMLButtonElement | null;
  const out = document.getElementById("git-ssh-test-result");
  if (!out) return;
  if (btn) btn.disabled = true;
  out.classList.remove("hidden");
  out.innerHTML = `<div class="px-4 py-3 text-xs text-muted-foreground">${t("sshDialog.conectando", "Conectando…")}</div>`;
  try {
    const res = await api.post<any>("/api/files/git/ssh/test", {
      user: gitSshTargetUser() || undefined,
      host: (document.getElementById("git-ssh-host") as HTMLInputElement).value.trim() || undefined,
      identityFile: (document.getElementById("git-ssh-test-key") as HTMLSelectElement).value || undefined,
      verbose: (document.getElementById("git-ssh-verbose") as HTMLInputElement).checked,
    });
    if (!res.ok) { out.innerHTML = `<div class="px-4 py-3 text-xs text-destructive">${escapeHtmlCred(res.error || t("sshDialog.testFailed", "Error al probar la conexión."))}</div>`; return; }
    const d: any = res.data ?? {};
    const badge = d.authenticated
      ? `<span class="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"><i class="ti ti-circle-check"></i> ${t("sshDialog.autenticado", "Autenticado")}${d.githubUser ? " · " + escapeHtmlCred(d.githubUser) : ""}</span>`
      : `<span class="inline-flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive"><i class="ti ti-circle-x"></i> ${t("sshDialog.noAutenticado", "No autenticado")}</span>`;
    out.innerHTML = `
      <div class="flex flex-wrap items-center gap-2 px-4 py-2.5">${badge}${d.keyUsed ? `<span class="text-xs text-muted-foreground">${t("sshDialog.llave", "llave:")} <span class="font-mono">${escapeHtmlCred(d.keyUsed)}</span></span>` : ""}</div>
      <pre class="max-h-48 overflow-auto border-t border-border px-4 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">${escapeHtmlCred(d.raw || "")}</pre>`;
  } catch {
    out.innerHTML = `<div class="px-4 py-3 text-xs text-destructive">${t("sshDialog.testFailed", "Error al probar la conexión.")}</div>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function saveGitSshConfig() {
  const key = (document.getElementById("git-ssh-config-key") as HTMLSelectElement).value;
  if (!key) { gitSshStatus("git-ssh-config-status", t("sshDialog.seleccionaLlave", "Selecciona una llave (IdentityFile)."), "err"); return; }
  const res = await api.post<any>("/api/files/git/ssh/config", {
    user: gitSshTargetUser() || undefined,
    hostName: (document.getElementById("git-ssh-config-hostname") as HTMLInputElement).value.trim() || undefined,
    identityFile: key,
  });
  if (!res.ok) { gitSshStatus("git-ssh-config-status", escapeHtmlCred(res.error || t("sshDialog.saveFailed", "No se pudo guardar.")), "err"); return; }
  gitSshStatus("git-ssh-config-status", `<i class="ti ti-check"></i> ${t("sshDialog.configEscrita", "Config escrita en")} <span class="font-mono">${escapeHtmlCred((res.data as any)?.path || "~/.ssh/config")}</span> ${t("sshDialog.permisosAjustadosSuffix", "(permisos ajustados).")}`, "ok");
  void loadGitSshConfig();
}

async function fixGitSshPerms() {
  const res = await api.post<any>("/api/files/git/ssh/fix-permissions", { user: gitSshTargetUser() || undefined });
  gitSshStatus("git-ssh-config-status", res.ok ? `<i class="ti ti-check"></i> ${t("sshDialog.permisosAjustados", "Permisos ajustados (700 ~/.ssh · 600 llaves/config · 644 .pub).")}` : escapeHtmlCred(res.error || t("sshDialog.permsFailed", "No se pudo ajustar.")), res.ok ? "ok" : "err");
}

async function readRepoSshCommand() {
  const repo = (document.getElementById("git-ssh-repo-path") as HTMLInputElement).value.trim();
  const box = document.getElementById("git-ssh-repo-current");
  if (!repo) { gitSshStatus("git-ssh-repo-status", t("sshDialog.indicaRuta", "Indica la ruta del repositorio."), "err"); return; }
  const res = await api.get<any>("/api/files/git/ssh/repo-key", { params: { path: repo, user: gitSshTargetUser() } });
  if (box) {
    box.classList.remove("hidden");
    const v = (res.ok ? res.data : null)?.value;
    box.textContent = v ? v : t("sshDialog.sinSshCommand", "(sin core.sshCommand — usa la config / agente)");
  }
}

async function applyRepoSshCommand(unset: boolean) {
  const repo = (document.getElementById("git-ssh-repo-path") as HTMLInputElement).value.trim();
  if (!repo) { gitSshStatus("git-ssh-repo-status", t("sshDialog.indicaRuta", "Indica la ruta del repositorio."), "err"); return; }
  const key = (document.getElementById("git-ssh-repo-key") as HTMLSelectElement).value;
  if (!unset && !key) { gitSshStatus("git-ssh-repo-status", t("sshDialog.seleccionaLlaveSimple", "Selecciona una llave."), "err"); return; }
  const res = await api.post<any>("/api/files/git/ssh/repo-key", {
    path: repo, user: gitSshTargetUser() || undefined, unset: unset || undefined, identityFile: unset ? undefined : key,
  });
  if (!res.ok) { gitSshStatus("git-ssh-repo-status", escapeHtmlCred(res.error || t("sshDialog.applyFailed", "No se pudo aplicar.")), "err"); return; }
  gitSshStatus("git-ssh-repo-status", unset ? `<i class="ti ti-check"></i> ${t("sshDialog.sshCommandEliminado", "core.sshCommand eliminado.")}` : `<i class="ti ti-check"></i> core.sshCommand = <span class="font-mono">${escapeHtmlCred((res.data as any)?.value || "")}</span>`, "ok");
  void readRepoSshCommand();
}

export function bindGitSsh(): void {
  if (gitSshBound) return;
  const dlgEl = document.getElementById("dlg-git-creds") as HTMLDialogElement | null;
  const openBtn = document.getElementById("btn-git-ssh-open");
  if (!dlgEl || !openBtn) return;
  gitSshBound = true;
  const dlg = () => document.getElementById("dlg-git-creds") as HTMLDialogElement | null;
  openBtn.addEventListener("click", () => {
    dlg()?.showModal();
    void loadGitSshUsers();
    void loadGitSshEnv();
  });
  document.getElementById("git-creds-close")?.addEventListener("click", () => dlg()?.close());
  document.getElementById("git-ssh-refresh")?.addEventListener("click", () => { void loadGitSshUsers(); void loadGitSshEnv(); });
  document.getElementById("git-ssh-user")?.addEventListener("change", () => void loadGitSshEnv());
  document.getElementById("git-ssh-test-btn")?.addEventListener("click", () => void runGitSshTest());
  document.getElementById("git-ssh-config-save")?.addEventListener("click", () => void saveGitSshConfig());
  document.getElementById("git-ssh-fixperms")?.addEventListener("click", () => void fixGitSshPerms());
  document.getElementById("git-ssh-repo-read")?.addEventListener("click", () => void readRepoSshCommand());
  document.getElementById("git-ssh-repo-apply")?.addEventListener("click", () => void applyRepoSshCommand(false));
  document.getElementById("git-ssh-repo-unset")?.addEventListener("click", () => void applyRepoSshCommand(true));
}
