// Files page — bind-controls orchestrator. The former single 927-line
// bindControls() is split by pure code-move into cohesive sibling bind-*
// submodules (toolbar / tools / editor / fs-ops / navigation / listing /
// settings); observable surface is byte-identical. This module keeps the public
// `bindControls()` entry that index-script1.ts imports unchanged: the guard +
// element lookups stay here (the null-check contract that returns false before
// any wiring), then each submodule's wiring block runs in the original source
// order. Guard-scoped elements needed by a block are passed as parameters so the
// moved bodies stay unchanged.
import { S } from "./state";
import { bindToolbar } from "./bind-toolbar";
import { bindTools } from "./bind-tools";
import { bindEditor } from "./bind-editor";
import { bindFsOps } from "./bind-fs-ops";
import { bindNavigation } from "./bind-navigation";
import { bindListing } from "./bind-listing";
import { bindSettings } from "./bind-settings";

export function bindControls() {
  if (S.controlsBound) return true;

  S.saveBtn = document.getElementById("btn-save") as HTMLButtonElement | null;
  S.diffBtn = document.getElementById("btn-diff") as HTMLButtonElement | null;
  const viewListBtn = document.getElementById("btn-view-list");
  const viewGridBtn = document.getElementById("btn-view-grid");
  const viewProjectsBtn = document.getElementById("btn-view-projects");
  const newFileBtn = document.getElementById("btn-new-file");
  const tabsEl = document.getElementById("file-tabs");
  const fileTable = document.getElementById("file-tbody");
  const editorHost = document.getElementById("file-editor");

  if (!S.saveBtn || !S.diffBtn || !viewListBtn || !viewGridBtn || !viewProjectsBtn || !newFileBtn || !tabsEl || !fileTable || !editorHost) {
    return false;
  }

  S.controlsBound = true;

  bindToolbar(viewListBtn, viewGridBtn, viewProjectsBtn, newFileBtn);
  bindTools();
  bindEditor(tabsEl);
  bindFsOps();
  bindNavigation();
  bindListing();
  bindSettings();

  return true;
}
