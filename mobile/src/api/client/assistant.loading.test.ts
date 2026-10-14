import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ direct: vi.fn(), api: vi.fn(), raw: vi.fn() }));
vi.mock("../serverApi", () => ({ getDirect: mocks.direct, callServerApi: mocks.api, withFreshGateway: (fn: () => unknown) => fn(), getDirectSessionRevision: () => 1, subscribeDirectSessions: () => undefined }));
vi.mock("../terminalSession", () => ({ ensureDirectPanelSession: async () => true }));
vi.mock("../../lib/store-reset", () => ({ registerStoreReset: () => undefined }));
vi.mock("./request", () => ({ requestRaw: mocks.raw, readCache: {}, TTL: {} }));
vi.mock("../../config/env", () => ({ ENV: {} }));
import { invalidateAssistantReads, luxAssistantProxy, luxAssistantProxyOk } from "./assistant";
beforeEach(() => { vi.resetAllMocks(); invalidateAssistantReads(); });
it("keeps a registered server on its direct transport and batches catalogs", async () => {
  mocks.direct.mockReturnValue({ baseUrl: "https://example.test" });
  mocks.api.mockResolvedValue({ ok: true, data: { catalogs: { agents: { agents: [] }, projects: { projects: [] } } } });
  await Promise.all([luxAssistantProxy("direct", "session", "GET", "/api/ai/agents"), luxAssistantProxy("direct", "session", "GET", "/api/ai/projects")]);
  expect(mocks.api).toHaveBeenCalledTimes(1);
  expect(mocks.raw).not.toHaveBeenCalled();
  expect(mocks.api.mock.calls[0]?.[3]).toBe("/api/ai/bootstrap");
});
it("accepts the direct payload and clears catalogs after mutations", async () => {
  mocks.api.mockResolvedValue({ ok: true, data: { ok: true, items: [{ id: "a" }] } });
  expect(await luxAssistantProxy("managed", "session", "GET", "/api/ai/conversations?q=&limit=15&paged=1")).toMatchObject({ items: [{ id: "a" }] });
  expect(await luxAssistantProxyOk("managed", "session", "PATCH", "/api/ai/conversations/a", { title: "x" })).toBe(true);
});
