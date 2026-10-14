import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { state } from "./state";
import { $, t, showToast } from "./dom";
import { applyEditorMode } from "./preview";

type Preferences = { editorMode: "edit" | "preview" | "split"; fontSize: number; lastVaultId: string | null };

export async function loadPreferences(): Promise<void> {
  const scopeSeq = state.scopeSeq;
  const res = await api.get<Preferences>("/api/obsidian/preferences");
  if (scopeSeq !== state.scopeSeq || !res.ok || !res.data) return;
  state.editorMode = res.data.editorMode;
  state.fontSize = res.data.fontSize;
  state.lastVaultId = res.data.lastVaultId;
  const mode = $("obs-pref-mode") as HTMLSelectElement | null;
  const font = $("obs-pref-font") as HTMLSelectElement | null;
  if (mode) mode.value = state.editorMode;
  if (font) font.value = String(state.fontSize);
  applyEditorMode();
}

export function resetPreferences(): void {
  state.editorMode = "edit";
  state.fontSize = 14;
  state.lastVaultId = null;
  const mode = $("obs-pref-mode") as HTMLSelectElement | null;
  const font = $("obs-pref-font") as HTMLSelectElement | null;
  if (mode) mode.value = "edit";
  if (font) font.value = "14";
  const status = $("obs-pref-status");
  if (status) status.textContent = "";
}

export async function patchPreferences(update: Partial<Preferences>): Promise<void> {
  const res = await api.patch<Preferences>("/api/obsidian/preferences", update);
  if (!res.ok) {
    showToast(res.error ?? t("errors.savePreferences", "No se pudieron guardar las preferencias"), false);
    return;
  }
  const status = $("obs-pref-status");
  if (status) status.textContent = t("workspace.saved", "Guardado");
}
