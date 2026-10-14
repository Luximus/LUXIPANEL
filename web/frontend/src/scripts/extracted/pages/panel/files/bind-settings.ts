// Files page — bind-controls submodule (code-move; no behavior change): files
// settings tab (console/files), shortcut-config inputs (debounced save), and the
// global keyboard-shortcut dispatcher.
import { t } from "./i18n";
import { FILE_SHORTCUT_ACTIONS, FILE_SHORTCUT_INPUT_IDS, matchesShortcut, normalizeShortcutText, scheduleFileShortcutSave } from "./shortcuts";
import { FILE_SHORTCUT_SETTING_KEYS, S } from "./state";
import { bindFilesOperation } from "./bind-operation";

export function bindSettings() {
    bindFilesOperation();
    if (!S.fileSettingsBound) {
      S.fileSettingsBound = true;
      (Object.keys(FILE_SHORTCUT_INPUT_IDS) as Array<keyof typeof FILE_SHORTCUT_SETTING_KEYS>).forEach((key) => {
        const input = document.getElementById(FILE_SHORTCUT_INPUT_IDS[key]) as HTMLInputElement | null;
        input?.addEventListener("input", () => {
          const normalized = normalizeShortcutText(input.value);
          input.value = normalized;
          scheduleFileShortcutSave();
        });
        input?.addEventListener("change", () => {
          const normalized = normalizeShortcutText(input.value);
          input.value = normalized;
          scheduleFileShortcutSave(true);
        });
      });

    }

    if (!S.shortcutsBound) {
      S.shortcutsBound = true;
      window.addEventListener("keydown", (event) => {
        if (!document.getElementById("files-browser")) return;
        // Only evaluate when a modifier combo is held (skip plain typing and lone
        // modifier presses). Don't pre-filter by *which* modifier — the configured
        // combos use Ctrl+Alt(+Shift), so requiring Ctrl-only broke every default.
        if (!event.ctrlKey && !event.altKey && !event.metaKey) return;
        const target = event.target as HTMLElement | null;

        const shortcutEntries = Object.entries(S.fileShortcutConfig) as Array<[keyof typeof FILE_SHORTCUT_SETTING_KEYS, string]>;
        const matchedEntry = shortcutEntries.find(([, shortcut]) => matchesShortcut(event, shortcut));
        if (!matchedEntry) return;

        // Never hijack while typing into a field (e.g. the shortcut config inputs),
        // with ONE exception: allow `toggleEditor` when focus is inside the Monaco
        // editor (its internal textarea) so Ctrl+Alt+E can close the editor from
        // within it. The shortcut-config inputs are never inside .monaco-editor.
        const editable = target?.closest('input, textarea, select, [contenteditable="true"]');
        if (editable) {
          const inMonaco = Boolean(target?.closest(".monaco-editor"));
          if (!(inMonaco && matchedEntry[0] === "toggleEditor")) return;
        }

        event.preventDefault();
        FILE_SHORTCUT_ACTIONS[matchedEntry[0]]?.();
        return;
      }, { capture: true });
    }
}
