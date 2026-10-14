import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ connect: vi.fn(), redeem: vi.fn() }));
vi.mock("./client/panels", () => ({ connectPanel: mocks.connect }));
vi.mock("./directAuth", () => ({ redeemPanelHandoff: mocks.redeem }));
import { connectWithSavedPanelCredentials } from "./panelHandoff";
beforeEach(() => {
  mocks.connect.mockReset().mockResolvedValue({ ok: true, data: { authenticated: true, handoff: { url: "https://box.example/api/auth/sso/handoff", ticket: "one-use" } } });
  mocks.redeem.mockReset().mockResolvedValue({ jwt: "box-session", csrf: null, exp: 0 });
});
it("asks LP to use the selected saved credential and exchanges only its ticket with the box", async () => {
  expect(await connectWithSavedPanelCredentials("a", "portal-token", "https://box.example", "key-a")).toMatchObject({ jwt: "box-session" });
  expect(mocks.connect).toHaveBeenCalledWith("a", "portal-token", { sshKeyId: "key-a" });
  expect(mocks.redeem).toHaveBeenCalledWith("https://box.example", { url: "https://box.example/api/auth/sso/handoff", ticket: "one-use" }, expect.any(Function));
});
it("leaves credential selection to LP when the panel has no explicit key", async () => {
  await connectWithSavedPanelCredentials("a", "portal-token", "https://box.example");
  expect(mocks.connect).toHaveBeenCalledWith("a", "portal-token", undefined);
});
it("does not invent an authenticated session from a manual-login fallback", async () => {
  mocks.connect.mockResolvedValue({ ok: true, data: { authenticated: false, redirectUrl: "https://box.example/login" } });
  expect(await connectWithSavedPanelCredentials("a", "portal-token", "https://box.example")).toBeNull();
  expect(mocks.redeem).not.toHaveBeenCalled();
});
it("does not redeem a ticket after the connection was cancelled", async () => {
  let current = true;
  mocks.connect.mockImplementationOnce(async () => { current = false; return { ok: true, data: { authenticated: true, handoff: { url: "https://box.example/api/auth/sso/handoff", ticket: "one-use" } } }; });
  expect(await connectWithSavedPanelCredentials("a", "portal-token", "https://box.example", undefined, () => current)).toBeNull();
  expect(mocks.redeem).not.toHaveBeenCalled();
});
