vi.mock("../../../config/env.js", () => ({ env: { LOG_LEVEL: "silent", NODE_ENV: "test", LUXIPANEL_CONFIG_DIR: "/tmp" } }));
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./releases.service.js", () => ({ releasesService: { publishedRelease: vi.fn() } }));
vi.mock("../../../shared/github/public-api.js", () => ({ CANONICAL_GITHUB: "/repos/Luxisoft/LUXIPANEL", publicGithub: vi.fn(), publicGithubPages: vi.fn() }));
vi.mock("../../../shared/releases/translation-bridge.js", () => ({ releaseTranslationBridge: { translate: vi.fn() } }));
import { publicGithub, publicGithubPages } from "../../../shared/github/public-api.js";
import { releaseTranslationBridge } from "../../../shared/releases/translation-bridge.js";
import { releasesService } from "./releases.service.js";
import { releaseDetails, translatedReleaseDetails } from "./release-details.service.js";
const release = { tag: "v2.0.4", name: "Release", notes: "Fixed `web/backend`", publishedAt: "2026-10-14" };
const context = { executor: {} as never, user: { userId: 1 } as never };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(releasesService.publishedRelease).mockResolvedValue(release); });
describe("published release details", () => {
  it("associates only the selected version's discussion and accepts canonical comment URLs", async () => {
    vi.mocked(publicGithub).mockResolvedValueOnce([{ number: 2, comments: 0, html_url: "https://github.com/Luxisoft/LUXIPANEL/issues/2" }]);
    vi.mocked(publicGithubPages).mockResolvedValueOnce([
      { id: 8, body: "Fixed `code`", html_url: "https://github.com/Luxisoft/LUXIPANEL/issues/2#issuecomment-8", updated_at: "now", user: { login: "contributor" } },
      { id: 9, body: "bad", html_url: "javascript:alert(1)", user: null },
    ]);
    const details = await releaseDetails(release.tag);
    expect(publicGithub).toHaveBeenNthCalledWith(1, expect.stringContaining("labels=release%3Av2.0.4"));
    expect(publicGithubPages).toHaveBeenCalledWith(expect.stringContaining("/issues/2/comments"), { maxAgeMs: 60000 });
    expect(details.comments).toHaveLength(1); expect(details.comments[0]?.author).toBe("contributor");
  });
  it("preserves notes when discussion is unavailable", async () => {
    vi.mocked(publicGithub).mockRejectedValue(new Error("rate limit"));
    expect(await releaseDetails(release.tag)).toMatchObject({ notes: release.notes, comments: [], commentsUnavailable: true });
  });
  it("translates server-fetched content and rejects arbitrary tags/languages before invoking AI", async () => {
    vi.mocked(publicGithub).mockResolvedValue([]);
    vi.mocked(releaseTranslationBridge.translate).mockResolvedValue({ status: "unavailable", texts: ["Fixed `web/backend`"], reason: "insufficient_balance" });
    const translated = await translatedReleaseDetails(release.tag, "es", context);
    expect(translated).toMatchObject({ translation: "unavailable", notes: "Fixed `web/backend`", translationReason: "insufficient_balance" });
    expect(releaseTranslationBridge.translate).toHaveBeenCalledWith({ ...context, locale: "es", texts: [release.notes] });
    await expect(translatedReleaseDetails(release.tag, "es;prompt", context)).rejects.toThrow();
    vi.mocked(releasesService.publishedRelease).mockRejectedValue(new Error("Unknown release"));
    await expect(translatedReleaseDetails("../../private", "es", context)).rejects.toThrow("Unknown release");
    expect(releaseTranslationBridge.translate).toHaveBeenCalledTimes(1);
  });
});
