import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../../../shared/github/public-api.js", () => ({ CANONICAL_GITHUB: "/repos/Luxisoft/LUXIPANEL", publicGithubPages: vi.fn() }));
import { publicGithubPages } from "../../../shared/github/public-api.js";
import { projectContributors } from "./release-contributors.service.js";
beforeEach(() => vi.resetAllMocks());
it("loads canonical project contributors, deduplicates profiles and never trusts upstream URLs", async () => {
  vi.mocked(publicGithubPages).mockResolvedValue([
    { login: "Maintainer", id: 123, contributions: 4, html_url: "javascript:alert(1)", avatar_url: "https://evil.test" },
    { login: "maintainer", id: 123 }, { login: "../escape", id: 9 }, null,
    { login: "github-actions[bot]", id: 456, contributions: -3 }, { login: "helper", id: "unsafe" },
  ]);
  const result = await projectContributors();
  expect(publicGithubPages).toHaveBeenCalledWith("/repos/Luxisoft/LUXIPANEL/contributors");
  expect(result.unavailable).toBe(false); expect(result.items).toHaveLength(3);
  expect(result.items[0]).toEqual({ login: "Maintainer", url: "https://github.com/Maintainer", avatarUrl: "https://avatars.githubusercontent.com/u/123?s=64&v=4", contributions: 4 });
  expect(result.items[1]?.contributions).toBe(0); expect(result.items[2]?.avatarUrl).toBe("");
});
it("keeps release views usable when GitHub contributors are unavailable", async () => {
  vi.mocked(publicGithubPages).mockRejectedValue(new Error("rate limit"));
  expect(await projectContributors()).toEqual({ items: [], unavailable: true });
});
