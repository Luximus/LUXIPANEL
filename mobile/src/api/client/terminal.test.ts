import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  target: { baseUrl: "https://box.example/prefix", jwt: "private-session" } as { baseUrl: string; jwt: string } | undefined,
  api: vi.fn(),
}));
vi.mock("./panels", () => ({ getPublicPanelBranding: vi.fn() }));
vi.mock("../serverApi", () => ({
  getDirect: () => mocks.target,
  callServerApi: mocks.api,
  unwrap: (res: any) => res.ok ? res.data?.data : null,
}));
import { buildTerminalWsUrl, getTerminalTmuxStatus, installTerminalTmux, killTerminalSession } from "./terminal";
beforeEach(() => {
  mocks.target = { baseUrl: "https://box.example/prefix", jwt: "private-session" };
  mocks.api.mockReset().mockResolvedValue({ ok: true, data: { data: { token: "ws-ticket" } } });
});
it("uses the box prefix and a fresh WS ticket, preserving the console identity", async () => {
  const url = new URL(await buildTerminalWsUrl("server-a", "portal-secret", { cols: 90, rows: 30 }, "con-12345678"));
  expect(url.protocol).toBe("wss:");
  expect(url.host).toBe("box.example");
  expect(url.pathname).toBe("/prefix/api/terminal/ws");
  expect(url.searchParams.get("token")).toBe("ws-ticket");
  expect(url.searchParams.get("sessionId")).toBe("con-12345678");
  expect(url.searchParams.get("cols")).toBe("90");
  expect(url.searchParams.get("rows")).toBe("30");
  expect(url.toString()).not.toMatch(/portal-secret|private-session|panelId/);
  mocks.api.mockResolvedValueOnce({ ok: true, data: { data: { token: "new-ticket" } } });
  expect(await buildTerminalWsUrl("server-a", "portal-secret")).toContain("new-ticket");
  expect(mocks.api).toHaveBeenCalledTimes(2);
});
it("preserves plain HTTP ports and fails closed without authentication", async () => {
  mocks.target = { baseUrl: "http://box.example:8080/", jwt: "private-session" };
  expect(await buildTerminalWsUrl("server-a", "portal")).toMatch(/^ws:\/\/box.example:8080\/api\/terminal\/ws/);
  mocks.target = undefined;
  await expect(buildTerminalWsUrl("server-a", "portal")).rejects.toThrow("connect_required");
  expect(mocks.api).toHaveBeenCalledTimes(1);
  mocks.target = { baseUrl: "https://box.example", jwt: "private-session" };
  mocks.api.mockResolvedValueOnce({ ok: false, error: "auth_required" });
  await expect(buildTerminalWsUrl("server-a", "portal")).rejects.toThrow("auth_required");
});
it("rejects a ticket returned after the target is removed or replaced", async () => {
  let resolve!: (value: unknown) => void;
  mocks.api.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const pending = buildTerminalWsUrl("server-a", "portal");
  mocks.target = { baseUrl: "https://other.example", jwt: "other-session" };
  resolve({ ok: true, data: { data: { token: "old-ticket" } } });
  await expect(pending).rejects.toThrow("connect_required");
});
it("uses direct management routes for tmux and closing only the selected session", async () => {
  mocks.api.mockResolvedValueOnce({ ok: true, data: { data: { installed: false, canInstall: true, packageManager: "apt" } } });
  expect(await getTerminalTmuxStatus("server-a", "portal")).toMatchObject({ installed: false, canInstall: true });
  expect(mocks.api).toHaveBeenLastCalledWith("server-a", "portal", "GET", "/api/terminal/tmux-status");
  mocks.api.mockResolvedValueOnce({ ok: true, data: { data: { installed: true } } });
  expect(await installTerminalTmux("server-a", "portal")).toEqual({ installed: true, error: undefined });
  expect(mocks.api).toHaveBeenLastCalledWith("server-a", "portal", "POST", "/api/terminal/tmux-install", undefined, { timeoutMs: 0 });
  await killTerminalSession("server-a", "portal", "con-12345678");
  expect(mocks.api).toHaveBeenLastCalledWith("server-a", "portal", "DELETE", "/api/terminal/sessions/con-12345678");
});
