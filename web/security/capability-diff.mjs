#!/usr/bin/env node
/**
 * capability-diff.mjs — the "diff" half of the capability check.
 *
 * Semgrep can't read the manifest and cross-reference, so it only TAGS usage
 * (security/module-semgrep.yml). This script consumes `semgrep --json` and
 * produces the verdict the review pipeline acts on:
 *
 *   - any FORBIDDEN finding (severity ERROR / metadata.capability=forbidden)
 *     => FAIL (sandbox escape / disallowed API).
 *   - capability USED in code but NOT declared in manifest.capabilities
 *     => FAIL (under-declared — the user wasn't asked to consent to it).
 *   - capability DECLARED but never USED
 *     => WARN (over-declared — least-privilege nudge, not blocking).
 *
 * Usage:
 *   node security/capability-diff.mjs <manifest.json> <semgrep.json>
 * Exit code: 0 pass/warn, 1 fail. Prints a JSON verdict to stdout
 * (persisted into module_review_events, ROADMAP §2.1 / §4).
 */
import fs from "node:fs";

const [, , manifestPath, semgrepPath] = process.argv;
if (!manifestPath || !semgrepPath) {
  console.error("usage: capability-diff.mjs <manifest.json> <semgrep.json>");
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const declared = new Set(manifest.capabilities ?? []);
const results = (JSON.parse(fs.readFileSync(semgrepPath, "utf8")).results ?? []);

const KNOWN = new Set([
  "server.exec", "server.sudo", "server.fs.read", "server.fs.write", "storage", "http",
]);

const forbidden = [];
const used = new Map(); // capability -> first "path:line"

for (const r of results) {
  const sev = r.extra?.severity;
  const cap = r.extra?.metadata?.capability;
  const loc = `${r.path}:${r.start?.line ?? "?"}`;
  if (sev === "ERROR" || cap === "forbidden") {
    forbidden.push({ loc, rule: r.check_id, message: (r.extra?.message ?? "").trim() });
  } else if (cap && KNOWN.has(cap)) {
    if (!used.has(cap)) used.set(cap, loc);
  }
}

const undeclared = [...used.keys()].filter((c) => !declared.has(c));
const unused = [...declared].filter((c) => !used.has(c));

const status = forbidden.length || undeclared.length ? "fail" : unused.length ? "warn" : "pass";

const verdict = {
  status,
  forbidden,
  undeclaredCapabilities: undeclared.map((c) => ({ capability: c, firstUse: used.get(c) })),
  unusedCapabilities: unused, // declared but never exercised
  usedCapabilities: [...used.keys()],
  declaredCapabilities: [...declared],
};

console.log(JSON.stringify(verdict, null, 2));
process.exit(status === "fail" ? 1 : 0);
