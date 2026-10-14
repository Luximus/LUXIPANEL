// Expo page — delegated static-control bindings (ROW_ACTION + click/change/input),
// survives SPA swaps. The DataTable READY listener lives in table-bridge.ts.
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { S, CANCELLABLE_STATUSES, PAGE_SIZE, EXPO_BUILDS_TABLE_ID, EXPO_ENV_TABLE_ID } from "./state";
import type { ExpoProject } from "./state";
import { t, showToast, $, dlg, refreshWith } from "./dom";
import { bindExpoTableReady } from "./table-bridge";
import { openBuildDialog, launchBuild, loadBuilds, cancelBuild, renderBuilds, calState, updateDateRangeLabel, openCalendar, closeCalendar, renderCalendar, applyCalendarRange, clearCalendarRange, onCalendarDayPick } from "./builds";
import { startDevClient, stopDevClient, showBuildInstallQr } from "./qr";
import { showBuildLogs, analyzeLogsWithAI, copyBuildLogs, renderLogLines } from "./logs";
import { submitToStore, uploadGoogleJson, selectAppleP8, saveAppleCreds, renderStoreTable } from "./store";
import { openEnvDialog, saveEnvVar, deleteEnvVar, renderEnvVars, loadEnvVars } from "./env";
import { loadProjects, linkProject, openCreateDialog, startCreate, openOtaDialog, publishOta, selectProject, installProjectDependencies } from "./projects";
import { testToken, clearToken, loadQuota } from "./account";

