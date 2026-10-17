// Cron page — classic cron jobs (list, dialog, bulk actions).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { awaitJob } from "/scripts/extracted/lib/job-poll.js?v=1";
import { confirmMutateReload } from "/scripts/extracted/lib/crud.js";
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
import { t, fmt, $, dlg, esc, norm, showToast, paginate, pagerHtml } from "./dom";
import { getTextFilter, onFilterChange } from "./text-filter";
import { setupBuilder, getSchedule, setScheduleAdvanced, resetBuilder } from "./schedule-builder";
import { openLogs } from "./logs";
import { openDialog } from "/scripts/extracted/lib/dom.js";
import { listClasses, wireListView } from "./list-view";

  let jobsPage = 1;
  (window as any).jobsGoPage = (p: number) => { jobsPage = p; renderJobs(); };

  // ---------------------------------------------------------------------------
  // Classic jobs
  // ---------------------------------------------------------------------------
  let jobs: any[] = [];

  // Bulk selection (mirror of the agents tab: selectedAgents + agents-bulk).
  const selectedJobs = new Set<string>();

  // Re-render (page 1) whenever the shared text filter changes. Registered here
  // so text-filter.ts never has to import this module (breaks the cycle).
  onFilterChange(() => { jobsPage = 1; renderJobs(); });

  const selectedLinuxUser = () => (($("cron-user") as HTMLSelectElement | null)?.value || "");
  const userQuery = () => selectedLinuxUser() ? `?user=${encodeURIComponent(selectedLinuxUser())}` : "";
  const jobUrl = (id: string) => `/api/cron/jobs/${encodeURIComponent(id)}`;

  function jobMatchesTextFilter(job: any): boolean {
    const textFilter = norm(($('jobs-filter') as HTMLInputElement | null)?.value || "");
    if (!textFilter) return true;
    return [job.comment, job.command, job.schedule, job.id].some((value) => norm(value).includes(textFilter));
  }

  export function visibleJobs(): any[] {
    return jobs.filter(jobMatchesTextFilter);
  }

  function updateJobsBulkBar() {
    const bar = $("jobs-bulk"); if (!bar) return;
    const n = selectedJobs.size;
    const cnt = $("jobs-bulk-count"); if (cnt) cnt.textContent = String(n);
    bar.classList.toggle("hidden", n === 0);
    bar.classList.toggle("flex", n > 0);
    syncJobsSelectAllState();
  }

  function syncJobsSelectAllState() {
    const all = $("jf-select-all") as HTMLInputElement | null;
    if (!all) return;
    const view = visibleJobs();
    const selected = view.filter((job) => selectedJobs.has(job.id)).length;
    all.checked = view.length > 0 && selected === view.length;
    all.indeterminate = selected > 0 && selected < view.length;
  }

  export async function loadJobs() {
    const res = await api.get<any>(`/api/cron/jobs${userQuery()}`);
    if (!res.ok) {
      const list = $("jobs-list");
      if (list) { list.textContent = res.error || t("toasts.error", "No se pudieron cargar las tareas"); list.className = "min-h-40 px-5 py-8 text-center text-sm text-destructive"; }
      return;
    }
    const list = $("jobs-list"); if (list) list.className = "min-h-40";
    jobs = (res.data as any[]) ?? [];
    // Drop selections that no longer exist (deleted elsewhere).
    for (const id of [...selectedJobs]) if (!jobs.some((j) => j.id === id)) selectedJobs.delete(id);
    updateJobsBulkBar();
    renderJobs();
  }

  export function renderJobs() {
    const el = $("jobs-list"); if (!el) return;
    if (jobs.length === 0) {
      el.innerHTML = `<div class="px-5 py-10 text-center text-sm text-muted-foreground"><i class="ti ti-clock-off mb-2 block text-3xl opacity-40"></i>${t("jobs.empty", "Sin tareas configuradas")}</div>`;
      syncJobsSelectAllState();
      return;
    }
    const view = visibleJobs();
    if (view.length === 0) {
      el.innerHTML = `<div class="px-5 py-10 text-center text-sm text-muted-foreground"><i class="ti ti-filter-off mb-2 block text-3xl opacity-40"></i>${t("jobs.noMatch", "Sin coincidencias con el filtro")}</div>`;
      syncJobsSelectAllState();
      return;
    }
    const pg = paginate(view, jobsPage);
    jobsPage = pg.page;
    const classes = listClasses("jobs");
    el.innerHTML = `<div role="list" class="${classes.collection}">` + pg.slice.map((j) => {
      const name = esc(j.comment || j.command);
      const logsBtn = j.managed ? `<button data-job-action="logs" data-id="${esc(j.id)}" class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="${t("actions.logs", "Registros")}"><i class="ti ti-file-text text-sm"></i></button>` : "";
      const managedBadge = j.managed
        ? `<span class="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-500">LUXIPANEL</span>`
        : "";
      return `
      <article role="listitem" class="${classes.entry}">
        <div class="flex min-w-0 items-start gap-3">
          <label class="flex cursor-pointer items-center pt-0.5">
          <input type="checkbox" aria-label="${name}" class="job-pick h-4 w-4 rounded border-input" data-id="${esc(j.id)}" ${selectedJobs.has(j.id) ? "checked" : ""} />
        </label>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="truncate text-sm font-semibold">${name}</span>
            <span class="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${j.enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}">${j.enabled ? t("jobs.statusActive", "Activo") : t("jobs.statusPaused", "Pausado")}</span>
            <span class="shrink-0 inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">${esc(j.user || selectedLinuxUser() || "")}</span>
            ${managedBadge}
          </div>
          <div class="${classes.schedule}">
            <span class="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 font-mono text-primary">${esc(j.schedule)}</span>
            <span class="truncate text-muted-foreground">${esc(j.id)}</span>
          </div>
        </div>
        </div>
        <div class="${classes.body}">
          <div class="${classes.label}">${t("jobs.labelCommand", "Comando")}</div>
          <code class="${el.dataset.view === "list" ? classes.text : "block break-all text-xs leading-5 text-foreground/90"}" title="${esc(j.command)}">${esc(j.command)}</code>
        </div>
        <div class="${classes.actions}">
          ${logsBtn}
          <button data-job-action="assistant" data-id="${esc(j.id)}" class="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary" title="${t("ai.sendJob", "Enviar al Asistente")}"><i class="ti ti-sparkles text-sm"></i></button>
          <button data-job-action="toggle" data-id="${esc(j.id)}" class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="${j.enabled ? t("actions.pause", "Pausar") : t("actions.activate", "Activar")}"><i class="ti ti-player-${j.enabled ? "pause" : "play"} text-sm"></i></button>
          <button data-job-action="clone" data-id="${esc(j.id)}" class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="${t("actions.clone", "Clonar")}"><i class="ti ti-copy text-sm"></i></button>
          <button data-job-action="edit" data-id="${esc(j.id)}" class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="${t("actions.edit", "Editar")}"><i class="ti ti-pencil text-sm"></i></button>
          <button data-job-action="delete" data-id="${esc(j.id)}" class="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="${t("actions.delete", "Eliminar")}"><i class="ti ti-trash text-sm"></i></button>
        </div>
      </article>`;
    }).join("") + `</div>` + pagerHtml(pg.page, pg.totalPages, pg.total, "jobsGoPage");
    syncJobsSelectAllState();
  }

  function openJobDialog(job?: any) {
    const ownerHint = $("job-owner-hint");
    if (ownerHint) ownerHint.textContent = `${t("settings.runAs", "Se ejecutará como")}: ${selectedLinuxUser() || ownerHint.dataset.defaultUser || "—"}`;
    ($("job-id") as HTMLInputElement).value = job?.id ?? "";
    ($("job-name") as HTMLInputElement).value = job?.comment || "";
    ($("job-command") as HTMLInputElement).value = job?.command || "";
    ($("job-enabled") as HTMLInputElement).checked = job ? !!job.enabled : true;
    // A clone passes job data WITHOUT id → "create" labels with prefilled form.
    $("job-dialog-title")!.textContent = job?.id ? t("jobs.titleEdit", "Editar tarea") : t("jobs.titleNew", "Nueva tarea cron");
    $("job-submit")!.textContent = job?.id ? t("jobs.btnSave", "Guardar") : t("jobs.btnCreate", "Crear tarea");
    $("job-error")!.classList.add("hidden");
    setupBuilder("job");
    if (job?.schedule) setScheduleAdvanced("job", job.schedule); else resetBuilder("job");
    openDialog("dialog-job");
  }

  (window as any).editJob = (id: string) => openJobDialog(jobs.find((j) => j.id === id));
  (window as any).cloneJob = (id: string) => {
    const src = jobs.find((j) => j.id === id); if (!src) return;
    openJobDialog({ ...src, id: "", comment: `${src.comment || src.command || ""} ${t("agents.copySuffix", "(copia)")}`.trim() });
  };
  // E-04: secuencia "confirmar → mutar → toast → awaitJob → recargar" compartida.
  (window as any).toggleJob = async (id: string) => {
    await confirmMutateReload({
      request: () => api.post(`${jobUrl(id)}/toggle${userQuery()}`, {}),
      toast: showToast,
      success: t("toasts.jobUpdated", "Tarea actualizada"),
      error: t("toasts.error", "Error"),
      reload: () => { loadJobs(); },
    });
  };
  (window as any).deleteJob = async (id: string, name: string) => {
    await confirmMutateReload({
      confirm: {
        message: fmt(t("confirm.deleteJob", "¿Eliminar la tarea \"{name}\"?"), { name }),
        options: { title: t("confirm.deleteJobTitle", "Eliminar tarea"), variant: "danger" },
      },
      request: () => api.delete(`${jobUrl(id)}${userQuery()}`),
      toast: showToast,
      success: t("toasts.jobDeleted", "Tarea eliminada"),
      error: t("toasts.deleteError", "Error al eliminar"),
      reload: () => { loadJobs(); },
    });
  };
  (window as any).viewJobLogs = (id: string, name: string) => openLogs("job", id, name, selectedLinuxUser());
  (window as any).sendJobToAssistant = (id: string) => {
    const job = jobs.find((item) => item.id === id);
    if (!job) return;
    const nextRuns = Array.isArray(job.nextRuns)
      ? job.nextRuns.filter(Boolean).map((item: unknown) => String(item)).join(", ") || t("ai.notAvailable", "No disponible")
      : String(job.nextRun ?? job.nextRunAt ?? job.next_run ?? t("ai.notAvailable", "No disponible"));
    const prompt = fmt(
      t(
        "ai.sendJobPrompt",
        "Analiza esta tarea cron del servidor conectado y explícame qué hace, cuándo se ejecuta, sus próximos runs si están disponibles y cualquier riesgo o mejora recomendable.\n\nNombre: {name}\nSchedule: {schedule}\nComando: {command}\nEstado: {status}\nPróximos runs: {nextRuns}",
      ),
      {
        name: job.comment || job.command || job.id,
        schedule: job.schedule || "—",
        command: job.command || "—",
        status: job.enabled ? t("jobs.statusActive", "Activo") : t("jobs.statusPaused", "Pausado"),
        nextRuns,
      },
    );
    requestAssistant({
      kind: "prompt",
      prompt,
      submit: "auto",
      conversation: "new",
      origin: { module: "cron", action: "sendJob" },
      target: { agentId: null, projectId: null },
    });
  };

  async function onJobSubmit(e: Event) {
    e.preventDefault();
    const errEl = $("job-error")!; errEl.classList.add("hidden");
    const id = ($("job-id") as HTMLInputElement).value;
    const schedule = getSchedule("job");
    const enabled = ($("job-enabled") as HTMLInputElement).checked;
    const body = {
      schedule,
      command: ($("job-command") as HTMLInputElement).value,
      comment: ($("job-name") as HTMLInputElement).value,
      ...(selectedLinuxUser() ? { user: selectedLinuxUser() } : {}),
    };
    if (!schedule) { errEl.textContent = t("errors.scheduleRequired", "Define un horario válido."); errEl.classList.remove("hidden"); return; }
    const res = id ? await api.put<any>(jobUrl(id), body) : await api.post<any>("/api/cron/jobs", body);
    if (!res.ok) { errEl.textContent = res.error ?? t("errors.saveFailed", "Error al guardar"); errEl.classList.remove("hidden"); return; }
    // Reconcile enabled state. Track the last queue-backed response so we poll
    // the FINAL job before reloading (cron/jobs is write-behind).
    let lastRes: any = res;
    if (id) {
      const prev = jobs.find((j) => j.id === id);
      if (prev && prev.enabled !== enabled) { await awaitJob(lastRes); lastRes = await api.post(`${jobUrl(id)}/toggle${userQuery()}`, {}); }
    } else if (!enabled && (res.data as any)?.id) {
      await awaitJob(lastRes); lastRes = await api.post(`${jobUrl((res.data as any).id)}/toggle${userQuery()}`, {});
    }
    dlg("dialog-job")!.close();
    showToast(id ? t("toasts.jobSaved", "Tarea guardada") : t("toasts.jobCreated", "Tarea creada"));
    await awaitJob(lastRes);
    loadJobs();
  }

  export function wireJobs() {
    wireListView("jobs", renderJobs);
    $("cron-user")?.addEventListener("change", () => { selectedJobs.clear(); jobsPage = 1; void loadJobs(); });
    $("jobs-filter")?.addEventListener("input", () => { jobsPage = 1; renderJobs(); });
    $("jobs-list")?.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("[data-job-action]");
      if (!button?.dataset.id) return;
      const id = button.dataset.id;
      const job = jobs.find((item) => item.id === id);
      const name = job?.comment || job?.command || id;
      const actions: Record<string, () => void> = {
        logs: () => (window as any).viewJobLogs(id, name), assistant: () => (window as any).sendJobToAssistant(id),
        toggle: () => void (window as any).toggleJob(id), clone: () => (window as any).cloneJob(id),
        edit: () => (window as any).editJob(id), delete: () => void (window as any).deleteJob(id, name),
      };
      actions[button.dataset.jobAction || ""]?.();
    });
    $("btn-new-job")?.addEventListener("click", () => openJobDialog());
    $("job-close")?.addEventListener("click", () => dlg("dialog-job")!.close());
    $("job-cancel")?.addEventListener("click", () => dlg("dialog-job")!.close());
    $("form-job")?.addEventListener("submit", onJobSubmit);

    // Bulk selection + quick actions — classic jobs
    $("jobs-list")?.addEventListener("change", (e) => {
      const cb = e.target as HTMLInputElement;
      if (!cb?.classList?.contains("job-pick")) return;
      if (cb.checked) selectedJobs.add(cb.dataset.id!); else selectedJobs.delete(cb.dataset.id!);
      updateJobsBulkBar();
    });
    $("jf-select-all")?.addEventListener("change", () => {
      const on = ($("jf-select-all") as HTMLInputElement).checked;
      selectedJobs.clear();
      if (on) visibleJobs().forEach((j) => selectedJobs.add(j.id));
      updateJobsBulkBar();
      renderJobs();
    });
    // Enable/pause: the jobs API only exposes /toggle, so flip ONLY the jobs
    // whose current state differs from the target (idempotent bulk action).
    const bulkSetJobsEnabled = async (enabled: boolean) => {
      const ids = [...selectedJobs]; if (!ids.length) return;
      const targets = jobs.filter((j) => ids.includes(j.id) && !!j.enabled !== enabled);
      let lastRes: any = null;
      for (const j of targets) { lastRes = await api.post(`${jobUrl(j.id)}/toggle${userQuery()}`, {}); if (!lastRes.ok) { showToast(lastRes.error || t("toasts.error", "Error"), false); break; } await awaitJob(lastRes); }
      showToast(t("toasts.jobsUpdated", "Tareas actualizadas"));
      // cron/jobs is write-behind: wait for the last enqueued job to apply.
      await awaitJob(lastRes);
      loadJobs();
    };
    $("jobs-bulk-enable")?.addEventListener("click", () => void bulkSetJobsEnabled(true));
    $("jobs-bulk-pause")?.addEventListener("click", () => void bulkSetJobsEnabled(false));
    $("jobs-bulk-delete")?.addEventListener("click", async () => {
      const ids = [...selectedJobs]; if (!ids.length) return;
      if (!await openConfirm(fmt(t("confirm.deleteJobs", "¿Eliminar {n} tarea(s) seleccionada(s)?"), { n: ids.length }), { title: t("confirm.deleteJobsTitle", "Eliminar tareas"), variant: "danger" })) return;
      let lastRes: any = null;
      for (const id of ids) { lastRes = await api.delete(`${jobUrl(id)}${userQuery()}`); if (!lastRes.ok) { showToast(lastRes.error || t("toasts.deleteError", "Error al eliminar"), false); break; } await awaitJob(lastRes); }
      selectedJobs.clear();
      const allJobs = $("jf-select-all") as HTMLInputElement | null; if (allJobs) allJobs.checked = false;
      updateJobsBulkBar();
      showToast(t("toasts.jobsDeleted", "Tareas eliminadas"));
      // cron/jobs is write-behind: wait for the last enqueued delete to apply.
      await awaitJob(lastRes);
      loadJobs();
    });
    $("jobs-bulk-clear")?.addEventListener("click", () => {
      selectedJobs.clear();
      const allJobs = $("jf-select-all") as HTMLInputElement | null; if (allJobs) allJobs.checked = false;
      updateJobsBulkBar();
      renderJobs();
    });
  }
