// Obsidian page — note editor (open / save / create / rename / delete / folders)
// + discard-dirty confirmation.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { state, vaultApi } from "./state";
import { t, fmt, esc, showToast, $ } from "./dom";
import { askInput } from "./input-dialog";
import { loadTree, renderTree } from "./tree";
import { loadLinks, setLinksChevron } from "./links";
import { applyEditorMode, showMobilePane } from "./preview";

export function displayNote(path: string, content: string, canWrite: boolean, draftNew = false): void {
  state.notePath = path;
  state.noteCanWrite = canWrite;
  state.draftNew = draftNew;
  state.dirty = false;
  state.linksOpen = false;
  $("obs-note-readonly")?.classList.toggle("hidden", canWrite);
  const pathEl = $("obs-note-path");
  if (pathEl) {
    pathEl.textContent = path;
  }
  const name = $("obs-note-name");
  if (name) name.textContent = path.split("/").pop() ?? path;
  const editor = $("obs-editor") as HTMLTextAreaElement | null;
  if (editor) {
    editor.value = content;
    editor.readOnly = !canWrite;
  }
  $("obs-editor-empty")?.classList.add("hidden");
  $("obs-links-panel")?.classList.add("hidden");
  setLinksChevron(false);
  for (const id of ["obs-links-toggle", "obs-analyze-ai"]) {
    $(id)?.classList.toggle("hidden", draftNew);
    $(id)?.classList.toggle("inline-flex", !draftNew);
  }
  $("obs-save")?.classList.toggle("hidden", !canWrite);
  $("obs-save")?.classList.toggle("inline-flex", canWrite);
  applyEditorMode();
  updateDirtyIndicator();
  renderTree();
  showMobilePane("editor");
}

/** Confirm discarding unsaved editor changes before navigating away. */
export async function confirmDiscardDirty(): Promise<boolean> {
  if (!state.dirty) return true;
  return openConfirm(t("confirm.discardDirtyBody", "Hay cambios sin guardar en la nota actual. ¿Descartarlos?"), {
    title: t("confirm.discardDirtyTitle", "Cambios sin guardar"),
    confirmText: t("confirm.discardDirtyConfirm", "Descartar"),
    cancelText: t("confirm.discardDirtyCancel", "Seguir editando"),
    variant: "danger",
  });
}

// ── Notes (open / save / create / rename / delete / folders) ─────────────────
export async function openNote(relPath: string, line?: number) {
  if (!state.vaultId) return;
  if (relPath === state.notePath && !state.dirty && !line) return;
  const vaultId = state.vaultId;
  const scopeSeq = state.scopeSeq;
  if (!(await confirmDiscardDirty()) || vaultId !== state.vaultId || scopeSeq !== state.scopeSeq) return;
  const res = await api.get<{ path: string; content: string; canWrite: boolean }>(
    vaultApi(`/note?path=${encodeURIComponent(relPath)}`),
  );
  if (vaultId !== state.vaultId || scopeSeq !== state.scopeSeq) return;
  if (!res.ok) {
    showToast(res.error ?? t("errors.openNote", "No se pudo abrir la nota"), false);
    return;
  }
  displayNote(res.data?.path ?? relPath, res.data?.content ?? "", !!res.data?.canWrite);
  if (line && line > 0) {
    if (state.editorMode === "preview") {
      state.editorMode = "edit";
      applyEditorMode();
    }
    const editor = $("obs-editor") as HTMLTextAreaElement | null;
    if (editor) {
      const lines = editor.value.split("\n");
      const index = lines.slice(0, Math.min(line - 1, lines.length)).reduce((sum, part) => sum + part.length + 1, 0);
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(index, index + (lines[line - 1]?.length ?? 0));
      editor.scrollTop = Math.max(0, (line - 3) * state.fontSize * 1.5);
    }
  }
}

export function closeEditor() {
  state.notePath = null;
  state.dirty = false;
  state.linksOpen = false;
  state.noteCanWrite = false;
  state.draftNew = false;
  $("obs-note-readonly")?.classList.add("hidden");
  const pathEl = $("obs-note-path");
  if (pathEl) {
    pathEl.textContent = "";
  }
  const name = $("obs-note-name");
  if (name) name.textContent = t("editor.emptyTitle", "Selecciona una nota");
  ($("obs-editor") as HTMLTextAreaElement | null)?.classList.add("hidden");
  $("obs-preview")?.classList.add("hidden");
  $("obs-mode-tabs")?.classList.add("hidden");
  $("obs-editor-empty")?.classList.remove("hidden");
  $("obs-links-panel")?.classList.add("hidden");
  for (const id of ["obs-save", "obs-analyze-ai", "obs-links-toggle"]) {
    $(id)?.classList.add("hidden");
    $(id)?.classList.remove("inline-flex");
  }
  updateDirtyIndicator();
}

export function updateDirtyIndicator() {
  $("obs-dirty")?.classList.toggle("hidden", !state.dirty);
}

