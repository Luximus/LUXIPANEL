vi.mock("../../../shared/websocket/live-auth.js", () => ({ verifyWsAuthorization: async () => {
  const { tokenService } = await import("../services/token.service.js");
  const payload = await tokenService.verify("test");
  return payload?.kind === "mfa_pending" ? null : payload;
} }));
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
const mock = vi.hoisted(() => ({ verify: vi.fn(), enabled: vi.fn(), executor: vi.fn() }));
vi.mock("../../../shared/executor/index.js", async original => {
  const actual = await original<typeof import("../../../shared/executor/index.js")>();
  return { ...actual, getDirectExecutorByBridgeSessionId: mock.executor };
});
vi.mock("../services/token.service.js", () => ({ tokenService: { verify: mock.verify, toSessionUser: (payload: unknown) => payload } }));
vi.mock("../../admin/services/module-registry.service.js", async (original) => {
  const actual = await original<typeof import("../../admin/services/module-registry.service.js")>();
  return { ...actual, moduleRegistryService: { ...actual.moduleRegistryService, isEnabled: mock.enabled } };
});
vi.mock("../../../shared/websocket/upgrade-auth.js", () => ({ extractWsToken: () => "token", extractOverrideBridgeId: () => undefined,
  wsConnKey: (id: number, target = "local") => `${target}:${id}`, wsSend: (ws: WebSocket, data: unknown) => ws.send(JSON.stringify(data)) }));
vi.mock("../../../shared/session/bridge-header.js", () => ({ resolveOverrideBridge: async () => null }));
vi.mock("../../monitor/services/monitor-executor.service.js", () => ({ resolveMonitorExecutor: mock.executor }));
vi.mock("../../monitor/services/stats-collector.service.js", () => ({ statsCollectorService: { getLatest: () => ({ cpu: 0 }), collectWithExecutorCached: async () => ({ cpu: 0 }) } }));
vi.mock("../../monitor/services/system-stats.service.js", () => ({ systemStatsService: { collect: async () => ({ cpu: 0 }) } }));
vi.mock("../../monitor/services/alert-evaluator.service.js", () => ({ alertEvaluatorService: { firingRuleIds: () => [] } }));
import { handleMonitorConnection, broadcastMonitorAlert } from "../../monitor/controllers/monitor-ws.controller.js";
import { handleAssistantConnection } from "../../ai-assistant/controllers/assistant-ws.controller.js";
import { getContextExecutor } from "../../../shared/executor/context.js";
import { eventBus, Events } from "../../../shared/events/index.js";

