// Mail page — Spam Filters tab (overview, threshold, spam box, auto-delete,
// whitelist/blacklist, calculated scores) + its bindings.
import { api } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { setCollapsed } from "/scripts/extracted/lib/dom.js";
import type { MailSpamView, RequiredScoreSelect, SpamCalculatedScore, SpamFiltersSettings } from "./state";
import { S } from "./state";
import { escapeAttr, fmt, showToast, t } from "./dom";
import { updateMailTabCounts } from "./settings";
import { switchView } from "/scripts/extracted/lib/dom.js";

function setSpamFiltersError(message: string | null) {
  const el = document.getElementById("mail-spam-error");
  if (!el) return;
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
}

function renderSpamListRows(containerId: string, items: string[], itemClass: string) {
  const root = document.getElementById(containerId);
  if (!root) return;
  const rows = items.length > 0 ? items : [""];
  root.innerHTML = rows.map((item) => `
    <div class="grid grid-cols-[1fr_auto] items-center gap-2 ${itemClass}">
      <input type="text" value="${escapeAttr(item)}" class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
      <button type="button" class="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="${t("actions.remove", "Eliminar")}">
        <i class="ti ti-x text-sm"></i>
      </button>
    </div>
  `).join("");
  root.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest(`.${itemClass}`)?.remove();
    });
  });
}

function createSpamCalculatedRowHtml(item?: SpamCalculatedScore): string {
  const options = S.mailSpamScoreTypes.map((type) => `<option value="${escapeAttr(type)}" ${item?.type === type ? "selected" : ""}>${escapeAttr(type)}</option>`).join("");
  return `
    <div class="spam-calculated-row grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_auto] md:items-center">
      <select class="spam-calculated-type h-9 rounded-md border border-input bg-background px-2 text-xs">
        ${options}
      </select>
      <input type="number" class="spam-calculated-score h-9 rounded-md border border-input bg-background px-2 text-sm" value="${Number.isFinite(item?.score) ? item!.score : 5}" />
      <button type="button" class="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="${t("actions.remove", "Eliminar")}">
        <i class="ti ti-x text-sm"></i>
      </button>
    </div>
  `;
}

function renderSpamCalculatedRows(items: SpamCalculatedScore[]) {
  const root = document.getElementById("mail-spam-calculated-items");
  if (!root) return;
  const rows = items.length > 0 ? items : [{ type: S.mailSpamScoreTypes[0] ?? "BAYES_50", score: 5 }];
  root.innerHTML = rows.map((item) => createSpamCalculatedRowHtml(item)).join("");
  root.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest(".spam-calculated-row")?.remove();
    });
  });
}

function syncSpamOverviewToggles() {
  const enabled = document.getElementById("mail-spam-enabled") as HTMLInputElement | null;
  const spamBoxEnabled = document.getElementById("mail-spam-box-enabled") as HTMLInputElement | null;
  const spamBoxViewEnabled = document.getElementById("mail-spam-box-view-enabled") as HTMLInputElement | null;
  const autoDeleteEnabled = document.getElementById("mail-spam-autodelete-enabled") as HTMLInputElement | null;
  const autoDeleteViewEnabled = document.getElementById("mail-spam-autodelete-view-enabled") as HTMLInputElement | null;
  if (!S.mailSpamSettings) return;
  if (enabled) enabled.checked = S.mailSpamSettings.enabled;
  if (spamBoxEnabled) spamBoxEnabled.checked = S.mailSpamSettings.spamBoxEnabled;
  if (spamBoxViewEnabled) spamBoxViewEnabled.checked = S.mailSpamSettings.spamBoxEnabled;
  if (autoDeleteEnabled) autoDeleteEnabled.checked = S.mailSpamSettings.autoDeleteEnabled;
  if (autoDeleteViewEnabled) autoDeleteViewEnabled.checked = S.mailSpamSettings.autoDeleteEnabled;
}

function setMailSpamView(view: MailSpamView) {
  // Overview → sub-vista: entra desde la derecha; volver: desde la izquierda.
  const direction = view === "overview" ? "left" : "right";
  S.mailSpamView = view;
  const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-mail-spam-view]"));
  switchView(panels, panels.find((panel) => panel.dataset.mailSpamView === view), { direction });
  const breadcrumb = document.getElementById("mail-spam-breadcrumb");
  if (breadcrumb) {
    const labelMap: Record<MailSpamView, string> = {
      overview: t("spamFilters.views.overview", "Overview"),
      "adjust-threshold": t("spamFilters.views.adjustThreshold", "Adjust Spam Threshold Score"),
      "spam-box": t("spamFilters.views.spamBox", "Spam Box"),
      "auto-delete": t("spamFilters.views.autoDelete", "Auto-Delete"),
      whitelist: t("spamFilters.views.whitelist", "Whitelist"),
      blacklist: t("spamFilters.views.blacklist", "Blacklist"),
      calculated: t("spamFilters.views.calculated", "Calculated Spam Score Settings"),
    };
    breadcrumb.textContent = fmt(t("spamFilters.breadcrumb", "Spam Filters / {view}"), { view: labelMap[view] });
  }
}

