import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  executor: { target: { id: "remote" }, stat: vi.fn(), readFile: vi.fn() },
  getByCategory: vi.fn(), get: vi.fn(),
}));
vi.mock("../../../shared/executor/index.js", () => ({
  LOCAL_TARGET_ID: "local", getExecutorForRead: () => mocks.executor,
}));
vi.mock("../repositories/settings.repository.js", () => ({ settingsRepository: mocks }));
import { layoutAssetPath, layoutController } from "./layout.controller.js";

async function invoke(handler: typeof layoutController.read, query = {}) {
  const res = { set: vi.fn(), json: vi.fn(), sendStatus: vi.fn(), type: vi.fn(), end: vi.fn() };
  const next = vi.fn();
  handler({ query } as any, res as any, next);
  await vi.waitFor(() => expect(res.json.mock.calls.length + res.end.mock.calls.length + res.sendStatus.mock.calls.length + next.mock.calls.length).toBeGreaterThan(0));
  expect(next).not.toHaveBeenCalled();
  return res;
}

describe("selected server layout", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.executor.target.id = "remote";
    mocks.getByCategory.mockResolvedValue([{ key: "layout_logo", value: "/branding/other.webp" }, { key: "layout_light_primary", value: "#123456" }]);
  });
  it("reads the selected executor and bridges its relative logo", async () => {
    const res = await invoke(layoutController.read);
    expect(mocks.getByCategory).toHaveBeenCalledWith("layout", mocks.executor);
    expect(res.json).toHaveBeenCalledWith({ ok: true, targetId: "remote", data: {
      layout_logo: "/api/ui/layout/asset?key=layout_logo&target=remote", layout_light_primary: "#123456",
    } });
  });
  it("preserves local asset URLs on return", async () => {
    mocks.executor.target.id = "local";
    const res = await invoke(layoutController.read);
    expect(res.json.mock.calls[0][0].data.layout_logo).toBe("/branding/other.webp");
  });
  it("rejects stale image requests after switching servers", async () => {
    const res = await invoke(layoutController.asset, { key: "layout_logo", target: "previous" });
    expect(res.sendStatus).toHaveBeenCalledWith(404);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("serves bytes from the selected server without exposing arbitrary files", async () => {
    mocks.get.mockResolvedValue("/branding/other.webp");
    mocks.executor.stat.mockResolvedValue({ type: "file", size: 4 });
    mocks.executor.readFile.mockResolvedValue(Buffer.from("logo").toString("base64"));
    const res = await invoke(layoutController.asset, { key: "layout_logo", target: "remote" });
    expect(mocks.executor.readFile.mock.calls[0][0]).toMatch(/luxipanel\/branding\/other.webp$/);
    expect(res.end).toHaveBeenCalledWith(Buffer.from("logo"));
  });
  it("limits relative assets to public raster paths", () => {
    expect(layoutAssetPath("/panel/logo_300.webp")).toBe("logo_300.webp");
    for (const value of ["/etc/private.png", "/branding/../secret.png", "/branding/a.svg", "//host/logo.png", "https://host/logo.png"]) expect(layoutAssetPath(value)).toBeNull();
  });
});
