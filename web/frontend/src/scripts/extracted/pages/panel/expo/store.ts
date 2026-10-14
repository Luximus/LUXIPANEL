// Expo page — store submit (Play / App Store) + store-account credentials.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { awaitJob } from "/scripts/extracted/lib/job-poll.js";
import { S, EXPO_STORE_TABLE_ID } from "./state";
import type { ExpoProject, ExpoStoreCredentials, StoreRow } from "./state";
import { t, $, showToast, readFileText, tsOf } from "./dom";
import { publishExpoRows, setExpoTableLoading } from "./table-bridge";

// ── Store submit ──────────────────────────────────────────────────────────────
export async function submitToStore(project: ExpoProject, platform: "android" | "ios") {
  const msg = platform === "android" ? t("submit.confirmPlay", "¿Enviar el último build de Android a Google Play?") : t("submit.confirmApple", "¿Enviar el último build de iOS a la App Store?");
  if (!(await openConfirm(msg, { title: t("submit.title", "Enviar a tiendas"), confirmText: t("submit.confirmText", "Enviar") }))) return;
  const res = await api.post("/api/expo/submit", { path: project.path, platform, profile: "production" });
  if (res.ok) await awaitJob(res);
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  showToast(t("submit.submitted", "Envío iniciado"));
}
// ── Store accounts ────────────────────────────────────────────────────────────
export async function uploadGoogleJson() {
  const input = $("expo-google-json") as HTMLInputElement | null;
  S.googleJsonContent = await readFileText(input);
  const stateEl = $("expo-google-state");
  if (!S.googleJsonContent) {
    if (stateEl) stateEl.textContent = "";
    return;
  }
  const project = S.currentProject;
  if (!project) {
    showToast(t("storeAccounts.noProject", "Crea o vincula un proyecto Expo antes de subir credenciales"), false);
    return;
  }
  if (stateEl) stateEl.textContent = input?.files?.[0]?.name ?? t("storeAccounts.jsonLoaded", "JSON cargado");
  const res = await api.post("/api/expo/credentials/google", {
    path: project.path,
    serviceAccountJson: S.googleJsonContent,
  });
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  showToast(t("storeAccounts.saved", "Credenciales guardadas"));
  void loadStoreCredentials();
}

export async function selectAppleP8() {
  const input = $("expo-apple-p8") as HTMLInputElement | null;
  S.appleP8Content = await readFileText(input);
  const stateEl = $("expo-apple-state");
  if (stateEl) stateEl.textContent = S.appleP8Content ? input?.files?.[0]?.name ?? t("storeAccounts.p8Loaded", ".p8 cargado") : "";
}

export async function saveAppleCreds() {
  const issuerId = ($("expo-apple-issuer") as HTMLInputElement | null)?.value.trim() ?? "";
  const keyId = ($("expo-apple-key-id") as HTMLInputElement | null)?.value.trim() ?? "";
  if (!issuerId || !keyId) {
    showToast(t("storeAccounts.issuerKeyRequired", "Indica Issuer ID y Key ID"), false);
    return;
  }
  const project = S.currentProject;
  if (!project) {
    showToast(t("storeAccounts.noProject", "Crea o vincula un proyecto Expo antes de subir credenciales"), false);
    return;
  }
  if (!S.appleP8Content) {
    showToast(t("storeAccounts.p8Required", "Selecciona el archivo .p8 de la API Key"), false);
    return;
  }
  const res = await api.post("/api/expo/credentials/apple", {
    path: project.path,
    issuerId,
    keyId,
    p8: S.appleP8Content,
  });
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  showToast(t("storeAccounts.saved", "Credenciales guardadas"));
  void loadStoreCredentials();
}

/**
 * Load and display the current store-account credential state (what EAS has on
 * the account + whether a local file is staged), so the panel shows existing
 * data instead of a bare upload form.
 */
export async function loadStoreCredentials() {
  const targetGeneration = S.targetGeneration;
  const project = S.currentProject;
  const gEl = $("expo-google-state");
  const aEl = $("expo-apple-state");
  if (!project) {
    if (gEl) gEl.textContent = "";
    if (aEl) aEl.textContent = "";
    S.storeRows = [];
    publishExpoRows(EXPO_STORE_TABLE_ID, []);
    return;
  }
  setExpoTableLoading(EXPO_STORE_TABLE_ID, true);
  const body: Record<string, unknown> = { path: project.path };
  if (project.projectId) body.projectId = project.projectId;
  const res = await api.post<ExpoStoreCredentials>("/api/expo/store-credentials", body);
  if (targetGeneration !== S.targetGeneration || S.currentProject?.path !== project.path) return;
  if (!res.ok || !res.data) {
    showToast(res.error ?? t("common.error", "Error"), false);
    S.storeRows = [];
    publishExpoRows(EXPO_STORE_TABLE_ID, []);
    return;
  }
  renderStoreCredentials(res.data);
}

