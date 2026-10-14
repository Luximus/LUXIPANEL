// Files page — shortcuts submodule (code-move from index-script1.ts; no behavior change).
import { pasteFilesClipboard } from "./clipboard";
import { showEditorView } from "./editor";
import { t } from "./i18n";
import { clearSelection } from "./listing";
import { DEFAULT_FILE_SHORTCUTS, FILE_SHORTCUT_SETTING_KEYS, S } from "./state";
import { loadFilesPreferences, patchFilesPreferences } from "./preferences";
import { showToast } from "./toast";


  export type ParsedShortcut = {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
    key: string;
  };

  export function normalizeShortcutText(value: string): string {
    return value.trim().replace(/\s*\+\s*/g, "+").replace(/\s+/g, "");
  }

  export function parseShortcut(value: string): ParsedShortcut | null {
    const parts = normalizeShortcutText(value).split("+").filter(Boolean);
    if (parts.length === 0) return null;
    const shortcut: ParsedShortcut = {
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: "",
    };

    let modifiers = 0;
    for (const part of parts) {
      const token = part.toLowerCase();
      if (token === "ctrl" || token === "control") { if (shortcut.ctrl) return null; shortcut.ctrl = true; modifiers++; }
      else if (token === "alt" || token === "option") { if (shortcut.alt) return null; shortcut.alt = true; modifiers++; }
      else if (token === "shift") { if (shortcut.shift) return null; shortcut.shift = true; modifiers++; }
      else if (token === "meta" || token === "cmd" || token === "command" || token === "win") { if (shortcut.meta) return null; shortcut.meta = true; modifiers++; }
      else { if (shortcut.key) return null; shortcut.key = token; }
    }
    return modifiers > 0 && /^(?:[a-z0-9]|f(?:[1-9]|1[0-2]))$/.test(shortcut.key) ? shortcut : null;
  }

  export function matchesShortcut(event: KeyboardEvent, shortcutValue: string): boolean {
    const shortcut = parseShortcut(shortcutValue);
    if (!shortcut) return false;
    if (event.ctrlKey !== shortcut.ctrl
      || event.altKey !== shortcut.alt
      || event.shiftKey !== shortcut.shift
      || event.metaKey !== shortcut.meta) return false;
    if (event.key.toLowerCase() === shortcut.key) return true;
    // Alt/AltGr (and some layouts) remap event.key to a different glyph; fall
    // back to the physical key code so letter/digit combos stay layout-stable.
    const code = event.code;
    if (/^[a-z]$/.test(shortcut.key)) return code === `Key${shortcut.key.toUpperCase()}`;
    if (/^[0-9]$/.test(shortcut.key)) return code === `Digit${shortcut.key}` || code === `Numpad${shortcut.key}`;
    return false;
  }

  export function shortcutDisplay(value: string): string {
    const parsed = parseShortcut(value);
    if (!parsed) return value;
    const parts: string[] = [];
    if (parsed.ctrl) parts.push("Ctrl");
    if (parsed.alt) parts.push("Alt");
    if (parsed.shift) parts.push("Shift");
    if (parsed.meta) parts.push("Meta");
    parts.push(parsed.key.toUpperCase());
    return parts.join("+");
  }

  function shortcutIdentity(value: string): string | null {
    const parsed = parseShortcut(value);
    return parsed ? `${Number(parsed.ctrl)}${Number(parsed.alt)}${Number(parsed.shift)}${Number(parsed.meta)}:${parsed.key}` : null;
  }

  export const FILE_SHORTCUT_INPUT_IDS: Record<keyof typeof FILE_SHORTCUT_SETTING_KEYS, string> = {
    newFile: "s-files-shortcut-new-file",
    newFolder: "s-files-shortcut-new-folder",
    upload: "s-files-shortcut-upload",
    paste: "s-files-shortcut-paste",
    save: "s-files-shortcut-save",
    delete: "s-files-shortcut-delete",
    back: "s-files-shortcut-back",
    refresh: "s-files-shortcut-refresh",
    search: "s-files-shortcut-search",
    newTab: "s-files-shortcut-new-tab",
    clearSelection: "s-files-shortcut-clear-selection",
    openFiles: "s-files-shortcut-open-files",
    toggleEditor: "s-files-shortcut-toggle-editor",
    viewList: "s-files-shortcut-view-list",
    viewGrid: "s-files-shortcut-view-grid",
    projects: "s-files-shortcut-projects",
    rescanProjects: "s-files-shortcut-rescan-projects",
    projectMap: "s-files-shortcut-project-map",
    compare: "s-files-shortcut-compare",
    git: "s-files-shortcut-git",
    copyPath: "s-files-shortcut-copy-path",
    download: "s-files-shortcut-download",
  };

  /** Action dispatch for each shortcut — runs in this scope so it can reach
   *  module helpers (clearSelection/pasteFilesClipboard/S.currentPath). Most map
   *  to a toolbar button click (no-op if that button isn't currently rendered). */
  export const FILE_SHORTCUT_ACTIONS: Record<keyof typeof FILE_SHORTCUT_SETTING_KEYS, () => void> = {
    newFile: () => document.getElementById("btn-new-file")?.click(),
    newFolder: () => document.getElementById("btn-mkdir")?.click(),
    upload: () => document.getElementById("btn-upload")?.click(),
    paste: () => { void pasteFilesClipboard(S.currentPath || "/"); },
    save: () => document.getElementById("btn-save")?.click(),
    delete: () => document.getElementById("bulk-delete")?.click(),
    back: () => document.getElementById("btn-back")?.click(),
    refresh: () => document.getElementById("btn-refresh")?.click(),
    search: () => {
      const el = document.getElementById("files-search") as HTMLInputElement | null;
      el?.focus();
      el?.select();
    },
    newTab: () => document.getElementById("btn-new-files-manager-tab")?.click(),
    clearSelection: () => clearSelection(),
    openFiles: () => { if (S.openTabs.length > 0) void showEditorView(); },
    toggleEditor: () => { void (window as any).toggleEditor?.(); },
    viewList: () => document.getElementById("btn-view-list")?.click(),
    viewGrid: () => document.getElementById("btn-view-grid")?.click(),
    projects: () => document.getElementById("btn-view-projects")?.click(),
    rescanProjects: () => document.getElementById("btn-scan-projects")?.click(),
    projectMap: () => document.getElementById("btn-project-map")?.click(),
    compare: () => document.getElementById("btn-compare")?.click(),
    git: () => document.getElementById("btn-git")?.click(),
    copyPath: () => document.getElementById("btn-copy-path")?.click(),
    download: () => document.getElementById("bulk-download")?.click(),
  };

  export function readFileShortcutInputValues(): Record<keyof typeof FILE_SHORTCUT_SETTING_KEYS, string> {
    return Object.fromEntries(
      Object.entries(FILE_SHORTCUT_INPUT_IDS).map(([key, id]) => {
        const input = document.getElementById(id) as HTMLInputElement | null;
        const shortcutKey = key as keyof typeof FILE_SHORTCUT_SETTING_KEYS;
        return [shortcutKey, normalizeShortcutText(input?.value || S.fileShortcutConfig[shortcutKey] || DEFAULT_FILE_SHORTCUTS[shortcutKey])];
      }),
    ) as Record<keyof typeof FILE_SHORTCUT_SETTING_KEYS, string>;
  }

  export function syncFileShortcutInputs() {
    (Object.keys(FILE_SHORTCUT_INPUT_IDS) as Array<keyof typeof FILE_SHORTCUT_SETTING_KEYS>).forEach((key) => {
      const input = document.getElementById(FILE_SHORTCUT_INPUT_IDS[key]) as HTMLInputElement | null;
      if (input) input.value = shortcutDisplay(S.fileShortcutConfig[key]);
    });
    updateFilesShortcutHints();
  }

  export function updateFilesShortcutHints() {
    const hints: Array<[string, string]> = [
      ["files-shortcut-new-file-hint", shortcutDisplay(S.fileShortcutConfig.newFile)],
      ["files-shortcut-new-folder-hint", shortcutDisplay(S.fileShortcutConfig.newFolder)],
      ["files-shortcut-projects-hint", shortcutDisplay(S.fileShortcutConfig.projects)],
      ["files-shortcut-rescan-hint", shortcutDisplay(S.fileShortcutConfig.rescanProjects)],
      ["files-shortcut-upload-hint", shortcutDisplay(S.fileShortcutConfig.upload)],
    ];
    hints.forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
  }

  export function scheduleFileShortcutSave(immediate = false) {
    if (S.fileShortcutSaveTimer) {
      clearTimeout(S.fileShortcutSaveTimer);
      S.fileShortcutSaveTimer = null;
    }

    if (immediate) {
      void saveFileShortcutPreferences();
      return;
    }

    S.fileShortcutSaveTimer = setTimeout(() => {
      S.fileShortcutSaveTimer = null;
      void saveFileShortcutPreferences();
    }, 350);
  }

  export async function loadFileShortcutPreferences(): Promise<void> {
    await loadFilesPreferences();
    syncFileShortcutInputs();
  }

  export async function saveFileShortcutPreferences(): Promise<void> {
    if (S.fileShortcutSaveInFlight) {
      S.fileShortcutSaveQueued = true;
      return;
    }

    S.fileShortcutSaveInFlight = true;
    try {
      const values = readFileShortcutInputValues();
      const identities = Object.values(values).map(shortcutIdentity);
      if (identities.includes(null) || new Set(identities).size !== identities.length) {
        showToast(t("runtime.shortcuts.invalid", "Corrige los atajos inválidos o repetidos antes de guardar"), false);
        return;
      }
      const res = await patchFilesPreferences({ shortcuts: values });
      if (!res.ok) { showToast(res.error || t("runtime.shortcuts.saveError", "No se pudieron guardar los atajos"), false); return; }
      S.fileShortcutConfig = { ...values };
      updateFilesShortcutHints();
      showToast(t("runtime.shortcuts.saved", "Atajos guardados"));
    } finally {
      S.fileShortcutSaveInFlight = false;
      if (S.fileShortcutSaveQueued) {
        S.fileShortcutSaveQueued = false;
        void saveFileShortcutPreferences();
      }
    }
  }