export async function saveNote() {
  if (!state.vaultId || !state.notePath) return;
  if (!state.noteCanWrite) return;
  const editor = $("obs-editor") as HTMLTextAreaElement | null;
  if (!editor) return;
  const savedContent = editor.value;
  const savedPath = state.notePath;
  const saveBtn = $("obs-save") as HTMLButtonElement | null;
  if (saveBtn) saveBtn.disabled = true;
  const res = await api.put(vaultApi("/note"), { path: savedPath, content: savedContent });
  if (saveBtn) saveBtn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("errors.saveNote", "No se pudo guardar la nota"), false);
    return;
  }
  if (state.notePath !== savedPath) return;
  state.dirty = editor.value !== savedContent;
  if (state.draftNew) {
    state.draftNew = false;
    await loadTree();
    for (const id of ["obs-links-toggle", "obs-analyze-ai"]) {
      $(id)?.classList.remove("hidden");
      $(id)?.classList.add("inline-flex");
    }
  }
  updateDirtyIndicator();
  showToast(t("toasts.noteSaved", "Nota guardada"));
  if (state.linksOpen) void loadLinks();
}

export async function createNote() {
  if (!state.vaultId) {
    showToast(t("errors.noVaultSelected", "Selecciona un vault primero"), false);
    return;
  }
  // Ask BEFORE doing anything: creating a note replaces the open editor
  // content, so unsaved changes need an explicit discard confirmation.
  if (!(await confirmDiscardDirty())) return;
  let rel = await askInput(t("actions.newNoteInputTitle", "Nueva nota"), t("labels.newNoteInputLabel", "Ruta relativa dentro del vault (ej: Ideas/Mi nota.md)"));
  if (!rel) return;
  rel = rel.replace(/^\/+/, "");
  if (!/\.(md|canvas|txt)$/i.test(rel)) rel = `${rel}.md`;
  const res = await api.put(vaultApi("/note"), { path: rel, content: "" });
  if (!res.ok) {
    showToast(res.error ?? t("errors.createNote", "No se pudo crear la nota"), false);
    return;
  }
  showToast(t("toasts.noteCreated", "Nota creada"));
  // The user already approved the discard above; clear the flag so openNote
  // doesn't prompt a second time. Cancel/failure paths keep dirty intact.
  state.dirty = false;
  await loadTree();
  await openNote(rel);
}

export async function createFolder() {
  if (!state.vaultId) {
    showToast(t("errors.noVaultSelected", "Selecciona un vault primero"), false);
    return;
  }
  let rel = await askInput(t("actions.newFolderInputTitle", "Nueva carpeta"), t("labels.newFolderInputLabel", "Ruta relativa dentro del vault (ej: Proyectos/2026)"));
  if (!rel) return;
  rel = rel.replace(/^\/+/, "");
  const res = await api.post(vaultApi("/folders"), { path: rel });
  if (!res.ok) {
    showToast(res.error ?? t("errors.createFolder", "No se pudo crear la carpeta"), false);
    return;
  }
  showToast(t("toasts.folderCreated", "Carpeta creada"));
  await loadTree();
}

export async function renameNote(from: string) {
  if (!state.vaultId) return;
  let to = await askInput(t("actions.renameInputTitle", "Renombrar nota"), t("labels.renameInputLabel", "Nueva ruta relativa"), from);
  if (!to || to === from) return;
  to = to.replace(/^\/+/, "");
  const res = await api.post(vaultApi("/note/rename"), { from, to });
  if (!res.ok) {
    showToast(res.error ?? t("errors.renameNote", "No se pudo renombrar la nota"), false);
    return;
  }
  showToast(t("toasts.noteRenamed", "Nota renombrada"));
  if (state.notePath === from) {
    state.notePath = to;
    const pathEl = $("obs-note-path");
    if (pathEl) pathEl.textContent = to;
    const name = $("obs-note-name");
    if (name) name.textContent = to.split("/").pop() ?? to;
  }
  await loadTree();
}

export async function deleteNote(relPath: string) {
  if (!state.vaultId) return;
  if (
    !(await openConfirm(fmt(t("confirm.deleteNoteBody", "¿Eliminar la nota \"{path}\"? Esta acción no se puede deshacer."), { path: relPath }), {
      title: t("confirm.deleteNoteTitle", "Eliminar nota"),
      confirmText: t("confirm.deleteNoteConfirm", "Eliminar"),
      variant: "danger",
    }))
  )
    return;
  const res = await api.delete(vaultApi(`/note?path=${encodeURIComponent(relPath)}`));
  if (!res.ok) {
    showToast(res.error ?? t("errors.deleteNote", "No se pudo eliminar la nota"), false);
    return;
  }
  showToast(t("toasts.noteDeleted", "Nota eliminada"));
  if (state.notePath === relPath) closeEditor();
  await loadTree();
}
