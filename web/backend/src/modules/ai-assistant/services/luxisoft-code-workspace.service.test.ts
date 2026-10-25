// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import { isLuxisoftSourceRepositoryWorkspace, normalizeGithubRemote } from "./luxisoft-code-workspace.service.js";

describe("Luxisoft source workspace", () => {
  it.each([
    ["git@github.com:Luxisoft/LuxiSoft.git", "github.com/luxisoft/luxisoft.git"],
    ["https://github.com/Luxisoft/LuxiSoft", "github.com/luxisoft/luxisoft.git"],
    ["ssh://git@github.com/Luxisoft/LuxiSoft.git", "github.com/luxisoft/luxisoft.git"],
  ])("normalizes %s to the exact repository identity", (input, expected) => {
    expect(normalizeGithubRemote(input)).toBe(expected);
  });

  it("accepts the exact local repo remote inside the Luxisoft workspace", async () => {
    const exec = vi.fn(async () => ({ stdout: "git@github.com:Luxisoft/LuxiSoft.git\n", stderr: "", exitCode: 0 }));
    expect(await isLuxisoftSourceRepositoryWorkspace({ exec } as unknown as Executor, "/var/www/luxisoft/.worktrees/lxp-agent-luxisoft")).toBe(true);
    expect(exec).toHaveBeenCalledOnce();
  });

  it("rejects other repositories and paths outside Luxisoft", async () => {
    const otherRepo = { exec: vi.fn(async () => ({ stdout: "git@github.com:Luxisoft/STORE.git\n", stderr: "", exitCode: 0 })) };
    expect(await isLuxisoftSourceRepositoryWorkspace(otherRepo as unknown as Executor, "/var/www/luxisoft/.worktrees/other")).toBe(false);
    expect(await isLuxisoftSourceRepositoryWorkspace(otherRepo as unknown as Executor, "/var/www/LUXIPANEL/web/backend")).toBe(false);
    expect(otherRepo.exec).toHaveBeenCalledOnce();
  });
});
