// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { PrivilegeDropExecutor } from "../../../shared/executor/privilege-drop-executor.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { quoteArg } from "../../../shared/executor/index.js";

export interface TerminalIdentity { username: string; switchUser: boolean }

/** Verify the live account on the selected server, never a stale JWT group claim. */
export async function resolveTerminalIdentity(
  executor: Executor,
  user: { kind?: string; username?: string; hostingPolicy?: SessionUser["hostingPolicy"] },
): Promise<TerminalIdentity | null> {
  const username = user.username ?? "";
  if (user.hostingPolicy?.runtime && user.hostingPolicy.state === "ready" && user.hostingPolicy.security?.shell === "jailed" && executor instanceof PrivilegeDropExecutor) return { username, switchUser: true };
  if (user.kind !== "admin" || !/^[a-z_][a-z0-9_-]{0,31}\$?$/.test(username)) return null;
  try {
    const current = await executor.exec("id -un");
    if (current.exitCode !== 0) return null;
    const currentName = current.stdout.trim();
    const groups = await executor.exec(`id -nG ${quoteArg(username)}`);
    if (groups.exitCode !== 0) return null;
    if (username !== "root" && !groups.stdout.trim().split(/\s+/).includes("sudo")) return null;
    if (currentName === username) return { username, switchUser: false };
    const probe = await executor.exec(`sudo -n -u ${quoteArg(username)} -H id -un`);
    if (probe.exitCode !== 0 || probe.stdout.trim() !== username) return null;
    return { username, switchUser: true };
  } catch {
    return null;
  }
}
