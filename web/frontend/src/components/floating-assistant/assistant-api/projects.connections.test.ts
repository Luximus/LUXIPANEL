import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/client", () => ({ getClientMessages: async () => ({}) }));
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
  document.body.innerHTML = "";
  delete (window as unknown as Record<symbol, unknown>)[Symbol.for("luxipanel.read-cache.v2")];
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("associatable servers", () => {
  it.each(["local", "remote-a"])("excludes the active %s target while preserving other servers", async activeId => {
    const targets = ["local", "remote-a", "remote-b"].map(id => ({ id, name: id, host: `${id}.test`, active: id === activeId, isLocal: id === "local" }));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: targets })));
    const { fetchAssociatableConnections } = await import("./projects");
    expect((await fetchAssociatableConnections()).map(s => s.id)).toEqual(targets.filter(s => s.id !== activeId).map(s => s.id));
  });
});

describe("workspace sharing", () => {
  it("uses the administrator-only sharing endpoint", async () => {
    const project = { id: "realityos", title: "RealityOS", icon: "folder", path: "/workspace", instructions: "", provider: "codex", ownerId: null };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { project } })));
    const { assistantProjectsApi } = await import("./projects");
    await expect(assistantProjectsApi.shareWithAdministrators(project.id)).resolves.toEqual(project);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/ai/projects/${project.id}/share-with-admins`);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
  });
});
