// Cron page — AI agent jobs (state, list, filters/sort, dialog, submit).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { escapeJsAttr } from "/scripts/extracted/lib/escape.js";
import { t, fmt, $, dlg, esc, norm, showToast, paginate, pagerHtml } from "./dom";
import { PROVIDER_MODELS, PROVIDER_LABELS } from "./providers";
import { setupBuilder, getSchedule, getFreq, setScheduleNone, setScheduleAdvanced, resetBuilder } from "./schedule-builder";
import { getTextFilter, setTextFilter, onFilterChange } from "./text-filter";
import {
  tagNamesFor, fillCategorySelect, fillTagsSelect, fillRulesPresetSelect,
  selectedDialogTags, checkedRuleIds, tagChipCls,
} from "./agent-presets";
import { updateBulkBar, refreshBulkSelectors, syncAgentsSelectAllState, selectedAgents } from "./agent-bulk";
import { openLogs } from "./logs";
import { openDialog } from "/scripts/extracted/lib/dom.js";
import { listClasses, wireListView } from "./list-view";

  // ---------------------------------------------------------------------------
  // AI agent jobs
  // ---------------------------------------------------------------------------
  export let agents: any[] = [];
  export let projects: any[] = [];

  // Git projects detected by the Files module — option value = absolute path,
  // which becomes the agent's working directory. Multi-select: more than one
  // project ⇒ the task runs once PER project, independently.
  const checkedProjects = () =>
    Array.from(document.querySelectorAll<HTMLInputElement>("#agent-project input[type=checkbox]:checked")).map((i) => i.value);

  export async function loadProjects(selectedPaths?: string[]) {
    try {
      const res = await api.get<any>("/api/files/projects");
      projects = res.ok ? ((res.data as any[]) ?? []) : [];
    } catch { projects = []; }
    const box = $("agent-project");
    if (!box) return;
    const current = selectedPaths ?? checkedProjects();
    // Keep stored paths selectable even if the scan no longer returns them.
    const items: any[] = [...projects];
    for (const path of current) {
      if (!projects.some((p) => p.path === path)) items.push({ path, name: path });
    }
    box.innerHTML = items.length
      ? items.map((p) => `
        <label class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/40">
          <input type="checkbox" value="${esc(p.path)}" ${current.includes(p.path) ? "checked" : ""} class="h-3.5 w-3.5 shrink-0 rounded border-input" />
          <span class="min-w-0 truncate text-sm">${esc(p.name)}${p.branch ? ` <span class="text-xs text-muted-foreground">(${esc(p.branch)})</span>` : ""} <span class="text-xs text-muted-foreground">— ${esc(p.path)}</span></span>
        </label>`).join("")
      : `<div class="px-2 py-1.5 text-xs text-muted-foreground">${esc((box as HTMLElement).dataset.empty || "—")}</div>`;
  }

  /** Selected project paths of a job (new array field, legacy single fallback). */
  export const agentPaths = (a: any): string[] =>
    a?.projectPaths?.length ? a.projectPaths : (a?.projectPath ? [a.projectPath] : []);

  function agentMatchesTextFilter(agent: any): boolean {
    const textFilter = getTextFilter();
    if (!textFilter) return true;
    const nextName = agent.nextJobId ? agents.find((item) => item.id === agent.nextJobId)?.name : "";
    return [
      agent.name,
      agent.providerId,
      PROVIDER_LABELS[agent.providerId] ?? agent.providerId,
      agent.model,
      agent.category,
      agent.schedule,
      agent.prompt,
      agent.rules,
      agent.lastStatus,
      nextName,
      ...(agent.tags ?? []),
      ...agentPaths(agent),
    ].some((value) => norm(value).includes(textFilter));
  }

  export function visibleAgents(): any[] {
    return sortAgentsView(applyAgentFilters(agents).filter(agentMatchesTextFilter));
  }

  // Other scheduled agents — chained via nextJobId when this one finishes.
  function fillNextOptions(agent?: any) {
    const sel = $("agent-next") as HTMLSelectElement | null;
    if (!sel) return;
    const others = agents.filter((a) => a.id !== agent?.id);
    const noneLabel = t("chain.none", "No encadenar");
    sel.innerHTML = `<option value="">${esc(noneLabel)}</option>` + others.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");
    sel.value = agent?.nextJobId && others.some((a) => a.id === agent.nextJobId) ? agent.nextJobId : "";
  }

  function fillProviders() {
    const psel = $("agent-provider") as HTMLSelectElement;
    if (psel.options.length === 0) {
      psel.innerHTML = Object.keys(PROVIDER_MODELS).map((p) => `<option value="${p}">${PROVIDER_LABELS[p]}</option>`).join("");
      psel.addEventListener("change", () => fillModels(psel.value));
    }
  }
  function fillModels(provider: string, selected?: string) {
    const msel = $("agent-model") as HTMLSelectElement;
    const list = PROVIDER_MODELS[provider] ?? [];
    msel.innerHTML = `<option value="">${t("models.default", "Modelo por defecto")}</option>` + list.map((m) => `<option value="${m}" ${m === selected ? "selected" : ""}>${m}</option>`).join("");
    if (selected && !list.includes(selected)) {
      const o = document.createElement("option"); o.value = selected; o.textContent = selected; o.selected = true; msel.appendChild(o);
    }
  }

  // Saved assistant agents (custom CLI-subagent style) for the optional selector.
  let savedAgents: Array<{ id: string; name: string; providerId: string; model: string }> = [];
  async function fillSavedAgents(selectedId?: string) {
    const sel = $("agent-saved") as HTMLSelectElement | null;
    if (!sel) return;
    if (savedAgents.length === 0) {
      try {
        const res = await api.get<any>("/api/ai/agents");
        if (res.ok && Array.isArray((res.data as any)?.agents)) savedAgents = (res.data as any).agents;
      } catch { /* ignore — selector stays "none" */ }
    }
    const none = t("agentDialog.savedAgentNone", "Sin agente (manual)");
    sel.innerHTML = `<option value="">${esc(none)}</option>` +
      savedAgents.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");
    sel.value = selectedId && savedAgents.some((a) => a.id === selectedId) ? selectedId : "";
    // Selecting an agent prefills provider/model (its prompt + tools apply at run time).
    if (!(sel as any)._wired) {
      sel.addEventListener("change", () => {
        const a = savedAgents.find((x) => x.id === sel.value);
        if (!a) return;
        const psel = $("agent-provider") as HTMLSelectElement;
        psel.value = a.providerId || "claude";
        fillModels(psel.value, a.model || "");
      });
      (sel as any)._wired = true;
    }
  }

  export async function loadAgents() {
    const res = await api.get<any>("/api/cron/ai-jobs");
    const el = $("agents-list")!;
    if (!res.ok) { el.innerHTML = `<div class="px-5 py-8 text-center text-sm text-destructive">${t("toasts.loadError", "Error al cargar")}</div>`; return; }
    agents = (res.data as any[]) ?? [];
    // Drop selections that no longer exist (deleted elsewhere).
    for (const id of [...selectedAgents]) if (!agents.some((a) => a.id === id)) selectedAgents.delete(id);
    updateBulkBar();
    refreshFilterOptions();
    refreshBulkSelectors();
    renderAgents();
  }

  // ── Filters + sorting (client-side over the loaded list) ─────────────────
  const fval = (id: string) => ($(id) as HTMLSelectElement | null)?.value ?? "";

  /** Repopulate the dynamic filter selects (category/tag/project) + the dialog's category datalist. */
  export function refreshFilterOptions() {
    const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((x, y) => x.localeCompare(y));
    const fill = (id: string, values: string[]) => {
      const sel = $(id) as HTMLSelectElement | null; if (!sel) return;
      const cur = sel.value;
      const first = sel.options[0]?.outerHTML ?? `<option value=""></option>`;
      sel.innerHTML = first + values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
      sel.value = values.includes(cur) ? cur : "";
    };
    fill("af-category", uniq(agents.map((a) => a.category)));
    fill("af-tag", tagNamesFor(fval("af-category")));
    fill("af-project", uniq(agents.flatMap(agentPaths)));
  }

  function applyAgentFilters(list: any[]): any[] {
    const cat = fval("af-category"), tag = fval("af-tag"), proj = fval("af-project");
    const mode = fval("af-mode"), sched = fval("af-schedule"), chain = fval("af-chain"), st = fval("af-status");
    return list.filter((a) => {
      if (cat && (a.category || "") !== cat) return false;
      if (tag && !(a.tags ?? []).includes(tag)) return false;
      if (proj && !agentPaths(a).includes(proj)) return false;
      if (mode === "multi" && a.agentMode !== "multi") return false;
      if (mode === "single" && a.agentMode === "multi") return false;
      if (sched === "scheduled" && !a.schedule) return false;
      if (sched === "unscheduled" && a.schedule) return false;
      if (chain === "chained" && !a.nextJobId) return false;
      if (chain === "not-chained" && a.nextJobId) return false;
      if (st === "enabled" && !a.enabled) return false;
      if (st === "paused" && a.enabled) return false;
      if (st === "running" && !a.running) return false;
      if (st === "ok" && a.lastStatus !== "ok") return false;
      if (st === "error" && a.lastStatus !== "error") return false;
      if (st === "never" && a.lastRunAt) return false;
      return true;
    });
  }

  function sortAgentsView(list: any[]): any[] {
    const mode = fval("af-sort") || "created";
    const arr = [...list];
    if (mode === "name") arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else if (mode === "lastrun") arr.sort((a, b) => (b.lastRunAt || "").localeCompare(a.lastRunAt || ""));
    else arr.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return arr;
  }

  export function renderAgents() {
    const el = $("agents-list"); if (!el) return;
    if (agents.length === 0) {
      el.innerHTML = `<div class="px-5 py-10 text-center text-sm text-muted-foreground"><i class="ti ti-robot mb-2 block text-3xl opacity-40"></i>${t("agents.empty", "Sin jobs configurados")}</div>`;
      syncAgentsSelectAllState();
      return;
    }
    const view = visibleAgents();
    if (view.length === 0) {
      el.innerHTML = `<div class="px-5 py-10 text-center text-sm text-muted-foreground"><i class="ti ti-filter-off mb-2 block text-3xl opacity-40"></i>${t("agents.noMatch", "Sin coincidencias con los filtros")}</div>`;
      syncAgentsSelectAllState();
      return;
    }
    const pg = paginate(view, agentsPage);
    agentsPage = pg.page;
    const classes = listClasses("agents");
    el.innerHTML = `<div role="list" class="${classes.collection}">` + pg.slice.map((a) => {
      const statusDot = a.running ? `<span class="text-amber-500">${t("agents.statusRunning", "● en ejecución")}</span>`
        : a.lastStatus === "ok" ? `<span class="text-emerald-500">${t("agents.statusOk", "● último OK")}</span>`
        : a.lastStatus === "error" ? `<span class="text-destructive">${t("agents.statusError", "● último error")}</span>`
        : `<span class="text-muted-foreground">${t("agents.statusNever", "● sin ejecutar")}</span>`;
      const last = a.lastRunAt ? new Date(a.lastRunAt).toLocaleString(document.documentElement.lang || "es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
      const nextName = a.nextJobId ? agents.find((x) => x.id === a.nextJobId)?.name : "";
      const chainBadge = nextName ? `<span class="text-muted-foreground"><i class="ti ti-arrow-ramp-right"></i> ${esc(nextName)}</span>` : "";
      const modeBadge = a.agentMode === "multi" ? `<span class="text-muted-foreground"><i class="ti ti-sitemap"></i> ${t("agents.multiAgentBadge", "multi-agente")}</span>` : "";
      const paths = agentPaths(a);
      const projBadge = paths.length ? `<span class="text-muted-foreground truncate"><i class="ti ti-folder-code"></i> ${esc(paths[0])}${paths.length > 1 ? ` +${paths.length - 1}` : ""}</span>` : "";
      const catBadge = a.category ? `<span class="text-muted-foreground"><i class="ti ti-category"></i> ${esc(a.category)}</span>` : "";
      const tagsBadge = (a.tags ?? []).length ? `<span class="text-muted-foreground">${(a.tags as string[]).map((t) => `#${esc(t)}`).join(" ")}</span>` : "";
      const prompt = esc((a.prompt || "").trim());
      return `
      <article role="listitem" class="${classes.entry}">
        <div class="flex min-w-0 items-start gap-3">
          <label class="flex cursor-pointer items-center pt-0.5">
          <input type="checkbox" aria-label="${esc(a.name)}" class="agent-pick h-4 w-4 rounded border-input" data-id="${esc(a.id)}" ${selectedAgents.has(a.id) ? "checked" : ""} />
        </label>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="truncate text-sm font-semibold">${esc(a.name)}</span>
            <span class="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${a.enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}">${a.enabled ? t("jobs.statusActive", "Activo") : t("jobs.statusPaused", "Pausado")}</span>
          </div>
          <div class="${classes.schedule}">
            ${a.schedule ? `<span class="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 font-mono text-primary">${esc(a.schedule)}</span>` : `<span class="inline-flex items-center rounded-full bg-muted px-2 py-1 text-muted-foreground"><i class="ti ti-hand-click mr-1"></i>${t("agents.noSchedule", "sin programación")}</span>`}
            <span class="text-muted-foreground">${PROVIDER_LABELS[a.providerId] ?? a.providerId}${a.model ? " · " + esc(a.model) : ""}</span>
            ${modeBadge}
          </div>
        </div>
        </div>
        <div class="${classes.body}">
          <div class="${classes.label}">${t("agents.labelInstructions", "Instrucciones")}</div>
          <p class="${classes.text}" title="${prompt}">${prompt || t("agents.noInstructions", "Sin instrucciones adicionales")}</p>
          <div class="${classes.metadata}">
            ${projBadge}
            ${catBadge}
            ${tagsBadge}
            ${chainBadge}
            <span>${statusDot}</span>
            <span class="text-muted-foreground">${last}</span>
          </div>
        </div>
        <div class="${classes.actions}">
          <button onclick="runAgent('${escapeJsAttr(a.id)}')" class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="${t("actions.runNow", "Ejecutar ahora")}"><i class="ti ti-player-play text-sm"></i></button>
          <button onclick="viewAgentLogs('${escapeJsAttr(a.id)}','${escapeJsAttr(a.name)}')" class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="${t("actions.logs", "Registros")}"><i class="ti ti-file-text text-sm"></i></button>
          <button onclick="toggleAgent('${escapeJsAttr(a.id)}')" class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="${a.enabled ? t("actions.pause", "Pausar") : t("actions.activate", "Activar")}"><i class="ti ti-player-${a.enabled ? "pause" : "play"} text-sm"></i></button>
          <button onclick="cloneAgent('${escapeJsAttr(a.id)}')" class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="${t("actions.clone", "Clonar")}"><i class="ti ti-copy text-sm"></i></button>
          <button onclick="editAgent('${escapeJsAttr(a.id)}')" class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="${t("actions.edit", "Editar")}"><i class="ti ti-pencil text-sm"></i></button>
          <button onclick="deleteAgent('${escapeJsAttr(a.id)}','${escapeJsAttr(a.name)}')" class="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="${t("actions.delete", "Eliminar")}"><i class="ti ti-trash text-sm"></i></button>
        </div>
      </article>`;
    }).join("") + `</div>` + pagerHtml(pg.page, pg.totalPages, pg.total, "agentsGoPage");
    syncAgentsSelectAllState();
  }

  function openAgentDialog(agent?: any) {
    fillProviders();
    ($("agent-id") as HTMLInputElement).value = agent?.id ?? "";
    ($("agent-name") as HTMLInputElement).value = agent?.name || "";
    ($("agent-provider") as HTMLSelectElement).value = agent?.providerId || "claude";
    fillModels(agent?.providerId || "claude", agent?.model || "");
    void fillSavedAgents(agent?.agentId || "");
    void loadProjects(agentPaths(agent));
    fillNextOptions(agent);
    ($("agent-mode") as HTMLSelectElement).value = agent?.agentMode === "multi" ? "multi" : "single";
    fillCategorySelect(agent?.category || "");
    fillTagsSelect(agent?.tags ?? [], agent?.category || "");
    fillRulesPresetSelect(agent?.ruleIds ?? []);
    ($("agent-prompt") as HTMLTextAreaElement).value = agent?.prompt || "";
    ($("agent-rules") as HTMLTextAreaElement).value = agent?.rules || "";
    ($("agent-notify") as HTMLInputElement).checked = !!(agent?.notifyOwner || (agent?.notifyEmails ?? []).length);
    ($("agent-approval") as HTMLInputElement).checked = !!agent?.requireApproval;
    ($("agent-enabled") as HTMLInputElement).checked = agent ? !!agent.enabled : true;
    // A clone passes agent data WITHOUT id → "create" labels with prefilled form.
    $("agent-dialog-title")!.textContent = agent?.id ? t("agents.titleEdit", "Editar job") : t("agents.titleNew", "Nuevo cron job");
    $("agent-submit")!.textContent = agent?.id ? t("agents.btnSave", "Guardar") : t("agents.btnCreate", "Crear job");
    $("agent-error")!.classList.add("hidden");
    setupBuilder("agent");
    if (agent?.schedule) setScheduleAdvanced("agent", agent.schedule);
    else if (agent) setScheduleNone("agent");
    else resetBuilder("agent");
    openDialog("dialog-agent");
  }

  (window as any).editAgent = (id: string) => openAgentDialog(agents.find((a) => a.id === id));
  (window as any).cloneAgent = (id: string) => {
    const src = agents.find((a) => a.id === id); if (!src) return;
    openAgentDialog({ ...src, id: "", name: `${src.name} ${t("agents.copySuffix", "(copia)")}` });
  };
  (window as any).toggleAgent = async (id: string) => {
    const res = await api.post(`/api/cron/ai-jobs/${id}/toggle`, {});
    if (res.ok) { showToast(t("toasts.agentUpdated", "Agente actualizado")); loadAgents(); } else showToast(t("toasts.error", "Error"), false);
  };
  (window as any).deleteAgent = async (id: string, name: string) => {
    if (!await openConfirm(fmt(t("confirm.deleteAgent", "¿Eliminar el agente \"{name}\"?"), { name }), { title: t("confirm.deleteAgentTitle", "Eliminar agente"), variant: "danger" })) return;
    const res = await api.delete(`/api/cron/ai-jobs/${id}`);
    if (res.ok) { showToast(t("toasts.agentDeleted", "Agente eliminado")); loadAgents(); } else showToast(t("toasts.deleteError", "Error al eliminar"), false);
  };
  (window as any).runAgent = async (id: string) => {
    const res = await api.post<any>(`/api/cron/ai-jobs/${id}/run`, {});
    if (res.ok) { showToast((res.data as any)?.started === false ? t("toasts.agentRunning", "Ya está en ejecución") : t("toasts.agentStarted", "Ejecución iniciada")); setTimeout(loadAgents, 1500); }
    else showToast(t("toasts.runError", "Error al ejecutar"), false);
  };
  (window as any).viewAgentLogs = (id: string, name: string) => openLogs("agent", id, name);

  async function onAgentSubmit(e: Event) {
    e.preventDefault();
    const errEl = $("agent-error")!; errEl.classList.add("hidden");
    const id = ($("agent-id") as HTMLInputElement).value;
    const schedule = getSchedule("agent");
    // freq "none" = task without schedule: runs only via "run now" or chained
    // from another agent's nextJobId.
    if (!schedule && getFreq("agent") !== "none") { errEl.textContent = t("errors.scheduleRequired", "Define un horario válido."); errEl.classList.remove("hidden"); return; }
    const body = {
      name: ($("agent-name") as HTMLInputElement).value,
      schedule,
      providerId: ($("agent-provider") as HTMLSelectElement).value,
      model: ($("agent-model") as HTMLSelectElement).value,
      agentId: ($("agent-saved") as HTMLSelectElement).value || null,
      projectPaths: checkedProjects(),
      nextJobId: ($("agent-next") as HTMLSelectElement).value || null,
      agentMode: ($("agent-mode") as HTMLSelectElement).value,
      category: ($("agent-category") as HTMLSelectElement).value.trim(),
      tags: selectedDialogTags(),
      prompt: ($("agent-prompt") as HTMLTextAreaElement).value,
      rules: ($("agent-rules") as HTMLTextAreaElement).value,
      ruleIds: checkedRuleIds(),
      notifyOwner: ($("agent-notify") as HTMLInputElement).checked,
      requireApproval: ($("agent-approval") as HTMLInputElement).checked,
      enabled: ($("agent-enabled") as HTMLInputElement).checked,
    };
    const res = id ? await api.put<any>(`/api/cron/ai-jobs/${id}`, body) : await api.post<any>("/api/cron/ai-jobs", body);
    if (!res.ok) { errEl.textContent = res.error ?? t("errors.saveFailed", "Error al guardar"); errEl.classList.remove("hidden"); return; }
    dlg("dialog-agent")!.close();
    showToast(id ? t("toasts.agentSaved", "Job guardado") : t("toasts.agentCreated", "Job creado"));
    loadAgents();
  }

  let agentsPage = 1;
  (window as any).agentsGoPage = (p: number) => { agentsPage = p; renderAgents(); };

  // Re-render (page 1) whenever the shared text filter changes. Registered here
  // so text-filter.ts never has to import this module (breaks the cycle).
  onFilterChange(() => { agentsPage = 1; renderAgents(); });

  export function wireAgents() {
    wireListView("agents", renderAgents);
    $("btn-new-agent")?.addEventListener("click", () => openAgentDialog());
    $("agent-close")?.addEventListener("click", () => dlg("dialog-agent")!.close());
    $("agent-cancel")?.addEventListener("click", () => dlg("dialog-agent")!.close());
    $("form-agent")?.addEventListener("submit", onAgentSubmit);
    $("agents-filters")?.addEventListener("change", (e) => {
      const id = (e.target as HTMLElement).id;
      if (id === "af-select-all") return; // handled below
      // Tag options depend on the selected category.
      if (id === "af-category") {
        const tagSel = $("af-tag") as HTMLSelectElement | null;
        if (tagSel) {
          const first = tagSel.options[0]?.outerHTML ?? `<option value=""></option>`;
          const cur = tagSel.value;
          const tags = tagNamesFor(fval("af-category"));
          tagSel.innerHTML = first + tags.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
          tagSel.value = tags.includes(cur) ? cur : "";
        }
      }
      agentsPage = 1; renderAgents();
    });
    $("af-clear")?.addEventListener("click", () => {
      document.querySelectorAll<HTMLSelectElement>("#agents-filters select").forEach((s) => { s.selectedIndex = 0; });
      agentsPage = 1;
      renderAgents();
    });
    const filterInput = $("cron-text-filter") as HTMLInputElement | null;
    filterInput?.addEventListener("input", () => setTextFilter(filterInput.value));
    $("cron-text-clear")?.addEventListener("click", () => setTextFilter(""));

    // Dialog: tag chips toggle on click; their options follow the category.
    $("agent-tags")?.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tag]");
      if (!b) return;
      const on = b.dataset.on !== "1";
      b.dataset.on = on ? "1" : "0";
      b.className = tagChipCls(on);
    });
    $("agent-category")?.addEventListener("change", () => {
      fillTagsSelect(selectedDialogTags(), ($("agent-category") as HTMLSelectElement).value);
    });
  }
