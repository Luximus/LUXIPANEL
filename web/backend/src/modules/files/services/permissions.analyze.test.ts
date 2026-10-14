// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import { permissionsService } from "./permissions.service.js";
import { setAllowedBases } from "./filesystem.service.js";

describe("permissionsService.analyzeMode", () => {
  it("flags 777 as danger", () => {
    const a = permissionsService.analyzeMode("0777", false);
    expect(a.level).toBe("danger");
    expect(a.current).toBe("777");
    expect(a.recommended).toBe("644");
    expect(a.reasons.join(" ")).toMatch(/777/);
  });

  it("flags world-writable (e.g. 646) as danger", () => {
    const a = permissionsService.analyzeMode("646", false);
    expect(a.level).toBe("danger");
  });

  it("accepts 644 for a file as ok/recommended", () => {
    const a = permissionsService.analyzeMode("0100644", false);
    expect(a.level).toBe("ok");
    expect(a.current).toBe("644");
    expect(a.reasons[0]).toMatch(/recomendados/i);
  });

  it("accepts 755 for a directory as ok, recommends 755", () => {
    const a = permissionsService.analyzeMode("755", true);
    expect(a.level).toBe("ok");
    expect(a.recommended).toBe("755");
  });

  it("warns when a data file has an execute bit (755 file)", () => {
    const a = permissionsService.analyzeMode("755", false);
    expect(a.level).toBe("warning");
    expect(a.reasons.join(" ")).toMatch(/ejecuci/i);
  });

  it("warns on group-write without world-write (664)", () => {
    const a = permissionsService.analyzeMode("664", false);
    expect(a.level).toBe("warning");
  });
});

describe("permissionsService.chmodRecursiveWithExecutor", () => {
  it("runs find -type f and -type d for applyTo=all", async () => {
    setAllowedBases(["/srv"]);
    const exec = vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 1 }));
    await permissionsService.chmodRecursiveWithExecutor(
      { target: { id: "r", name: "R" }, exec } as never,
      { path: "/srv/site", fileMode: "644", dirMode: "755", applyTo: "all" },
    );
    expect(exec).toHaveBeenCalledTimes(2);
    const cmds = exec.mock.calls.map((c) => c[0] as string);
    expect(cmds[0]).toContain("'-type' 'f'");
    expect(cmds[0]).toContain("'644'");
    expect(cmds[1]).toContain("'-type' 'd'");
    expect(cmds[1]).toContain("'755'");
  });

  it("runs only the files pass for applyTo=files", async () => {
    setAllowedBases(["/srv"]);
    const exec = vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 1 }));
    await permissionsService.chmodRecursiveWithExecutor(
      { target: { id: "r", name: "R" }, exec } as never,
      { path: "/srv/site", fileMode: "644", dirMode: "755", applyTo: "files" },
    );
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec.mock.calls[0]![0] as string).toContain("'-type' 'f'");
  });
});
