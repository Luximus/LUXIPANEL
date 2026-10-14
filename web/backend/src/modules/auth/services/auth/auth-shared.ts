// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auth service — shared private helpers + constants used across the auth
 * sub-services. NOT part of the public surface (re-exported by the facade only
 * where noted). Pure code movement out of auth.service.ts.
 */

import { createHash } from "node:crypto";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import { quoteArg, type Executor } from "../../../../shared/executor/index.js";

export const log = createModuleLogger("auth-service");

export const LEGACY_MODULES = new Set(["terminal"]);

// Linux groups that grant FULL panel admin (everything: menus, views, actions,
// file paths, commands). A member of these already has root-equivalent shell on
// the server, so panel-level gating would be theatre — elevate to admin kind.
export const PRIVILEGED_ADMIN_GROUPS = new Set(["sudo", "wheel"]);

export function extractSubdomainFromHost(host: string | undefined): string | null {
  if (!host) return null;
  const cleaned = host.split(":")[0]?.trim().toLowerCase() ?? "";
  if (!cleaned) return null;
  // Strip the panel root domain. We accept anything under .luxipanel.com or
  // any host matching <subdomain>.<root>; for the latter we treat the
  // first label as the subdomain unless the host has only two labels.
  const parts = cleaned.split(".");
  if (parts.length < 3) return null;
  const subdomain = parts[0]!;
  if (subdomain === "www") return null;
  return subdomain;
}

export function sanitizeModules(modules: string[]): string[] {
  return modules.filter((module) => !LEGACY_MODULES.has(module));
}

/** Deterministic per-(server, linux-user) numeric id, used as the panel userId
 *  for an SSO session when no sidecar row exists yet. Stable across logins (so
 *  per-user config persists) and scoped by target so the same id on a different
 *  server never collides. */
export function stableBridgedUserId(targetId: string, username: string): number {
  const hex = createHash("sha256").update(`${targetId}:${username}`).digest("hex").slice(0, 8);
  return (Number.parseInt(hex, 16) & 0x7fffffff) || 1;
}

/** Read the GECOS display name (`getent passwd` 5th field, first comma part)
 *  with a no-sudo, single-line command. Returns null if unavailable. */
export async function readGecosDisplayName(executor: Executor, username: string): Promise<string | null> {
  try {
    const r = await executor.exec(`getent passwd ${quoteArg(username)}`);
    if (r.exitCode !== 0) return null;
    const line = r.stdout.split("\n")[0] ?? "";
    const gecos = (line.split(":")[4] ?? "").split(",")[0]?.trim();
    return gecos && gecos.length > 0 ? gecos : null;
  } catch {
    return null;
  }
}
