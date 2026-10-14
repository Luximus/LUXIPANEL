// Vitest — Files module target-scope: reset on target switch clears editor tabs.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("/scripts/extracted/lib/api-client.js", async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  api: {
    get: vi.fn(async () => ({ ok: true, data: "" })),
    put: vi.fn(async () => ({ ok: true })),
    patch: vi.fn(async () => ({ ok: true })),
    post: vi.fn(async () => ({ ok: true })),
    delete: vi.fn(async () => ({ ok: true })),
  },
  resolvePanelApiPath: (p: string) => p,
  uploadFile: vi.fn(),
  LOCAL_TARGET_SCOPE: "local",
  SERVER_SWITCHER_ID: "server-switcher",
  ATTR_CURRENT_TARGET_ID: "data-current-target-id",
}));

import { api } from "/scripts/extracted/lib/api-client.js";
import { FILES_CURRENT_PATH_KEY, FILES_MANAGER_TABS_KEY, S, navHistory } from "./state";
import * as targetScope from "./target-scope";

function ensureMinimalDom() {
  document.body.innerHTML = `
    <button id="btn-back"></button>
    <input id="files-search" />
    <ul id="file-tabs"></ul>
    <div id="editor-filename"></div>
    <div id="bulk-bar" class="hidden"></div>
  `;
}

