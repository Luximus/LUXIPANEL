import { describe, expect, it } from "vitest";
import { MOUSE_TRACKING_OFF, terminalProcessEnded, trackAlternateScreenExit } from "./terminal-lifecycle";

describe("terminal lifecycle", () => {
  it("disables mouse reporting without resetting the terminal screen", () => {
    expect(MOUSE_TRACKING_OFF).toContain("\x1b[?1000l");
    expect(MOUSE_TRACKING_OFF).toContain("\x1b[?1006l");
    expect(MOUSE_TRACKING_OFF).not.toContain("\x1bc");
  });

  it("detects a TUI leaving the alternate screen across output frames", () => {
    const first = trackAlternateScreenExit("", "ready\x1b[?10");
    expect(first.exited).toBe(false);
    const second = trackAlternateScreenExit(first.tail, "49l$ ");
    expect(second.exited).toBe(true);
    expect(trackAlternateScreenExit(second.tail, "next output").exited).toBe(false);
  });

  it("keeps timed out and replaced sessions eligible for reconnect", () => {
    expect(terminalProcessEnded("process-exit")).toBe(true);
    expect(terminalProcessEnded("idle-timeout")).toBe(false);
    expect(terminalProcessEnded("replaced")).toBe(false);
    expect(terminalProcessEnded("")).toBe(false);
  });
});
