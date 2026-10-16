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

it("refreshes an unexpired catalog and makes later background reads see the new revision", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('[{"sha":"old"}]', { headers: { etag: "old" } }))
    .mockResolvedValueOnce(new Response('[{"sha":"new"}]'));
  vi.stubGlobal("fetch", fetcher);
  const { publicGithub } = await import("./public-api.js");
  expect(await publicGithub(route)).toEqual([{ sha: "old" }]);
  expect(await publicGithub(route, { fresh: true })).toEqual([{ sha: "new" }]);
  expect(await publicGithub(route)).toEqual([{ sha: "new" }]);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("retries a cached failure on an explicit refresh", async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(new Response("[]"));
  vi.stubGlobal("fetch", fetcher);
  const { publicGithub } = await import("./public-api.js");
  await expect(publicGithub(route)).rejects.toThrow("offline");
  expect(await publicGithub(route, { fresh: true })).toEqual([]);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("never presents a stale fallback as a successful live refresh at the anonymous limit", async () => {
  const fetcher = vi.fn(async () => new Response('[{"sha":"old"}]'));
  vi.stubGlobal("fetch", fetcher);
  const { publicGithub } = await import("./public-api.js");
  await publicGithub(route, { maxAgeMs: 60000 });
  for (let i = 0; i < 44; i++) await publicGithub(`/repos/Luxisoft/LUXIPANEL/issues/${i + 10}`);
  vi.advanceTimersByTime(61000);
  expect(await publicGithub(route, { maxAgeMs: 60000 })).toEqual([{ sha: "old" }]);
  await expect(publicGithub(route, { fresh: true })).rejects.toThrow("límite");
  expect(fetcher).toHaveBeenCalledTimes(45);
});

it("waits for an older background request then coalesces strict refreshes", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(new Response('[{"sha":"new"}]'));
  vi.stubGlobal("fetch", fetcher);
  const { publicGithub } = await import("./public-api.js");
  const background = publicGithub(route);
  const first = publicGithub(route, { fresh: true });
  const second = publicGithub(route, { fresh: true });
  finish(new Response('[{"sha":"old"}]'));
  expect(await background).toEqual([{ sha: "old" }]);
  expect(await first).toEqual([{ sha: "new" }]);
  expect(await second).toEqual([{ sha: "new" }]);
  expect(await publicGithub(route)).toEqual([{ sha: "new" }]);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
