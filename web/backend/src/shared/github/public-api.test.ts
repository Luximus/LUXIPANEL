import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../../config/env.js", () => ({ env: { LUXIPANEL_GITHUB_TOKEN: "" } }));
const route = "/repos/Luxisoft/LUXIPANEL/issues/2/comments?per_page=100&page=1";
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-15T18:00:00Z")); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("refreshes an empty comment cache after a minute while preserving the normal cache for other callers", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("[]", { headers: { etag: "first" } })).mockResolvedValueOnce(new Response('[{"id":1}]'));
  vi.stubGlobal("fetch", fetcher);
  const { publicGithub } = await import("./public-api.js");
  expect(await publicGithub(route)).toEqual([]);
  vi.setSystemTime(new Date("2026-10-15T18:01:01Z"));
  expect(await publicGithub(route)).toEqual([]);
  expect(await publicGithub(route, { maxAgeMs: 60000 })).toEqual([{ id: 1 }]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1]?.[1].headers["If-None-Match"]).toBe("first");
});
it("renews the short cache after GitHub confirms an unchanged response", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('[{"id":1}]', { headers: { etag: "one" } })).mockResolvedValueOnce(new Response(null, { status: 304 }));
  vi.stubGlobal("fetch", fetcher);
  const { publicGithub } = await import("./public-api.js");
  await publicGithub(route, { maxAgeMs: 60000 });
  vi.setSystemTime(new Date("2026-10-15T18:01:01Z"));
  expect(await publicGithub(route, { maxAgeMs: 60000 })).toEqual([{ id: 1 }]);
  await publicGithub(route, { maxAgeMs: 60000 });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("follows actual comment pages instead of a cached announcement count", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 100 }, (_, id) => ({ id }))))).mockResolvedValueOnce(new Response('[{"id":100}]'));
  vi.stubGlobal("fetch", fetcher);
  const { publicGithubPages } = await import("./public-api.js");
  const rows = await publicGithubPages("/repos/Luxisoft/LUXIPANEL/issues/2/comments", { maxAgeMs: 60000 });
  expect(rows).toHaveLength(101);
  expect(fetcher.mock.calls[1]?.[0]).toContain("per_page=100&page=2");
});
