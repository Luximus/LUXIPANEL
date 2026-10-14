// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Coordinates CLI state persistence with the bashrc-manager so that
 * activating a CLI is a single atomic operation from the panel's POV.
 */

import { NoServerExecutorError, ValidationError } from "../../../shared/errors/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { isCommandInPath, isSafeCommandName } from "../../../shared/system/command-probe.js";
import { cliStateRepository } from "../repositories/cli-state.repository.js";
import { bashrcManager } from "./bashrc-manager.service.js";
import { CLI_CATALOG, getCliCommand, isValidCliId } from "./cli-catalog.js";
import type { CliId, TerminalCliState } from "../models/cli-state.model.js";

export type CliInstallProbe = Partial<Record<CliId, boolean>>;

// `isCommandInPath` / `isSafeCommandName` viven en `shared/system/command-probe.ts`
// (mismo allowlist de nombre + `command -v` bajo bash LOGIN shell, para que el
// PATH sea el del PTY del usuario: ~/.local/bin, nvm, etc.).

function normalizeInstalled(installed: string[]): CliId[] {
  const filtered = installed.filter(isValidCliId);
  if (!filtered.includes("default")) filtered.unshift("default");
  return Array.from(new Set(filtered));
}

export const terminalCliService = {
  async getState(executor?: Executor | null): Promise<TerminalCliState> {
    return cliStateRepository.get(executor);
  },

  /**
   * Checks which CLIs in the catalog are actually present on PATH for the
   * connected target. Returns a `{ cliId: boolean }` map. Runs all probes
   * in a single bash invocation to keep latency bounded on remote targets.
   * "default" is omitted (it has no binary to probe).
   */
  async probeInstalled(executor?: Executor | null): Promise<CliInstallProbe> {
    // Probes `command -v` on the CONNECTED server — fail-closed, never the panel
    // host. An absent executor is a hard error, not a localExecutor fallback
    // (a silent probe on the panel host would report the wrong target's CLIs).
    if (!executor) throw new NoServerExecutorError();
    const probeExecutor: Executor = executor;
    const targets = CLI_CATALOG.filter((c) => c.id !== "default" && isSafeCommandName(c.command));
    const result: CliInstallProbe = {};
    if (targets.length === 0) return result;
    const script = targets
      .map(
        (c) =>
          `command -v ${c.command} >/dev/null 2>&1 && echo "${c.id}=1" || echo "${c.id}=0"`,
      )
      .join("; ");
    try {
      const out = await probeExecutor.exec(`bash -lc '${script}'`);
      const stdout = (out.stdout ?? "").trim();
      for (const line of stdout.split("\n")) {
        const idx = line.indexOf("=");
        if (idx <= 0) continue;
        const id = line.slice(0, idx);
        const val = line.slice(idx + 1);
        if (isValidCliId(id)) result[id] = val === "1";
      }
    } catch {
      // probe failed entirely — leave map empty so callers can keep current state
    }
    return result;
  },

  async setInstalled(
    cliId: string,
    installed: boolean,
    executor?: Executor | null,
  ): Promise<TerminalCliState> {
    if (!isValidCliId(cliId)) throw new ValidationError(`Unknown CLI id: ${cliId}`);
    if (cliId === "default") {
      throw new ValidationError("The default option cannot be installed/uninstalled");
    }
    const current = await cliStateRepository.get(executor);
    const set = new Set<CliId>(current.installed);
    if (installed) set.add(cliId);
    else set.delete(cliId);
    set.add("default");
    const nextInstalled = normalizeInstalled(Array.from(set));
    let nextActive: CliId = current.active;
    if (!nextInstalled.includes(nextActive)) nextActive = "default";
    return cliStateRepository.set(
      { ...current, installed: nextInstalled, active: nextActive },
      executor,
    );
  },

  async setActive(
    cliId: string,
    executor?: Executor | null,
  ): Promise<TerminalCliState> {
    if (!isValidCliId(cliId)) throw new ValidationError(`Unknown CLI id: ${cliId}`);
    // Mutates ~/.bashrc on the CONNECTED server — fail-closed, never the panel
    // host. An absent executor is a hard error, not a localExecutor fallback.
    if (!executor) throw new NoServerExecutorError();
    const current = await cliStateRepository.get(executor);
    if (cliId !== "default" && !current.installed.includes(cliId)) {
      throw new ValidationError(`CLI "${cliId}" is not marked as installed`);
    }
    if (cliId !== "default") {
      const command = getCliCommand(cliId);
      const inPath = await isCommandInPath(executor, command);
      if (!inPath) {
        const nextInstalled = current.installed.filter((id) => id !== cliId);
        if (!nextInstalled.includes("default")) nextInstalled.unshift("default");
        await cliStateRepository.set(
          { ...current, installed: nextInstalled, active: "default" },
          executor,
        );
        throw new ValidationError(
          `El binario "${command}" del CLI "${cliId}" no está disponible en PATH. Instala el CLI antes de activarlo.`,
        );
      }
    }
    // Apply on the CONNECTED server (where the user shells), not the panel host.
    // `applyActiveCli` requires an explicit executor (no localExecutor default)
    // so a missing executor can never mutate the panel host's ~/.bashrc.
    await bashrcManager.applyActiveCli(cliId, executor);
    return cliStateRepository.set({ ...current, active: cliId }, executor);
  },

  async completeOnboarding(
    installed: string[],
    active: string,
    executor?: Executor | null,
  ): Promise<TerminalCliState> {
    if (!isValidCliId(active)) throw new ValidationError(`Unknown CLI id: ${active}`);
    // Mutates ~/.bashrc on the CONNECTED server — fail-closed, never the panel host.
    if (!executor) throw new NoServerExecutorError();
    const filtered = normalizeInstalled(installed);
    if (active !== "default" && !filtered.includes(active)) {
      throw new ValidationError("Active CLI must be in the installed list");
    }
    await bashrcManager.applyActiveCli(active, executor);
    return cliStateRepository.set(
      {
        onboardingDone: true,
        installed: filtered,
        active,
        updatedAt: new Date().toISOString(),
      },
      executor,
    );
  },

  async skipOnboarding(executor?: Executor | null): Promise<TerminalCliState> {
    const current = await cliStateRepository.get(executor);
    const next = { ...current, onboardingDone: true };
    try {
      return await cliStateRepository.set(next, executor);
    } catch {
      // Persist failed (e.g. LP rate-limiting) — return in-memory state so the
      // HTTP request does not 500. The onboarding flag will re-appear on next
      // page load but that is preferable to a crash loop.
      return { ...next, updatedAt: new Date().toISOString() };
    }
  },
};
