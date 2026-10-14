import { afterEach, expect, it, vi } from "vitest";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("../../config/env", () => ({ ENV: { apiUrl: "https://account.example" } }));
vi.mock("../../integrity", () => ({ requestWithPlayIntegrity: vi.fn() }));
vi.mock("../auth-bridge", () => ({ refreshAccessToken: refresh }));
vi.mock("../../lib/step-up-bridge", () => ({ promptStepUp: vi.fn() }));
vi.mock("../../lib/rate-limit-notice", () => ({ emitRateLimited: vi.fn(), parseRetryAfterSeconds: vi.fn() }));
import { connectPanel } from "./panels";
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("renews the account session and keeps the saved-credential handoff when its access token expires", async () => {
  const body = { ok: true, data: { authenticated: true, handoff: { url: "https://box.example/api/auth/sso/handoff", ticket: "one-use" } } };
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "Expired session" }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  refresh.mockResolvedValue("fresh-account-token");
  expect(await connectPanel("box-a", "expired-account-token", { sshKeyId: "saved-key" })).toEqual(body);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][1]).toMatchObject({
    method: "POST", headers: { Authorization: "Bearer fresh-account-token" }, body: JSON.stringify({ sshKeyId: "saved-key" }),
  });
});
