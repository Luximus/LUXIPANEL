import { beforeEach, expect, it, vi } from "vitest";
import { mobileProfilesApi } from "./api";
import { emptyGlobalManifest } from "./types";
vi.mock("expo-crypto", () => ({ randomUUID: () => "fixture-avatar" }));
const mock = vi.hoisted(() => ({ request: vi.fn(), ensure: vi.fn(), revision: 1, invalidate: vi.fn() }));
vi.mock("../../../api/serverApi", () => ({ callServerApi: mock.request, getDirectSessionRevision: () => mock.revision }));
vi.mock("../../../api/terminalSession", () => ({ ensureDirectPanelSession: mock.ensure }));
vi.mock("../../../api/client/assistant", () => ({ invalidateAssistantReads: mock.invalidate }));
beforeEach(() => { vi.clearAllMocks(); mock.revision = 1; mock.ensure.mockResolvedValue(true); });
it("requires a direct session before any profile request", async () => {
  mock.ensure.mockResolvedValue(false);
  await expect(mobileProfilesApi("A", "token").catalog()).rejects.toThrow("sesión");
  expect(mock.request).not.toHaveBeenCalled();
});
it("pins multi-step publication to the same session", async () => {
  const client = mobileProfilesApi("A", "token");
  mock.request.mockImplementation(async () => { mock.revision++; return { ok: true, data: { data: [] } }; });
  await expect(client.publish({ id: "p", revision: 1, manifest: emptyGlobalManifest() }, "1.0.0")).rejects.toThrow("sesión cambió");
  expect(mock.request).toHaveBeenCalledTimes(1);
});
it("writes private settings through the project endpoint and strips membership", async () => {
  mock.request.mockResolvedValue({ ok: true, data: { agent: { id: "a" } } });
  await mobileProfilesApi("A", "token").privateSave("a", "p", 3, { model: "private", projectIds: ["B"] });
  expect(mock.request).toHaveBeenCalledWith("A", "token", "PUT", "/api/ai/agents/a/project-profile/p", { revision: 3, config: { model: "private" } });
  expect(mock.invalidate).toHaveBeenCalledOnce();
});
