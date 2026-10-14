// Vitest — Files module navigation: a path that does not exist on THIS server
// (a remembered folder from another target after a server switch) must fall
// back silently to the default base instead of a dead-end error toast.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("/scripts/extracted/lib/api-client.js", async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  api: {
    get: vi.fn(async () => ({ ok: true, status: 200, data: "" })),
    put: vi.fn(async () => ({ ok: true })),
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
import * as toast from "./toast";
import { S, navHistory } from "./state";
import { renderBreadcrumb } from "./navigation";

beforeEach(() => {
  document.body.innerHTML = `
    <div id="status-bar"></div>
    <div id="breadcrumb"></div>
    <table><tbody id="file-tbody"></tbody></table>
    <div id="view-list"></div><div id="view-grid" class="hidden"></div><div id="view-projects" class="hidden"></div>
    <div id="files-manager-tabs"></div>
  `;
  S.fileAccessPolicyLoaded = true;
  S.filesAllowAll = true;
  S.filesDefaultBase = "/";
  S.currentPath = "";
  S.filesManagers = [{ id: "mgr-1", label: "x", path: "/var/www/luxisoft/site-kits" }];
  S.activeFilesManagerId = "mgr-1";
  navHistory.length = 0;
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.post).mockResolvedValue({ ok: true } as any);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("navigate() — path missing on this server", () => {
  it("404 on the remembered path → lists the default base silently (no error toast)", async () => {
    const toastSpy = vi.spyOn(toast, "showToast");
    vi.mocked(api.get).mockImplementation(async (url: string, opts?: any) => {
      if (url === "/api/files/list") {
        const path = opts?.params?.path;
        if (path === "/var/www/luxisoft/site-kits") return { ok: false, status: 404, error: "Path not found" } as any;
        if (path === "/") return { ok: true, status: 200, data: [] } as any;
      }
      return { ok: true, status: 200, data: "" } as any;
    });

    await (window as any).navigate("/var/www/luxisoft/site-kits", { skipHistory: true });

    const listed = vi.mocked(api.get).mock.calls
      .filter((c) => c[0] === "/api/files/list")
      .map((c) => (c[1] as any)?.params?.path);
    expect(listed).toEqual(["/var/www/luxisoft/site-kits", "/"]);
    expect(S.currentPath).toBe("/");
    // The active manager tab now remembers the fallback, not the foreign path.
    expect(S.filesManagers[0]?.path).toBe("/");
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it("404 on the default base itself does not loop (surfaces the error once)", async () => {
    const toastSpy = vi.spyOn(toast, "showToast");
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/api/files/list") return { ok: false, status: 404, error: "Path not found" } as any;
      return { ok: true, status: 200, data: "" } as any;
    });
    await (window as any).navigate("/", { skipHistory: true });
    const listCalls = vi.mocked(api.get).mock.calls.filter((c) => c[0] === "/api/files/list");
    expect(listCalls).toHaveLength(1);
    expect(toastSpy).toHaveBeenCalledTimes(1);
  });
});

describe("folder location bar", () => {
  it("marks the current folder and keeps special characters out of inline handlers", () => {
    renderBreadcrumb("/srv/O'Reilly & Sons");
    const crumbs = document.querySelectorAll<HTMLElement>("[data-breadcrumb-path]");
    expect(crumbs[crumbs.length - 1]?.textContent).toBe("O'Reilly & Sons");
    expect(crumbs[crumbs.length - 1]?.getAttribute("data-breadcrumb-path")).toBe("/srv/O'Reilly & Sons");
    expect(crumbs[crumbs.length - 1]?.getAttribute("aria-current")).toBe("location");
    expect(document.querySelector("[onclick]")).toBeNull();
  });
});
