import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/server-env", () => ({ getBackendUrl: () => "http://backend.test" }));
import { loadLayoutRuntimeContext } from "./layout-context";
afterEach(() => vi.unstubAllGlobals());
it("loads authenticated server branding for the workspace and keeps login local", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, targetId: "remote", data: { layout_logo: "/api/ui/layout/asset?key=layout_logo&target=remote" } }) });
  vi.stubGlobal("fetch", fetchMock);
  const cookie = "luxipanel_session=workspace";
  const request = (pathname: string) => ({ url: `https://panel.test${pathname}`, headers: { get: (name: string) => name === "cookie" ? cookie : null } }) as Request;
  const context = await loadLayoutRuntimeContext(request("/assistant"));
  expect(fetchMock.mock.calls[0][0]).toBe("http://backend.test/api/ui/layout");
  expect(context.layoutLogoMap.__scope).toBe("remote");
  await loadLayoutRuntimeContext(request("/login"));
  expect(fetchMock.mock.calls[1][0]).toBe("http://backend.test/api/public/layout");
});
it("separates two tab bridges sharing a cookie and forwards the selected connection", async () => {
  const fetchMock = vi.fn().mockImplementation(async (_url, options) => ({
    ok: true, json: async () => ({ ok: true, targetId: options.headers["X-Bridge-Session-Id"], data: { layout_logo: "/branding/saved.png" } }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  const request = (bridge: string) => ({ url: "https://tabs.test/settings", headers: { get: (name: string) => ({
    cookie: "luxipanel_session=shared-tabs", "x-bridge-session-id": bridge,
  } as Record<string, string>)[name] ?? null } }) as Request;
  expect((await loadLayoutRuntimeContext(request("bridge-a"))).layoutLogoMap.__scope).toBe("bridge-a");
  expect((await loadLayoutRuntimeContext(request("bridge-b"))).layoutLogoMap.__scope).toBe("bridge-b");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("uses authenticated bootstrap branding even when Astro clones the Request", async () => {
 const fetchMock=vi.fn();vi.stubGlobal("fetch",fetchMock);
 const bootstrap={targetId:"target-seeded",layout:{layout_logo:"/branding/seed.png"}};
 const request=new Request("https://seed.test/");
 const a=await loadLayoutRuntimeContext(request,bootstrap);
 const b=await loadLayoutRuntimeContext(new Request(request),bootstrap);
 expect(a.layoutLogoMap).toEqual(b.layoutLogoMap);expect(b.layoutLogoMap.__scope).toBe("target-seeded");expect(fetchMock).not.toHaveBeenCalled();
});
