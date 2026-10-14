import { afterEach, describe, expect, it } from "vitest";
import { TerminalEmulator } from "./terminal-emulator";
import { terminalKey, terminalPaste } from "./terminal-input";
const terminals: TerminalEmulator[] = [];
function term(cols = 40, rows = 10) { const t = new TerminalEmulator(cols, rows); terminals.push(t); return t; }
const write = (t: TerminalEmulator, text: string) => new Promise<void>(resolve => t.write(text, resolve));
const row = (t: TerminalEmulator, y = 0) => t.getRenderRows()[y].spans.map(s => s.text).join("").trimEnd();
afterEach(() => { for (const t of terminals.splice(0)) t.dispose(); });
describe("native VT engine and Codex controls", () => {
  it("positions Unicode graphemes by columns and answers cursor/device queries", async () => {
    const t = term(); const replies: string[] = []; t.onData = data => replies.push(data);
    await write(t, "A😀e\u0301界B\x1b[6n\x1b[c");
    expect(row(t)).toBe("A😀e\u0301界B"); expect(t.getCursor().x).toBe(7);
    expect(replies).toContain("\x1b[1;8R"); expect(replies.some(s => s.startsWith("\x1b[?"))).toBe(true);
    const glyph = t.getRenderRows()[0].spans.find(s => s.text === "界"); expect(glyph?.columns).toBe(2); expect(glyph?.column).toBe(4);
  });
  it("restores shell from the alternate screen and handles split escapes", async () => {
    const t = term(); await write(t, "shell"); await write(t, "\x1b[?104"); await write(t, "9h\x1b[2J\x1b[Hcodex\x1b[?25l");
    expect(t.alternateScreen).toBe(true); expect(t.getScrollbackLength()).toBe(0); expect(row(t)).toBe("codex"); expect(t.getCursor().visible).toBe(false);
    await write(t, "\x1b[?1049l\x1b[?25h"); expect(row(t)).toBe("shell"); expect(t.getCursor().visible).toBe(true);
  });
  it("honors cursor mode and bracketed paste without double Enter", async () => {
    const t = term(); await write(t, "\x1b[?1h\x1b[?2004h");
    expect(terminalKey("up", t.applicationCursor)).toBe("\x1bOA"); expect(terminalKey("left", true, true)).toBe("\x1b[1;5D");
    expect(terminalPaste("one\ntwo", t.bracketedPaste)).toBe("\x1b[200~one\rtwo\x1b[201~");
    expect(terminalKey("enter", false)).toBe("\r");
  });
  it("reflows scrollback when orientation changes without truncating the newest output", async () => {
    const t = term(12, 3); await write(t, "abcdefghijklmnopqrstuvwx\r\nlast"); t.resize(6, 3);
    expect(t.getRenderRows().some(line => line.spans.map(s => s.text).join("").includes("last"))).toBe(true);
    expect(t.getScrollback().length).toBeGreaterThan(0);
  });
  it("keeps bright ANSI colors and synchronized screen updates", async () => {
    const t=term(); let changes=0; t.onChange=()=>changes++;
    await write(t,"\x1b[?2026h\x1b[91mred"); expect(changes).toBe(0);
    await write(t,"\x1b[?2026l"); expect(changes).toBe(1);
    expect(t.getRenderRows()[0].spans.find(s=>s.text.includes("red"))?.fg).toBe("brightred");
  });
  it("applies truecolor, erase and cursor movement used in full screen repaint", async () => {
    const t = term(); await write(t, "stale\x1b[2J\x1b[3;4H\x1b[38;2;1;2;3mOK");
    expect(row(t)).toBe(""); expect(row(t, 2)).toBe("   OK"); expect(t.getRenderRows()[2].spans.some(s => s.fg === "#010203")).toBe(true);
  });
});
