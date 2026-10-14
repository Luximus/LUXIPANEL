// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Allowed-tools normalization against the live capability registry.
 *
 * Agent/role/template allowlists reference tools by NAME and intersect at run
 * time — a name that doesn't exist in the registry silently narrows the agent
 * to nothing. Historically several dead names shipped in the team-template
 * seeds (`files.list`, `terminal.run`, `ssl.issue`, …) and nothing validated
 * user input, so agents lost capabilities without any signal.
 *
 * This module is the single choke point:
 * - `LEGACY_TOOL_ALIASES` maps every known dead name to its real replacement(s)
 *   (empty array = the tool has no equivalent anymore and is dropped).
 * - `normalizeAllowedTools` validates a list against the registry, expanding
 *   aliases; unknown names are either rejected (user-facing writes) or dropped
 *   (internal/read paths — never break a load).
 *
 * Fail-open by design: when the registry is empty (early boot, unit tests that
 * don't register capabilities) the list passes through untouched — validation
 * is a hardening layer, not a boot dependency.
 */

import { agentCapabilityRegistry } from "../../../shared/agent-capability/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("assistant-tool-allowlist");

/** Known dead tool names → their real replacement(s). Empty = no equivalent. */
export const LEGACY_TOOL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "files.list": ["files.list_dir"],
  "files.search": ["files.grep"],
  "files.diff": [],
  "terminal.run": ["admin.bash"],
  "hosting.read": ["hosting.list_accounts", "hosting.account_stats"],
  "nginx.read": ["nginx.list_sites", "nginx.tail_access_log"],
  "nginx.write": [],
  "databases.read": ["databases.list_databases", "databases.list_tables"],
  "databases.write": ["databases.run_query"],
  "monitor.read": ["monitor.snapshot", "monitor.cpu_top"],
  "monitor.write": ["monitor.watchdog_configure"],
  "ssl.read": [],
  "ssl.issue": [],
  "cron.read": ["cron.list"],
  "cron.write": ["cron.add", "cron.update", "cron.toggle", "cron.remove"],
};

export interface NormalizedAllowlist {
  /** Final list: deduplicated, every name registered. */
  valid: string[];
  /** Aliases that were expanded (from → to; to=[] means dropped, no equivalent). */
  migrated: Array<{ from: string; to: string[] }>;
  /** Names that are neither registered nor a known alias. */
  unknown: string[];
}

export interface NormalizeOptions {
  /**
   * What to do with unknown names: `"reject"` throws a `ValidationError`
   * listing them (with close-name suggestions) — for user-facing writes;
   * `"drop"` (default) discards them with a warn — for internal/read paths.
   */
  onUnknown?: "reject" | "drop";
  /** Free-text tag for logs ("agents.create", "runtime", …). */
  context?: string;
}

function allRegisteredToolNames(): string[] {
  return agentCapabilityRegistry.list().flatMap((cap) => cap.tools.map((t) => t.name));
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i, ...new Array<number>(n)];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n]!;
}

/** Closest registered tool names to `name` (same module prefix or distance ≤2). */
export function suggestSimilarTools(name: string, max = 3): string[] {
  const catalog = allRegisteredToolNames();
  if (!catalog.length) return [];
  const moduleId = name.includes(".") ? name.slice(0, name.indexOf(".")) : "";
  const scored = catalog
    .map((candidate) => {
      const sameModule = moduleId && candidate.startsWith(`${moduleId}.`);
      const dist = levenshtein(name, candidate);
      return { candidate, score: dist - (sameModule ? 2 : 0), dist, sameModule };
    })
    .filter((s) => s.sameModule || s.dist <= 2)
    .sort((a, b) => a.score - b.score);
  return scored.slice(0, max).map((s) => s.candidate);
}

/**
 * Validate/normalize an allowlist against the registry. `null` input (no
 * restriction) returns `null`. Aliases migrate silently (logged); unknown
 * names follow `opts.onUnknown`. Registry empty → pass-through (fail-open).
 */
export function normalizeAllowedTools(
  list: string[] | null | undefined,
  opts: NormalizeOptions = {},
): NormalizedAllowlist | null {
  if (list == null) return null;
  const onUnknown = opts.onUnknown ?? "drop";
  const context = opts.context ?? "unspecified";

  if (agentCapabilityRegistry.list().length === 0) {
    log.warn({ context }, "capability registry empty — allowlist passed through unvalidated");
    return { valid: [...new Set(list)], migrated: [], unknown: [] };
  }

  const valid: string[] = [];
  const seen = new Set<string>();
  const migrated: NormalizedAllowlist["migrated"] = [];
  const unknown: string[] = [];
  const push = (name: string) => {
    if (!seen.has(name)) {
      seen.add(name);
      valid.push(name);
    }
  };

  for (const raw of list) {
    const name = raw.trim();
    if (!name) continue;
    if (agentCapabilityRegistry.findTool(name)) {
      push(name);
      continue;
    }
    const alias = LEGACY_TOOL_ALIASES[name];
    if (alias) {
      // Keep only replacements that actually exist on this build.
      const to = alias.filter((t) => agentCapabilityRegistry.findTool(t));
      migrated.push({ from: name, to: [...to] });
      for (const t of to) push(t);
      continue;
    }
    unknown.push(name);
  }

  if (migrated.length) {
    log.info({ context, migrated }, "legacy tool names migrated in allowlist");
  }
  if (unknown.length) {
    if (onUnknown === "reject") {
      throw new ValidationError(
        "La lista de herramientas contiene nombres desconocidos.",
        unknown.map((name) => {
          const hints = suggestSimilarTools(name);
          return {
            field: "allowedTools",
            message: `Herramienta desconocida "${name}"${hints.length ? ` — ¿quisiste decir: ${hints.join(", ")}?` : ""}`,
          };
        }),
      );
    }
    log.warn({ context, unknown }, "unknown tool names dropped from allowlist");
  }

  return { valid, migrated, unknown };
}
