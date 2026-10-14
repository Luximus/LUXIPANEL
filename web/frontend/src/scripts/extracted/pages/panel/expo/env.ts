// Expo page — EAS environment variables / secrets mini-manager.
import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
import { api,resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { S, EXPO_ENV_TABLE_ID } from "./state";
import type { ExpoEnvVar } from "./state";
import { t, $, dlg, showToast, fmt, syncFilterOptions, expoEnvScopeLabel, expoEnvVisibilityLabel, expoEnvEnvironmentLabel } from "./dom";
import { publishExpoRows, setExpoTableLoading } from "./table-bridge";

const envPages=createTablePages({tableId:EXPO_ENV_TABLE_ID,events:window,scope:resolveTargetScope,reload:()=>loadEnvVars(),field:"auto"});

// ── Env / secrets ─────────────────────────────────────────────────────────────
export async function loadEnvVars() {
  const targetGeneration = S.targetGeneration;
  const project = S.currentProject;
  if (!project) {
    S.envVars = [];
    S.envFiltered = [];
    publishExpoRows(EXPO_ENV_TABLE_ID, []);
    return;
  }
  setExpoTableLoading(EXPO_ENV_TABLE_ID, true);
  const body: Record<string, unknown> = { path: project.path };
  if (project.projectId) body.projectId = project.projectId;
  const res = await envPages.read<ExpoEnvVar[]>(params=>{const query=JSON.parse(params.tableWindow!);const f=S.envFilters;query.filters.push(...[{key:"name",type:"text",value:f.text.trim()},{key:"scope",type:"select",value:f.scope},{key:"visibility",type:"select",value:f.visibility},{key:"environments",type:"text",value:f.environment}].filter(filter=>filter.value));return api.post<ExpoEnvVar[]>("/api/expo/env-list",body,{params:{...params,tableWindow:JSON.stringify(query)}});},JSON.stringify([body,S.envFilters]));
  if(res.code==="TARGET_SCOPE_CHANGED")return;
  if (targetGeneration !== S.targetGeneration || S.currentProject?.path !== project.path) return;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    S.envVars = [];
    S.envFiltered = [];
    publishExpoRows(EXPO_ENV_TABLE_ID, []);
    return;
  }
  S.envVars = res.data ?? [];
  S.envVarsPage = 0;
  renderEnvVars();
}

/** Apply the env filter bar (text + scope/visibility/environment) to the list. */
export function applyEnvFilters(): ExpoEnvVar[] {
  const f = S.envFilters;
  const text = f.text.trim().toLowerCase();
  return S.envVars.filter((v) => {
    if (text && !v.name.toLowerCase().includes(text)) return false;
    if (f.scope && v.scope !== f.scope) return false;
    if (f.visibility && v.visibility !== f.visibility) return false;
    if (f.environment && !(v.environments ?? []).includes(f.environment)) return false;
    return true;
  });
}

/** Masked display value: secret/sensitive vars never expose their content. */
export function envDisplayValue(v: ExpoEnvVar): string {
  if (v.visibility === "secret" || v.visibility === "sensitive") return "••••••";
  return v.value ?? "—";
}

export function renderEnvVars() {
  // Sync the external filter selects with the data.
  syncFilterOptions("expo-env-filter-scope", S.envVars.map((v) => v.scope), t("env.filterScopeAll", "Ámbito: todos"), expoEnvScopeLabel);
  syncFilterOptions("expo-env-filter-visibility", S.envVars.map((v) => v.visibility), t("env.filterVisibilityAll", "Visibilidad: todas"), expoEnvVisibilityLabel);
  syncFilterOptions("expo-env-filter-env", S.envVars.flatMap((v) => v.environments ?? []), t("env.filterEnvAll", "Entorno: todos"), expoEnvEnvironmentLabel);

  S.envFiltered = applyEnvFilters();
  const rows = S.envFiltered.map((v) => {
    const envs = (v.environments ?? []).map(expoEnvEnvironmentLabel).join(", ");
    return {
      id: v.id || v.name,
      name: v.name,
      value: envDisplayValue(v),
      scope: expoEnvScopeLabel(v.scope),
      visibility: expoEnvVisibilityLabel(v.visibility),
      environments: envs || "—",
      _envId: v.id ?? "",
      _name: v.name,
      _canEdit: !!v.id, // GraphQL-backed vars only
    };
  });
  publishExpoRows(EXPO_ENV_TABLE_ID, rows);
}