beforeEach(() => {
  ensureMinimalDom();
  sessionStorage.clear();
  S.openTabs = [
    { path: "/etc/a.txt", name: "a.txt", content: "x", originalContent: "x", dirty: false },
    { path: "/etc/peek.txt", name: "peek.txt", content: "p", originalContent: "p", dirty: false },
  ];
  S.activeTabPath = "/etc/a.txt";
  S.editingPath = "/etc/a.txt";
  S.currentPath = "/etc";
  S.activeTargetScope = "local";
  S.currentEntries = [{ name: "a.txt" }];
  S.currentProjects = [{ name: "p" }];
  S.isSearchMode = true;
  S.searchQuery = "x";
  navHistory.push("/etc/a.txt", "/etc");
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("resolveCurrentTargetScope in drawers", () => {
  it("uses the parent tab's remote target when the embed omits the switcher", () => {
    sessionStorage.setItem("panel-active-target-scope", "remote-a");
    expect(targetScope.resolveCurrentTargetScope()).toBe("remote-a");
  });

  it("uses local when there is no selected server", () => {
    expect(targetScope.resolveCurrentTargetScope()).toBe("local");
  });

  it("lets a visible local switcher override old remote tab storage", () => {
    sessionStorage.setItem("panel-active-target-scope", "old-remote");
    document.body.insertAdjacentHTML("beforeend", '<div id="sidebar-server-switcher" data-current-target-id=""></div>');
    expect(targetScope.resolveCurrentTargetScope()).toBe("local");
  });
});

describe("resetStateForTargetSwitch", () => {
  it("clears openTabs / activeTabPath / editingPath", () => {
    targetScope.resetStateForTargetSwitch();
    expect(S.openTabs).toEqual([]);
    expect(S.activeTabPath).toBe("");
    expect(S.editingPath).toBe("");
  });

  it("clears navHistory", () => {
    expect(navHistory.length).toBeGreaterThan(0);
    targetScope.resetStateForTargetSwitch();
    expect(navHistory.length).toBe(0);
  });

  it("invalidates permissions and keeps dirty drafts for the old server", () => {
    S.fileAccessPolicyLoaded = true;
    S.filesAllowAll = true;
    S.openTabs[0]!.dirty = true;
    S.openTabs[0]!.content = "unsaved";
    targetScope.resetStateForTargetSwitch();
    expect(S.fileAccessPolicyLoaded).toBe(false);
    expect(S.filesAllowAll).toBe(false);
    targetScope.restoreDraftsForTarget("local");
    expect(S.openTabs[0]?.content).toBe("unsaved");
  });
});

describe("confirmFilesTargetSwitch", () => {
  it("allows a clean workspace and blocks losing dirty edits when the confirmation dialog is absent", async () => {
    document.body.insertAdjacentHTML("beforeend", '<div id="files-browser"></div>');
    expect(await targetScope.confirmFilesTargetSwitch()).toBe(true);
    S.openTabs[0]!.dirty = true;
    S.openTabs[0]!.content = "pending";
    expect(await targetScope.confirmFilesTargetSwitch()).toBe(false);
    expect(S.openTabs[0]!.content).toBe("pending");
  });
});

describe("resetStateForTargetSwitch — shared current path", () => {
  it("drops the terminal-shared current path (it belongs to the previous server)", () => {
    sessionStorage.setItem(FILES_CURRENT_PATH_KEY, "/var/www/luxisoft/site-kits");
    (window as any).__filesCurrentPath = "/var/www/luxisoft/site-kits";
    targetScope.resetStateForTargetSwitch();
    expect(sessionStorage.getItem(FILES_CURRENT_PATH_KEY)).toBeNull();
    expect((window as any).__filesCurrentPath).toBe("");
  });
});

describe("syncTargetScopeFromSession", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    (window as any).navigate = vi.fn(async () => {});
    S.activeTargetScope = "local";
    S.currentPath = "";
    S.fileAccessPolicyLoaded = true;
    S.filesAllowAll = true;
    S.filesManagers = [{ id: "mgr-1", label: "x", path: "/var/www/luxisoft/site-kits" }];
    localStorage.clear();
    localStorage.setItem(FILES_MANAGER_TABS_KEY, JSON.stringify([{ id: "mgr-1", label: "x", path: "/var/www/luxisoft/site-kits" }]));
  });

  it("reads the target from /api/session (not the removed /api/sso/me) and re-scopes on change", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/api/session") return { ok: true, status: 200, data: { ok: true, user: { targetId: "d61557e4-ats" } } } as any;
      return { ok: true, status: 200, data: "" } as any;
    });
    await targetScope.syncTargetScopeFromSession();
    expect(vi.mocked(api.get).mock.calls.map((c) => c[0])).toContain("/api/session");
    expect(vi.mocked(api.get).mock.calls.map((c) => c[0])).not.toContain("/api/sso/me");
    expect(S.activeTargetScope).toBe("d61557e4-ats");
    expect(sessionStorage.getItem("panel-files-target-scope")).toBe("d61557e4-ats");
    // Manager tabs were reloaded from the REMOTE bucket (empty → fresh "/"),
    // not inherited from the panel host's last folder.
    expect(S.filesManagers.map((m) => m.path)).toEqual(["/"]);
    expect((window as any).navigate).toHaveBeenCalledWith("/", { skipHistory: true });
  });

  it("is a no-op when the session target matches the active scope", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/api/session") return { ok: true, status: 200, data: { ok: true, user: {} } } as any;
      return { ok: true, status: 200, data: "" } as any;
    });
    await targetScope.syncTargetScopeFromSession();
    expect(S.activeTargetScope).toBe("local");
    expect((window as any).navigate).not.toHaveBeenCalled();
  });

  it("keeps the first remote load instead of resetting and loading it again", async () => {
    sessionStorage.setItem("panel-active-target-scope", "remote-a");
    targetScope.persistTargetScope(targetScope.resolveCurrentTargetScope());
    vi.mocked(api.get).mockResolvedValue({ ok: true, status: 200, data: { user: { targetId: "remote-a" } } } as any);
    const tabs = S.openTabs;
    await targetScope.syncTargetScopeFromSession();
    expect(S.activeTargetScope).toBe("remote-a");
    expect(S.fileAccessPolicyLoaded).toBe(true);
    expect(S.openTabs).toBe(tabs);
    expect(vi.mocked(api.get).mock.calls.map(call => call[0])).toEqual(["/api/session"]);
    expect((window as any).navigate).not.toHaveBeenCalled();
  });
});
