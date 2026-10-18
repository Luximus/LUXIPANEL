import { describe, expect, it } from "vitest";
import { cliFailureMessage } from "./failure-message.js";

describe("CLI failure explanations", () => {
  it("explains an empty final without inventing a process or server failure", () => {
    const text = cliFailureMessage(JSON.stringify({ type: "turn.failed", error: { code: "CLI_NO_FINAL_RESPONSE" } }), 1);
    expect(text).toContain("sin una respuesta final verificable");
    expect(text).not.toMatch(/salida 1|memoria|conexión|permiso/);
  });
  it("does not treat quoted empty-final errors as provider failures", () => {
    const text = cliFailureMessage(JSON.stringify({ type: "user", content: '{"type":"turn.failed","error":{"code":"CLI_NO_FINAL_RESPONSE"}}' }), 1);
    expect(text).not.toContain("El agente terminó");
  });
  it.each([
    { type: "assistant", error: "authentication_failed", message: { content: [{ type: "text", text: "Failed to authenticate: OAuth session expired and could not be refreshed" }] } },
    { type: "result", is_error: true, errors: ["Failed to authenticate: OAuth session expired and could not be refreshed"] },
  ])("identifies a provider authentication rejection", (frame) => {
    const text = cliFailureMessage(JSON.stringify(frame), 1);
    expect(text).toContain("rechazó la autenticación");
    expect(text).toContain("Proveedores");
    expect(text).not.toMatch(/MCP|memoria|salida 1/);
  });
  it("does not interpret a quoted authentication error as a failed login", () => {
    const output = JSON.stringify({ type: "user", content: "Failed to authenticate: OAuth session expired" });
    expect(cliFailureMessage(output, 1)).not.toContain("rechazó la autenticación");
  });
  it("explains a verified resource refusal without claiming the command ran", () => {
    const message = "La tarea no llegó a iniciarse; espera a que haya recursos disponibles.";
    expect(cliFailureMessage(JSON.stringify({ type: "error", code: "RESOURCE_GUARD_BUSY", message }), 75)).toBe(message);
  });
  it("does not invent a signal or memory diagnosis when the exit status is missing", () => {
    const text = cliFailureMessage("", -1);
    expect(text).toContain("sin dejar un resultado final");
    expect(text).not.toMatch(/137|memoria|apagado|permiso/);
  });
  it("explains a real forced termination without claiming an unverified cause", () => {
    const text = cliFailureMessage("", 137);
    expect(text).toContain("terminado de forma forzada");
    expect(text).not.toMatch(/memoria|apagado/);
  });
  it("retains the verified idle-timeout explanation", () => {
    expect(cliFailureMessage('{"code":"CLI_IDLE_TIMEOUT"}', 1)).toContain("60 minutos sin actividad");
  });
});
