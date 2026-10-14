import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ scope: "server-b", bridge: "bridge-b", fetch: vi.fn() }));
vi.mock("/scripts/extracted/lib/api-client.js", () => ({
  resolveTargetScope: () => state.scope,
  scopeHeaders: () => ({ "X-Bridge-Session-Id": state.bridge }),
  resolvePanelApiPath: (path: string) => `/panel${path}`,
}));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); state.scope = "server-b"; state.bridge = "bridge-b";
  document.body.innerHTML = `<img data-lxp-logo-role="sidebar" src="/logo-a.png"><link rel="icon">`;
  vi.stubGlobal("fetch", state.fetch);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:server-b-logo");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  state.fetch.mockResolvedValue({ ok: true, blob: async () => new Blob(["logo-b"]) });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("server branding images", () => {
  it("loads the persisted logo after a fresh session without browser overrides", async () => {
    const { applyBrandedAsset } = await import("./branding-images");
    await applyBrandedAsset(document.querySelector("img")!, "/api/ui/layout/asset?key=layout_logo&target=server-b", "server-b");
    expect(state.fetch).toHaveBeenCalledWith("/panel/api/ui/layout/asset?key=layout_logo&target=server-b", {
      credentials: "include", cache: "no-store", headers: { "X-Bridge-Session-Id": "bridge-b" },
    });
    expect(document.querySelector("img")!.getAttribute("src")).toBe("blob:server-b-logo");
  });
  it("loads a newly chosen remote file for the logo and favicon without changing its stored path", async () => {
    const { applyBrandedAsset } = await import("./branding-images");
    await Promise.all([...document.querySelectorAll("img, link")].map(el => applyBrandedAsset(el, "/branding/logo-b.png")));
    expect(state.fetch).toHaveBeenCalledTimes(1);
    expect(state.fetch.mock.calls[0][0]).toBe("/panel/api/admin/branding/asset?name=logo-b.png&target=server-b");
    expect(document.querySelector("link")!.getAttribute("href")).toBe("blob:server-b-logo");
  });
  it.each(["target", "bridge"])("discards a pending image when the %s changes", async change => {
    let release!: (value: unknown) => void;
    state.fetch.mockReturnValue(new Promise(resolve => { release = resolve; }));
    const { applyBrandedAsset } = await import("./branding-images");
    const loading = applyBrandedAsset(document.querySelector("img")!, "/branding/logo-b.png");
    if (change === "target") state.scope = "server-a"; else state.bridge = "reconnected-bridge-b";
    release({ ok: true, blob: async () => new Blob(["stale"]) }); await loading;
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(document.querySelector("img")!.getAttribute("src")).toBeNull();
  });
  it("does not fetch a persisted asset belonging to another server", async () => {
    const { applyBrandedAsset } = await import("./branding-images");
    await applyBrandedAsset(document.querySelector("img")!, "/api/ui/layout/asset?key=layout_logo&target=server-a");
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it("keeps local public images directly accessible", async () => {
    state.scope = "local";
    const { applyBrandedAsset } = await import("./branding-images");
    await applyBrandedAsset(document.querySelector("img")!, "/branding/local.png");
    expect(state.fetch).not.toHaveBeenCalled();
    expect(document.querySelector("img")!.getAttribute("src")).toBe("/branding/local.png");
  });
});
