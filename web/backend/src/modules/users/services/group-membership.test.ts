// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — buildGroupMembershipSteps managed-set behavior.
 *
 * System groups (sudo) ARE assignable on purpose; the only groups never
 * touched are legacy lxp-role-* and the user's PRIMARY group.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const exec = vi.fn();

vi.mock("../../../shared/executor/context.js", () => ({
  getContextExecutor: () => ({ exec }),
}));

import { systemAccountsService } from "./system-accounts.service.js";

const GETENT_GROUP = [
  "root:x:0:",
  "sudo:x:27:bob",
  "developers:x:1001:bob",
  "editors:x:1002:",
  "marketing:x:1003:bob",
  "lxp-role-9-legacy:x:1500:bob",
].join("\n");

beforeEach(() => {
  exec.mockReset();
  exec.mockImplementation((cmd: string) => {
    if (cmd.includes("getent 'group'") && !cmd.includes("getent 'group' '")) {
      return Promise.resolve({ stdout: GETENT_GROUP, stderr: "", exitCode: 0 });
    }
    if (cmd.includes("id '-gn'")) {
      // bob's PRIMARY group is "developers" (must never be removed).
      return Promise.resolve({ stdout: "developers", stderr: "", exitCode: 0 });
    }
    if (cmd.includes("id '-nG'")) {
      return Promise.resolve({ stdout: "developers sudo marketing lxp-role-9-legacy", stderr: "", exitCode: 0 });
    }
    return Promise.resolve({ stdout: "", stderr: "", exitCode: 0 });
  });
});

describe("buildGroupMembershipSteps", () => {
  it("adds desired and removes undesired within the managed set", async () => {
    const steps = await systemAccountsService.buildGroupMembershipSteps("bob", ["editors", "sudo"]);
    const argvs = steps.map((s) => (s as { argv: string[] }).argv);
    expect(argvs).toContainEqual(["gpasswd", "-a", "bob", "editors"]); // newly desired
    expect(argvs).toContainEqual(["gpasswd", "-d", "bob", "marketing"]); // member, no longer desired
    // sudo stays (desired + already member) → no op for it
    expect(argvs.find((a) => a[3] === "sudo")).toBeUndefined();
  });

  it("CAN remove a system group (sudo) when it is unchecked", async () => {
    const steps = await systemAccountsService.buildGroupMembershipSteps("bob", ["editors"]);
    const argvs = steps.map((s) => (s as { argv: string[] }).argv);
    expect(argvs).toContainEqual(["gpasswd", "-d", "bob", "sudo"]);
  });

  it("NEVER touches the primary group or legacy lxp-role-* groups", async () => {
    const steps = await systemAccountsService.buildGroupMembershipSteps("bob", []);
    const argvs = steps.map((s) => (s as { argv: string[] }).argv);
    // primary group "developers" is never removed
    expect(argvs.some((a) => a[3] === "developers")).toBe(false);
    // legacy synthetic group never touched
    expect(argvs.some((a) => a.some((t) => t.startsWith("lxp-role-")))).toBe(false);
    // but sudo and marketing (managed members) are removed
    expect(argvs).toContainEqual(["gpasswd", "-d", "bob", "sudo"]);
    expect(argvs).toContainEqual(["gpasswd", "-d", "bob", "marketing"]);
  });
});
