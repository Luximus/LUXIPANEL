// Vitest — Files module shared state hub.
// Pins the OpenTab contract and the frozen STORAGE keys.

import { describe, expect, it } from "vitest";

import * as state from "./state";
import { S, STORAGE } from "./state";

describe("OpenTab contract", () => {
  it("an OpenTab carries path/name/content/originalContent/dirty", () => {
    S.openTabs = [];
    S.openTabs.push({
      path: "/etc/a.txt",
      name: "a.txt",
      content: "x",
      originalContent: "x",
      dirty: false,
    });
    expect(S.openTabs[0]?.path).toBe("/etc/a.txt");
    expect(S.openTabs[0]?.dirty).toBe(false);
  });
});

describe("STORAGE keys — frozen contract (manager-tabs intact)", () => {
  it("exposes the seven persisted keys with the exact stored values", () => {
    expect(STORAGE.managerTabs).toBe("panel-files-manager-tabs");
    expect(STORAGE.managerActive).toBe("panel-files-manager-active");
    expect(STORAGE.leftTab).toBe("panel-files-left-tab");
    expect(STORAGE.clipboard).toBe("panel-files-clipboard");
    expect(STORAGE.targetScope).toBe("panel-files-target-scope");
    expect(STORAGE.favRoots).toBe("panel-files-fav-roots");
    expect(STORAGE.showHidden).toBe("files-show-hidden");
  });
});

// Surface check — the test reporter will fail the run if the module stops
// exporting the symbols we depend on. Keeping it explicit makes drift loud.
describe("module surface — sanity", () => {
  it("exports S, STORAGE, and SHOW_HIDDEN_KEY", () => {
    expect(state.S).toBeDefined();
    expect(state.STORAGE).toBeDefined();
    expect((state as any).SHOW_HIDDEN_KEY).toBe("files-show-hidden");
  });
});

describe("scopedFilesStorageKey — manager tabs are stored PER SERVER", () => {
  it("LOCAL (or empty) scope keeps the legacy bare key so existing data survives", () => {
    expect(state.scopedFilesStorageKey("panel-files-manager-tabs", "local")).toBe("panel-files-manager-tabs");
    expect(state.scopedFilesStorageKey("panel-files-manager-tabs", "")).toBe("panel-files-manager-tabs");
    expect(state.scopedFilesStorageKey("panel-files-manager-tabs", undefined)).toBe("panel-files-manager-tabs");
  });

  it("a remote target gets its own bucket (never the panel host's last folders)", () => {
    expect(state.scopedFilesStorageKey("panel-files-manager-tabs", "d61557e4-ats"))
      .toBe("panel-files-manager-tabs::d61557e4-ats");
    expect(state.scopedFilesStorageKey("panel-files-manager-active", " c91f6179 "))
      .toBe("panel-files-manager-active::c91f6179");
  });
});
