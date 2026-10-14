// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ request: vi.fn(), target: "server-a" }));
vi.mock("/scripts/extracted/lib/api-client.js?v=20260506a", () => ({
  api: { get: mocks.request, post: mocks.request, put: mocks.request, patch: mocks.request, delete: mocks.request },
  resolveTargetScope: () => mocks.target,
  scopeHeaders: (mutating: boolean) => ({ "X-Bridge-Session-Id": "active-bridge", ...(mutating ? { "X-CSRF-Token": "csrf" } : {}) }),
}));
vi.mock("/scripts/extracted/lib/i18n-client.js", () => ({ getClientMessages: async () => ({ apiErrors: { targetScopeChanged: "Reload this view." } }) }));
import { api, selectedMailServer, saveMailServer, scopeHeaders } from "./mail-api-client";
beforeEach(() => { sessionStorage.clear(); vi.resetAllMocks(); mocks.target = "server-a"; mocks.request.mockResolvedValue({ ok: true, data: [] }); });
it("scopes the selection to this tab's active panel server", () => {
  saveMailServer("mail-b"); expect(selectedMailServer()).toBe("mail-b");
  mocks.target = "server-c"; expect(selectedMailServer()).toBe("");
  mocks.target = "server-a"; expect(selectedMailServer()).toBe("mail-b");
  saveMailServer(""); expect(selectedMailServer()).toBe("");
});
it("preserves the active bridge and CSRF while routing mailbox reads/writes", async () => {
  saveMailServer("mail-b");
  await api.post("/api/mail/42/send", { subject: "test" });
  const headers = new Headers(mocks.request.mock.calls[0][2].headers);
  expect(headers.get("X-Bridge-Session-Id")).toBe("active-bridge");
  expect(headers.get("X-CSRF-Token")).toBe("csrf");
  expect(headers.get("X-Mail-Target-Id")).toBe("mail-b");
  expect(headers.get("Content-Type")).toBe("application/json");
  expect(scopeHeaders()).toMatchObject({ "X-Bridge-Session-Id": "active-bridge", "X-Mail-Target-Id": "mail-b" });
});
it.each(["/api/mail/server-settings", "/api/mail/server-settings/validate", "/api/mail/outbound", "/api/servers", "/api/system-deps/mail"])("keeps control and notification calls on the panel target: %s", async path => {
  saveMailServer("mail-b"); await api.get(path);
  expect(new Headers(mocks.request.mock.calls[0][1].headers).get("X-Mail-Target-Id")).toBeNull();
});
it("routes mail mutation jobs to the same server as their account mutation", async () => {
  saveMailServer("mail-b"); await api.get("/api/mail/jobs/opaque-id");
  expect(new Headers(mocks.request.mock.calls[0][1].headers).get("X-Mail-Target-Id")).toBe("mail-b");
});
it("discards a response if the mail selection changed while it was loading", async () => {
  let finish!: (value: unknown) => void;
  mocks.request.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  saveMailServer("mail-b"); const response = api.get("/api/accounts");
  saveMailServer("mail-c"); finish({ ok: true, data: [{ address: "b@example.test" }] });
  expect(await response).toMatchObject({ ok: false, code: "TARGET_SCOPE_CHANGED", status: 409 });
  const count = mocks.request.mock.calls.length;
  expect(await api.post("/api/mail/1/send", { subject: "old composer" })).toMatchObject({ ok: false, code: "TARGET_SCOPE_CHANGED", error: "Reload this view." });
  expect(mocks.request.mock.calls.length).toBe(count);
  expect(scopeHeaders()["X-Mail-Target-Id"]).toBe("mail-b");
});
