import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  panels: vi.fn(), handoff: vi.fn(), saved: vi.fn(), persist: vi.fn(), register: vi.fn(), relogin: vi.fn(),
  password: vi.fn(), username: vi.fn(), reset: undefined as undefined | (() => void), revision: 0, target: undefined as any,
}));
vi.mock("./client/panels", () => ({ getPanelsData: mocks.panels }));
vi.mock("./panelHandoff", () => ({ connectWithSavedPanelCredentials: mocks.handoff }));
vi.mock("./directAuth", () => ({ normalizeBaseUrl: (url: string) => url, reloginStandalone: mocks.relogin }));
vi.mock("./serverApi", () => ({
  getDirect: () => mocks.target,
  getDirectSessionRevision: () => mocks.revision,
  registerDirectServer: (...args: any[]) => { mocks.register(...args); mocks.target = args[1]; mocks.revision++; },
}));
vi.mock("../storage/directPanelSession", () => ({
  getDirectPanelSession: mocks.saved, setDirectPanelSession: mocks.persist,
  getDirectPanelUsername: mocks.username, getDirectPanelPassword: mocks.password,
}));
vi.mock("../lib/store-reset", () => ({ registerStoreReset: (reset: () => void) => { mocks.reset = reset; } }));
import { ensureTerminalSession } from "./terminalSession";
const session = { jwt: "box-session", csrf: null, exp: Date.now() + 600_000 };
beforeEach(() => {
  mocks.reset?.(); vi.clearAllMocks(); mocks.revision = 0; mocks.target = undefined;
  mocks.panels.mockResolvedValue({ panels: [{ id: "box", customDomain: "https://box.example", sshKeyId: "saved-key" }] });
  mocks.saved.mockResolvedValue(null); mocks.handoff.mockReset().mockResolvedValue(session);
  mocks.username.mockResolvedValue(null); mocks.password.mockResolvedValue(null);
});
it("authenticates the selected panel with its saved LP credential without a connection screen", async () => {
  expect(await ensureTerminalSession("box", "account", () => true)).toBe(true);
  expect(mocks.handoff).toHaveBeenCalledWith("box", "account", "https://box.example", "saved-key", expect.any(Function));
  expect(mocks.register).toHaveBeenCalledWith("box", expect.objectContaining({ jwt: session.jwt, baseUrl: "https://box.example", relogin: expect.any(Function) }));
});
it("reuses the native saved session and an already registered target", async () => {
  mocks.saved.mockResolvedValue(session);
  expect(await ensureTerminalSession("box", "account", () => true)).toBe(true);
  expect(mocks.handoff).not.toHaveBeenCalled();
  expect(await ensureTerminalSession("box", "account", () => true)).toBe(true);
  expect(mocks.panels).toHaveBeenCalledTimes(1);
});
it("shares authentication across consoles and keeps it if one console closes", async () => {
  let resolve!: (session: any) => void;
  let firstActive = true;
  mocks.handoff.mockImplementation(() => new Promise(r => { resolve = r; }));
  const first = ensureTerminalSession("box", "account", () => firstActive);
  const second = ensureTerminalSession("box", "account", () => true);
  await vi.waitFor(() => expect(mocks.handoff).toHaveBeenCalledTimes(1));
  firstActive = false;
  resolve(session);
  expect(await second).toBe(true); await first;
  expect(mocks.register).toHaveBeenCalledTimes(1);
});
it.each(["close", "logout", "session-change"])("does not register a late handoff after %s", async reason => {
  let resolve!: (session: any) => void;
  let active = true;
  mocks.handoff.mockImplementation(() => new Promise(r => { resolve = r; }));
  const connection = ensureTerminalSession("box", "account", () => active);
  await vi.waitFor(() => expect(mocks.handoff).toHaveBeenCalledTimes(1));
  if (reason === "close") active = false;
  if (reason === "logout") mocks.reset?.();
  if (reason === "session-change") mocks.revision++;
  resolve(session);
  expect(await connection).toBe(false);
  expect(mocks.register).not.toHaveBeenCalled();
  expect(mocks.persist).not.toHaveBeenCalled();
});
it("returns a failure without asking for new credentials when saved authentication fails", async () => {
  mocks.handoff.mockResolvedValue(null);
  expect(await ensureTerminalSession("box", "account", () => true)).toBe(false);
  expect(mocks.register).not.toHaveBeenCalled();
});
it("silently renews an expired direct session using the same saved LP credential", async () => {
  await ensureTerminalSession("box", "account", () => true);
  mocks.handoff.mockResolvedValue({ ...session, jwt: "renewed-session" });
  const fresh = await mocks.target.relogin();
  expect(fresh.jwt).toBe("renewed-session");
  expect(mocks.register).toHaveBeenCalledTimes(2);
});
