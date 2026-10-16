import { describe, expect, it } from "vitest";
import { cliFailureMessage } from "./failure-message.js";

describe("CLI failure explanations", () => {
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