function applySpamSettingsToForm(settings: SpamFiltersSettings) {
  S.mailSpamSettings = settings;
  const status = document.getElementById("mail-spam-status");
  if (status) status.textContent = settings.legacyConfigured
    ? t("spamRuntime.legacySettings", "Los ajustes antiguos no se aplicaron al servidor. Guárdalos de nuevo cuando el filtro esté conectado.")
    : settings.integration?.available
      ? settings.applied ? t("spamRuntime.rulesApplied", "Reglas aplicadas en SpamAssassin y Sieve.") : t("spamRuntime.filterAvailable", "Filtro disponible. Guarda los ajustes para activarlos.")
      : settings.integration?.reason ?? t("spamRuntime.checkFailed", "No se pudo comprobar el filtro antispam del servidor.");
  syncSpamOverviewToggles();

  const requiredScoreSelect = document.getElementById("mail-spam-required-score-select") as HTMLSelectElement | null;
  const customWrap = document.getElementById("mail-spam-custom-score-wrap");
  const customInput = document.getElementById("mail-spam-custom-score") as HTMLInputElement | null;
  const autoDeleteScore = document.getElementById("mail-spam-autodelete-threshold") as HTMLInputElement | null;

  if (requiredScoreSelect) requiredScoreSelect.value = settings.requiredScoreSelect;
  if (customInput) customInput.value = String(settings.customRequiredScore ?? settings.requiredScore);
  if (autoDeleteScore) autoDeleteScore.value = String(settings.autoDeleteThresholdScore);
  if (customWrap) customWrap.classList.toggle("hidden", settings.requiredScoreSelect !== "custom");

  renderSpamListRows("mail-spam-whitelist-items", settings.whitelistFrom, "spam-whitelist-row");
  renderSpamListRows("mail-spam-blacklist-items", settings.blacklistFrom, "spam-blacklist-row");
  renderSpamCalculatedRows(settings.calculatedScores);
  updateMailTabCounts();
}

function collectSpamListValues(containerId: string): string[] {
  const root = document.getElementById(containerId);
  if (!root) return [];
  const out: string[] = [];
  root.querySelectorAll("input").forEach((input) => {
    const value = (input as HTMLInputElement).value.trim().toLowerCase();
    if (value) out.push(value);
  });
  return Array.from(new Set(out));
}

function collectSpamCalculatedScores(): SpamCalculatedScore[] {
  const root = document.getElementById("mail-spam-calculated-items");
  if (!root) return [];
  const out: SpamCalculatedScore[] = [];
  root.querySelectorAll(".spam-calculated-row").forEach((row) => {
    const type = ((row.querySelector(".spam-calculated-type") as HTMLSelectElement | null)?.value ?? "").trim().toUpperCase();
    const scoreRaw = Number((row.querySelector(".spam-calculated-score") as HTMLInputElement | null)?.value ?? "0");
    if (!type || !Number.isFinite(scoreRaw)) return;
    out.push({ type, score: scoreRaw });
  });
  return out;
}

async function saveSpamFiltersPatch(patch: Partial<SpamFiltersSettings>, successMessage: string) {
  setSpamFiltersError(null);
  const res = await api.put<SpamFiltersSettings>("/api/mail/spam-filters", patch);
  if (!res.ok) {
    setSpamFiltersError(res.error ?? t("errors.spamFiltersSaveFailed", "No se pudo guardar configuración de Spam Filters."));
    return false;
  }
  if (res.data) {
    applySpamSettingsToForm(res.data as SpamFiltersSettings);
  }
  showToast(successMessage);
  return true;
}

