import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
// Expo page — EAS builds: launch dialog, build history + external filter bar,
// cancel, and the build-history date-range calendar.
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { awaitJob } from "/scripts/extracted/lib/job-poll.js";
import { S, EXPO_BUILDS_TABLE_ID } from "./state";
import type { ExpoProject, ExpoBuild } from "./state";
import { t, showToast, $, dlg, esc, fmt, fmtDateTime, tsOf, syncFilterOptions, expoProfileLabel, expoBuildStatusLabel } from "./dom";
import { publishExpoRows, setExpoTableLoading } from "./table-bridge";

const buildPages=createTablePages({tableId:EXPO_BUILDS_TABLE_ID,events:window,scope:resolveTargetScope,reload:()=>loadBuilds(),field:"auto",aliases:{fechaTs:"createdAt",status:"status",profile:"profile",app:"appName"},values:()=>({status:Object.fromEntries(["new","in-queue","in-progress","pending-cancel","errored","finished","canceled"].map(status=>[expoBuildStatusLabel(status),status])),profile:Object.fromEntries(["development","preview","production"].map(profile=>[expoProfileLabel(profile),profile]))})});
let buildFacets: Record<string,unknown[]> = {};
// ── Builds ───────────────────────────────────────────────────────────────────
export function openBuildDialog(project: ExpoProject, profile: "development" | "production") {
  S.buildProject = project;
  S.buildProfile = profile;
  const title = $("expo-build-title");
  if (title) title.textContent = profile === "production" ? t("projects.buildProd", "Build prod") : t("projects.buildDev", "Build dev");
  const appEl = $("expo-build-app");
  if (appEl) appEl.textContent = project.name;
  const platSel = $("expo-build-platform") as HTMLSelectElement | null;
  if (platSel) platSel.value = "android";
  setBuildStatus("");
  const goBtn = $("expo-build-go") as HTMLButtonElement | null;
  if (goBtn) goBtn.disabled = false;
  const d = dlg("dlg-expo-build");
  if (d && !d.open) d.showModal();
}

export function setBuildStatus(msg: string, tone: "info" | "error" = "info") {
  const el = $("expo-build-status");
  if (!el) return;
  el.className =
    msg === ""
      ? "hidden text-xs"
      : `text-xs ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`;
  el.innerHTML = msg;
}

export async function launchBuild() {
  const project = S.buildProject;
  if (!project) {
    setBuildStatus(t("build.noProject", "No hay proyecto seleccionado. Cierra y vuelve a abrir el diálogo."), "error");
    return;
  }
  const platform = ($("expo-build-platform") as HTMLSelectElement | null)?.value ?? "android";
  const btn = $("expo-build-go") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  setBuildStatus(
    `<i class="ti ti-loader-2 animate-spin"></i> ${esc(fmt(t("build.launching", "Lanzando build ({profile} · {platform}) en EAS..."), { profile: expoProfileLabel(S.buildProfile), platform }))}`,
  );
  // The backend launches `eas build` detached and returns right away, so this
  // resolves in a second or two — no more frozen modal.
  const res = await api.post("/api/expo/build", {
    path: project.path,
    profile: S.buildProfile,
    platform,
  });
  if (btn) btn.disabled = false;
  if (!res.ok) {
    setBuildStatus(esc(res.error ?? t("build.launchError", "No se pudo lanzar el build.")), "error");
    return;
  }
  setBuildStatus("");
  dlg("dlg-expo-build")?.close();
  showToast(t("build.launched", "Build lanzado — aparecerá en el historial en unos segundos"));
  // EAS takes a few seconds to register the queued build; refresh now and again
  // shortly after so it shows up without the user clicking "Actualizar".
  void loadBuilds();
  window.setTimeout(() => void loadBuilds(), 8000);
  window.setTimeout(() => void loadBuilds(), 20000);
}