// ── Bind static controls (delegated → survives SPA swaps) ─────────────────────
export function bindOnce() {
  if ((window as any).__lxpExpoBound) return;
  (window as any).__lxpExpoBound = true;

  // Handshake READY listener now lives in table-bridge.ts.
  bindExpoTableReady();

  window.addEventListener(DATATABLE_EVENTS.ROW_ACTION, (event: Event) => {
    const d = (event as CustomEvent<{ tableId?: string; actionId?: string; row?: Record<string, any> }>).detail;
    if (!d?.row || !d.actionId) return;
    if (d.tableId === EXPO_BUILDS_TABLE_ID) {
      const b = S.builds.find((x) => x.id === d.row!._buildId);
      if (!b) return;
      switch (d.actionId) {
        case "open":
          if (b.url) window.open(b.url, "_blank", "noopener");
          else showToast(t("history.noLink", "Este build no tiene enlace."), false);
          return;
        case "logs":
          if (!["new", "in-queue"].includes(b.status)) void showBuildLogs(b);
          else showToast(t("logs.notReady", "El registro aún no está disponible."), false);
          return;
        case "qr":
          if (b.url || b.artifactUrl) showBuildInstallQr(b);
          else showToast(t("history.noQr", "Este build no tiene artefacto para QR."), false);
          return;
        case "cancel":
          if (CANCELLABLE_STATUSES.has(b.status)) void cancelBuild(b);
          else showToast(t("build.notCancellable", "Este build ya no se puede cancelar."), false);
          return;
      }
      return;
    }
    if (d.tableId === EXPO_ENV_TABLE_ID) {
      const v = S.envVars.find((x) => (x.id && x.id === d.row!._envId) || x.name === d.row!._name);
      if (!v) return;
      if (!d.row._canEdit) {
        showToast(t("env.readOnly", "Esta variable no se puede editar desde el panel."), false);
        return;
      }
      if (d.actionId === "edit") openEnvDialog(v);
      else if (d.actionId === "delete") void deleteEnvVar(v);
      return;
    }
  });

  document.addEventListener("click", (e) => {
    const el = e.target as HTMLElement | null;
    if (!el) return;

    // Close the date-range calendar on any click outside it (and not the toggle).
    // Checked first, against the live target before any re-render.
    const calBox = $("expo-bh-calendar");
    if (
      calBox &&
      !calBox.classList.contains("hidden") &&
      !el.closest("#expo-bh-calendar") &&
      !el.closest("#expo-bh-daterange")
    ) {
      closeCalendar();
    }

    // Dynamic per-project row actions.
    const proj = (cls: string): ExpoProject | null => {
      const btn = el.closest<HTMLButtonElement>(`.${cls}`);
      if (!btn) return null;
      return S.projects[Number(btn.dataset.idx)] ?? null;
    };
    const selectedP = proj("expo-select");
    if (selectedP) return selectProject(selectedP);
    const installP = proj("expo-install");
    if (installP) return void installProjectDependencies(installP);
    const devP = proj("expo-build-dev");
    if (devP) return openBuildDialog(devP, "development");
    const prodP = proj("expo-build-prod");
    if (prodP) return openBuildDialog(prodP, "production");
    const qrP = proj("expo-devclient");
    if (qrP) return void startDevClient(qrP);
    const stopP = proj("expo-devclient-stop");
    if (stopP) return void stopDevClient(stopP);
    const playP = proj("expo-submit-play");
    if (playP) return void submitToStore(playP, "android");
    const appleP = proj("expo-submit-apple");
    if (appleP) return void submitToStore(appleP, "ios");
    const otaP = proj("expo-ota");
    if (otaP) return openOtaDialog(otaP);

    const buildQr = el.closest<HTMLButtonElement>(".expo-build-qr");
    if (buildQr) {
      const b = S.buildsFiltered[Number(buildQr.dataset.idx)];
      if (b) showBuildInstallQr(b);
      return;
    }
    const buildLogs = el.closest<HTMLButtonElement>(".expo-build-logs");
    if (buildLogs) {
      const b = S.buildsFiltered[Number(buildLogs.dataset.idx)];
      if (b) void showBuildLogs(b);
      return;
    }
    const buildCancel = el.closest<HTMLButtonElement>(".expo-build-cancel");
    if (buildCancel) {
      const b = S.buildsFiltered[Number(buildCancel.dataset.idx)];
      if (b) void cancelBuild(b);
      return;
    }
    const envEdit = el.closest<HTMLButtonElement>(".expo-env-edit");
    if (envEdit) {
      const v = S.envFiltered[Number(envEdit.dataset.idx)];
      if (v) openEnvDialog(v);
      return;
    }
    const envDel = el.closest<HTMLButtonElement>(".expo-env-del");
    if (envDel) {
      const v = S.envFiltered[Number(envDel.dataset.idx)];
      if (v) void deleteEnvVar(v);
      return;
    }
    // Calendar day pick (build history date range).
    const calDay = el.closest<HTMLButtonElement>(".expo-cal-day");
    if (calDay?.dataset.date) {
      onCalendarDayPick(calDay.dataset.date);
      return;
    }
    const btn = el.closest<HTMLButtonElement>("button[id]");
    if (!btn) return;
    switch (btn.id) {
      case "expo-go-config":
      case "expo-token-set":
        window.location.href = "/panel/settings#cred-expo";
        break;
      case "expo-token-test":
        void testToken();
        break;
      case "expo-token-clear":
        void clearToken();
        break;
      case "expo-quota-refresh":
        void refreshWith("expo-quota-refresh", loadQuota);
        break;
      case "expo-projects-refresh":
        void refreshWith("expo-projects-refresh", loadProjects);
        break;
      case "expo-projects-link":
        void linkProject();
        break;
      case "expo-history-refresh":
        void refreshWith("expo-history-refresh", loadBuilds);
        break;
      case "expo-logs-x":
      case "expo-logs-close":
        dlg("dlg-expo-logs")?.close();
        break;
      case "expo-logs-ai":
        analyzeLogsWithAI();
        break;
      case "expo-logs-copy":
        void copyBuildLogs();
        break;
      case "expo-builds-prev":
        if (S.buildsPage > 0) {
          S.buildsPage -= 1;
          renderBuilds();
        }
        break;
      case "expo-builds-next":
        if ((S.buildsPage + 1) * PAGE_SIZE < S.buildsFiltered.length) {
          S.buildsPage += 1;
          renderBuilds();
        }
        break;
      case "expo-bh-clear":
        S.buildFilters = { status: "", platform: "", profile: "", from: "", to: "" };
        for (const id of ["expo-bh-status", "expo-bh-platform", "expo-bh-profile"]) {
          const s = $(id) as HTMLSelectElement | null;
          if (s) s.value = "";
        }
        calState.start = "";
        calState.end = "";
        S.buildsPage = 0;
        updateDateRangeLabel();
        closeCalendar();
        renderBuilds();
        break;
      case "expo-bh-daterange":
        if ($("expo-bh-calendar")?.classList.contains("hidden")) openCalendar();
        else closeCalendar();
        break;
      case "expo-cal-prev":
        calState.month -= 1;
        if (calState.month < 0) {
          calState.month = 11;
          calState.year -= 1;
        }
        renderCalendar();
        break;
      case "expo-cal-next":
        calState.month += 1;
        if (calState.month > 11) {
          calState.month = 0;
          calState.year += 1;
        }
        renderCalendar();
        break;
      case "expo-cal-apply":
        applyCalendarRange();
        break;
      case "expo-cal-clear":
        clearCalendarRange();
        break;
      case "expo-env-prev":
        if (S.envVarsPage > 0) {
          S.envVarsPage -= 1;
          renderEnvVars();
        }
        break;
      case "expo-env-next":
        if ((S.envVarsPage + 1) * PAGE_SIZE < S.envFiltered.length) {
          S.envVarsPage += 1;
          renderEnvVars();
        }
        break;
      case "expo-store-prev":
        if (S.storePage > 0) {
          S.storePage -= 1;
          renderStoreTable();
        }
        break;
      case "expo-store-next":
        if ((S.storePage + 1) * PAGE_SIZE < S.storeRows.length) {
          S.storePage += 1;
          renderStoreTable();
        }
        break;
      // Create wizard
      case "expo-create-open":
        openCreateDialog();
        break;
      case "expo-create-go":
        startCreate();
        break;
      case "expo-create-cancel":
      case "expo-create-x":
        dlg("dlg-expo-create")?.close();
        break;
      // Build dialog
      case "expo-build-go":
        void launchBuild();
        break;
      case "expo-build-cancel":
      case "expo-build-x":
        dlg("dlg-expo-build")?.close();
        break;
      // QR dialog
      case "expo-qr-stop":
        void stopDevClient();
        break;
      case "expo-qr-close":
      case "expo-qr-x":
        dlg("dlg-expo-qr")?.close();
        break;
      // OTA dialog
      case "expo-ota-go":
        void publishOta();
        break;
      case "expo-ota-cancel":
      case "expo-ota-x":
        dlg("dlg-expo-ota")?.close();
        break;
      // Env dialog
      case "expo-env-add":
        openEnvDialog();
        break;
      case "expo-env-save":
        void saveEnvVar();
        break;
      case "expo-env-cancel":
      case "expo-env-x":
        dlg("dlg-expo-env")?.close();
        break;
      // Store accounts
      case "expo-google-upload":
        ($("expo-google-json") as HTMLInputElement | null)?.click();
        break;
      case "expo-apple-upload":
        ($("expo-apple-p8") as HTMLInputElement | null)?.click();
        break;
      case "expo-apple-save":
        void saveAppleCreds();
        break;
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target as HTMLElement | null;
    if (!el?.id) return;
    const val = (el as HTMLSelectElement).value;
    switch (el.id) {
      case "expo-google-json":
        void uploadGoogleJson();
        break;
      case "expo-apple-p8":
        void selectAppleP8();
        break;
      // Build history filters
      case "expo-bh-status":
        S.buildFilters.status = val;
        S.buildsPage = 0;
        void loadBuilds();
        break;
      case "expo-bh-platform":
        S.buildFilters.platform = val;
        S.buildsPage = 0;
        void loadBuilds();
        break;
      case "expo-bh-profile":
        S.buildFilters.profile = val;
        S.buildsPage = 0;
        void loadBuilds();
        break;
      // Env filters
      case "expo-env-filter-scope":
        S.envFilters.scope = val;
        S.envVarsPage = 0;
        void loadEnvVars();
        break;
      case "expo-env-filter-visibility":
        S.envFilters.visibility = val;
        S.envVarsPage = 0;
        void loadEnvVars();
        break;
      case "expo-env-filter-env":
        S.envFilters.environment = val;
        S.envVarsPage = 0;
        void loadEnvVars();
        break;
      case "expo-logs-errors-only":
        S.logsErrorsOnly = (el as HTMLInputElement).checked;
        renderLogLines();
        break;
    }
  });

  document.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement | null;
    if (el?.id === "expo-env-filter-text") {
      S.envFilters.text = el.value;
      S.envVarsPage = 0;
        void loadEnvVars();
    } else if (el?.id === "expo-logs-search") {
      S.logsSearch = el.value;
      renderLogLines();
    }
  });
}