/** Flatten the three credential sources into unified table rows. */
export function buildStoreRows(c: ExpoStoreCredentials): StoreRow[] {
  const EAS_TONE = "bg-emerald-500/10 text-emerald-500";
  const PROJ_TONE = "bg-sky-500/10 text-sky-500";
  const PANEL_TONE = "bg-amber-500/10 text-amber-500";
  const rows: StoreRow[] = [];
  // Google Play
  for (const k of c.google.cloudKeys) {
    rows.push({ platform: "Google Play", source: "EAS", sourceTone: EAS_TONE, detail: k.clientEmail ?? t("storeAccounts.serviceKey", "(clave de servicio)"), updatedAt: k.updatedAt });
  }
  if (c.google.projectFile) {
    rows.push({ platform: "Google Play", source: t("storeAccounts.sourceProject", "Proyecto"), sourceTone: PROJ_TONE, detail: c.google.projectFile.clientEmail ?? c.google.projectFile.path, updatedAt: null });
  }
  if (c.google.localFile) {
    rows.push({ platform: "Google Play", source: t("storeAccounts.sourcePanel", "Panel"), sourceTone: PANEL_TONE, detail: t("storeAccounts.googleUnassigned", "google-service-account.json (sin asignar)"), updatedAt: null });
  }
  // App Store Connect
  for (const k of c.apple.cloudKeys) {
    const detail = [k.name, k.keyIdentifier ? `Key ${k.keyIdentifier}` : null, k.issuerIdentifier ? `Issuer ${k.issuerIdentifier}` : null].filter(Boolean).join(" · ");
    rows.push({ platform: "App Store Connect", source: "EAS", sourceTone: EAS_TONE, detail: detail || t("storeAccounts.apiKey", "(API key)"), updatedAt: k.updatedAt });
  }
  if (c.apple.projectFile) {
    const pf = c.apple.projectFile;
    const ids = [pf.keyId ? `Key ${pf.keyId}` : null, pf.issuerId ? `Issuer ${pf.issuerId}` : null].filter(Boolean).join(" · ");
    rows.push({ platform: "App Store Connect", source: t("storeAccounts.sourceProject", "Proyecto"), sourceTone: PROJ_TONE, detail: ids || `${pf.path} (${t("storeAccounts.idsNotSet", "IDs sin configurar")})`, updatedAt: null });
  }
  if (c.apple.localFile) {
    rows.push({ platform: "App Store Connect", source: t("storeAccounts.sourcePanel", "Panel"), sourceTone: PANEL_TONE, detail: t("storeAccounts.p8UploadedUnassigned", ".p8 subido (sin asignar)"), updatedAt: null });
  }
  return rows;
}

export function renderStoreTable() {
  const rows = S.storeRows.map((r, i) => ({
    id: i,
    platform: r.platform,
    source: r.source,
    detail: r.detail,
    updated: r.updatedAt ? r.updatedAt.slice(0, 10) : "—",
    updatedTs: tsOf(r.updatedAt),
  }));
  publishExpoRows(EXPO_STORE_TABLE_ID, rows);
}

export function renderStoreCredentials(c: ExpoStoreCredentials) {
  // Unified table (all sources flattened), paginated 10/page.
  S.storeRows = buildStoreRows(c);
  S.storePage = 0;
  renderStoreTable();

  const GREEN = "text-xs font-medium text-emerald-500";
  const AMBER = "text-xs font-medium text-amber-500";
  const MUTED = "text-xs text-muted-foreground";

  const gEl = $("expo-google-state");
  if (gEl) {
    const cloud = c.google.cloudKeys[0];
    if (cloud) {
      gEl.className = GREEN;
      gEl.textContent = `${t("storeAccounts.configuredEas", "Configurado en EAS")}${cloud.clientEmail ? ` · ${cloud.clientEmail}` : ""}`;
    } else if (c.google.projectFile) {
      gEl.className = GREEN;
      gEl.textContent = `${t("storeAccounts.configuredProject", "Configurado (archivo en el proyecto)")}${
        c.google.projectFile.clientEmail ? ` · ${c.google.projectFile.clientEmail}` : ""
      }`;
    } else if (c.google.localFile) {
      gEl.className = AMBER;
      gEl.textContent = t("storeAccounts.fileUploadedUnassigned", "Archivo subido (sin asignar en EAS)");
    } else {
      gEl.className = MUTED;
      gEl.textContent = t("storeAccounts.notConfigured", "No configurado");
    }
  }

  const aEl = $("expo-apple-state");
  if (aEl) {
    const cloud = c.apple.cloudKeys[0];
    const idParts = (keyId: string | null, issuerId: string | null) =>
      [keyId ? `Key ${keyId}` : null, issuerId ? `Issuer ${issuerId}` : null].filter(Boolean).join(" · ");
    if (cloud) {
      aEl.className = GREEN;
      const parts = idParts(cloud.keyIdentifier, cloud.issuerIdentifier);
      aEl.textContent = `${t("storeAccounts.configuredEas", "Configurado en EAS")}${parts ? ` · ${parts}` : ""}`;
    } else if (c.apple.projectFile) {
      const parts = idParts(c.apple.projectFile.keyId, c.apple.projectFile.issuerId);
      if (parts) {
        aEl.className = GREEN;
        aEl.textContent = `${t("storeAccounts.configuredProject", "Configurado (archivo en el proyecto)")} · ${parts}`;
      } else {
        aEl.className = AMBER;
        aEl.textContent = t("storeAccounts.p8InProjectNoIds", "Archivo .p8 en el proyecto (IDs sin configurar)");
      }
    } else if (c.apple.localFile) {
      aEl.className = AMBER;
      aEl.textContent = t("storeAccounts.p8UploadedUnassigned", ".p8 subido (sin asignar)");
    } else {
      aEl.className = MUTED;
      aEl.textContent = t("storeAccounts.notConfigured", "No configurado");
    }
  }
}
