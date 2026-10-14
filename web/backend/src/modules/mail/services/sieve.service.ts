// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Sieve service — manages per-account Sieve scripts for forwards and custom filters.
 */

import path from "node:path";
import { mailConfig } from "../../../config/mail.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { stageSecretFile, removeStagedFile, execChecked } from "./staging.helpers.js";
import type {
  MailFilterAction,
  MailFilterDefinition,
  MailFilterRule,
  AnyFilterActionType,
  FilterRuleMatch,
  FilterRulePart,
} from "../types/filter.types.js";
import type { MailAutoresponderDefinition } from "../types/autoresponder.types.js";

const log = createModuleLogger("sieve");

function escapeSieveString(value: string): string {
  // Hard rejection of CR/LF and vertical whitespace: a Sieve string with an
  // embedded newline splits into a second statement when sievec compiles the
  // script (the surrounding quotes don't survive line concat), turning filter
  // authoring into a tiny shell-as-vmail primitive via `pipe`. Strip them at
  // the boundary, do not escape.
  // eslint-disable-next-line no-control-regex
  const sanitized = value.replace(/[\r\n\f\v\x00]/g, "");
  return `"${sanitized.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function escapeGlob(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("*", "\\*").replaceAll("?", "\\?");
}

function normalizeRuleValue(rule: MailFilterRule): string {
  return (rule.value ?? "").trim();
}

function needsNumericComparator(match: FilterRuleMatch): boolean {
  return match === "is_above" || match === "is_not_above" || match === "is_below" || match === "is_not_below";
}

function isNegatedMatch(match: FilterRuleMatch): boolean {
  return (
    match === "does_not_contain"
    || match === "does_not_begin"
    || match === "does_not_end"
    || match === "does_not_match"
    || match === "is_not_above"
    || match === "is_not_below"
  );
}

function toBaseMatch(match: FilterRuleMatch): FilterRuleMatch {
  switch (match) {
    case "does_not_contain":
      return "contains";
    case "does_not_begin":
      return "begins";
    case "does_not_end":
      return "ends";
    case "does_not_match":
      return "matches";
    case "is_not_above":
      return "is_above";
    case "is_not_below":
      return "is_below";
    default:
      return match;
  }
}

function compileTextMatch(
  testPrefix: string,
  baseMatch: FilterRuleMatch,
  value: string,
  capabilities: Set<string>,
): string | null {
  if (!value && baseMatch !== "is") return null;

  if (baseMatch === "matches") {
    capabilities.add("regex");
    // Defensive regex compile-cost check. sievec hands the pattern straight
    // to the system regex engine (no timeout), so an exotic pattern becomes
    // a per-message DoS on the mail server. Reject obvious catastrophic
    // backtracking shapes (nested quantifiers like `(a+)+`) at the API edge.
    if (/(\([^)]*[+*]\)[+*])/.test(value)) {
      log.warn(
        { valuePreview: value.slice(0, 80) },
        "Rejected sieve regex with likely catastrophic backtracking shape",
      );
      return null;
    }
    return `${testPrefix} :regex ${escapeSieveString(value)}`;
  }

  if (baseMatch === "contains") {
    return `${testPrefix} :contains ${escapeSieveString(value)}`;
  }

  if (baseMatch === "is") {
    return `${testPrefix} :is ${escapeSieveString(value)}`;
  }

  if (baseMatch === "begins") {
    return `${testPrefix} :matches ${escapeSieveString(`${escapeGlob(value)}*`)}`;
  }

  if (baseMatch === "ends") {
    return `${testPrefix} :matches ${escapeSieveString(`*${escapeGlob(value)}`)}`;
  }

  if (baseMatch === "is_above" || baseMatch === "is_below") {
    capabilities.add("relational");
    capabilities.add("comparator-i;ascii-numeric");
    const op = baseMatch === "is_above" ? "gt" : "lt";
    return `${testPrefix} :value "${op}" :comparator "i;ascii-numeric" ${escapeSieveString(value)}`;
  }

  return null;
}

function wrapNegation(test: string, negate: boolean): string {
  return negate ? `not (${test})` : test;
}

/**
 * Sieve test prefix for each rule `part` that compiles via the shared
 * text-match path (`compileTextMatch` + `wrapNegation`). Parts with bespoke
 * handling (`body`, `not_delivered`, `error_message`) are NOT listed here.
 */
const TEXT_MATCH_PREFIX_BY_PART: Partial<Record<FilterRulePart, string>> = {
  from: "address \"from\"",
  to: "address \"to\"",
  any_recipient: "address [\"to\", \"cc\"]",
  subject: "header \"Subject\"",
  reply: "header \"Reply-To\"",
  list_id: "header \"List-Id\"",
  spam_status: "header \"X-Spam-Status\"",
  spam_bar: "header \"X-Spam-Bar\"",
  spam_score: "header \"X-Spam-Score\"",
  any_header: "header [\"From\", \"To\", \"Cc\", \"Subject\", \"Reply-To\", \"List-Id\", \"X-Spam-Status\", \"X-Spam-Bar\", \"X-Spam-Score\"]",
};

function compileRule(rule: MailFilterRule, capabilities: Set<string>): string | null {
  const rawValue = normalizeRuleValue(rule);
  const baseMatch = toBaseMatch(rule.match);
  const negate = isNegatedMatch(rule.match);

  if (needsNumericComparator(baseMatch) && !/^\d+(\.\d+)?$/.test(rawValue)) {
    return null;
  }

  if (rule.part === "not_delivered") {
    return "not exists [\"Delivered-To\"]";
  }
  if (rule.part === "error_message") {
    return "anyof (header :contains \"Auto-Submitted\" \"auto\", exists [\"X-Failed-Recipients\"])";
  }

  if (rule.part === "body") {
    capabilities.add("body");
    const compiled = compileTextMatch("body", baseMatch, rawValue, capabilities);
    return compiled ? wrapNegation(compiled, negate) : null;
  }

  const prefix = TEXT_MATCH_PREFIX_BY_PART[rule.part];
  if (prefix !== undefined) {
    const compiled = compileTextMatch(prefix, baseMatch, rawValue, capabilities);
    return compiled ? wrapNegation(compiled, negate) : null;
  }

  return null;
}

function compileFilterCondition(rules: MailFilterRule[], capabilities: Set<string>): string | null {
  const compiledRules = rules
    .map((rule) => ({
      joinWithPrevious: rule.joinWithPrevious === "or" ? "or" : "and",
      test: compileRule(rule, capabilities),
    }))
    .filter((entry): entry is { joinWithPrevious: "and" | "or"; test: string } => Boolean(entry.test));

  if (compiledRules.length === 0) return null;
  if (compiledRules.length === 1) return compiledRules[0]!.test;

  let andGroup: string[] = [compiledRules[0]!.test];
  const orGroups: string[] = [];

  for (let i = 1; i < compiledRules.length; i++) {
    const current = compiledRules[i]!;
    if (current.joinWithPrevious === "or") {
      orGroups.push(andGroup.length === 1 ? andGroup[0]! : `allof (${andGroup.join(", ")})`);
      andGroup = [current.test];
      continue;
    }
    andGroup.push(current.test);
  }

  orGroups.push(andGroup.length === 1 ? andGroup[0]! : `allof (${andGroup.join(", ")})`);
  if (orGroups.length === 1) return orGroups[0]!;
  return `anyof (${orGroups.join(", ")})`;
}

/**
 * Open/closed registry of action compilers keyed by `AnyFilterActionType`
 * (admin incluida: un filtro global legítimo usa `pipe`).
 * Adding a new action type is adding a table entry — no `switch` to edit.
 * Each compiler receives the trimmed action `value` and the shared
 * `capabilities` set, and returns the emitted Sieve line (or `null` to skip).
 */
const ACTION_COMPILERS: Record<
  AnyFilterActionType,
  (value: string, capabilities: Set<string>) => string | null
> = {
  discard: () => "discard;",
  redirect: (value, capabilities) => {
    if (!value) return null;
    capabilities.add("copy");
    return `redirect ${escapeSieveString(value)};`;
  },
  fail: (value, capabilities) => {
    capabilities.add("reject");
    return `reject ${escapeSieveString(value || "Rejected by mail filter")};`;
  },
  stop: () => "stop;",
  deliver_to_folder: (value, capabilities) => {
    capabilities.add("fileinto");
    return `fileinto ${escapeSieveString(value || "INBOX")};`;
  },
  pipe: (value, capabilities) => {
    if (!value) return null;
    capabilities.add("vnd.dovecot.pipe");
    return `pipe ${escapeSieveString(value)};`;
  },
};

function compileAction(action: MailFilterAction, capabilities: Set<string>): string | null {
  const value = (action.value ?? "").trim();
  const compiler = ACTION_COMPILERS[action.type];
  return compiler ? compiler(value, capabilities) : null;
}

function buildAccountScript(
  destinations: string[],
  keepCopy: boolean,
  filters: MailFilterDefinition[],
  autoresponder?: MailAutoresponderDefinition | null,
): string | null {
  const capabilities = new Set<string>();
  const blocks: string[] = [];

  for (const filter of filters) {
    if (!filter.enabled) continue;
    const condition = compileFilterCondition(filter.rules, capabilities);
    if (!condition) continue;

    const actionLines = filter.actions
      .map((action) => compileAction(action, capabilities))
      .filter((line): line is string => Boolean(line));
    if (!actionLines.length) continue;

    blocks.push(`if ${condition} {\n  ${actionLines.join("\n  ")}\n}\n`);
  }

  if (destinations.length > 0) {
    capabilities.add("copy");
    blocks.push(destinations.map((destination) => {
      if (keepCopy) return `redirect :copy ${escapeSieveString(destination)};`;
      return `redirect ${escapeSieveString(destination)};`;
    }).join("\n"));

    if (keepCopy) {
      blocks.push("keep;");
    }
  }

  if (autoresponder?.enabled) {
    capabilities.add("vacation");

    const intervalHours = Math.max(0, Number(autoresponder.intervalHours || 0));
    const days = Math.max(1, Math.ceil(intervalHours / 24));
    const fromAddress = `${autoresponder.localPart}@${autoresponder.domain}`;
    const subject = autoresponder.subject.trim() || "Autoresponder";
    const body = autoresponder.body || "";
    const addresses = `["${fromAddress.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"]`;

    let reasonArg = escapeSieveString(body);
    const vacationTags: string[] = [
      `:days ${days}`,
      `:addresses ${addresses}`,
      `:subject ${escapeSieveString(subject)}`,
      `:from ${escapeSieveString(autoresponder.fromName?.trim() || fromAddress)}`,
    ];

    if (autoresponder.isHtml) {
      vacationTags.push(":mime");
      const charset = (autoresponder.charset || "utf-8").trim() || "utf-8";
      reasonArg = escapeSieveString(
        `Content-Type: text/html; charset=${charset}\r\nMIME-Version: 1.0\r\n\r\n${body}`,
      );
    }

    const vacationAction = `vacation ${vacationTags.join(" ")} ${reasonArg};`;
    const startAt = autoresponder.startAt ? new Date(autoresponder.startAt) : null;
    const stopAt = autoresponder.stopAt ? new Date(autoresponder.stopAt) : null;
    const dateChecks: string[] = [];

    if (startAt && !Number.isNaN(startAt.getTime())) {
      capabilities.add("date");
      capabilities.add("relational");
      dateChecks.push(`currentdate :zone "+0000" :value "ge" "iso8601" ${escapeSieveString(startAt.toISOString())}`);
    }
    if (stopAt && !Number.isNaN(stopAt.getTime())) {
      capabilities.add("date");
      capabilities.add("relational");
      dateChecks.push(`currentdate :zone "+0000" :value "le" "iso8601" ${escapeSieveString(stopAt.toISOString())}`);
    }

    if (dateChecks.length === 0) {
      blocks.push(vacationAction);
    } else if (dateChecks.length === 1) {
      blocks.push(`if ${dateChecks[0]} {\n  ${vacationAction}\n}\n`);
    } else {
      blocks.push(`if allof (${dateChecks.join(", ")}) {\n  ${vacationAction}\n}\n`);
    }
  }

  if (blocks.length === 0) return null;

  const requires = [...capabilities].sort();
  const requireLine = requires.length > 0
    ? `require [${requires.map((cap) => escapeSieveString(cap)).join(", ")}];\n\n`
    : "";

  return `${requireLine}${blocks.join("\n")}\n`;
}

function accountScriptPaths(address: string) {
  const [local, domain] = address.split("@");
  if (!local || !domain) return null;
  // Defense in depth: reject any local/domain segment that could escape the
  // maildir tree (path separators, "..", NUL). The controllers already validate
  // the address with emailSchema, but this guards direct/service callers too.
  if (/[/\\]|\.\./.test(local) || /[/\\]|\.\./.test(domain) || address.includes("\0")) return null;
  const maildirBase = path.join(mailConfig.vmail.base, domain, local);
  // Confirm the resolved path stays contained under the vmail base.
  const baseWithSep = path.join(mailConfig.vmail.base) + path.sep;
  if (maildirBase !== path.join(mailConfig.vmail.base) && !maildirBase.startsWith(baseWithSep)) return null;
  const sieveDir = path.join(maildirBase, ".sieve");
  const sieveFile = path.join(sieveDir, "luxipanel.sieve");
  const activeLink = path.join(maildirBase, ".dovecot.sieve");
  return { maildirBase, sieveDir, sieveFile, activeLink };
}

async function writeOrRemoveScriptWithExecutor(
  address: string,
  script: string | null,
  executor: Executor,
): Promise<void> {
  const paths = accountScriptPaths(address);
  if (!paths) return;
  const { sieveDir, sieveFile, activeLink } = paths;

  if (!script) {
    await executor.exec(quoteCmd("rm", ["-f", sieveFile, `${sieveFile}c`, activeLink]));
    log.info({ address, target: executor.target.id }, "Removed Sieve script via executor");
    return;
  }

  // The Sieve dir lives under the vmail tree (root/vmail-owned), so SFTP
  // mkdir/writeFile by the panel's SSH user is denied. Stage the script over
  // SFTP as a tmp file, then `sudo cp` it into place — sudo gets the operator
  // passphrase injected, the same as the chown/sievec calls below. Every
  // privileged step (mkdir/cp/ln/chown) goes through sudo so this never fails
  // on a non-root target.
  await execChecked(executor, quoteCmd("sudo", ["mkdir", "-p", sieveDir]), "mkdir sieve dir");
  // 0600 atomic staging (audit Top #9): forward destinations / autoresponder
  // bodies are never world-readable during the staging window.
  const tmp = await stageSecretFile(executor, "sieve", script);
  try {
    const cp = await executor.exec(quoteCmd("sudo", ["cp", tmp, sieveFile]));
    if (cp.exitCode !== 0) {
      throw new Error(`sudo cp → ${sieveFile} failed: ${(cp.stderr || cp.stdout || "").trim() || "exit " + cp.exitCode}`);
    }
  } finally {
    await removeStagedFile(executor, tmp);
  }
  await execChecked(executor, quoteCmd("sudo", ["chown", `${mailConfig.vmail.uid}:${mailConfig.vmail.gid}`, sieveFile]), "chown sieve script");
  await execChecked(executor, quoteCmd("sudo", [mailConfig.sievec, sieveFile]), "sievec compile");
  await execChecked(executor, quoteCmd("sudo", ["ln", "-sf", sieveFile, activeLink]), "ln sieve active");
  await executor.exec(quoteCmd("sudo", ["chown", "-h", `${mailConfig.vmail.uid}:${mailConfig.vmail.gid}`, activeLink]));
  log.info({ address, target: executor.target.id }, "Wrote Sieve script via executor");
}

export const sieveService = {
  /**
   * Write a full account Sieve script (filters + forwards) via executor.
   */
  async writeAccountFiltersAndForwardsWithExecutor(
    address: string,
    destinations: string[],
    keepCopy: boolean,
    filters: MailFilterDefinition[],
    executor: Executor,
    autoresponder?: MailAutoresponderDefinition | null,
  ): Promise<void> {
    const script = buildAccountScript(destinations, keepCopy, filters, autoresponder ?? null);
    await writeOrRemoveScriptWithExecutor(address, script, executor);
  },
};
