// Expo page — project list, EAS link, create-app wizard and OTA update dialog.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openPrompt } from "/scripts/extracted/lib/confirm.js";
import { awaitJob } from "/scripts/extracted/lib/job-poll.js";
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
import { S } from "./state";
import type { ExpoProject, ExpoInstallStatus } from "./state";
import { t, showToast, $, esc, fmt, dlg, projectsSkeleton } from "./dom";
import { loadBuilds } from "./builds";
import { loadEnvVars } from "./env";
import { loadStoreCredentials } from "./store";
import { loadQuota } from "./account";
import { liveSessionMarkup, renderLiveSessionCanvases, refreshLiveSessions } from "./live-sessions";

function selectionKey(): string {
  const user = document.getElementById("messenger-link")?.getAttribute("data-me") || "user";
  let storedTarget = "";
  try { storedTarget = sessionStorage.getItem("panel-active-target-scope") || ""; } catch { /* storage unavailable */ }
  const target = document.getElementById("sidebar-server-switcher")?.getAttribute("data-current-target-id") || storedTarget || "local";
  return `lxp:expo:project:v1:${encodeURIComponent(user)}:${encodeURIComponent(target)}`;
}

export function selectProject(project: ExpoProject): void {
  if (S.currentProject?.path === project.path) return;
  S.currentProject = project;
  try { localStorage.setItem(selectionKey(), project.path); } catch { /* storage unavailable */ }
  renderProjects();
  void loadBuilds();
  void loadEnvVars();
  void loadStoreCredentials();
  void loadQuota();
}

// ── Projects ─────────────────────────────────────────────────────────────────
export async function loadProjects() {
  const targetGeneration = S.targetGeneration;
  const root = $("expo-root");
  const view = $("expo-projects");
  if (!view) return;
  view.innerHTML = projectsSkeleton();
  let res = await api.get<ExpoProject[]>("/api/expo/projects");
  // Initial CSRF/bridge hydration can invalidate the first read. Retry only
  // that cancellation while the same module and selected server remain live.
  for (let attempt = 0; !res.ok && res.code === "TARGET_SCOPE_CHANGED" && attempt < 2; attempt++) {
    if (targetGeneration !== S.targetGeneration || $("expo-root") !== root) return;
    await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
    if (targetGeneration !== S.targetGeneration || $("expo-root") !== root) return;
    res = await api.get<ExpoProject[]>("/api/expo/projects");
  }
  if (targetGeneration !== S.targetGeneration || $("expo-root") !== root) return;
  if (!res.ok) {
    view.innerHTML = `<div class="px-4 py-6 text-sm text-destructive">${esc(res.error ?? t("common.error", "Error"))}</div>`;
    return;
  }
  S.projects = res.data ?? [];
  // Pick a current project for the per-project panels: prefer a linked one.
  let savedPath = "";
  try { savedPath = localStorage.getItem(selectionKey()) || ""; } catch { /* storage unavailable */ }
  S.currentProject = S.projects.find((p) => p.path === savedPath)
    ?? S.projects.find((p) => p.path === S.currentProject?.path)
    ?? S.projects.find((p) => p.projectId) ?? S.projects[0] ?? null;
  renderProjects();
  // These panels are project-scoped; (re)load them for the resolved project.
  void refreshLiveSessions();
  void loadBuilds();
  void loadEnvVars();
  void loadStoreCredentials();
  if (S.currentProject) void loadQuota();
}

