// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * PIPS — operator policy sidecar repository (Phase F3).
 *
 * Reads the OPERATOR-approved preview policy from a panel-HOST sidecar:
 *
 *   ${LUXIPANEL_CONFIG_DIR}/preview-policy/<ownerUserId>:<moduleId>.json  (0600)
 *
 * This sidecar is the ONLY way to widen a preview's default-deny policy
 * (RUNTIME-DESIGN §6.1). It lives OUTSIDE `installedDir` so the module author —
 * who controls the vendored tree — can never author it. It is read from the
 * panel host's local filesystem (instance-level state, like the license/branding
 * sidecars), NOT through a per-server `Executor`: the policy belongs to this
 * LUXIPANEL installation, not to any bridged tenant server.
 *
 * Absent / malformed ⇒ `null` ⇒ the broker's default-deny table (read + storage,
 * with exec/sudo/fs.write still hard-denied) is the whole policy. This is
 * fail-closed by construction: a missing or corrupt operator file NEVER widens.
 *
 * Ver `RUNTIME-DESIGN.md` §6.1 (operator opt-in), §6.6 (storage namespacing).
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { CONFIG_DIR } from "@config/paths.js";
import { createModuleLogger } from "../logger/index.js";
import type { Capability } from "../module-sdk/index.js";
import type { OperatorPolicy } from "./broker.js";

const log = createModuleLogger("preview-sandbox:policy");

const KNOWN_CAPS: ReadonlySet<string> = new Set<Capability>([
  "server.exec",
  "server.sudo",
  "server.fs.read",
  "server.fs.write",
  "storage",
  "http",
]);

/** Sidecar dir on the panel host (outside installedDir, never author-writable). */
function policyDir(): string {
  return path.join(CONFIG_DIR, "preview-policy");
}

/** `<ownerUserId>:<moduleId>.json`. The owner/module ids are validated by the
 *  caller (regex-gated upstream); we additionally reject path separators here. */
function policyPath(ownerUserId: string, moduleId: string): string | null {
  if (
    !ownerUserId ||
    !moduleId ||
    /[/\\\0]/.test(ownerUserId) ||
    /[/\\\0]/.test(moduleId) ||
    ownerUserId.includes("..") ||
    moduleId.includes("..")
  ) {
    return null;
  }
  return path.join(policyDir(), `${ownerUserId}:${moduleId}.json`);
}

/**
 * Coerce raw JSON to a sanitized `OperatorPolicy`. Anything unrecognized is
 * dropped (narrow-only). Unknown capability strings are filtered out so a
 * corrupt/hostile file cannot smuggle a non-closed-set capability through.
 */
function coerce(raw: unknown): OperatorPolicy | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const out: OperatorPolicy = {};

  if (Array.isArray(src.capabilities)) {
    const caps = src.capabilities.filter(
      (c): c is Capability => typeof c === "string" && KNOWN_CAPS.has(c),
    );
    if (caps.length) out.capabilities = caps;
  }
  if (Array.isArray(src.http_allowlist)) {
    const hosts = src.http_allowlist.filter((h): h is string => typeof h === "string" && !!h);
    if (hosts.length) out.http_allowlist = hosts;
  }
  if (typeof src.readPrefix === "string" && src.readPrefix.startsWith("/")) {
    out.readPrefix = src.readPrefix;
  }
  if (src.exec && typeof src.exec === "object") {
    const cmds = (src.exec as { commands?: unknown }).commands;
    if (Array.isArray(cmds)) {
      const list = cmds.filter((c): c is string => typeof c === "string" && !!c);
      if (list.length) out.exec = { commands: list };
    }
  }
  return out;
}

/**
 * Load the operator policy sidecar for `(ownerUserId, moduleId)`. Returns `null`
 * when absent or malformed (fail-closed: the default-deny table applies). Never
 * throws.
 */
export async function loadPreviewPolicy(
  ownerUserId: string,
  moduleId: string,
): Promise<OperatorPolicy | null> {
  const p = policyPath(ownerUserId, moduleId);
  if (!p) {
    log.warn({ ownerUserId, moduleId }, "preview policy lookup rejected (unsafe id)");
    return null;
  }
  let raw: string;
  try {
    raw = await fs.readFile(p, "utf-8");
  } catch {
    // No sidecar ⇒ default-deny. Not an error condition.
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    log.warn(
      { ownerUserId, moduleId, err: (err as Error).message },
      "preview policy sidecar is malformed JSON — ignoring (default-deny)",
    );
    return null;
  }
  const policy = coerce(parsed);
  if (!policy) {
    log.warn({ ownerUserId, moduleId }, "preview policy sidecar has no usable grants (default-deny)");
    return null;
  }
  return policy;
}