/** Open the env dialog for create (no arg) or edit (pass the variable). */
export function openEnvDialog(editVar?: ExpoEnvVar) {
  S.editingEnvId = editVar?.id ?? null;
  const titleEl = $("expo-env-dialog-title");
  if (titleEl) titleEl.textContent = editVar ? t("env.editTitle", "Editar variable") : t("env.newTitle", "Nueva variable");
  const nameEl = $("expo-env-name") as HTMLInputElement | null;
  const valueEl = $("expo-env-value") as HTMLInputElement | null;
  if (nameEl) {
    nameEl.value = editVar?.name ?? "";
    nameEl.readOnly = !!editVar; // name is the identifier; don't rename on edit
  }
  if (valueEl) valueEl.value = editVar?.value ?? "";
  const vis = $("expo-env-visibility") as HTMLSelectElement | null;
  if (vis) vis.value = editVar?.visibility === "public" ? "plaintext" : (editVar?.visibility ?? "plaintext");
  const envs = editVar?.environments ?? ["production"];
  document.querySelectorAll<HTMLInputElement>(".expo-env-env-cb").forEach((cb) => {
    cb.checked = envs.includes(cb.value);
  });
  const d = dlg("dlg-expo-env");
  if (d && !d.open) d.showModal();
}

export async function saveEnvVar() {
  const name = ($("expo-env-name") as HTMLInputElement | null)?.value.trim() ?? "";
  const value = ($("expo-env-value") as HTMLInputElement | null)?.value ?? "";
  const visibility = ($("expo-env-visibility") as HTMLSelectElement | null)?.value ?? "plaintext";
  const environments = Array.from(document.querySelectorAll<HTMLInputElement>(".expo-env-env-cb"))
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);
  if (!name) {
    showToast(t("create.nameRequired", "Indica un nombre"), false);
    return;
  }
  if (environments.length === 0) {
    showToast(t("env.environmentRequired", "Selecciona al menos un entorno"), false);
    return;
  }
  const project = S.currentProject;
  if (!project) {
    showToast(t("env.noProjectToast", "Crea o vincula un proyecto Expo primero"), false);
    return;
  }
  const editingId = S.editingEnvId;
  const res = editingId
    ? await api.post("/api/expo/env-update", {
        path: project.path,
        projectId: project.projectId ?? undefined,
        id: editingId,
        value,
        visibility,
        environments,
      })
    : await api.post("/api/expo/env-set", {
        path: project.path,
        projectId: project.projectId ?? undefined,
        name,
        value,
        visibility,
        environments,
      });
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  dlg("dlg-expo-env")?.close();
  showToast(editingId ? t("env.updated", "Variable actualizada") : t("env.saved", "Variable guardada"));
  void loadEnvVars();
}

export async function deleteEnvVar(v: ExpoEnvVar) {
  if (!v.id) return;
  const project = S.currentProject;
  if (!project) return;
  if (!(await openConfirm(fmt(t("env.confirmDelete", "¿Eliminar la variable {name}?"), { name: v.name }), { title: t("env.deleteTitle", "Eliminar variable"), confirmText: t("env.deleteConfirm", "Eliminar"), variant: "danger" }))) return;
  const res = await api.post("/api/expo/env-delete", {
    path: project.path,
    projectId: project.projectId ?? undefined,
    id: v.id,
  });
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  showToast(t("env.deleted", "Variable eliminada"));
  void loadEnvVars();
}