export function renderProjects() {
  const view = $("expo-projects");
  if (!view) return;
  if (S.projects.length === 0) {
    view.innerHTML = `<div class="px-4 py-10 text-center text-sm text-muted-foreground">${esc(t("projects.empty", "No se han detectado proyectos Expo en este servidor."))}</div>`;
    renderReadiness();
    return;
  }
  const rows = S.projects
    .map((p, idx) => {
      const missingExpo = p.runtime?.expoInstalled !== true;
      const missingNgrok = p.runtime?.ngrokInstalled !== true;
      const installing = S.installingPath === p.path;
      const blocked = missingExpo ? "disabled aria-disabled=\"true\"" : "";
      const qrBlocked = missingExpo || missingNgrok ? "disabled aria-disabled=\"true\"" : "";
      const missingLabel = missingExpo
        ? t("projects.dependenciesMissing", "Faltan dependencias del proyecto (expo)")
        : t("projects.ngrokMissing", "Falta @expo/ngrok para el QR");
      const installHint = esc(missingLabel);
      const linked = p.projectId
        ? `<span class="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">${esc(t("projects.linked", "Vinculado"))}</span>`
        : `<span class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">${esc(t("projects.unlinked", "Sin vincular"))}</span>`;
      const selected = S.currentProject?.path === p.path;
      return `<div data-expo-project-path="${esc(p.path)}" class="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${selected ? "bg-primary/5" : ""}">
        <div class="min-w-0">
          <p class="truncate text-sm font-medium">${esc(p.name)}</p>
          <p class="truncate font-mono text-[11px] text-muted-foreground" title="${esc(p.path)}">${esc(p.projectId || p.path)}</p>
          <div class="mt-1 flex flex-wrap items-center gap-2">${linked}${missingExpo || missingNgrok ? `<span class="text-[11px] text-amber-600">${installHint}</span>` : ""}</div>
          ${S.installErrorPath === p.path && S.installLog ? `<pre class="mt-2 max-h-28 max-w-xl overflow-auto whitespace-pre-wrap text-[11px] text-destructive">${esc(S.installLog)}</pre>` : ""}
        </div>
        <div class="flex flex-wrap items-start gap-1.5">
          <button data-idx="${idx}" class="expo-select inline-flex items-center gap-1 rounded-md border ${selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"} px-2 py-1 text-[11px] font-medium hover:bg-accent" aria-pressed="${selected}">${esc(selected ? t("projects.selected", "Seleccionado") : t("projects.select", "Ver proyecto"))}</button>
          ${missingExpo || missingNgrok ? `<button data-idx="${idx}" class="expo-install inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 disabled:opacity-50" ${installing ? "disabled" : ""}><i class="ti ${installing ? "ti-loader-2 animate-spin" : "ti-download"} text-sm"></i> ${esc(t(installing ? "projects.installing" : "projects.installDependencies", installing ? "Instalando…" : "Instalar dependencias"))}</button>` : ""}
          <button data-idx="${idx}" ${blocked} class="expo-build-dev inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40" title="${missingExpo ? installHint : esc(t("projects.buildDev", "Build dev"))}"><i class="ti ti-flask text-sm"></i> ${esc(t("projects.buildDev", "Build dev"))}</button>
          <button data-idx="${idx}" ${blocked} class="expo-build-prod inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40" title="${missingExpo ? installHint : esc(t("projects.buildProd", "Build prod"))}"><i class="ti ti-rocket text-sm"></i> ${esc(t("projects.buildProd", "Build prod"))}</button>
          <div data-expo-session-path="${esc(p.path)}">${liveSessionMarkup(p, idx, qrBlocked, installHint)}</div>
          <button data-idx="${idx}" ${blocked} class="expo-submit-play inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40" title="${missingExpo ? installHint : esc(t("projects.submitPlay", "Subir a Play Store"))}"><i class="ti ti-brand-google-play text-sm"></i> ${esc(t("projects.playButton", "Play"))}</button>
          <button data-idx="${idx}" ${blocked} class="expo-submit-apple inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40" title="${missingExpo ? installHint : esc(t("projects.submitApple", "Subir a App Store"))}"><i class="ti ti-brand-apple text-sm"></i> ${esc(t("projects.appStoreButton", "App Store"))}</button>
          <button data-idx="${idx}" ${blocked} class="expo-ota inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40" title="${missingExpo ? installHint : esc(t("projects.ota", "Publicar update"))}"><i class="ti ti-cloud-upload text-sm"></i> OTA</button>
        </div>
      </div>`;
    })
    .join("");
  view.innerHTML = rows;
  void renderLiveSessionCanvases();
  renderReadiness();
}

export async function installProjectDependencies(project: ExpoProject): Promise<void> {
  if (S.installingPath) return;
  const generation = S.targetGeneration;
  S.installingPath = project.path;
  S.installErrorPath = null;
  S.installLog = "";
  renderProjects();
  const start = await api.post<ExpoInstallStatus>("/api/expo/dependencies/install", { path: project.path });
  if (generation !== S.targetGeneration) return;
  if (!start.ok || !start.data) {
    S.installingPath = null;
    showToast(start.error ?? t("projects.installFailed", "No se pudo instalar las dependencias."), false);
    renderProjects();
    return;
  }
  let status = start.data;
  while (!status.done && generation === S.targetGeneration && document.getElementById("expo-root")) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (generation !== S.targetGeneration) return;
    const res = await api.post<ExpoInstallStatus>("/api/expo/dependencies/status", { path: project.path });
    if (!res.ok || !res.data) {
      status = { status: "error", done: true, ok: false, log: "", message: res.error ?? t("common.error", "Error") };
      break;
    }
    status = res.data;
  }
  if (generation !== S.targetGeneration) return;
  if (!document.getElementById("expo-root")) { S.installingPath = null; return; }
  S.installingPath = null;
  S.installLog = status.ok ? "" : status.log.slice(-2500) || status.message;
  S.installErrorPath = status.ok ? null : project.path;
  showToast(status.ok ? t("projects.installDone", "Dependencias instaladas") : status.message, status.ok);
  await loadProjects();
}

