// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization tests — terminal-cli service (state + activation logic).
 *
 * Locks the pure orchestration contract without the HTTP/middleware chain:
 *   - setInstalled: id validation, "default" always kept, active falls back to
 *     "default" when the active CLI is uninstalled.
 *   - setActive: fail-closed on a missing executor (NoServerExecutorError),
 *     rejects a not-installed CLI, self-heals to "default" when the binary is
 *     absent from PATH, and applies ~/.bashrc on success.
 *   - completeOnboarding: fail-closed executor + active-must-be-installed.
 *   - skipOnboarding: a persistence failure degrades to in-memory state (no throw).
 *   - probeInstalled: parses the `id=1/0` bash output into a boolean map.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NoServerExecutorError, ValidationError } from "../../../shared/errors/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { TerminalCliState } from "../models/cli-state.model.js";

// Repo + bashrc seams.
vi.mock("../repositories/cli-state.repository.js", () => ({
  cliStateRepository: { get: vi.fn(), set: vi.fn() },
}));
vi.mock("./bashrc-manager.service.js", () => ({
  bashrcManager: { applyActiveCli: vi.fn().mockResolvedValue({ path: "/home/u/.bashrc" }) },
}));

import { terminalCliService } from "./terminal-cli.service.js";
import { cliStateRepository } from "../repositories/cli-state.repository.js";
import { bashrcManager } from "./bashrc-manager.service.js";

function state(partial: Partial<TerminalCliState> = {}): TerminalCliState {
  return {
    onboardingDone: false,
    installed: ["default"],
    active: "default",
    updatedAt: new Date(0).toISOString(),
    ...partial,
  };
}

/** Fake executor whose `exec` exitCode is controllable per test. */
function execWith(opts: { exitCode?: number; stdout?: string } = {}): Executor {
  return {
    exec: vi.fn().mockResolvedValue({
      stdout: opts.stdout ?? "",
      stderr: "",
      exitCode: opts.exitCode ?? 0,
      durationMs: 0,
    }),
  } as unknown as Executor;
}

beforeEach(() => {
  vi.clearAllMocks();
  // set() echoes back the persisted state by default.
  vi.mocked(cliStateRepository.set).mockImplementation(async (s) => s as TerminalCliState);
});

describe("setInstalled", () => {
  it("rejects an unknown CLI id", async () => {
    await expect(terminalCliService.setInstalled("bogus", true)).rejects.toBeInstanceOf(ValidationError);
    expect(cliStateRepository.set).not.toHaveBeenCalled();
  });

  it("refuses to (un)install the 'default' pseudo-CLI", async () => {
    await expect(terminalCliService.setInstalled("default", true)).rejects.toBeInstanceOf(ValidationError);
  });

  it("adds a CLI and always keeps 'default'", async () => {
    vi.mocked(cliStateRepository.get).mockResolvedValue(state());
    const out = await terminalCliService.setInstalled("claude", true, execWith());
    expect(out.installed).toEqual(expect.arrayContaining(["default", "claude"]));
    expect(out.active).toBe("default");
  });

  it("uninstalling the active CLI resets active to 'default'", async () => {
    vi.mocked(cliStateRepository.get).mockResolvedValue(state({ installed: ["default", "claude"], active: "claude" }));
    const out = await terminalCliService.setInstalled("claude", false, execWith());
    expect(out.installed).toEqual(["default"]);
    expect(out.active).toBe("default");
  });
});

