import { describe, expect, it } from "vitest";
import { ServerAccessError, serverToolError } from "./server-tool-error.js";

const context = { serverId: "server-1", serverName: "FRONTEND" };

describe("friendly remote server errors", () => {
  it.each([
    [new Error("Timed out while waiting for handshake"), "SERVER_CONNECTION_TIMEOUT", "not_started"],
    [new Error("connect ETIMEDOUT 198.51.100.1:22"), "SERVER_CONNECTION_TIMEOUT", "not_started"],
    [Object.assign(new Error("socket timeout"), { code: "ETIMEDOUT" }), "SERVER_RESPONSE_TIMEOUT", "unconfirmed"],
    [Object.assign(new Error("refused"), { code: "ECONNREFUSED" }), "SERVER_CONNECTION_REFUSED", "not_started"],
    [Object.assign(new Error("route"), { code: "EHOSTUNREACH" }), "SERVER_UNREACHABLE", "not_started"],
    [Object.assign(new Error("DNS"), { code: "ENOTFOUND" }), "SERVER_DNS_FAILED", "not_started"],
    [new Error("All configured authentication methods failed"), "SERVER_AUTH_FAILED", "not_started"],
    [new Error("Host denied (verification failed)"), "SERVER_HOST_KEY_CHANGED", "not_started"],
    [new Error("exec timed out after 300000ms"), "SERVER_OPERATION_TIMEOUT", "unconfirmed"],
    [Object.assign(new Error("reset"), { code: "ECONNRESET" }), "SERVER_CONNECTION_LOST", "unconfirmed"],
    [Object.assign(new Error("No such file"), { code: 2 }), "SERVER_FILE_NOT_FOUND", "unconfirmed"],
    [Object.assign(new Error("Permission denied"), { code: 3 }), "SERVER_FILE_PERMISSION_DENIED", "unconfirmed"],
  ])("classifies %s without confusing transport, authentication or operation failures", (error, code, operationStatus) => {
    const result = serverToolError(error, context);
    expect(result).toMatchObject({ serverId: "server-1", serverName: "FRONTEND", code, operationStatus });
    expect(result.message).toContain("FRONTEND");
    expect(result.nextStep).toBeTruthy();
    expect(result.message).not.toContain((error as Error).message);
  });

  it("does not claim no changes after a peer request followed by an SSH timeout", () => {
    expect(serverToolError(new Error("Timed out while waiting for handshake"), { ...context, peerAttempted: true }))
      .toMatchObject({ code: "SERVER_CONNECTION_TIMEOUT", operationStatus: "unconfirmed" });
  });

  it("preserves safe authorization errors", () => {
    expect(serverToolError(new ServerAccessError("SERVER_ACCESS_DENIED", "No tienes permiso para usar ese servidor."), context))
      .toMatchObject({ code: "SERVER_ACCESS_DENIED", message: "No tienes permiso para usar ese servidor.", operationStatus: "not_started" });
  });

  it.each([new Error("unknown credential secret-token command=rm -rf data"), "secret-token", null, undefined])("does not expose unclassified errors or crash on non-Errors", error => {
    const result = serverToolError(error, context);
    expect(result).toMatchObject({ code: "SERVER_OPERATION_FAILED", operationStatus: "unconfirmed" });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
});
