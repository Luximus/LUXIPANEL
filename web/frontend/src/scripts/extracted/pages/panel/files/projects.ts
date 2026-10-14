// Files page — projects submodule (code-move from index-script1.ts; no behavior change).
import { updateGitButtonState } from "./git";
import { fmt, t } from "./i18n";
import { filterProjects, renderFiles } from "./listing";
import { escapeHtml, getSearchQuery } from "./paths";
import { S, gitRepoCache } from "./state";
import { showToast } from "./toast";
import { applyFilesMode } from "./tools";
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";


  // ── Projects ───────────────────────────────────────────────
  export let isShowingProjectsInTree = false;

  export function refreshCurrentView() {
    if (S.viewMode === "projects") {
      if (S.currentProjects.length > 0) {
        renderProjects(S.currentProjects);
      } else {
        loadProjects();
      }
      return;
    }
    renderFiles(S.currentEntries);
    // A refresh may follow a git clone/init that changed repo membership.
    if (S.currentPath) { gitRepoCache.delete(S.currentPath); void updateGitButtonState(S.currentPath); }
  }

  export let projectsScanBusy = false;

  /** Toggle the four mutually-exclusive blocks of the projects view. */
  export function showProjectsState(state: "loading" | "empty" | "list") {
    document.getElementById("projects-loading")?.classList.toggle("hidden", state !== "loading");
    document.getElementById("projects-empty")?.classList.toggle("hidden", state !== "empty");
    document.getElementById("projects-toolbar")?.classList.toggle("hidden", state !== "list");
    document.getElementById("projects-container")?.classList.toggle("hidden", state !== "list");
  }

  /** During a scan, disable every scan trigger to prevent double-runs. */
  export function updateProjectsControls() {
    for (const id of ["btn-scan-projects", "btn-projects-rescan", "btn-projects-scan-cta"]) {
      const b = document.getElementById(id) as HTMLButtonElement | null;
      if (b) b.disabled = projectsScanBusy;
    }
  }

  // Toolbar buttons that don't apply to the projects view — hidden there. The
  // whole #files-main-toolbar row is display:none inside the projects view (see
  // setProjectsViewActive) and the in-view Reescanear (btn-projects-rescan) in
  // #projects-toolbar is the only rescan trigger; the old toolbar btn-rescan-d
  // was removed.
  export const PROJECTS_HIDDEN_BTNS = [
    "btn-view-list", "btn-view-grid", "btn-refresh",
    "btn-projects-d", "btn-new-file-d", "btn-project-map-d", "btn-git-d", "btn-compare-d", "btn-exposure-d", "btn-malware-d", "btn-history-d", "btn-upload-d", "btn-mkdir-d",
    "btn-files-actions-menu-trigger",
  ];

  /** Enter/leave the projects view: hide the non-applicable toolbar buttons and
   *  reveal the Reescanear button (and vice-versa). Uses inline style.display so
   *  it survives React re-renders (which reset className) and CSS-order quirks. */
  export function setProjectsViewActive(active: boolean) {
    for (const id of PROJECTS_HIDDEN_BTNS) {
      const el = document.getElementById(id);
      if (el) (el as HTMLElement).style.display = active ? "none" : "";
    }
    // Hide the whole general toolbar row in the projects view so no residual
    // row (hidden-toggle + Reescanear) sits on top of #projects-toolbar, which
    // brings its own Reescanear (btn-projects-rescan). Inline style survives
    // React re-renders. On the way back (active=false) the row reappears.
    const mainToolbar = document.getElementById("files-main-toolbar");
    if (mainToolbar) mainToolbar.style.display = active ? "none" : "";
    // Same for the mobile actions-menu "Rescanear" item: only inside projects.
    const rescanMenu = document.getElementById("btn-scan-projects") as HTMLElement | null;
    if (rescanMenu) rescanMenu.style.display = active ? "flex" : "none";
    // Re-assert client-mode gating (it overlaps some of the toggled buttons).
    if (!active) applyFilesMode();
  }

  export function renderProjects(projects: any[]) {
    const container = document.getElementById("projects-container");
    if (!container) return;
    if (!container.dataset.aiLinkBound) {
      container.dataset.aiLinkBound = "1";
      container.addEventListener("click", (event) => {
        const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-link-ai-path]");
        if (!target) return;
        void linkProjectToAssistant(target.dataset.linkAiPath || "");
      });
    }

    const normalized = filterProjects(projects);

    if (normalized.length === 0) {
      const query = getSearchQuery();
      const txt = document.getElementById("projects-empty-text");
      if (txt) txt.textContent = query
        ? fmt(t("empty.noProjectsForQuery", "No se encontraron proyectos para \"{query}\"."), { query })
        : t("empty.noProjects", "No se encontraron proyectos en este servidor.");
      container.innerHTML = "";
      showProjectsState("empty");
      updateProjectsControls();
      return;
    }

    const countEl = document.getElementById("projects-count");
    if (countEl) countEl.textContent = fmt(normalized.length === 1 ? t("labels.projectCountOne", "{n} proyecto") : t("labels.projectCountMany", "{n} proyectos"), { n: normalized.length });

    container.innerHTML = normalized.map((p: any) => {
      const url = typeof p.url === "string" ? p.url : "";
      const repoIcon = /github\.com/i.test(url) ? "ti-brand-github"
        : /gitlab\./i.test(url) ? "ti-brand-gitlab"
        : /bitbucket\./i.test(url) ? "ti-brand-bitbucket"
        : "ti-git-branch";
      const urlRow = url
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="block text-xs text-muted-foreground hover:text-foreground truncate mb-2" title="${escapeHtml(url)}">${escapeHtml(url.replace(/^https?:\/\//, "").replace(/\.git$/, ""))}</a>`
        : `<p class="text-xs text-muted-foreground/70 mb-2">${escapeHtml(t("labels.localRepo", "Repositorio local"))}</p>`;
      const desc = typeof p.description === "string" && p.description.trim()
        ? `<p class="text-xs text-muted-foreground/90 mb-3 line-clamp-2" title="${escapeHtml(p.description)}">${escapeHtml(p.description)}</p>`
        : "";
      return `
        <div class="flex flex-col rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-all">
          <div class="flex items-center gap-2 mb-1">
            <i class="ti ${repoIcon} text-lg ${repoIcon === "ti-brand-github" ? "" : "text-muted-foreground"} shrink-0"></i>
            <h3 class="font-semibold text-sm truncate">${escapeHtml(p.name ?? "")}</h3>
          </div>
          ${urlRow}
          ${desc}
          <div class="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
            ${p.branch ? `<span class="inline-flex items-center gap-1"><i class="ti ti-git-branch"></i>${escapeHtml(p.branch)}</span>` : ""}
            ${p.lastCommit ? `<span class="inline-flex items-center gap-1"><i class="ti ti-history"></i>${escapeHtml(String(p.lastCommit).split(" ")[0] ?? "")}</span>` : ""}
          </div>
          <button onclick="openProject('${p.path}')" class="mt-auto w-full rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium py-2 transition-colors">
            <i class="ti ti-folder mr-1"></i>${escapeHtml(t("actions.openFolder", "Abrir carpeta"))}
          </button>
          <button type="button" data-link-ai-path="${escapeHtml(p.path ?? "")}" class="mt-2 w-full rounded-lg border border-primary/30 px-2 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
            <i class="ti ti-robot mr-1" aria-hidden="true"></i>Vincular / abrir en Agentes IA
          </button>
        </div>`;
    }).join("");
    showProjectsState("list");
    updateProjectsControls();
  }

  async function linkProjectToAssistant(path: string): Promise<void> {
    if (!path.startsWith("/")) return;
    const targetId = resolveTargetScope();
    const fileProject = S.currentProjects.find((entry: any) => entry.path === path);
    if (!fileProject) return;
    const response = await api.get<{ ok: boolean; projects: Array<{ id: string; title: string; relation?: string; fileProjectRef?: { targetId: string; path: string } }> }>("/api/ai/projects");
    if (!response.ok) {
      showToast(response.error || t("runtime.projectLink.loadError", "No se pudieron cargar los proyectos IA."), false);
      return;
    }
    const list = response.data?.projects ?? [];
    const linked = list.find((project) => project.fileProjectRef?.targetId === targetId && project.fileProjectRef.path === path);
    if (linked) {
      window.location.href = `/panel?project=${encodeURIComponent(linked.id)}`;
      return;
    }
    const eligible = list.filter((project) => project.relation !== "shared" && !project.fileProjectRef);
    const creationKey = crypto.randomUUID();
    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-label", t("runtime.projectLink.title", "Vincular proyecto con Agentes IA"));
    dialog.innerHTML = `<div class="flex h-full flex-col"><header class="border-b border-border px-5 py-4"><h2 class="font-semibold">${escapeHtml(t("runtime.projectLink.title", "Vincular proyecto con Agentes IA"))}</h2><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(fileProject.name || path)}</p></header><form class="flex min-h-0 flex-1 flex-col gap-3 p-5"><label class="text-xs">${escapeHtml(t("runtime.projectLink.projectLabel", "Proyecto IA"))}<select name="project" class="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="">${escapeHtml(t("runtime.projectLink.createNew", "Crear proyecto IA nuevo"))}</option>${eligible.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.title)}</option>`).join("")}</select></label><p class="text-xs text-muted-foreground">${escapeHtml(t("runtime.projectLink.hint", "Se vinculará esta carpeta del servidor. El directorio de trabajo de un proyecto IA existente permanecerá igual."))}</p><p data-ai-link-error class="text-xs text-destructive" role="alert"></p><div class="mt-auto flex justify-end gap-2"><button type="button" data-cancel class="rounded-lg border border-border px-3 py-2 text-xs">${escapeHtml(t("runtime.projectLink.cancel", "Cancelar"))}</button><button type="submit" class="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">${escapeHtml(t("runtime.projectLink.linkOpen", "Vincular y abrir"))}</button></div></form></div>`;
    document.body.appendChild(dialog);
    const close = () => { dialog.close(); dialog.remove(); };
    dialog.querySelector("[data-cancel]")?.addEventListener("click", close);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.querySelector("form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const select = dialog.querySelector<HTMLSelectElement>("select[name=project]");
      const selected = select?.value || "";
      const error = dialog.querySelector<HTMLElement>("[data-ai-link-error]");
      const ref = { targetId, path };
      void (selected
        ? api.patch<{ ok: boolean; project: { id: string } }>(`/api/ai/projects/${encodeURIComponent(selected)}`, { fileProjectRef: ref })
        : api.post<{ ok: boolean; project: { id: string } }>("/api/ai/projects", { title: fileProject.name || path.split("/").pop() || t("runtime.projectLink.projectLabel", "Proyecto IA"), icon: "Folder", path, instructions: "", provider: "claude", fileProjectRef: ref, creationKey })
      ).then((result) => {
        const id = result.data?.project?.id;
        if (!result.ok || !id) throw new Error(t("runtime.projectLink.linkError", "No se pudo vincular el proyecto."));
        close();
        window.location.href = `/panel?project=${encodeURIComponent(id)}`;
      }).catch((cause) => { if (error) error.textContent = (cause as Error).message; });
    });
    dialog.showModal();
  }

  export async function loadProjects() {
    showProjectsState("loading");
    try {
      const res = await api.get<any>("/api/files/projects");
      const projects = res.data || [];
      S.currentProjects = Array.isArray(projects) ? projects : [];
      renderProjects(S.currentProjects);
    } catch {
      S.currentProjects = [];
      const txt = document.getElementById("projects-empty-text");
      if (txt) txt.textContent = t("toasts.loadProjectsError", "Error al cargar proyectos.");
      showProjectsState("empty");
      updateProjectsControls();
    }
  }

  /** Trigger a fresh scan on the server, then reload the list. Wired to the
   *  toolbar/menu rescan buttons, the in-view rescan, and the empty-state CTA. */
  export async function scanProjects() {
    if (projectsScanBusy) return;
    projectsScanBusy = true;
    updateProjectsControls();
    showProjectsState("loading");
    try {
      const res = await api.post("/api/files/scan-projects", {});
      const count = Number((res as any)?.data?.count ?? 0);
      showToast(fmt(count === 1 ? t("toasts.projectsFoundOne", "Se encontró {count} proyecto") : t("toasts.projectsFoundMany", "Se encontraron {count} proyectos"), { count }));
    } catch {
      showToast(t("toasts.scanProjectsError", "Error al escanear proyectos"), false);
    } finally {
      projectsScanBusy = false;
    }
    await loadProjects();
  }

  // ── System deps (banner ModuleDepsBanner module="files") ──────────────
  // archive (zip+unzip+tar) requerido; git y rsync opcionales. El navegador
  // sigue usable aunque falten: el banner solo informa e instala. Guardamos
  // qué deps faltaban para detectar la transición "faltaba → instalado"
  // (wasMissing) tras una instalación y refrescar el listado.
  export let filesDepsMissing: Set<string> | null = null;
  export function onFilesDepsStatus(status: { dependencies: Array<{ key: string; installed: boolean }> }): void {
    const missing = new Set(status.dependencies.filter((d) => !d.installed).map((d) => d.key));
    const prev = filesDepsMissing;
    filesDepsMissing = missing;
    const wasMissing = !!prev && [...prev].some((k) => !missing.has(k));
    if (!wasMissing) return;
    // Algo se instaló (p.ej. git): invalida el caché "¿es repo git?" (pudo
    // cachear false sin binario) y re-lista para reevaluar acciones.
    gitRepoCache.clear();
    if (S.currentPath) (window as any).navigate(S.currentPath, { skipHistory: true });
  }