export async function loadBuilds() {
  const targetGeneration = S.targetGeneration;
  const project = S.currentProject;
  if (!project) {
    S.builds = [];
    S.buildsFiltered = [];
    publishExpoRows(EXPO_BUILDS_TABLE_ID, []);
    return;
  }
  setExpoTableLoading(EXPO_BUILDS_TABLE_ID, true);
  // Fetch a wider window; DataTable paginates client-side.
  const body: Record<string, unknown> = { path: project.path, limit: 50 };
  if (project.projectId) body.projectId = project.projectId;
  const res = await buildPages.read<ExpoBuild[]>(params => {
    const query=JSON.parse(params.tableWindow!);
    query.filters.push(...Object.entries(S.buildFilters).filter(([,value])=>value).map(([key,value])=>({key:key==="from"||key==="to" ? "createdAt" : key,type:key==="from" ? "gte" : key==="to" ? "lte" : "select",value:key==="to" ? value+"T23:59:59.999Z" : value})));
    return api.post<ExpoBuild[]>("/api/expo/build-list",body,{params:{tableWindow:JSON.stringify(query)}});
  },JSON.stringify([project.path,S.buildFilters]));
  if(res.code === "TARGET_SCOPE_CHANGED") return;
  buildFacets=res.meta?.tableWindow?.facets ?? {};
  if (targetGeneration !== S.targetGeneration || S.currentProject?.path !== project.path) return;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    S.builds = [];
    S.buildsFiltered = [];
    publishExpoRows(EXPO_BUILDS_TABLE_ID, []);
    return;
  }
  S.builds = res.data ?? [];
  S.buildsPage = 0;
  renderBuilds();
}

/** Apply the build filter bar (status/platform/profile/date range) to the list. */
export function applyBuildFilters(): ExpoBuild[] {
  const f = S.buildFilters;
  return S.builds.filter((b) => {
    if (f.status && b.status !== f.status) return false;
    if (f.platform && b.platform !== f.platform) return false;
    if (f.profile && (b.profile ?? "") !== f.profile) return false;
    if (f.from || f.to) {
      const day = (b.createdAt ?? "").slice(0, 10); // yyyy-mm-dd
      if (!day) return false;
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
    }
    return true;
  });
}
export function renderBuilds() {
  // Keep the external filter selects in sync with whatever the data offers.
  syncFilterOptions("expo-bh-status", (buildFacets.status as string[] | undefined) ?? S.builds.map((b) => b.status), t("history.filterStatusAll", "Estado: todos"), expoBuildStatusLabel);
  syncFilterOptions("expo-bh-platform", (buildFacets.platform as string[] | undefined) ?? S.builds.map((b) => b.platform), t("history.filterPlatformAll", "Plataforma: todas"));
  syncFilterOptions("expo-bh-profile", (buildFacets.profile as string[] | undefined) ?? S.builds.map((b) => b.profile ?? ""), t("history.filterProfileAll", "Perfil: todos"), expoProfileLabel);

  // Apply the external filter bar; DataTable owns sorting + pagination.
  S.buildsFiltered = applyBuildFilters();
  const rows = S.buildsFiltered.map((b) => ({
    id: b.id,
    app: b.appName ?? S.currentProject?.name ?? "—",
    status: expoBuildStatusLabel(b.status),
    platform: b.platform,
    profile: expoProfileLabel(b.profile ?? ""),
    fecha: fmtDateTime(b.createdAt),
    fechaTs: tsOf(b.createdAt),
    _buildId: b.id,
  }));
  publishExpoRows(EXPO_BUILDS_TABLE_ID, rows);
}

export async function cancelBuild(build: ExpoBuild) {
  const project = S.currentProject;
  if (!project) return;
  if (!(await openConfirm(t("build.confirmCancel", "¿Cancelar este build?"), { title: t("build.cancel", "Cancelar build"), confirmText: t("build.cancel", "Cancelar build"), variant: "danger" }))) return;
  const res = await api.post("/api/expo/build-cancel", { path: project.path, buildId: build.id });
  if (res.ok) await awaitJob(res);
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  showToast(t("build.cancelled", "Build cancelado"));
  void loadBuilds();
}

// ── Build history: date-range calendar (single calendar, range selection) ──────
export function getMonthNames(): string[] {
  return [
    t("history.monthJan", "Enero"), t("history.monthFeb", "Febrero"), t("history.monthMar", "Marzo"),
    t("history.monthApr", "Abril"), t("history.monthMay", "Mayo"), t("history.monthJun", "Junio"),
    t("history.monthJul", "Julio"), t("history.monthAug", "Agosto"), t("history.monthSep", "Septiembre"),
    t("history.monthOct", "Octubre"), t("history.monthNov", "Noviembre"), t("history.monthDec", "Diciembre"),
  ];
}
export const calState = { year: 0, month: 0, start: "", end: "" };

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
export function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

