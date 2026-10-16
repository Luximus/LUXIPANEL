import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../../../shared/github/public-api.js", () => ({ CANONICAL_GITHUB: "/repos/Luxisoft/LUXIPANEL", publicGithub: vi.fn() }));
vi.mock("../../../config/env.js", () => ({ env: { LOG_LEVEL: "silent", NODE_ENV: "test" } }));
import { publicGithub } from "../../../shared/github/public-api.js";
import { releaseBranches, releaseBranchDetails, verifyBranchRevision } from "./release-branches.service.js";
const sha = "a".repeat(40), base = "b".repeat(40);
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllGlobals());
it("compares exact branch heads and does not mark an older branch as new", async () => {
  vi.mocked(publicGithub).mockImplementation(async route => route.includes("/branches?") ? [
    { name: "developer", commit: { sha } }, { name: "main", commit: { sha: base } }, { name: "untrusted", commit: { sha } },
  ] : { ahead_by: 3 });
  const result = await releaseBranches(base);
  expect(result.branches).toEqual([{ name: "main", commit: base, ahead: 0, updateAvailable: false }, { name: "developer", commit: sha, ahead: 3, updateAvailable: true }]);
  expect(publicGithub).toHaveBeenCalledWith(`/repos/Luxisoft/LUXIPANEL/compare/${base}...${sha}`);
});
it("does not advertise an update when comparison fails", async () => {
  vi.mocked(publicGithub).mockImplementation(async route => { if (route.includes("/branches?")) return [{ name: "developer", commit: { sha } }]; throw new Error("offline"); });
  const result = await releaseBranches(base); expect(result.branches[0]?.updateAvailable).toBe(false); expect(result.branches[0]?.error).toBeTruthy();
});
it("loads history for the selected SHA and detects component-only branches", async () => {
  vi.mocked(publicGithub).mockImplementation(async route => route.includes("/branches?") ? [{ name: "mobile", commit: { sha } }] : route.includes("/commits?") ? [{ sha, commit: { message: "Fix mobile", author: { name: "Author", date: "2026-10-16" } } }] : []);
  const details = await releaseBranchDetails("mobile", sha);
  expect(details.installable).toBe(false); expect(details.commits[0]?.url).toBe(`https://github.com/Luxisoft/LUXIPANEL/commit/${sha}`);
  expect(publicGithub).toHaveBeenCalledWith(`/repos/Luxisoft/LUXIPANEL/commits?sha=${sha}&per_page=30`);
});
it.each([["../main", sha], ["developer", "--upload-pack=bad"], ["developer;id", sha]])("rejects invalid branch selections before network access", async (branch, commit) => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  await expect(verifyBranchRevision(branch, commit)).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
});
it("revalidates mutations without the catalog cache and rejects an advanced branch", async () => {
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ commit: { sha: base } }) })); vi.stubGlobal("fetch", fetch);
  await expect(verifyBranchRevision("developer", sha)).rejects.toThrow("más reciente"); expect(publicGithub).not.toHaveBeenCalled();
  await expect(verifyBranchRevision("developer", base)).resolves.toBeUndefined();
});

it("does not label an unavailable contents check as a component-only branch", async () => {
  vi.mocked(publicGithub).mockImplementation(async route => {
    if (route.includes("/branches?")) return [{ name: "developer", commit: { sha } }];
    if (route.includes("/commits?")) return [];
    throw new Error("network unavailable");
  });
  await expect(releaseBranchDetails("developer", sha)).rejects.toThrow("No se pudo comprobar");
});
