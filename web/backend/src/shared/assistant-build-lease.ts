// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { readFileSync } from "node:fs";
import { quoteArg } from "./executor/index.js";

const runner = readFileSync(new URL("./assistant-build-lease.py", import.meta.url)).toString("base64");

/** The shell tools can identify common build/deploy invocations, including compound commands. */
export function isBuildOrDeployCommand(command: string): boolean {
  return /\b(?:npm|pnpm|yarn|bun)\b[^\n;&|]{0,120}\b(?:build|install|ci|deploy)\b|\b(?:astro|vite|next)\s+build\b|\b(?:pm2|systemctl)\s+(?:restart|reload)\b|\bdocker\s+(?:build|compose\s+(?:build|up))\b|\bdeploy(?:ment)?\b/i.test(command);
}

export function withAssistantBuildLease(command: string): string {
  const bootstrap = `import base64; exec(compile(base64.b64decode('${runner}'), 'luxipanel-assistant-build-lease', 'exec'))`;
  return `python3 -c ${quoteArg(bootstrap)} ${quoteArg(command)} 60`;
}