export function updateDateRangeLabel() {
  const label = $("expo-bh-daterange-label");
  if (!label) return;
  const { from, to } = S.buildFilters;
  label.textContent = from || to ? `${from || "…"} → ${to || "…"}` : t("history.dateRange", "Rango de fechas");
}

export function openCalendar() {
  const box = $("expo-bh-calendar");
  if (!box) return;
  // Seed from the active range, else today's month.
  const seed = S.buildFilters.from || S.buildFilters.to;
  const base = seed ? new Date(`${seed}T00:00:00`) : new Date();
  calState.year = base.getFullYear();
  calState.month = base.getMonth();
  calState.start = S.buildFilters.from;
  calState.end = S.buildFilters.to;
  box.classList.remove("hidden");
  renderCalendar();
}
export function closeCalendar() {
  $("expo-bh-calendar")?.classList.add("hidden");
}

export function onCalendarDayPick(ds: string) {
  // No start, or a full range already chosen → start over.
  if (!calState.start || (calState.start && calState.end)) {
    calState.start = ds;
    calState.end = "";
  } else if (ds < calState.start) {
    calState.end = calState.start;
    calState.start = ds;
  } else {
    calState.end = ds;
  }
  renderCalendar();
}

export function renderCalendar() {
  const box = $("expo-bh-calendar");
  if (!box) return;
  const { year, month } = calState;
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: string[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(`<div class="h-7"></div>`);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = ymd(year, month, d);
    const isEnd = ds === calState.start || ds === calState.end;
    const inRange = calState.start && calState.end && ds > calState.start && ds < calState.end;
    const cls = isEnd
      ? "bg-primary text-primary-foreground font-semibold"
      : inRange
        ? "bg-primary/15"
        : "hover:bg-accent";
    cells.push(`<button data-date="${ds}" class="expo-cal-day h-7 rounded text-xs ${cls}">${d}</button>`);
  }
  const weekdays = [
    t("history.weekMon", "L"), t("history.weekTue", "M"), t("history.weekWed", "X"),
    t("history.weekThu", "J"), t("history.weekFri", "V"), t("history.weekSat", "S"), t("history.weekSun", "D"),
  ]
    .map((w) => `<div>${esc(w)}</div>`)
    .join("");
  const rangeLabel = calState.start
    ? `${calState.start}${calState.end ? ` → ${calState.end}` : " → …"}`
    : t("history.calSelectRange", "Selecciona inicio y fin");
  box.innerHTML = `
    <div class="mb-2 flex items-center justify-between">
      <button id="expo-cal-prev" class="rounded p-1 hover:bg-accent"><i class="ti ti-chevron-left text-sm"></i></button>
      <span class="text-xs font-semibold">${esc(getMonthNames()[month])} ${year}</span>
      <button id="expo-cal-next" class="rounded p-1 hover:bg-accent"><i class="ti ti-chevron-right text-sm"></i></button>
    </div>
    <div class="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted-foreground">${weekdays}</div>
    <div class="grid grid-cols-7 gap-0.5 text-center">${cells.join("")}</div>
    <div class="mt-2 flex items-center justify-between gap-2">
      <span class="text-[11px] text-muted-foreground">${esc(rangeLabel)}</span>
      <div class="flex gap-1.5">
        <button id="expo-cal-clear" class="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">${esc(t("history.clearFilters", "Limpiar"))}</button>
        <button id="expo-cal-apply" class="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90">${esc(t("history.calApply", "Aplicar"))}</button>
      </div>
    </div>`;
}

export function applyCalendarRange() {
  S.buildFilters.from = calState.start;
  S.buildFilters.to = calState.end || calState.start; // single day = same start/end
  S.buildsPage = 0;
  updateDateRangeLabel();
  closeCalendar();
  renderBuilds();
}
export function clearCalendarRange() {
  calState.start = "";
  calState.end = "";
  S.buildFilters.from = "";
  S.buildFilters.to = "";
  S.buildsPage = 0;
  updateDateRangeLabel();
  renderCalendar();
  renderBuilds();
}
