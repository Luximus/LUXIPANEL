import { fmt, t } from "./i18n";
import { S, aiSelectedEntries, selected } from "./state";

export function updateAiSelectionNotice() {
  const notice = document.getElementById("files-ai-selection-notice");
  const count = document.getElementById("files-ai-selection-count");
  const button = document.getElementById("bulk-attach-ai") as HTMLButtonElement | null;
  const label = document.getElementById("bulk-attach-ai-label");
  if (!notice || !count || !button || !label) return;
  notice.classList.toggle("hidden", selected.size === 0);
  notice.classList.toggle("flex", selected.size > 0);
  if (!selected.size) return;
  let folders = 0;
  for (const path of selected) {
    const item = S.currentEntries.find((entry) => entry.path === path || `${S.currentPath}/${entry.name}`.replace("//", "/") === path);
    if (item?.isDir) folders++;
  }
  const files = selected.size - folders;
  const message = folders === 0
    ? (files === 1 ? t("aiSelectedFilesOne", "{n} archivo seleccionado") : t("aiSelectedFilesMany", "{n} archivos seleccionados"))
    : files === 0
      ? (folders === 1 ? t("aiSelectedFoldersOne", "{n} carpeta seleccionada") : t("aiSelectedFoldersMany", "{n} carpetas seleccionadas"))
      : t("labels.selectedCountMany", "{n} elementos seleccionados");
  count.textContent = fmt(message, { n: selected.size });
  const allAttached = [...selected].every((path) => aiSelectedEntries.some((entry) => entry.path === path));
  button.disabled = allAttached;
  label.textContent = allAttached ? t("aiAlreadyAttached", "Ya adjuntados al mensaje") : t("aiAttachSelected", "Adjuntar al mensaje");
}

export function renderAiSelection() {
  updateAiSelectionNotice();
  const host = document.getElementById("files-ai-attachments");
  if (!host) return;
  host.replaceChildren();
  host.classList.toggle("hidden", aiSelectedEntries.length === 0);
  for (const entry of aiSelectedEntries) {
    const chip = document.createElement("span");
    chip.className = "inline-flex max-w-full items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs text-foreground";
    const icon = document.createElement("i");
    icon.className = `ti ${entry.isDir ? "ti-folder" : "ti-file"} text-primary`;
    icon.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "max-w-44 truncate";
    label.textContent = entry.path.split("/").filter(Boolean).pop() ?? entry.path;
    label.title = entry.path;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "rounded p-0.5 hover:bg-accent";
    remove.setAttribute("aria-label", `${t("aiRemoveAttachment", "Quitar adjunto")} ${label.textContent}`);
    remove.innerHTML = '<i class="ti ti-x text-xs" aria-hidden="true"></i>';
    remove.addEventListener("click", () => {
      const index = aiSelectedEntries.findIndex((item) => item.path === entry.path);
      if (index >= 0) aiSelectedEntries.splice(index, 1);
      renderAiSelection();
    });
    chip.append(icon, label, remove);
    host.append(chip);
  }
}

export function stageSelectedForAi() {
  for (const path of selected) {
    if (aiSelectedEntries.some((entry) => entry.path === path)) continue;
    const item = S.currentEntries.find((entry) => entry.path === path || `${S.currentPath}/${entry.name}`.replace("//", "/") === path);
    aiSelectedEntries.push({ path, isDir: Boolean(item?.isDir) });
  }
  renderAiSelection();
  (document.getElementById("files-ai-input") as HTMLInputElement | null)?.focus({ preventScroll: true });
}

export function clearAiSelection() {
  aiSelectedEntries.length = 0;
  renderAiSelection();
}
