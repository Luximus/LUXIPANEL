import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMaterial: vi.fn(), getView: vi.fn(), getPeerCredential: vi.fn(), allowed: vi.fn(), audit: vi.fn(),
  exec: vi.fn(), readFile: vi.fn(), readdir: vi.fn(), peerExec: vi.fn(),
  env: { PANEL_PEER_MCP_ENABLED: false },
}));
vi.mock("../../config/env.js", () => ({ env: mocks.env }));
vi.mock("../../shared/logger/index.js", () => ({ createModuleLogger: () => ({ warn: vi.fn() }) }));
vi.mock("../../shared/executor/index.js", () => ({ getContextExecutor: () => ({}), getContextUser: () => ({ userId: 1, kind: "admin" }), quoteArg: (value: string) => `'${value.replaceAll("'", "'\\''")}'` }));
vi.mock("../../shared/executor/direct-ssh-executor.js", () => ({ DirectSshExecutor: class {
  exec = mocks.exec; readFile = mocks.readFile; readdir = mocks.readdir;
} }));
vi.mock("../../shared/executor/sudo-exec-wrap.js", () => ({ wrapExecutorWithSudo: (executor: unknown) => executor }));
vi.mock("../servers/index.js", () => ({ targetsRepository: { getMaterial: mocks.getMaterial, getView: mocks.getView, getPeerCredential: mocks.getPeerCredential }, userMayUseTarget: mocks.allowed }));
vi.mock("./repositories/assistant-audit.repository.js", () => ({ assistantAuditRepository: { append: mocks.audit } }));
vi.mock("./services/panel-peer-mcp-client.js", () => ({ PanelPeerMcpClient: class {
  exec = mocks.peerExec;
  static isReachableError() { return true; }
} }));

import { serversAgentCapability } from "./servers-agent-capability.js";

const input = { serverId: "server-1", command: "uptime", path: "/proc/loadavg" };
const material = { target: { name: "FRONTEND", enabled: true, hostFingerprint: "approved" }, material: { host: "198.51.100.1" } };

describe("associated server tool failures", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.env.PANEL_PEER_MCP_ENABLED = false;
    mocks.getMaterial.mockResolvedValue(material);
    mocks.getView.mockResolvedValue({ name: "FRONTEND", host: "198.51.100.1" });
    mocks.allowed.mockReturnValue(true);
  });

  it.each(serversAgentCapability.tools)("$name reports the server and why the operation could not start", async tool => {
    const error = new Error("Timed out while waiting for handshake");
    mocks.exec.mockRejectedValue(error);
    mocks.readFile.mockRejectedValue(error);
    mocks.readdir.mockRejectedValue(error);
    const result = await tool.handler(input);
    expect(result).toMatchObject({ ok: false, output: { code: "SERVER_CONNECTION_TIMEOUT", serverName: "FRONTEND", operationStatus: "not_started" } });
    expect(JSON.stringify(result)).not.toContain("handshake");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ success: false, tool: tool.name }), expect.anything());
  });

  it.each(serversAgentCapability.tools)("$name stops before execution when permission is denied", async tool => {
    mocks.allowed.mockReturnValue(false);
    expect(await tool.handler(input)).toMatchObject({ ok: false, output: { code: "SERVER_ACCESS_DENIED", operationStatus: "not_started" } });
    expect(mocks.exec).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.readdir).not.toHaveBeenCalled();
  });

  it.each([
    [null, "SERVER_NOT_REGISTERED"],
    [{ ...material, target: { ...material.target, enabled: false } }, "SERVER_DISABLED"],
    [{ ...material, target: { ...material.target, hostFingerprint: undefined } }, "SERVER_IDENTITY_APPROVAL_REQUIRED"],
  ])("preserves registry, enabled and identity checks", async (found, code) => {
    mocks.getMaterial.mockResolvedValue(found);
    expect(await serversAgentCapability.tools[0]!.handler(input)).toMatchObject({ ok: false, output: { code, operationStatus: "not_started" } });
    expect(mocks.exec).not.toHaveBeenCalled();
  });

  it("keeps successful results and command exit errors intact", async () => {
    for (const exitCode of [0, 1]) {
      mocks.exec.mockResolvedValue({ exitCode, stdout: "output", stderr: "details" });
      expect(await serversAgentCapability.tools[0]!.handler(input)).toEqual({ ok: exitCode === 0, output: { serverId: "server-1", exitCode, stdout: "output", stderr: "details" } });
    }
  });

  it("reserves the target build slot and grants a long timeout", async () => {
    mocks.exec.mockResolvedValue({ exitCode: 0, stdout: "done", stderr: "" });
    await serversAgentCapability.tools[0]!.handler({ serverId: "server-1", command: "pnpm run build" });
    expect(mocks.exec).toHaveBeenCalledWith(expect.stringContaining("luxipanel-assistant-build-lease"), expect.objectContaining({ timeoutMs: 600_000 }));
  });

  it("does not report an unresponsive peer operation as never started", async () => {
    mocks.env.PANEL_PEER_MCP_ENABLED = true;
    mocks.getMaterial.mockResolvedValue({ ...material, target: { ...material.target, hasLuxipanel: true, luxipanelBaseUrl: "https://example.test" } });
    mocks.getPeerCredential.mockResolvedValue("test-token");
    mocks.peerExec.mockRejectedValue(new Error("peer response lost"));
    mocks.exec.mockRejectedValue(new Error("Timed out while waiting for handshake"));
    expect(await serversAgentCapability.tools[0]!.handler(input)).toMatchObject({ ok: false, output: { operationStatus: "unconfirmed" } });
  });
});
