import { beforeEach, expect, it, vi } from "vitest";
import { profilesApi } from "./api";
import { emptyGlobalManifest } from "./types";
const mock = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), get: vi.fn(), scope: "A" }));
vi.mock("@/lib/api-client", () => ({ api: mock, resolveTargetScope: () => mock.scope, scopeHeaders: () => ({}) }));
beforeEach(() => { vi.clearAllMocks(); mock.scope = "A"; });
it("publishes only the portable draft and stops if the target changes between requests", async () => {
  const draft = { id: "profile", revision: 1, manifest: emptyGlobalManifest(), ownerId: 77, privateConfig: { model: "private" } };
  mock.post.mockImplementation(async () => { mock.scope = "B"; return { ok: true, data: { data: [] } }; });
  await expect(profilesApi.publish(draft, "1.0.0")).rejects.toThrow("cambiaron");
  expect(mock.post).toHaveBeenCalledTimes(1);
  mock.scope = "A"; mock.post.mockResolvedValue({ ok: true, data: { profile: draft } });
  await profilesApi.save(draft);
  expect(mock.post.mock.calls.at(-1)![1]).toEqual({ id: draft.id, revision: 1, manifest: draft.manifest });
});
it("saves a private adaptation with its project and revision without changing membership", async () => {
  mock.put.mockResolvedValue({ ok: true, data: { agent: { id: "a" } } });
  await profilesApi.privateSave("a", "p", 4, { model: "private", projectIds: ["other"] });
  expect(mock.put).toHaveBeenCalledWith("/api/ai/agents/a/project-profile/p", { revision: 4, config: { model: "private" } });
});