function renderReadiness(): void {
  const box = $("expo-readiness");
  if (!box) return;
  const project = S.currentProject;
  if (!project) { box.textContent = t("settingsUi.selectProjectPrep", "Selecciona un proyecto para ver su preparación."); return; }
  const steps = [
    [t("readiness.expoToken", "Token de Expo"), S.tokenSet],
    [t("readiness.easLinked", "Proyecto EAS vinculado"), !!project.projectId],
    [t("readiness.androidId", "Identificador de Android"), !!project.androidPackage],
    [t("readiness.iosId", "Identificador de iOS"), !!project.iosBundleIdentifier],
  ] as const;
  box.innerHTML = `<div class="flex flex-wrap items-center gap-2"><strong class="mr-2 text-xs">${esc(project.name)}</strong>${steps.map(([label, done]) => `<span class="rounded-full border px-2.5 py-1 text-[11px] ${done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-amber-500/30 bg-amber-500/10 text-amber-600"}">${done ? "✓" : "○"} ${esc(label)}</span>`).join("")}</div>`;
}

export async function linkProject() {
  const project = S.currentProject;
  if (!project) {
    showToast(t("projects.linkNoProject", "Crea o detecta primero un proyecto Expo en el servidor"), false);
    return;
  }
  const projectId = await openPrompt(
    fmt(t("projects.linkPrompt", "Vincular \"{name}\" a un EAS Project ID (deja vacío para crear uno nuevo con eas init)."), { name: project.name }),
    {
      title: t("projects.link", "Vincular proyecto"),
      placeholder: "00000000-0000-0000-0000-000000000000",
      okText: t("projects.linkConfirm", "Vincular"), // PromptOptions usa okText
    },
  );
  if (projectId === null) return; // cancelled
  const body: Record<string, unknown> = { path: project.path };
  if (projectId.trim()) body.projectId = projectId.trim();
  const res = await api.post("/api/expo/link", body);
  if (res.ok) await awaitJob(res);
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  showToast(t("projects.linkSuccess", "Proyecto vinculado"));
  void loadProjects();
}
// ── Create app wizard (seeds the AI assistant) ───────────────────────────────
export function openCreateDialog() {
  const nameInput = $("expo-create-name") as HTMLInputElement | null;
  if (nameInput) nameInput.value = "";
  const gh = $("expo-create-github") as HTMLInputElement | null;
  if (gh) gh.checked = true;
  const d = dlg("dlg-expo-create");
  if (d && !d.open) d.showModal();
}

export function startCreate() {
  const name = ($("expo-create-name") as HTMLInputElement | null)?.value.trim() ?? "";
  if (!name) {
    showToast(t("create.nameRequired", "Indica un nombre"), false);
    return;
  }
  const githubBackup = ($("expo-create-github") as HTMLInputElement | null)?.checked ?? false;
  const prompt =
    fmt(
      t(
        "create.seedPrompt",
        `Crea una nueva app Expo / React Native llamada "{name}" en el servidor: ejecuta create-expo-app, configura eas init, y deja el proyecto listo para builds EAS.`,
      ),
      { name },
    ) +
    (githubBackup
      ? " " + t("create.seedPromptGithub", "Después inicializa un repositorio Git y súbelo como copia de seguridad a GitHub.")
      : "");
  dlg("dlg-expo-create")?.close();
  requestAssistant({
    kind: "prompt",
    prompt,
    submit: "prefill",
    conversation: "new",
    origin: { module: "expo", action: "createApp" },
    target: { agentId: null, projectId: null },
  });
  showToast(t("create.opening", "Abriendo el asistente IA..."));
}
// ── OTA ───────────────────────────────────────────────────────────────────────
export function openOtaDialog(project: ExpoProject) {
  S.otaProject = project;
  const appEl = $("expo-ota-app");
  if (appEl) appEl.textContent = project.name;
  const branch = $("expo-ota-branch") as HTMLInputElement | null;
  if (branch) branch.value = "production";
  const message = $("expo-ota-message") as HTMLInputElement | null;
  if (message) message.value = "";
  const d = dlg("dlg-expo-ota");
  if (d && !d.open) d.showModal();
}

export async function publishOta() {
  const project = S.otaProject;
  if (!project) return;
  const branch = ($("expo-ota-branch") as HTMLInputElement | null)?.value.trim() ?? "production";
  const message = ($("expo-ota-message") as HTMLInputElement | null)?.value.trim() ?? "";
  const btn = $("expo-ota-go") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  const otaBody: Record<string, unknown> = { path: project.path, branch };
  if (message) otaBody.message = message;
  const res = await api.post("/api/expo/update", otaBody);
  if (res.ok) await awaitJob(res);
  if (btn) btn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  dlg("dlg-expo-ota")?.close();
  showToast(t("ota.published", "Update publicado"));
}
