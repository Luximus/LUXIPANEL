// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Terminal, type IBufferCell, type ITerminalAddon } from "@xterm/headless";
import { UnicodeGraphemesAddon } from "@xterm/addon-unicode-graphemes";
import { NAMES, color256 } from "../components/ansi-parser";

export interface CellStyle { fg?: string; bg?: string; bold?: boolean; dim?: boolean; underline?: boolean; inverse?: boolean; italic?: boolean; invisible?: boolean; strike?: boolean }
export interface Cell extends CellStyle { ch: string; width?: number }
export interface RenderSpan extends CellStyle { text: string; column: number; columns: number }
export interface RenderRow { key: string; spans: RenderSpan[] }
export interface CursorState { x: number; y: number; visible: boolean }

/** Headless VT engine. Only buffers are rendered by RN; no DOM or WebView. */
export class TerminalEmulator {
  private terminal: Terminal;
  private revision = 0;
  private title = "";
  private cursorVisible = true;
  onData?: (data: string) => void;
  onChange?: () => void;
  constructor(cols: number, rows: number) {
    this.terminal = new Terminal({ cols, rows, scrollback: 2000, allowProposedApi: true, windowsPty: undefined });
    this.terminal.loadAddon(new UnicodeGraphemesAddon() as unknown as ITerminalAddon);
    this.terminal.unicode.activeVersion = "15-graphemes";
    this.terminal.onData(data => this.onData?.(data));
    this.terminal.onTitleChange(title => { this.title = title; });
    for (const [final, visible] of [["h", true], ["l", false]] as const) {
      this.terminal.parser.registerCsiHandler({ prefix: "?", final }, params => {
        if (params.includes(25)) this.cursorVisible = visible;
        return false; // Let xterm process the modes as well.
      });
    }
    this.terminal.parser.registerEscHandler({ final: "c" }, () => { this.cursorVisible = true; return false; });
  }
  get cols() { return this.terminal.cols; }
  get rows() { return this.terminal.rows; }
  get bracketedPaste() { return this.terminal.modes.bracketedPasteMode; }
  get applicationCursor() { return this.terminal.modes.applicationCursorKeysMode; }
  get alternateScreen() { return this.terminal.buffer.active.type === "alternate"; }
  getTitle() { return this.title; }
  getRevision() { return this.revision; }
  getCursor(): CursorState {
    const buffer = this.terminal.buffer.active;
    return { x: buffer.cursorX, y: buffer.cursorY, visible: this.cursorVisible };
  }
  write(data: string | Uint8Array, callback?: () => void) {
    this.terminal.write(data, () => { this.revision++; if (!this.terminal.modes.synchronizedOutputMode) this.onChange?.(); callback?.(); });
  }
  resize(cols: number, rows: number) {
    if (cols === this.cols && rows === this.rows) return;
    this.terminal.resize(Math.max(2, cols), Math.max(2, rows));
    this.revision++; this.onChange?.();
  }
  reset() { this.terminal.reset(); this.cursorVisible = true; this.title = ""; this.revision++; this.onChange?.(); }
  dispose() { this.onData = undefined; this.onChange = undefined; this.terminal.dispose(); }
  getScrollbackLength() { return this.terminal.buffer.active.baseY; }
  getScrollback(): Cell[][] {
    const buffer = this.terminal.buffer.normal;
    return Array.from({ length: buffer.baseY }, (_, y) => {
      const line = buffer.getLine(y);
      return Array.from({ length: this.cols }, (_, x) => {
        const cell = line?.getCell(x);
        return { ch: cell?.getChars() || " ", width: cell?.getWidth() ?? 1, ...styleOf(cell) };
      });
    });
  }
  getRenderRows(offset = 0): RenderRow[] {
    const buffer = this.terminal.buffer.active;
    const top = Math.max(0, buffer.baseY - Math.max(0, offset));
    return Array.from({ length: this.rows }, (_, y) => {
      const line = buffer.getLine(top + y);
      const spans: RenderSpan[] = [];
      let previousStyle = "";
      for (let column = 0; column < this.cols; column++) {
        const cell = line?.getCell(column);
        const width = cell?.getWidth() ?? 1;
        if (width === 0) continue;
        const text = cell?.getChars() || " ";
        const style = styleOf(cell);
        const key = JSON.stringify(style);
        const last = spans[spans.length - 1];
        // Graphemes wider than one column are positioned separately so font fallback cannot shift later text.
        if (last && key === previousStyle && width === 1 && /^[\x20-\x7e]+$/.test(last.text + text)) {
          last.text += text; last.columns++;
        } else spans.push({ text, column, columns: width, ...style });
        previousStyle = key;
      }
      return { key: JSON.stringify(spans), spans };
    });
  }
}
function styleOf(cell?: IBufferCell): CellStyle {
  if (!cell) return {};
  const color = (foreground: boolean): string | undefined => {
    const value = foreground ? cell.getFgColor() : cell.getBgColor();
    if (foreground ? cell.isFgRGB() : cell.isBgRGB()) return `#${value.toString(16).padStart(6, "0")}`;
    if (foreground ? cell.isFgPalette() : cell.isBgPalette()) return value < 8 ? NAMES[value] : value < 16 ? `bright${NAMES[value - 8]}` : color256(value);
    return undefined;
  };
  return { fg: color(true), bg: color(false), bold: !!cell.isBold(), dim: !!cell.isDim(), underline: !!cell.isUnderline(), inverse: !!cell.isInverse(), italic: !!cell.isItalic(), invisible: !!cell.isInvisible(), strike: !!cell.isStrikethrough() };
}