describe("setActive", () => {
  it("throws NoServerExecutorError when no executor is present", async () => {
    await expect(terminalCliService.setActive("claude", null)).rejects.toBeInstanceOf(NoServerExecutorError);
  });

  it("rejects an unknown id even with an executor", async () => {
    await expect(terminalCliService.setActive("bogus", execWith())).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects activating a CLI that is not installed", async () => {
    vi.mocked(cliStateRepository.get).mockResolvedValue(state({ installed: ["default"] }));
    await expect(terminalCliService.setActive("claude", execWith())).rejects.toBeInstanceOf(ValidationError);
  });

  it("self-heals to 'default' when the binary is missing from PATH", async () => {
    vi.mocked(cliStateRepository.get).mockResolvedValue(state({ installed: ["default", "claude"] }));
    const exec = execWith({ exitCode: 1 }); // command -v fails
    await expect(terminalCliService.setActive("claude", exec)).rejects.toBeInstanceOf(ValidationError);
    // Persisted the healed state (active=default, claude dropped) and did NOT touch bashrc.
    expect(cliStateRepository.set).toHaveBeenCalledWith(
      expect.objectContaining({ active: "default", installed: ["default"] }),
      exec,
    );
    expect(bashrcManager.applyActiveCli).not.toHaveBeenCalled();
  });

  it("applies ~/.bashrc and persists when the binary is present", async () => {
    vi.mocked(cliStateRepository.get).mockResolvedValue(state({ installed: ["default", "claude"] }));
    const exec = execWith({ exitCode: 0 });
    const out = await terminalCliService.setActive("claude", exec);
    expect(bashrcManager.applyActiveCli).toHaveBeenCalledWith("claude", exec);
    expect(out.active).toBe("claude");
  });

  it("activating 'default' skips the PATH probe and applies bashrc", async () => {
    vi.mocked(cliStateRepository.get).mockResolvedValue(state({ installed: ["default", "claude"], active: "claude" }));
    const exec = execWith();
    const out = await terminalCliService.setActive("default", exec);
    expect(bashrcManager.applyActiveCli).toHaveBeenCalledWith("default", exec);
    expect(out.active).toBe("default");
  });
});

describe("completeOnboarding", () => {
  it("throws NoServerExecutorError without an executor", async () => {
    await expect(terminalCliService.completeOnboarding(["claude"], "claude", null)).rejects.toBeInstanceOf(
      NoServerExecutorError,
    );
  });

  it("rejects when the active CLI is not in the installed list", async () => {
    await expect(terminalCliService.completeOnboarding(["default"], "claude", execWith())).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("persists onboardingDone + applies bashrc on success", async () => {
    const out = await terminalCliService.completeOnboarding(["claude"], "claude", execWith());
    expect(bashrcManager.applyActiveCli).toHaveBeenCalledWith("claude", expect.anything());
    expect(out.onboardingDone).toBe(true);
    expect(out.active).toBe("claude");
    expect(out.installed).toEqual(expect.arrayContaining(["default", "claude"]));
  });
});

describe("skipOnboarding", () => {
  it("degrades to in-memory state when persistence fails (no throw)", async () => {
    vi.mocked(cliStateRepository.get).mockResolvedValue(state());
    vi.mocked(cliStateRepository.set).mockRejectedValue(new Error("LP rate-limited"));
    const out = await terminalCliService.skipOnboarding(execWith());
    expect(out.onboardingDone).toBe(true);
  });
});

describe("probeInstalled", () => {
  it("parses the id=1/0 output into a boolean map", async () => {
    const exec = execWith({ stdout: "claude=1\ncodex=0\n" });
    const out = await terminalCliService.probeInstalled(exec);
    expect(out.claude).toBe(true);
    expect(out.codex).toBe(false);
  });

  it("returns an empty map when the probe throws", async () => {
    const exec = { exec: vi.fn().mockRejectedValue(new Error("ssh down")) } as unknown as Executor;
    const out = await terminalCliService.probeInstalled(exec);
    expect(out).toEqual({});
  });

  it("throws NoServerExecutorError without an executor (never probes the panel host)", async () => {
    await expect(terminalCliService.probeInstalled(null)).rejects.toBeInstanceOf(NoServerExecutorError);
    await expect(terminalCliService.probeInstalled()).rejects.toBeInstanceOf(NoServerExecutorError);
  });
});
