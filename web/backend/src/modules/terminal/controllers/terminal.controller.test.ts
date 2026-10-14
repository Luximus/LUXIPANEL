// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { PassThrough } from "node:stream";
import { once } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createPtyFromStream } from "./terminal.controller.js";

describe("createPtyFromStream", () => {
  it("delegates resize and kill to the underlying stream", async () => {
    const stream = new PassThrough() as PassThrough & {
      resize?: (cols: number, rows: number) => void;
      kill?: (signal?: string) => void;
    };
    const resize = vi.fn();
    const kill = vi.fn();
    stream.resize = resize;
    stream.kill = kill;

    const pty = createPtyFromStream(stream);

    const outputs: string[] = [];
    let exitCode: number | null = null;
    pty.onData((data) => outputs.push(data));
    pty.onExit((code) => {
      exitCode = code;
    });

    pty.resize(120, 40);
    pty.write("hello");
    stream.write("world");
    pty.kill("SIGHUP");
    stream.end();
    await once(stream, "close");

    expect(resize).toHaveBeenCalledWith(120, 40);
    expect(kill).toHaveBeenCalledWith("SIGHUP");
    expect(outputs.join("")).toContain("world");
    expect(exitCode).toBe(0);
  });
});
