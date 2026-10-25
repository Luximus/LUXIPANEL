// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import path from "node:path";
import type { Executor } from "../../../shared/executor/index.js";
import { quoteArg } from "../../../shared/executor/index.js";
import { isLuxisoftWorkspacePath } from "./luxisoft-chat-history.service.js";

const LUXISOFT_REPOSITORY = "github.com/luxisoft/luxisoft.git";

/** Normalize SSH, SCP-style SSH, and HTTPS GitHub remotes without credentials. */
export function normalizeGithubRemote(value: string): string | null {
  const raw = value.trim();
  const scp = raw.match(/^(?:[^@/:]+@)?([^/:]+):(.+)$/);
  let host: string;
  let repositoryPath: string;
  if (scp && !raw.includes("://")) {
    const scpHost = scp[1];
    const scpPath = scp[2];
    if (!scpHost || !scpPath) return null;
    host = scpHost;
    repositoryPath = scpPath;
  } else {
    try {
      const url = new URL(raw);
      if (!["https:", "ssh:", "git:"].includes(url.protocol)) return null;
      host = url.hostname;
      repositoryPath = url.pathname;
    } catch {
      return null;
    }
  }
  const normalizedPath = repositoryPath.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "").toLowerCase();
  if (!host || !normalizedPath) return null;
  return `${host.toLowerCase()}/${normalizedPath}.git`;
}

/** True only for the exact Luxisoft/LuxiSoft source repository inside its local workspace. */
export async function isLuxisoftSourceRepositoryWorkspace(
  executor: Executor | null | undefined,
  projectPath: string | undefined,
): Promise<boolean> {
  if (!executor || !projectPath || !isLuxisoftWorkspacePath(projectPath)) return false;
  const resolvedPath = path.resolve(projectPath);
  try {
    const result = await executor.exec(
      `git -C ${quoteArg(resolvedPath)} config --get remote.origin.url`,
      { timeoutMs: 5_000 },
    );
    return result.exitCode === 0 && normalizeGithubRemote(result.stdout) === LUXISOFT_REPOSITORY;
  } catch {
    return false;
  }
}
