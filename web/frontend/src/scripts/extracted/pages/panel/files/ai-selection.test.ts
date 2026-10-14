import { beforeEach, describe, expect, it } from "vitest";
import { aiSelectedEntries, S, selected } from "./state";
import { clearAiSelection, stageSelectedForAi, updateAiSelectionNotice } from "./ai-selection";

beforeEach(() => {
  document.body.innerHTML = '<div id="files-ai-selection-notice" class="hidden"><span id="files-ai-selection-count"></span><button id="bulk-attach-ai"><span id="bulk-attach-ai-label"></span></button></div><div id="files-ai-attachments" class="hidden"></div><input id="files-ai-input" />';
  selected.clear();
  aiSelectedEntries.length = 0;
  S.currentPath = "/var/www";
  S.currentEntries = [{ name: "site", isDir: true }, { name: "README.md", isDir: false }];
});

describe("selection attached to the Files AI question", () => {
  it("shows the selected count next to the bottom AI message and updates the button", () => {
    selected.add("/var/www/README.md");
    updateAiSelectionNotice();
    expect(document.getElementById("files-ai-selection-count")?.textContent).toBe("1 archivo seleccionado");
    expect(document.getElementById("files-ai-selection-notice")?.classList.contains("hidden")).toBe(false);
    expect(document.getElementById("bulk-attach-ai-label")?.textContent).toBe("Adjuntar al mensaje");
    stageSelectedForAi();
    expect((document.getElementById("bulk-attach-ai") as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById("bulk-attach-ai-label")?.textContent).toBe("Ya adjuntados al mensaje");
    clearAiSelection();
    expect((document.getElementById("bulk-attach-ai") as HTMLButtonElement).disabled).toBe(false);
    selected.clear();
    updateAiSelectionNotice();
    expect(document.getElementById("files-ai-selection-notice")?.classList.contains("hidden")).toBe(true);
  });

  it("stages files and folders once, renders removable chips and preserves selection", () => {
    selected.add("/var/www/site");
    selected.add("/var/www/README.md");
    stageSelectedForAi();
    stageSelectedForAi();
    expect(aiSelectedEntries).toEqual([
      { path: "/var/www/site", isDir: true },
      { path: "/var/www/README.md", isDir: false },
    ]);
    expect(document.querySelectorAll("#files-ai-attachments button")).toHaveLength(2);
    document.querySelector<HTMLButtonElement>("#files-ai-attachments button")!.click();
    expect(aiSelectedEntries).toEqual([{ path: "/var/www/README.md", isDir: false }]);
    expect(selected.size).toBe(2);
    clearAiSelection();
    expect(document.getElementById("files-ai-attachments")?.classList.contains("hidden")).toBe(true);
  });
});
