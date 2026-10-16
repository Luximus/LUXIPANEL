import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../../../config/env.js", () => ({ env: { LUXIPANEL_GITHUB_TOKEN: "", LOG_LEVEL: "silent", NODE_ENV: "test" } }));
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

it("replaces a cached rejected revision and permits validation of the newly displayed revision", async () => {
  const installed = "a".repeat(40), previous = "b".repeat(40), latest = "c".repeat(40);
  let head = previous;
  const fetcher = vi.fn(async (input: string) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/branches")) return Response.json([{ name: "developer", commit: { sha: head } }]);
    if (url.pathname.endsWith("/branches/developer")) return Response.json({ commit: { sha: head } });
    if (url.pathname.includes("/compare/")) return Response.json({ ahead_by: head === latest ? 2 : 1, behind_by: 0 });
    throw new Error("Unexpected URL");
  });
  vi.stubGlobal("fetch", fetcher);
  const { releaseBranches, verifyBranchRevision } = await import("./release-branches.service.js");
  expect((await releaseBranches(installed)).branches[0]?.commit).toBe(previous);
  head = latest;
  expect((await releaseBranches(installed)).branches[0]?.commit).toBe(previous);
  await expect(verifyBranchRevision("developer", previous, installed)).rejects.toMatchObject({ code: "RELEASE_BRANCH_CHANGED", statusCode: 409 });
  const refreshed = await releaseBranches(installed);
  expect(refreshed.branches[0]).toMatchObject({ commit: latest, updateAvailable: true, ahead: 2 });
  await expect(verifyBranchRevision("developer", latest, installed)).resolves.toBeUndefined();
  expect(fetcher.mock.calls.filter(([url]) => new URL(url).pathname.endsWith("/branches"))).toHaveLength(2);
});
