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

describe("project and agent snippet filters through the HTTP client", () => {
  it("loads categories and their tags from the real server envelope", async () => {
    const catalog = {
      categories: [{ id: 14, name: "Proyecto" }],
      tags: [{ id: 35, categoryId: 14, name: "navigate" }],
      snippets: [],
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: catalog })));
    const { fetchTerminalSnippetFilterOptions } = await import("./projects");
    expect(await fetchTerminalSnippetFilterOptions()).toEqual({ ok: true, categories: catalog.categories, tags: catalog.tags });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/terminal/snippets");
  });

  it("accepts an empty library for a new user or project", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { categories: [], tags: [], snippets: [] } })));
    const { fetchTerminalSnippetFilterOptions } = await import("./projects");
    expect(await fetchTerminalSnippetFilterOptions()).toEqual({ ok: true, categories: [], tags: [] });
  });

  it.each([401, 403, 503])("keeps filters unavailable for HTTP %s", async status => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "Unavailable" }), { status }));
    const { fetchTerminalSnippetFilterOptions } = await import("./projects");
    expect(await fetchTerminalSnippetFilterOptions()).toEqual({ ok: false, categories: [], tags: [] });
  });

  it("rejects an invalid catalog instead of crashing the selectors", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { categories: {}, tags: [] } })));
    const { fetchTerminalSnippetFilterOptions } = await import("./projects");
    expect(await fetchTerminalSnippetFilterOptions()).toEqual({ ok: false, categories: [], tags: [] });
  });
});
