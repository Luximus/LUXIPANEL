// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import { resolveTerminalIdentity } from "./terminal-access.service.js";

function executor(current: string, groups: string, sudo = true) {
  const exec = vi.fn(async (cmd: string) => {
    if (cmd === "id -un") return { exitCode: 0, stdout: current };
    if (cmd.startsWith("id -nG")) return { exitCode: 0, stdout: groups };
    return { exitCode: sudo ? 0 : 1, stdout: sudo ? "alice" : "" };
  });
  return { exec };
}

describe("terminal Linux identity", () => {
  it("rejects nonadmins even if Linux account belongs to sudo", async () => {
    const target = executor("alice", "alice sudo");
    expect(await resolveTerminalIdentity(target as never, { kind: "user", username: "alice" })).toBeNull();
    expect(target.exec).not.toHaveBeenCalled();
  });
  it("requires live sudo membership", async () => {
    expect(await resolveTerminalIdentity(executor("alice", "alice") as never, { kind: "admin", username: "alice" })).toBeNull();
    expect(await resolveTerminalIdentity(executor("alice", "alice sudo") as never, { kind: "admin", username: "alice" })).toEqual({ username: "alice", switchUser: false });
  });
  it("allows root without sudo-group membership", async () => {
    expect(await resolveTerminalIdentity(executor("root", "root") as never, { kind: "admin", username: "root" })).toEqual({ username: "root", switchUser: false });
  });
  it("requires passwordless sudo before switching to the authenticated account", async () => {
    expect(await resolveTerminalIdentity(executor("service", "alice sudo", false) as never, { kind: "admin", username: "alice" })).toBeNull();
    expect(await resolveTerminalIdentity(executor("service", "alice sudo") as never, { kind: "admin", username: "alice" })).toEqual({ username: "alice", switchUser: true });
  });
});
