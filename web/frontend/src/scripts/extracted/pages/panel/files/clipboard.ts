// Files page — clipboard submodule (code-move from index-script1.ts; no behavior change).
import { fmt, t } from "./i18n";
import { getBaseName, getParentPath, joinPath } from "./paths";
import { FILES_CLIPBOARD_KEY } from "./state";
import { showToast } from "./toast";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";

  export type FilesClipboardItem = {
    path: string;
    name: string;
    isDir: boolean;
    copiedAt: number;
  };

  export function readFilesClipboard(): FilesClipboardItem | null {
    const raw = window.localStorage.getItem(FILES_CLIPBOARD_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<FilesClipboardItem>;
      if (!parsed || typeof parsed.path !== "string" || typeof parsed.name !== "string" || typeof parsed.isDir !== "boolean") {
        return null;
      }
      return {
        path: parsed.path,
        name: parsed.name,
        isDir: parsed.isDir,
        copiedAt: typeof parsed.copiedAt === "number" ? parsed.copiedAt : Date.now(),
      };
    } catch {
      return null;
    }
  }

  export function writeFilesClipboard(item: FilesClipboardItem | null) {
    if (!item) {
      window.localStorage.removeItem(FILES_CLIPBOARD_KEY);
      return;
    }
    window.localStorage.setItem(FILES_CLIPBOARD_KEY, JSON.stringify(item));
  }

  export function clearFilesClipboard() {
    writeFilesClipboard(null);
  }

  export function getPasteTargetPath(targetPath: string, isDir: boolean): string {
    return isDir ? targetPath : getParentPath(targetPath);
  }

  export async function pasteFilesClipboard(destDir: string) {
    const clipboard = readFilesClipboard();
    if (!clipboard) {
      showToast(t("toasts.nothingCopied", "No hay nada copiado"), false);
      return;
    }
    const baseName = getBaseName(clipboard.path) || clipboard.name;
    const target = joinPath(destDir || "/", baseName);
    if (!baseName) {
      showToast(t("toasts.cannotDetermineSourceName", "No se pudo determinar el nombre de origen"), false);
      return;
    }

    const res = await api.post("/api/files/copy", { from: clipboard.path, to: target });
    if (!res.ok) {
      showToast(res.error ?? t("toasts.pasteError", "Error al pegar"), false);
      return;
    }

    showToast(fmt(t("toasts.pastedIn", "{kind} pegado en {dir}"), { kind: clipboard.isDir ? t("labels.folderCap", "Carpeta") : t("labels.fileCap", "Archivo"), dir: destDir || "/" }));
    (window as any).navigate(destDir || "/", { skipHistory: true });
    (window as any).__lxpFilesTreeRefresh?.([destDir || "/"]);
  }
