// Files preferences belong to the current user on the connected server.
import { DEFAULT_FILE_SHORTCUTS, FILES_FAV_ROOTS_KEY, SHOW_HIDDEN_KEY, S } from "./state";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";

export type FilesPreferencesPatch = {
  mode?: "client" | "developer";
  showHidden?: boolean;
  favoriteRoots?: string[];
  treeExpansionMode?: "multiple" | "single";
  shortcuts?: Record<string, string>;
};

const preferenceRequests = new Map<string, Promise<void>>();
let preferencesVersion = 0;

export async function patchFilesPreferences(values: FilesPreferencesPatch): Promise<{ ok: boolean; error?: string }> {
  const res = await api.patch<any>("/api/files/preferences", values);
  return { ok: res.ok, error: res.error };
}

export function invalidateFilesPreferences(): void {
  preferencesVersion++;
  preferenceRequests.clear();
  S.preferencesLoadedScope = "";
  S.filesClientMode = false;
  S.favoriteRoots = [];
  S.showHidden = false;
  S.treeExpansionMode = "multiple";
  S.fileShortcutConfig = { ...DEFAULT_FILE_SHORTCUTS };
}

export async function loadFilesPreferences(): Promise<void> {
  const scope = S.activeTargetScope || "local";
  if (S.preferencesLoadedScope === scope) {
    window.dispatchEvent(new Event("luxipanel:files-preferences-loaded"));
    return;
  }
  const pending = preferenceRequests.get(scope);
  if (pending) return pending;
  const version = preferencesVersion;
  const request = loadFilesPreferencesUncached(scope, version).finally(() => {
    if (preferenceRequests.get(scope) === request) preferenceRequests.delete(scope);
  });
  preferenceRequests.set(scope, request);
  return request;
}

async function loadFilesPreferencesUncached(scope: string, version: number): Promise<void> {
  const res = await api.get<any>("/api/files/preferences");
  if (!res.ok || version !== preferencesVersion || scope !== (S.activeTargetScope || "local")) return;
  const data = res.data || {};
  S.filesClientMode = data.mode === "client";
  const migration: FilesPreferencesPatch = {};
  if (typeof data.showHidden === "boolean") S.showHidden = data.showHidden;
  else {
    try { S.showHidden = localStorage.getItem(SHOW_HIDDEN_KEY) === "1"; } catch { S.showHidden = false; }
    migration.showHidden = S.showHidden;
  }
  if (Array.isArray(data.favoriteRoots)) S.favoriteRoots = data.favoriteRoots;
  else {
    try {
      const raw = localStorage.getItem(`${FILES_FAV_ROOTS_KEY}::${scope}`);
      const parsed = raw ? JSON.parse(raw) : [];
      S.favoriteRoots = Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string" && p.startsWith("/")).slice(0, 50) : [];
    } catch { S.favoriteRoots = []; }
    migration.favoriteRoots = S.favoriteRoots;
  }
  S.treeExpansionMode = data.treeExpansionMode === "single" ? "single" : "multiple";
  S.fileShortcutConfig = { ...DEFAULT_FILE_SHORTCUTS, ...(data.shortcuts || data.legacyShortcuts || {}) };
  if (!data.shortcuts && data.legacyShortcuts) migration.shortcuts = S.fileShortcutConfig;
  S.preferencesLoadedScope = scope;
  window.dispatchEvent(new Event("luxipanel:files-preferences-loaded"));
  if (Object.keys(migration).length) await patchFilesPreferences(migration);
}
