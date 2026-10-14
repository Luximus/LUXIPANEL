// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupService } from "./cleanup.service.js";
import { ALLOWED_BASES, setAllowedBases } from "./filesystem.service.js";

let originalBases: string[] = [];
beforeEach(() => { originalBases = [...ALLOWED_BASES]; setAllowedBases(["/srv"]); });
afterEach(() => setAllowedBases(originalBases));

function makeExecutor(dirOut: string, fileOut: string) {
  const exec = vi.fn(async (cmd: string) => {
    if (cmd.includes("du -sb")) return { stdout: dirOut, stderr: "", exitCode: 0, durationMs: 1 };
    if (cmd.includes("-printf")) return { stdout: fileOut, stderr: "", exitCode: 0, durationMs: 1 };
    return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
  });
  return { target: { id: "r", name: "R" }, exec } as never;
}

describe("cleanupService.scan", () => {
  it("classifies regenerable dirs as safe and big files by type", async () => {
    const dirOut = [
      `524288000\t/srv/app/node_modules`,
      `104857600\t/srv/app/.next`,
    ].join("\n");
    const fileOut = [
      `52428800\t/srv/app/backup.sql`,
      `31457280\t/srv/app/old.zip`,
      `20971520\t/srv/app/photo.jpg`,
      `15728640\t/srv/app/huge.bin`,
    ].join("\n");
    const res = await cleanupService.scan(makeExecutor(dirOut, fileOut), "/srv/app");

    const byPath = Object.fromEntries(res.items.map((i) => [i.path, i]));
    expect(byPath["/srv/app/node_modules"]?.classification).toBe("safe");
    expect(byPath["/srv/app/node_modules"]?.category).toBe("deps");
    expect(byPath["/srv/app/.next"]?.classification).toBe("safe");
    expect(byPath["/srv/app/backup.sql"]?.classification).toBe("review");
    expect(byPath["/srv/app/backup.sql"]?.category).toBe("dump");
    expect(byPath["/srv/app/old.zip"]?.category).toBe("archive");
    expect(byPath["/srv/app/photo.jpg"]?.category).toBe("image");
    expect(byPath["/srv/app/huge.bin"]?.classification).toBe("keep"); // unclassified → keep

    // safe sorts before review before keep
    expect(res.items[0]?.classification).toBe("safe");
    // reclaimable = safe + review (excludes keep "huge.bin")
    const expected = 524288000 + 104857600 + 52428800 + 31457280 + 20971520;
    expect(res.reclaimableBytes).toBe(expected);
  });

  it("single-quotes a path containing $(...) to prevent command injection", async () => {
    const exec = vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 1 }));
    await cleanupService.scan({ target: { id: "r", name: "R" }, exec } as never, "/srv/app$(id)");
    const cmds = exec.mock.calls.map((c) => c[0] as string);
    // The malicious path must be inside SINGLE quotes (inert), never double quotes.
    expect(cmds.some((c) => c.includes("'/srv/app$(id)'"))).toBe(true);
    expect(cmds.some((c) => c.includes('"/srv/app$(id)"'))).toBe(false);
  });

  it("handles an empty scan", async () => {
    const res = await cleanupService.scan(makeExecutor("", ""), "/srv/app");
    expect(res.items).toHaveLength(0);
    expect(res.reclaimableBytes).toBe(0);
  });
});
