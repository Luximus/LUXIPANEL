// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * PTY service — shared pseudo-terminal process type.
 */

export interface PtyProcess {
  /** Write data to the PTY stdin. */
  write(data: string): void;
  /** Resize the PTY window. */
  resize(cols: number, rows: number): void;
  /** Kill the process with an optional signal. */
  kill(signal?: string): void;
  /** Register a callback for output data. */
  onData(cb: (data: string) => void): void;
  /** Register a callback for process exit. */
  onExit(cb: (code: number, signal: number) => void): void;
  /** The underlying PID. */
  pid: number;
}