export async function loadSpamFilters() {
  setSpamFiltersError(null);
  const [settingsRes, typesRes] = await Promise.all([
    api.get<SpamFiltersSettings>("/api/mail/spam-filters"),
    api.get<string[]>("/api/mail/spam-filters/score-types"),
  ]);

  if (!settingsRes.ok) {
    setSpamFiltersError(settingsRes.error ?? t("errors.spamFiltersLoadFailed", "No se pudo cargar Spam Filters."));
    return;
  }
  if (!typesRes.ok) {
    setSpamFiltersError(typesRes.error ?? t("errors.scoreTypesLoadFailed", "No se pudo cargar el catálogo de score types."));
    return;
  }

  const scoreTypesRaw = Array.isArray(typesRes.data) ? typesRes.data : [];
  S.mailSpamScoreTypes = scoreTypesRaw
    .map((item) => String(item).trim().toUpperCase())
    .filter((item) => !!item);
  if (!S.mailSpamScoreTypes.length) {
    S.mailSpamScoreTypes = ["BAYES_50", "RCVD_IN_PBL", "SPF_FAIL", "DKIM_VALID"];
  }

  applySpamSettingsToForm(settingsRes.data as SpamFiltersSettings);
  setMailSpamView(S.mailSpamView);
  updateMailTabCounts();
}

let boundSpamPanel: Element | null = null;
export function bindMailSpamDomEvents(): void {
const panel = document.querySelector('[data-mail-main-panel="spam-filters"]');
if (!panel || panel === boundSpamPanel) return;
boundSpamPanel = panel;
setMailSpamView("overview");

document.querySelectorAll<HTMLButtonElement>("[data-mail-spam-open]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.mailSpamOpen as MailSpamView | undefined;
    if (!target) return;
    setMailSpamView(target);
  });
});

document.getElementById("mail-spam-toggle-advanced")?.addEventListener("click", () => {
  const panel = document.getElementById("mail-spam-advanced");
  const button = document.getElementById("mail-spam-toggle-advanced");
  if (!panel || !button) return;
  const collapsed = setCollapsed(panel);
  button.textContent = collapsed
    ? t("spamFilters.showAdditionalConfig", "Show Additional Configurations")
    : t("spamFilters.hideAdditionalConfig", "Hide Additional Configurations");
});

document.getElementById("mail-spam-required-score-select")?.addEventListener("change", () => {
  const select = document.getElementById("mail-spam-required-score-select") as HTMLSelectElement | null;
  const customWrap = document.getElementById("mail-spam-custom-score-wrap");
  if (!select || !customWrap) return;
  customWrap.classList.toggle("hidden", select.value !== "custom");
});

document.getElementById("mail-spam-whitelist-add")?.addEventListener("click", () => {
  const root = document.getElementById("mail-spam-whitelist-items");
  if (!root) return;
  root.insertAdjacentHTML("beforeend", `
    <div class="grid grid-cols-[1fr_auto] items-center gap-2 spam-whitelist-row">
      <input type="text" class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
      <button type="button" class="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="${t("actions.remove", "Eliminar")}">
        <i class="ti ti-x text-sm"></i>
      </button>
    </div>
  `);
  root.lastElementChild?.querySelector("button")?.addEventListener("click", (event) => {
    (event.currentTarget as HTMLElement | null)?.closest(".spam-whitelist-row")?.remove();
  });
});

document.getElementById("mail-spam-blacklist-add")?.addEventListener("click", () => {
  const root = document.getElementById("mail-spam-blacklist-items");
  if (!root) return;
  root.insertAdjacentHTML("beforeend", `
    <div class="grid grid-cols-[1fr_auto] items-center gap-2 spam-blacklist-row">
      <input type="text" class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
      <button type="button" class="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="${t("actions.remove", "Eliminar")}">
        <i class="ti ti-x text-sm"></i>
      </button>
    </div>
  `);
  root.lastElementChild?.querySelector("button")?.addEventListener("click", (event) => {
    (event.currentTarget as HTMLElement | null)?.closest(".spam-blacklist-row")?.remove();
  });
});

document.getElementById("mail-spam-calculated-add")?.addEventListener("click", () => {
  const root = document.getElementById("mail-spam-calculated-items");
  if (!root) return;
  root.insertAdjacentHTML("beforeend", createSpamCalculatedRowHtml({ type: S.mailSpamScoreTypes[0] ?? "BAYES_50", score: 5 }));
  root.lastElementChild?.querySelector("button")?.addEventListener("click", (event) => {
    (event.currentTarget as HTMLElement | null)?.closest(".spam-calculated-row")?.remove();
  });
});

