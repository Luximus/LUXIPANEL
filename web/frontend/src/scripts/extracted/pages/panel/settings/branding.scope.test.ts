import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ scope: "server-a", get: vi.fn(), fetch: vi.fn() }));
vi.mock("/scripts/extracted/lib/api-client.js?v=20260506a", () => ({
  api: { get: state.get }, uploadFile: vi.fn(), resolvePanelApiPath: (path: string) => path,
  resolveTargetScope: () => state.scope, scopeHeaders: () => ({ "X-Bridge-Session-Id": `bridge-${state.scope}` }),
}));
vi.mock("/scripts/extracted/lib/confirm.js?v=3", () => ({ openConfirm: vi.fn() }));
vi.mock("./dom", () => ({ t: (_key: string, fallback: string) => fallback, showToast: vi.fn(), normalizePanelAssetPath: (path: string) => path }));
vi.mock("./settings-io", () => ({ scheduleAutosave: vi.fn() }));
vi.mock("./fields", () => ({ FIELDS: [], LAYOUT_DEFAULTS: {} }));
import { loadBrandingImagesIntoPicker, updateLogoPreview } from "./branding";

beforeEach(() => {
  vi.clearAllMocks(); state.scope = "server-a";
  document.body.innerHTML = `<input id="s-layout-logo" value="/branding/logo.png"><div><img id="preview-layout-logo"><span class="logo-preview-fallback"></span></div>
    <div id="img-picker-skeleton"></div><div id="img-picker-grid"></div><div id="img-picker-empty"></div>`;
  vi.stubGlobal("fetch", state.fetch);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:server-a-image");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("branding previews follow the selected server", () => {
  it("fetches an authenticated preview using this tab's bridge", async () => {
    state.fetch.mockResolvedValue({ ok: true, blob: async () => new Blob(["server-a logo"]) });
    updateLogoPreview("s-layout-logo");
    await vi.waitFor(() => expect(document.querySelector("img")?.getAttribute("src")).toBe("blob:server-a-image"));
    expect(state.fetch).toHaveBeenCalledWith("/api/admin/branding/asset?name=logo.png&target=server-a", expect.objectContaining({
      credentials: "include", headers: { "X-Bridge-Session-Id": "bridge-server-a" }, cache: "no-store",
    }));
  });

  it("discards an image that arrives after switching servers", async () => {
    let release!: (value: unknown) => void;
    state.fetch.mockReturnValue(new Promise(resolve => { release = resolve; }));
    updateLogoPreview("s-layout-logo");
    state.scope = "server-b";
    release({ ok: true, blob: async () => new Blob(["stale image"]) });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(document.querySelector("img")?.getAttribute("src")).toBeNull();
  });

  it("discards a picker list that arrives after switching servers", async () => {
    let release!: (value: unknown) => void;
    state.get.mockReturnValue(new Promise(resolve => { release = resolve; }));
    const loading = loadBrandingImagesIntoPicker();
    state.scope = "server-b";
    release({ ok: true, data: [{ name: "logo.png", url: "/branding/logo.png", previewUrl: "/api/admin/branding/asset?name=logo.png&target=server-a" }] });
    await loading;
    expect(document.getElementById("img-picker-grid")?.children.length).toBe(0);
    expect(state.fetch).not.toHaveBeenCalled();
  });
});