function socket() {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const ws = { readyState: 1, send: vi.fn(), on: vi.fn((event, callback) => listeners.set(event, callback)),
    close: vi.fn(() => listeners.get("close")?.()) };
  return { ws: ws as unknown as WebSocket, spies: ws };
}
const req = { headers: {}, url: "/api/monitor/ws" } as IncomingMessage;
function payload(module: string, granted = true) {
  return { userId: 1, username: "reader", role: "user", kind: "user", modules: [module], permissions: { views: granted ? [`panel.${module}`] : [], actions: granted ? [`${module}.read`] : [] } };
}
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); mock.enabled.mockResolvedValue(true); mock.executor.mockResolvedValue({ target: { id: "local" } }); });
afterEach(() => vi.useRealTimers());
describe.each([["monitor", handleMonitorConnection], ["assistant", handleAssistantConnection]] as const)("%s WebSocket authorization", (module, handler) => {
  it("denies unchecked views and partial MFA sessions before opening data streams", async () => {
    for (const user of [payload(module, false), { ...payload(module), modules: [] }, { ...payload(module), kind: "mfa_pending" }]) {
      mock.verify.mockResolvedValue(user);
      const { ws, spies } = socket();
      await handler(ws, req);
      expect(spies.close).toHaveBeenCalled();
      expect(mock.executor).not.toHaveBeenCalled();
    }
  });
  it("denies a disabled module even for an admin", async () => {
    mock.verify.mockResolvedValue({ ...payload(module), kind: "admin" }); mock.enabled.mockResolvedValue(false);
    const { ws, spies } = socket(); await handler(ws, req);
    expect(spies.close).toHaveBeenCalled();
  });
  it("denies a view-only grant without its stream action", async () => {
    const user = payload(module); user.permissions.actions = []; mock.verify.mockResolvedValue(user);
    const { ws, spies } = socket(); await handler(ws, req); expect(spies.close).toHaveBeenCalled();
  });
  it("accepts an administrator for Monitor and an authorized user for Assistant", async () => {
    mock.verify.mockResolvedValue({ ...payload(module), kind: module === "monitor" ? "admin" : "user" });
    const { ws, spies } = socket(); await handler(ws, req);
    expect(spies.close).not.toHaveBeenCalled();
    expect(spies.send).toHaveBeenCalled();
    spies.close();
  });
  it("checks activation on the remote server instead of the panel host", async () => {
    mock.verify.mockResolvedValue({ ...payload(module), kind: module === "monitor" ? "admin" : "user", direct: true, bridgeSessionId: "bridge" });
    mock.enabled.mockImplementation(async () => getContextExecutor()?.target.id === "allowed-server");
    mock.executor.mockResolvedValueOnce({ target: { id: "disabled-server" } }).mockResolvedValueOnce({ target: { id: "allowed-server" } });
    const denied = socket(), allowed = socket();
    await handler(denied.ws, req); await handler(allowed.ws, req);
    expect(denied.spies.close).toHaveBeenCalledWith(1008, "Forbidden");
    expect(allowed.spies.close).not.toHaveBeenCalled();
    allowed.spies.close();
  });
});
it("keeps monitor alert broadcasts on the connected server", async () => {
  mock.verify.mockResolvedValue({ ...payload("monitor"), kind: "admin" });
  const first = socket(), second = socket();
  mock.executor.mockResolvedValueOnce({ target: { id: "one" } }).mockResolvedValueOnce({ target: { id: "two" } });
  await handleMonitorConnection(first.ws, req); await handleMonitorConnection(second.ws, req);
  first.spies.send.mockClear(); second.spies.send.mockClear();
  broadcastMonitorAlert("alert", { scope: "one", rule: "private" });
  expect(first.spies.send).toHaveBeenCalledOnce(); expect(second.spies.send).not.toHaveBeenCalled();
  first.spies.close(); second.spies.close();
});

it("keeps assistant task updates on the connected server for the same user", async () => {
  mock.verify.mockResolvedValue({ ...payload("assistant"), direct: true, bridgeSessionId: "bridge" });
  const first = socket(), second = socket();
  mock.executor.mockResolvedValueOnce({ target: { id: "one" } }).mockResolvedValueOnce({ target: { id: "two" } });
  await handleAssistantConnection(first.ws, req); await handleAssistantConnection(second.ws, req);
  try {
    first.spies.send.mockClear(); second.spies.send.mockClear();
    eventBus.emit(Events.AI_TEAM_TASK_UPDATE, { targetId: "one", userId: "1", task: { id: "private" }, phase: "assigned" });
    expect(first.spies.send).toHaveBeenCalledOnce(); expect(second.spies.send).not.toHaveBeenCalled();
    eventBus.emit(Events.AI_TEAM_TASK_UPDATE, { userId: "1", task: { id: "unscoped" }, phase: "assigned" });
    expect(first.spies.send).toHaveBeenCalledOnce(); expect(second.spies.send).not.toHaveBeenCalled();
  } finally { first.spies.close(); second.spies.close(); }
});

it("never opens global monitoring for a non-admin with an explicit stream grant", async () => {
  mock.verify.mockResolvedValue(payload("monitor"));
  const { ws, spies } = socket(); await handleMonitorConnection(ws, req);
  expect(spies.close).toHaveBeenCalledWith(1008, "Forbidden"); expect(mock.executor).not.toHaveBeenCalled();
});
