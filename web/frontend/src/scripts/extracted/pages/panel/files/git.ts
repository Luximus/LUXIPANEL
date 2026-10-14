// Files page — git submodule (code-move from index-script1.ts; no behavior change).
import { getEditorApi, showEditorView } from "./editor";
import { fmt, t } from "./i18n";
import { escapeAttr, escapeHtml } from "./paths";
import { filesCan } from "./perm-gating";
import { refreshCurrentView } from "./projects";
import { S, gitRepoCache, selected } from "./state";
import { showToast } from "./toast";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";


  // ── Git panel ("Git", #14 phase 1) ─────────────────────────
  export type GitStatusData = {
    isRepo: boolean; root: string | null; branch: string | null; head: string | null;
    ahead: number; behind: number;
    files: Array<{ path: string; x: string; y: string; staged: boolean; untracked: boolean }>;
    branches: string[];
  };
  export let gitState: { root: string; head: string | null } | null = null;
  // Working-tree change list + client-side filter/pagination state for the Git
  // modal. The full list comes from /git/status; filtering & paging are local.
  export let gitFiles: GitStatusData["files"] = [];
  export let gitFilter = { q: "", status: "", ext: "", page: 1 };
  export const GIT_PAGE_SIZE = 10;

  export async function openGitDialog() {
    const dlg = document.getElementById("dialog-git") as HTMLDialogElement | null;
    const scope = document.getElementById("git-scope");
    const body = document.getElementById("git-body");
    if (scope) scope.textContent = S.currentPath || "—";
    if (body) body.innerHTML = `<div class="px-2 py-6 text-center text-sm text-muted-foreground">${t("status.consultingGit", "Consultando estado…")}</div>`;
    if (dlg && !dlg.open) dlg.showModal();
    await loadGitStatus();
  }

  /** Enable the Git toolbar button only when the current folder (or an ancestor)
   *  is inside a git work-tree; otherwise disable it. The result per directory is
   *  cached for the session. No-op when the user lacks files.git (button hidden)
   *  or when running on the panel host. Fire-and-forget; never blocks nav. */
  export function applyGitButtonEnabled(inRepo: boolean) {
    for (const id of ["btn-git", "btn-git-d"]) {
      const btn = document.getElementById(id) as HTMLButtonElement | null;
      if (!btn) continue;
      btn.disabled = !inRepo;
      btn.classList.toggle("opacity-40", !inRepo);
      btn.classList.toggle("cursor-not-allowed", !inRepo);
      if (!inRepo) btn.setAttribute("title", t("labels.noGitRepo", "No hay un repositorio Git en esta carpeta ni en sus carpetas padre"));
      else btn.setAttribute("title", "Git");
    }
  }

  export async function updateGitButtonState(path: string) {
    if (!filesCan("files.git")) return; // button hidden anyway
    if (!path) { applyGitButtonEnabled(false); return; }
    const cached = gitRepoCache.get(path);
    if (cached !== undefined) { applyGitButtonEnabled(cached); return; }
    // Disable until we know, to avoid opening Git on a non-repo folder.
    applyGitButtonEnabled(false);
    const token = ++S.gitRepoNav;
    try {
      const res: any = await api.get("/api/files/git/in-repo", { params: { path } });
      const inRepo = !!(res?.ok && res.data?.inRepo);
      gitRepoCache.set(path, inRepo);
      if (token === S.gitRepoNav && S.currentPath === path) applyGitButtonEnabled(inRepo);
    } catch {
      // fail-open: leave enabled so a transient error doesn't lock Git out.
      if (token === S.gitRepoNav && S.currentPath === path) applyGitButtonEnabled(true);
    }
  }

  export async function loadGitStatus() {
    const body = document.getElementById("git-body");
    if (!body || !S.currentPath) return;
    const res: any = await api.get("/api/files/git/status", { params: { path: S.currentPath } });
    if (!res.ok) { body.innerHTML = `<div class="px-2 py-6 text-center text-sm text-destructive">${escapeHtml(res.error || t("status.error", "Error"))}</div>`; return; }
    renderGit(res.data as GitStatusData);
  }

  /** Stable, translation-independent status key used for filtering. */
  export function gitStatusKey(f: { x: string; y: string; untracked: boolean }): string {
    if (f.untracked) return "new";
    if (f.x === "A") return "added";
    if (f.x === "D" || f.y === "D") return "deleted";
    if (f.x === "R") return "renamed";
    return "modified";
  }

  export function gitStatusKeyLabel(k: string): string {
    switch (k) {
      case "new": return t("gitStatus.new", "nuevo");
      case "added": return t("gitStatus.added", "añadido");
      case "deleted": return t("gitStatus.deleted", "eliminado");
      case "renamed": return t("gitStatus.renamed", "renombrado");
      default: return t("gitStatus.modified", "modificado");
    }
  }

  export function gitStatusLabel(f: { x: string; y: string; untracked: boolean }): string {
    return gitStatusKeyLabel(gitStatusKey(f));
  }

  /** Lower-cased file extension (without the dot); "" for dotfiles / no ext. */
  export function gitFileExt(path: string): string {
    const base = path.split("/").pop() || path;
    const dot = base.lastIndexOf(".");
    if (dot <= 0) return "";
    return base.slice(dot + 1).toLowerCase();
  }

  export function gitFilteredFiles(): GitStatusData["files"] {
    const q = gitFilter.q.trim().toLowerCase();
    return gitFiles.filter((f) => {
      if (gitFilter.status && gitStatusKey(f) !== gitFilter.status) return false;
      if (gitFilter.ext !== "" && gitFileExt(f.path) !== gitFilter.ext) return false;
      if (q && !f.path.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  /** Search + status + extension filter bar (static; re-rendered only on
   *  full renderGit). Its inputs live OUTSIDE #git-changes so they keep focus. */
  export function gitToolbar(): string {
    const statuses = Array.from(new Set(gitFiles.map(gitStatusKey)));
    const exts = Array.from(new Set(gitFiles.map((f) => gitFileExt(f.path)))).sort();
    const statusOpts = [`<option value="">${t("git.filterAllStatus", "Todos los estados")}</option>`]
      .concat(statuses.map((k) => `<option value="${k}">${escapeHtml(gitStatusKeyLabel(k))}</option>`)).join("");
    const extOpts = [`<option value="">${t("git.filterAllTypes", "Todos los tipos")}</option>`]
      .concat(exts.map((e) => `<option value="${escapeHtml(e)}">${e ? "." + escapeHtml(e) : t("git.noExt", "(sin extensión)")}</option>`)).join("");
    const sel = "h-8 rounded-lg border border-input bg-background px-2 text-xs";
    return `
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <div class="relative min-w-[8rem] flex-1">
          <i class="ti ti-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"></i>
          <input id="git-search" type="text" autocomplete="off" placeholder="${t("git.searchPlaceholder", "Buscar archivo…")}" value="${escapeHtml(gitFilter.q)}" class="h-8 w-full rounded-lg border border-input bg-background pl-7 pr-2 text-xs" />
        </div>
        <select id="git-status-filter" class="${sel}">${statusOpts}</select>
        <select id="git-ext-filter" class="${sel}">${extOpts}</select>
      </div>`;
  }

  export function gitFileRow(f: GitStatusData["files"][number]): string {
    const label = gitStatusLabel(f);
    const color = f.untracked ? "text-emerald-600 dark:text-emerald-400" : (label === gitStatusKeyLabel("deleted") ? "text-destructive" : "text-amber-600 dark:text-amber-400");
    const da = `data-git-file="${escapeHtml(f.path)}"`;
    return `
      <div class="flex items-center justify-between gap-2 border-b border-border px-2 py-2 last:border-0">
        <span class="min-w-0 truncate font-mono text-xs"><span class="${color}">[${label}]</span> ${escapeHtml(f.path)}</span>
        <span class="flex shrink-0 gap-1">
          ${f.untracked ? "" : `<button type="button" data-git-action="file-diff" ${da} class="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-accent">${t("actions.diff", "Diff")}</button>`}
          <button type="button" data-git-action="file-discard" ${da} class="rounded-md border border-border px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10">${t("actions.discard", "Descartar")}</button>
        </span>
      </div>`;
  }

  /** Re-render ONLY the paginated change list (count header + rows + pager)
   *  inside #git-changes, so typing in the search box never loses focus. */
  export function renderGitChanges() {
    const container = document.getElementById("git-changes");
    if (!container) return;
    const filtered = gitFilteredFiles();
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / GIT_PAGE_SIZE));
    if (gitFilter.page > pages) gitFilter.page = pages;
    if (gitFilter.page < 1) gitFilter.page = 1;
    const start = (gitFilter.page - 1) * GIT_PAGE_SIZE;
    const pageFiles = filtered.slice(start, start + GIT_PAGE_SIZE);

    const countRow = `<div class="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5 text-xs text-muted-foreground">
      <span>${fmt(t("git.resultsCount", "{n} archivo(s)"), { n: total })}</span>
      ${total > 0 ? `<span>${fmt(t("git.showingRange", "{from}–{to} de {n}"), { from: start + 1, to: start + pageFiles.length, n: total })}</span>` : ""}
    </div>`;

    const listHtml = total === 0
      ? `<div class="px-2 py-4 text-center text-sm text-muted-foreground">${t("git.noMatches", "No hay archivos que coincidan con el filtro.")}</div>`
      : pageFiles.map(gitFileRow).join("");

    let pager = "";
    if (pages > 1) {
      const prevDis = gitFilter.page <= 1;
      const nextDis = gitFilter.page >= pages;
      const btn = (page: number, disabled: boolean, icon: string) =>
        `<button type="button" data-git-action="git-page" data-git-page="${page}" ${disabled ? "disabled" : ""} class="rounded-md border border-border px-2 py-1 text-xs ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-accent"}"><i class="ti ${icon}"></i></button>`;
      pager = `<div class="flex items-center justify-center gap-3 border-t border-border px-2 py-2">
        ${btn(gitFilter.page - 1, prevDis, "ti-chevron-left")}
        <span class="text-xs text-muted-foreground">${fmt(t("git.pageOf", "Página {p} de {t}"), { p: gitFilter.page, t: pages })}</span>
        ${btn(gitFilter.page + 1, nextDis, "ti-chevron-right")}
      </div>`;
    }

    container.innerHTML = countRow + `<div>${listHtml}</div>` + pager;
  }

  export function renderGit(s: GitStatusData) {
    const body = document.getElementById("git-body");
    if (!body) return;
    if (!s.isRepo) {
      body.innerHTML = `<div class="px-2 py-6 text-center text-sm text-muted-foreground">
        ${t("empty.notGitRepo", "Esta carpeta no es un repositorio Git.")}
        <div class="mt-3"><button type="button" data-git-action="open-clone" class="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"><i class="ti ti-git-fork text-sm"></i> ${t("actions.cloneHere", "Clonar un repositorio aquí")}</button></div>
      </div>`;
      gitState = null;
      return;
    }
    gitState = { root: s.root!, head: s.head };
    const branchOpts = (s.branches.length ? s.branches : [s.branch || "main"])
      .map((b) => `<option value="${escapeHtml(b)}" ${b === s.branch ? "selected" : ""}>${escapeHtml(b)}</option>`).join("");
    const aheadBehind = (s.ahead || s.behind)
      ? `<span class="text-xs text-muted-foreground">↑${s.ahead} ↓${s.behind}</span>` : "";
    const head = `
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="rounded-md bg-primary/15 px-2 py-1 text-xs font-semibold text-primary"><i class="ti ti-git-branch"></i> ${escapeHtml(s.branch || "—")}</span>
        ${aheadBehind}
        <select id="git-branch-select" class="h-8 rounded-lg border border-input bg-background px-2 text-xs">${branchOpts}</select>
        <button type="button" data-git-action="checkout" class="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">${t("actions.switchBranch", "Cambiar")}</button>
        <span class="mx-1 text-border">|</span>
        <input id="git-new-branch" type="text" placeholder="${t("placeholders.newBranch", "nueva-rama")}" class="h-8 w-32 rounded-lg border border-input bg-background px-2 text-xs" />
        <button type="button" data-git-action="branch" class="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">${t("actions.createBranch", "Crear rama")}</button>
      </div>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" data-git-action="pull" class="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"><i class="ti ti-arrow-down text-sm"></i> ${t("actions.pull", "Pull")}</button>
        <button type="button" data-git-action="push" class="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"><i class="ti ti-arrow-up text-sm"></i> ${t("actions.push", "Push")}</button>
        <button type="button" data-git-action="deploy" class="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent" title="${escapeAttr(t("git.deployTitle", "Cambia a la rama seleccionada y hace pull"))}"><i class="ti ti-rocket text-sm"></i> ${t("actions.deploy", "Deploy")}</button>
        <button type="button" data-git-action="open-clone" class="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"><i class="ti ti-git-fork text-sm"></i> ${t("actions.clone", "Clonar")}</button>
        <span id="git-creds-cta" class="ml-auto"></span>
      </div>`;

    const commitRow = `
      <div class="mb-3 flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
        <input id="git-commit-msg" type="text" placeholder="${t("placeholders.commitMsg", "Mensaje del commit…")}" class="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm" />
        <div class="flex items-center justify-between">
          <label class="flex items-center gap-2 text-xs text-muted-foreground"><input id="git-commit-all" type="checkbox" checked class="h-3.5 w-3.5 accent-primary" /> ${t("labels.includeAllChanges", "Incluir todos los cambios (add -A)")}</label>
          <div class="flex gap-2">
            <button type="button" data-git-action="discard-all" class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10">${t("actions.discardAll", "Descartar todo")}</button>
            <button type="button" data-git-action="commit" class="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">${t("actions.commit", "Commit")}</button>
          </div>
        </div>
      </div>`;

    // Reset filter/pagination state for the freshly loaded change set.
    gitFiles = s.files;
    gitFilter = { q: "", status: "", ext: "", page: 1 };

    let changesBlock: string;
    if (s.files.length === 0) {
      changesBlock = `<div class="rounded-xl border border-border"><div class="px-2 py-4 text-center text-sm text-emerald-600 dark:text-emerald-400">${t("empty.noGitChanges", "✓ Sin cambios en el árbol de trabajo.")}</div></div>`;
    } else {
      changesBlock = gitToolbar() + `<div id="git-changes" class="rounded-xl border border-border"></div>`;
    }
    body.innerHTML = head + commitRow + changesBlock;
    if (s.files.length > 0) renderGitChanges();
    void refreshGitCredsCta();
  }

  // Live search box → filter the change list (delegated; ignores the commit
  // message / new-branch inputs which also live inside #git-body).
  export function onGitBodyInput(ev: Event) {
    const el = ev.target as HTMLElement | null;
    if (el && el.id === "git-search") {
      gitFilter.q = (el as HTMLInputElement).value;
      gitFilter.page = 1;
      renderGitChanges();
    }
  }

  // Status / extension filter selects (delegated; ignores the branch select).
  export function onGitBodyChange(ev: Event) {
    const el = ev.target as HTMLElement | null;
    if (!el) return;
    if (el.id === "git-status-filter") {
      gitFilter.status = (el as HTMLSelectElement).value;
      gitFilter.page = 1;
      renderGitChanges();
    } else if (el.id === "git-ext-filter") {
      gitFilter.ext = (el as HTMLSelectElement).value;
      gitFilter.page = 1;
      renderGitChanges();
    }
  }

  export async function onGitBodyClick(ev: Event) {
    const target = (ev.target as HTMLElement | null)?.closest("[data-git-action]") as HTMLElement | null;
    if (!target) return;
    const action = target.getAttribute("data-git-action") || "";
    // "open-clone" works even when the folder isn't a repo yet.
    if (action === "open-clone") { openGitCloneDialog(); return; }
    // Pagination of the change list — purely client-side, no API call.
    if (action === "git-page") {
      const p = parseInt(target.getAttribute("data-git-page") || "1", 10);
      if (!Number.isNaN(p)) { gitFilter.page = p; renderGitChanges(); }
      return;
    }
    if (!gitState) return;
    const root = gitState.root;
    const file = target.getAttribute("data-git-file") || "";

    if (action === "deploy") {
      const branch = (document.getElementById("git-branch-select") as HTMLSelectElement | null)?.value || "";
      if (!branch) { showToast(t("toasts.selectBranch", "Selecciona una rama"), false); return; }
      const ok = await openConfirm(fmt(t("confirm.deployBranch", "¿Desplegar la rama \"{branch}\"? Cambia a esa rama y hace pull (fast-forward)."), { branch }), { title: t("confirm.deployTitle", "Deploy desde rama") });
      if (!ok) return;
      showToast(fmt(t("status.deploying", "Desplegando {branch}…"), { branch }));
      const res: any = await api.post("/api/files/git/deploy", { path: root, branch });
      if (res.ok) { showToast(res.data?.message?.slice(0, 80) || t("toasts.deployCompleted", "Deploy completado")); await loadGitStatus(); refreshCurrentView(); }
      else showToast(res.error?.slice(0, 120) || t("toasts.deployError", "No se pudo desplegar"), false);
      return;
    }

    if (action === "commit") {
      const msg = (document.getElementById("git-commit-msg") as HTMLInputElement | null)?.value?.trim() || "";
      const all = (document.getElementById("git-commit-all") as HTMLInputElement | null)?.checked ?? true;
      if (!msg) { showToast(t("toasts.enterCommitMsg", "Escribe un mensaje de commit"), false); return; }
      const res: any = await api.post("/api/files/git/commit", { path: root, message: msg, all });
      if (res.ok) { showToast(t("toasts.commitCreated", "Commit creado")); await loadGitStatus(); refreshCurrentView(); }
      else showToast(res.error || t("toasts.commitError", "No se pudo hacer commit"), false);
      return;
    }
    if (action === "discard-all") {
      const ok = await openConfirm(t("confirm.discardAll", "¿Descartar TODOS los cambios del árbol de trabajo? Es irreversible (vuelve a HEAD)."), { title: t("confirm.discardAllTitle", "Descartar todo"), variant: "danger" });
      if (!ok) return;
      const res: any = await api.post("/api/files/git/discard", { path: root });
      if (res.ok) { showToast(t("toasts.changesDiscarded", "Cambios descartados")); await loadGitStatus(); refreshCurrentView(); }
      else showToast(res.error || t("toasts.discardError", "No se pudo descartar"), false);
      return;
    }
    if (action === "file-discard") {
      const ok = await openConfirm(fmt(t("confirm.discardFile", "¿Descartar los cambios de \"{file}\"? Irreversible."), { file }), { title: t("confirm.discardFileTitle", "Descartar archivo"), variant: "danger" });
      if (!ok) return;
      const res: any = await api.post("/api/files/git/discard", { path: root, paths: [file] });
      if (res.ok) { showToast(t("toasts.changesDiscarded", "Cambios descartados")); await loadGitStatus(); refreshCurrentView(); }
      else showToast(res.error || t("toasts.discardError", "No se pudo descartar"), false);
      return;
    }
    if (action === "pull" || action === "push") {
      showToast(action === "pull" ? t("status.pulling", "Haciendo pull…") : t("status.pushing", "Haciendo push…"));
      const res: any = await api.post(`/api/files/git/${action}`, { path: root });
      if (res.ok) { showToast(res.data?.message?.slice(0, 80) || (action === "pull" ? t("toasts.pullCompleted", "Pull completado") : t("toasts.pushCompleted", "Push completado"))); await loadGitStatus(); refreshCurrentView(); }
      else showToast(res.error?.slice(0, 120) || fmt(t("toasts.gitActionError", "No se pudo {action}"), { action }), false);
      return;
    }
    if (action === "goto-creds") {
      goToGitCreds();
      return;
    }
    if (action === "checkout") {
      const branch = (document.getElementById("git-branch-select") as HTMLSelectElement | null)?.value || "";
      const res: any = await api.post("/api/files/git/checkout", { path: root, branch });
      if (res.ok) { showToast(fmt(t("toasts.branchSwitched", "Rama cambiada a {branch}"), { branch })); await loadGitStatus(); refreshCurrentView(); }
      else showToast(res.error || t("toasts.checkoutError", "No se pudo cambiar de rama"), false);
      return;
    }
    if (action === "branch") {
      const name = (document.getElementById("git-new-branch") as HTMLInputElement | null)?.value?.trim() || "";
      if (!name) { showToast(t("toasts.enterBranchName", "Indica el nombre de la rama"), false); return; }
      const res: any = await api.post("/api/files/git/branch", { path: root, branch: name });
      if (res.ok) { showToast(fmt(t("toasts.branchCreated", "Rama \"{name}\" creada"), { name })); await loadGitStatus(); }
      else showToast(res.error || t("toasts.branchError", "No se pudo crear la rama"), false);
      return;
    }
    if (action === "file-diff") {
      if (!gitState.head) { showToast(t("toasts.noHead", "Sin HEAD para comparar"), false); return; }
      const full = `${root.replace(/\/+$/, "")}/${file}`;
      const [showRes, curRes]: any[] = await Promise.all([
        api.get("/api/files/history/git-show", { params: { path: full, rev: gitState.head } }),
        api.get("/api/files/read", { params: { path: full } }),
      ]);
      const before = showRes.ok ? (showRes.data?.content ?? "") : "";
      const after = curRes.ok ? (typeof curRes.data === "string" ? curRes.data : curRes.data?.content ?? "") : "";
      await showEditorView();
      getEditorApi()?.openFile({ path: full, name: fmt(t("labels.headVsCurrent", "{file} (HEAD ↔ actual)"), { file }), content: after, originalContent: before });
      setTimeout(() => getEditorApi()?.openDiff(), 140);
    }
  }

  // ── Git credentials (#14) ──────────────────────────────────
  // La GESTIÓN de credenciales Git vive ahora en Ajustes → Credenciales. Aquí
  // sólo mostramos un acceso directo en el modal de Git: un CTA prominente
  // cuando NO hay credenciales activas, o un enlace discreto para gestionarlas
  // cuando ya existen. Ambos navegan a /panel/settings#cred-git.
  export function goToGitCreds() {
    window.location.assign("/panel/settings#cred-git");
  }

  export async function refreshGitCredsCta() {
    const cta = document.getElementById("git-creds-cta");
    if (!cta) return;
    let count = 0;
    let enabled = true;
    try {
      const res: any = await api.get("/api/files/git/credentials");
      if (res?.ok) {
        enabled = res.data?.enabled !== false;
        count = Array.isArray(res.data?.credentials) ? res.data.credentials.length : 0;
      }
    } catch { /* best-effort: treat as none configured */ }
    if (enabled && count > 0) {
      cta.innerHTML = `<button type="button" data-git-action="goto-creds" class="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"><i class="ti ti-key text-sm"></i> ${fmt(t("actions.manageCreds", "Credenciales ({n})"), { n: count })}</button>`;
    } else {
      cta.innerHTML = `<button type="button" data-git-action="goto-creds" class="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"><i class="ti ti-key text-sm"></i> ${t("actions.setupCreds", "Configurar credenciales")}</button>`;
    }
  }

  // ── Git clone ("Clonar repositorio", #14 phase 3) ──────────
  export function openGitCloneDialog() {
    const dlg = document.getElementById("dialog-git-clone") as HTMLDialogElement | null;
    const destEl = document.getElementById("git-clone-dest") as HTMLInputElement | null;
    // Default dest = current folder (the user appends the repo name).
    if (destEl && !destEl.value) destEl.value = S.currentPath ? `${S.currentPath.replace(/\/+$/, "")}/` : "";
    if (dlg && !dlg.open) dlg.showModal();
    setTimeout(() => (document.getElementById("git-clone-url") as HTMLInputElement | null)?.focus(), 40);
  }

  export async function submitGitClone() {
    const url = (document.getElementById("git-clone-url") as HTMLInputElement | null)?.value?.trim() || "";
    let dest = (document.getElementById("git-clone-dest") as HTMLInputElement | null)?.value?.trim() || "";
    const branch = (document.getElementById("git-clone-branch") as HTMLInputElement | null)?.value?.trim() || "";
    if (!url || !dest) { showToast(t("toasts.indicateUrlAndDest", "Indica URL y carpeta destino"), false); return; }
    // If dest ends with "/", append the repo name derived from the URL.
    if (dest.endsWith("/")) {
      const name = (url.split("/").pop() || "repo").replace(/\.git$/, "");
      dest = dest + name;
    }
    showToast(t("status.cloning", "Clonando…"));
    const res: any = await api.post("/api/files/git/clone", { url, dest, branch: branch || undefined });
    if (res.ok) {
      showToast(t("toasts.repoCloned", "Repositorio clonado"));
      (document.getElementById("dialog-git-clone") as HTMLDialogElement | null)?.close();
      if (res.data?.dest) (window as any).navigate(res.data.dest);
    } else {
      showToast(res.error?.slice(0, 140) || t("toasts.cloneError", "No se pudo clonar"), false);
    }
  }
