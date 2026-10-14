import { afterEach, expect, it, vi } from "vitest";
vi.mock("/scripts/extracted/lib/api-client.js", () => ({
  resolveTargetScope: () => "server-b", scopeHeaders: () => ({ "X-Bridge-Session-Id": "new-bridge-b" }),
  resolvePanelApiPath: (path: string) => path,
}));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear(); });
it("restores the server logo on a new visit using its SSR settings and a fresh bridge", async () => {
  sessionStorage.clear(); delete window.__lxpBrandingInit;
  document.body.innerHTML = `<script id="lxp-layout-logo-map" type="application/json">${JSON.stringify({
    __scope: "server-b", primary: "/api/ui/layout/asset?key=layout_logo&target=server-b",
  })}</script><img data-lxp-logo-role="sidebar" src="/logo_150.webp"><link rel="icon">`;
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["persisted remote logo"]) });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:restored-b");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  await import("./branding-runtime");
  await vi.waitFor(() => expect(document.querySelector("img")?.getAttribute("src")).toBe("blob:restored-b"));
  expect(document.querySelector("link")?.getAttribute("href")).toBe("blob:restored-b");
  expect(fetchMock.mock.calls[0][1].headers).toEqual({ "X-Bridge-Session-Id": "new-bridge-b" });
});
