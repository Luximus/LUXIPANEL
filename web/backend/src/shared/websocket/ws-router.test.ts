import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("./live-auth.js", () => ({ verifyWsAuthorization: state.verify }));
vi.mock("../auth/authorization-revision.js", async () => ({ authorizationChanges: new (await import("node:events")).EventEmitter(), subscribeAuthorizationChanges: () => undefined }));
import { authorizationChanges } from "../auth/authorization-revision.js";
import { WsRouter } from "./ws-router.js";
let server: Server, socket: WebSocket;
beforeEach(() => { state.verify.mockReset(); state.verify.mockResolvedValue({ exp: Date.now() / 1000 + 60, authorizationRevision: "1" }); });
afterEach(async () => { socket?.terminate(); if (server?.listening) await new Promise<void>(resolve => server.close(() => resolve())); });
async function connect(handler: Parameters<WsRouter["register"]>[1]) {
  server = createServer(); new WsRouter(server).register("/test/ws", handler);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  socket = new WebSocket(`ws://127.0.0.1:${(server.address() as { port: number }).port}/test/ws`);
  return socket;
}
describe("live WebSocket revocation", () => {
  it("closes an already authenticated stream immediately on authorization changes", async () => {
    const ws = await connect(ws => { ws.send("ready"); }); await once(ws, "message");
    const closed = once(ws, "close"); authorizationChanges.emit("changed", "server");
    expect((await closed)[0]).toBe(1008);
  });
  it("does not open the module if revocation occurs during asynchronous authentication", async () => {
    let complete!: (value: unknown) => void; state.verify.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const handler = vi.fn(), ws = await connect(handler); await once(ws, "open");
    authorizationChanges.emit("changed", "server"); const closed = once(ws, "close");
    complete({ exp: Date.now() / 1000 + 60, authorizationRevision: "1" }); await closed;
    expect(handler).not.toHaveBeenCalled();
  });
  it("closes at account expiry without waiting for another API request", async () => {
    state.verify.mockResolvedValue({ exp: Date.now() / 1000 + 60, authorizationRevision: "1", hostingPolicy: { expiresAt: new Date(Date.now() + 200).toISOString() } });
    const ws = await connect(ws => { ws.send("ready"); }); await once(ws, "message");
    expect((await once(ws, "close"))[0]).toBe(1008);
  });
  it("fails closed on its fresh heartbeat when the authorization store becomes unavailable", async () => {
    const ws = await connect(ws => { ws.send("ready"); }); await once(ws, "message");
    state.verify.mockRejectedValue(new Error("Redis disconnected"));
    expect((await once(ws, "close"))[0]).toBe(1008);
  }, 8000);
});
