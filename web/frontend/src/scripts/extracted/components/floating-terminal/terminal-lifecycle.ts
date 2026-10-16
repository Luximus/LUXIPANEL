// xterm can retain mouse reporting after a TUI exits or its PTY disconnects.
// Clear only the input modes; keep the visible scrollback intact.
export const MOUSE_TRACKING_OFF = "\x1b[?9l\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1005l\x1b[?1006l\x1b[?1015l\x1b[?1016l";

const ALT_SCREEN_EXIT = "\x1b[?1049l";

export function trackAlternateScreenExit(tail: string, output: string): { tail: string; exited: boolean } {
  const combined = tail + output;
  return {
    tail: combined.slice(-(ALT_SCREEN_EXIT.length - 1)),
    exited: combined.includes(ALT_SCREEN_EXIT),
  };
}

export function terminalProcessEnded(reason: string): boolean {
  return reason === "process-exit";
}
