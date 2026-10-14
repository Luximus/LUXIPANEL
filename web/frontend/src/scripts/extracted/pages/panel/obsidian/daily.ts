import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { state, vaultApi } from "./state";
import { $, t, showToast } from "./dom";
import { confirmDiscardDirty, displayNote, openNote, closeEditor } from "./editor";
import { loadTree } from "./tree";
import { openDialog } from "/scripts/extracted/lib/dom.js";

type Today = { date: string; path: string; exists: boolean; content: string; canWrite: boolean };

export async function openToday(): Promise<void> {
  if (!state.vaultId) return;
  const vaultId = state.vaultId;
  const scopeSeq = state.scopeSeq;
  if (!(await confirmDiscardDirty()) || vaultId !== state.vaultId || scopeSeq !== state.scopeSeq) return;
  const res = await api.get<Today>(vaultApi("/daily/today"));
  if (vaultId !== state.vaultId || scopeSeq !== state.scopeSeq) return;
  if (!res.ok || !res.data) return showToast(res.error ?? t("errors.openNote", "No se pudo abrir la nota"), false);
  displayNote(res.data.path, res.data.content, res.data.canWrite, !res.data.exists);
}

export function openQuickEntry(): void {
  if (!state.vaultId || !state.vaults.find((v) => v.id === state.vaultId)?.canWrite) return;
  openDialog("dlg-obs-daily");
  ($("obs-daily-content") as HTMLTextAreaElement | null)?.focus();
}

export async function appendQuickEntry(): Promise<void> {
  if (!state.vaultId) return;
  const textarea = $("obs-daily-content") as HTMLTextAreaElement | null;
  const content = textarea?.value.trim() ?? "";
  if (!content) return showToast(t("workspace.entryRequired", "Escribe una entrada antes de añadirla"), false);
  const vaultId = state.vaultId;
  const scopeSeq = state.scopeSeq;
  if (!(await confirmDiscardDirty()) || vaultId !== state.vaultId || scopeSeq !== state.scopeSeq) return;
  const button = $("obs-daily-save") as HTMLButtonElement | null;
  if (button) button.disabled = true;
  const res = await api.post<{ path: string }>(vaultApi("/daily"), { content });
  if (button) button.disabled = false;
  if (vaultId !== state.vaultId || scopeSeq !== state.scopeSeq) return;
  if (!res.ok) return showToast(res.error ?? t("workspace.entryError", "No se pudo añadir la entrada"), false);
  ($("dlg-obs-daily") as HTMLDialogElement | null)?.close();
  if (textarea) textarea.value = "";
  state.dirty = false;
  closeEditor();
  await loadTree();
  if (res.data?.path) await openNote(res.data.path);
  showToast(t("workspace.entryAdded", "Entrada añadida"));
}