document.getElementById("mail-spam-save-threshold")?.addEventListener("click", async () => {
  const select = document.getElementById("mail-spam-required-score-select") as HTMLSelectElement | null;
  const customInput = document.getElementById("mail-spam-custom-score") as HTMLInputElement | null;
  if (!select) return;
  const requiredScoreSelect = select.value as RequiredScoreSelect;
  if (requiredScoreSelect === "custom") {
    const customRaw = Number(customInput?.value ?? "5");
    if (!Number.isFinite(customRaw) || customRaw < 0) {
      setSpamFiltersError(t("errors.customScoreInvalid", "Custom score inválido."));
      return;
    }
    await saveSpamFiltersPatch(
      { requiredScoreSelect, customRequiredScore: customRaw, requiredScore: customRaw },
      t("toasts.spamThresholdUpdated", "Spam Threshold actualizado"),
    );
    return;
  }
  await saveSpamFiltersPatch(
    { requiredScoreSelect },
    t("toasts.spamThresholdUpdated", "Spam Threshold actualizado"),
  );
});

document.getElementById("mail-spam-save-spam-box")?.addEventListener("click", async () => {
  const enabled = (document.getElementById("mail-spam-box-view-enabled") as HTMLInputElement | null)?.checked ?? false;
  await saveSpamFiltersPatch({ spamBoxEnabled: enabled }, t("toasts.spamBoxUpdated", "Spam Box actualizado"));
});

document.getElementById("mail-spam-save-autodelete")?.addEventListener("click", async () => {
  const enabled = (document.getElementById("mail-spam-autodelete-view-enabled") as HTMLInputElement | null)?.checked ?? false;
  const threshold = Number((document.getElementById("mail-spam-autodelete-threshold") as HTMLInputElement | null)?.value ?? "5");
  if (!Number.isFinite(threshold) || threshold < 0) {
    setSpamFiltersError(t("errors.autoDeleteThresholdInvalid", "Auto-Delete Threshold inválido."));
    return;
  }
  await saveSpamFiltersPatch(
    { autoDeleteEnabled: enabled, autoDeleteThresholdScore: threshold },
    t("toasts.autoDeleteUpdated", "Auto-Delete actualizado"),
  );
});

document.getElementById("mail-spam-save-whitelist")?.addEventListener("click", async () => {
  const whitelistFrom = collectSpamListValues("mail-spam-whitelist-items");
  await saveSpamFiltersPatch({ whitelistFrom }, t("toasts.whitelistUpdated", "Whitelist actualizada"));
});

document.getElementById("mail-spam-save-blacklist")?.addEventListener("click", async () => {
  const blacklistFrom = collectSpamListValues("mail-spam-blacklist-items");
  await saveSpamFiltersPatch({ blacklistFrom }, t("toasts.blacklistUpdated", "Blacklist actualizada"));
});

document.getElementById("mail-spam-save-calculated")?.addEventListener("click", async () => {
  const calculatedScores = collectSpamCalculatedScores();
  await saveSpamFiltersPatch({ calculatedScores }, t("toasts.calculatedScoresUpdated", "Calculated scores actualizados"));
});

document.getElementById("mail-spam-enabled")?.addEventListener("change", async () => {
  const enabled = (document.getElementById("mail-spam-enabled") as HTMLInputElement | null)?.checked ?? true;
  await saveSpamFiltersPatch({ enabled }, enabled ? t("toasts.spamFiltersEnabled", "Spam Filters habilitado") : t("toasts.spamFiltersDisabled", "Spam Filters deshabilitado"));
});

document.getElementById("mail-spam-box-enabled")?.addEventListener("change", async () => {
  const spamBoxEnabled = (document.getElementById("mail-spam-box-enabled") as HTMLInputElement | null)?.checked ?? true;
  const spamBoxViewEnabled = document.getElementById("mail-spam-box-view-enabled") as HTMLInputElement | null;
  if (spamBoxViewEnabled) spamBoxViewEnabled.checked = spamBoxEnabled;
  await saveSpamFiltersPatch({ spamBoxEnabled }, spamBoxEnabled ? t("toasts.spamBoxEnabled", "Spam Box habilitado") : t("toasts.spamBoxDisabled", "Spam Box deshabilitado"));
});

document.getElementById("mail-spam-autodelete-enabled")?.addEventListener("change", async () => {
  const autoDeleteEnabled = (document.getElementById("mail-spam-autodelete-enabled") as HTMLInputElement | null)?.checked ?? false;
  const autoDeleteViewEnabled = document.getElementById("mail-spam-autodelete-view-enabled") as HTMLInputElement | null;
  if (autoDeleteViewEnabled) autoDeleteViewEnabled.checked = autoDeleteEnabled;
  await saveSpamFiltersPatch({ autoDeleteEnabled }, autoDeleteEnabled ? t("toasts.autoDeleteEnabled", "Auto-Delete habilitado") : t("toasts.autoDeleteDisabled", "Auto-Delete deshabilitado"));
});
}
