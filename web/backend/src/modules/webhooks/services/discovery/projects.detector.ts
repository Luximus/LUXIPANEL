// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Webhook discovery detector — project.
 *
 * Discovers webhook references *inside* the Git projects the Files module lists
 * on the connected client server. The Files module surfaces projects by walking
 * the standard roots for `.git` dirs; we replicate that scan independently (no
 * cross-module import) so "webhooks in projects" lines up with what users see
 * in Files. Read-only, `managed: false`.
 *
 * Strategy (bounded shell scans via the per-server Executor):
 *   1. find <roots> -maxdepth N -type d -name .git   (head -n 200) → repo dirs
 *   2. per repo (capped): grep for webhook references in
 *        a. .github/workflows (GitHub Actions)
 *        b. project config/env files (.env, json, yml, yaml, toml)
 *      both bounded with head -n 10 each.
 *   3. per `grep -n` line (file:line:content): first URL via WEBHOOK_URL_RE, or
 *      "GitHub Actions workflow" for a secret-only workflow ref. Skip comments.
 *
 * Fail-soft: any error resolves to [], never throws. Total commands bounded.
 */

import path from "node:path";

import { quoteArg, type Executor } from "../../../../shared/executor/index.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import {
  type DiscoveredWebhook,
  makeDiscoveryId,
} from "../../models/discovery.model.js";
import {
  clampRaw,
  DISCOVERY_MAX_DEPTH,
  DISCOVERY_SCAN_ROOTS,
  firstUrl,
  maskSecretsInText,
  maskSecretUrl,
  parseGrepLine,
  type WebhookDetector,
} from "./types.js";

const log = createModuleLogger("webhook-discovery:projects");

const REPO_LIMIT = 200;
const REPO_SCAN_CAP = 100;
const GREP_PER_REPO_LIMIT = 10;
const ROUTE_PER_REPO_LIMIT = 40;
const TOTAL_CAP = 400;
const EXEC_TIMEOUT_MS = 8000;

const WORKFLOW_TARGET = "GitHub Actions workflow";

/** Whether the matched line is a comment (shell `#`, JS `//` `*` `/*`, HTML). */
function isComment(content: string): boolean {
  const c = content.trim();
  return (
    c.startsWith("#") ||
    c.startsWith("//") ||
    c.startsWith("*") ||
    c.startsWith("/*") ||
    c.startsWith("<!--")
  );
}

/** Backup / editor-swap files that just duplicate real config (noise). */
function isBackupFile(file: string): boolean {
  const base = file.slice(file.lastIndexOf("/") + 1);
  return /\.(bak|orig|swp|tmp|old)\b|\.bak[.-]|~$|\.bak\.|cleanup|backup/i.test(base);
}

/** Source-file extensions worth scanning for webhook ROUTE handlers. */
const CODE_INCLUDES = [
  "*.ts", "*.tsx", "*.js", "*.jsx", "*.mjs", "*.cjs",
  "*.py", "*.go", "*.php", "*.rb", "*.java", "*.cs",
]
  .map((g) => `--include='${g}'`)
  .join(" ");

const CODE_EXCLUDE_DIRS = [
  "node_modules", ".git", "dist", "build", ".next", "vendor", "coverage",
  "public", ".astro", ".cache", "out", "tmp",
]
  .map((d) => `--exclude-dir='${d}'`)
  .join(" ");

/** Receivers that mean a CLIENT HTTP call, not a server route registration
 *  (`api.post(...)`, `axios.get(...)`, `res.redirect(...)`). Filters out the
 *  biggest false-positive class. */
const CLIENT_RECEIVERS = new Set([
  "api", "axios", "http", "https", "client", "fetch", "$fetch", "ky", "got",
  "request", "req", "res", "response", "supertest", "agent", "instance", "xhr",
  "usefetch", "$http", "rest", "service", "self", "window", "document",
]);

/** ERE matching a route registration whose path contains webhook/hook:
 *  `.post("…/webhook…")`, `.get('…/hooks…')`, NestJS `@Post('webhook')`, etc.
 *  Uses POSIX `[[:space:]]` (portable across servers; not GNU-only `\s`). */
const ROUTE_GREP =
  "(\\.(get|post|put|patch|delete|all|route|on)|@(Get|Post|Put|Patch|Delete|All))" +
  "[[:space:]]*\\([[:space:]]*[\"'`][^\"'`]*(webhook|/hooks?)";

/** JS-side parse of a matched route line → { method, routePath }.
 *  Captures the receiver token so client HTTP calls can be filtered out. */
const ROUTE_PARSE = /(?:(\w+)\s*\.\s*(get|post|put|patch|delete|all|route|on)|@(Get|Post|Put|Patch|Delete|All))\s*\(\s*[`'"]([^`'"]+)[`'"]/i;

function parseRoute(content: string): { method: string; routePath: string } | null {
  const m = ROUTE_PARSE.exec(content);
  if (!m) return null;
  const receiver = (m[1] ?? "").toLowerCase();
  if (receiver && CLIENT_RECEIVERS.has(receiver)) return null; // client call, not a route
  const method = (m[2] ?? m[3] ?? "").toUpperCase();
  const routePath = (m[4] ?? "").trim();
  if (!routePath) return null;
  return { method: method || "ALL", routePath };
}

export const projectsDetector: WebhookDetector = {
  source: "project",
  async detect(executor: Executor): Promise<DiscoveredWebhook[]> {
    try {
      const roots = DISCOVERY_SCAN_ROOTS.map((r) => quoteArg(r)).join(" ");
      const dirCmd =
        `find ${roots} -maxdepth ${DISCOVERY_MAX_DEPTH} -type d -name .git 2>/dev/null` +
        ` | head -n ${REPO_LIMIT}`;
      const dirRes = await executor.exec(dirCmd, { timeoutMs: EXEC_TIMEOUT_MS });
      const repoPaths = dirRes.stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        // <repo>/.git → <repo>
        .map((gitDir) => gitDir.replace(/\/\.git$/, ""))
        .filter(Boolean)
        .slice(0, REPO_SCAN_CAP);

      const out: DiscoveredWebhook[] = [];
      const seen = new Set<string>();

      const matchFilter = "webhook|hooks\\.slack\\.com|discord(app)?\\.com/api/webhooks";

      for (const repoPath of repoPaths) {
        if (out.length >= TOTAL_CAP) break;
        const repoName = path.basename(repoPath) || repoPath;
        const qRepo = quoteArg(repoPath);

        // ── A. Webhook ROUTE handlers defined in the project's source code.
        //    This is what "the project has webhooks" usually means: inbound
        //    endpoints like `fastify.post("/api/webhooks/whatsapp")` or
        //    `router.post("/api/payments/wompi/webhook")`. These never appear
        //    in config files, so they were the big miss before.
        const routeLines: string[] = [];
        try {
          const routeCmd =
            `grep -RInE ${quoteArg(ROUTE_GREP)} ${qRepo} ${CODE_INCLUDES} ${CODE_EXCLUDE_DIRS}` +
            ` 2>/dev/null | head -n ${ROUTE_PER_REPO_LIMIT}`;
          const routeRes = await executor.exec(routeCmd, { timeoutMs: EXEC_TIMEOUT_MS });
          for (const l of routeRes.stdout.split("\n")) {
            const t = l.trim();
            if (t) routeLines.push(t);
          }
        } catch (err) {
          log.debug({ err, repoPath }, "project: route grep failed");
        }

        for (const line of routeLines) {
          if (out.length >= TOTAL_CAP) break;
          const parsed = parseGrepLine(line);
          if (!parsed) continue;
          const { file, lineNo, content } = parsed;
          if (isComment(content)) continue;
          const route = parseRoute(content);
          if (!route) continue; // unparseable or a client HTTP call → skip
          const target = route.routePath;
          const location = `${file}:${lineNo}`;
          const id = makeDiscoveryId("project", location, target);
          if (seen.has(id)) continue;
          seen.add(id);
          out.push({
            id,
            source: "project",
            name: repoName,
            target,
            location,
            detail: `${route.method} · ${repoName}`,
            enabled: null,
            managed: false,
            raw: clampRaw(content),
          });
        }

        // ── B. Outbound webhook URLs in workflows / config / env files.
        const lines: string[] = [];
        try {
          // GitHub Actions workflows.
          const wfCmd =
            `grep -RInE 'https?://|webhook' ${quoteArg(`${repoPath}/.github/workflows`)} 2>/dev/null` +
            ` | grep -iE ${quoteArg(matchFilter)} | head -n ${GREP_PER_REPO_LIMIT}`;
          const wfRes = await executor.exec(wfCmd, { timeoutMs: EXEC_TIMEOUT_MS });
          for (const l of wfRes.stdout.split("\n")) {
            const t = l.trim();
            if (t) lines.push(t);
          }

          // Project config/env files referencing webhook URLs.
          const cfgCmd =
            `grep -RInE 'https?://[^\\s"'"'"']+' ${qRepo}` +
            ` --include='*.env' --include='.env*' --include='*.json'` +
            ` --include='*.yml' --include='*.yaml' --include='*.toml' 2>/dev/null` +
            ` | grep -iE ${quoteArg(matchFilter)} | head -n ${GREP_PER_REPO_LIMIT}`;
          const cfgRes = await executor.exec(cfgCmd, { timeoutMs: EXEC_TIMEOUT_MS });
          for (const l of cfgRes.stdout.split("\n")) {
            const t = l.trim();
            if (t) lines.push(t);
          }
        } catch (err) {
          log.debug({ err, repoPath }, "project: grep failed");
        }

        const urlSeenInRepo = new Set<string>();
        for (const line of lines) {
          if (out.length >= TOTAL_CAP) break;
          const parsed = parseGrepLine(line);
          if (!parsed) continue;
          const { file, lineNo, content } = parsed;
          if (isComment(content)) continue;
          if (isBackupFile(file)) continue;

          const url = firstUrl(content);
          const isWorkflow = file.includes("/.github/workflows");
          let rawTarget: string;
          if (url) {
            rawTarget = url;
          } else if (isWorkflow) {
            rawTarget = WORKFLOW_TARGET;
          } else {
            // No URL and not a workflow secret reference — nothing to surface.
            continue;
          }
          // Collapse the same outbound URL repeated across config files in a repo
          // (dedupe on the REAL url, before masking).
          if (urlSeenInRepo.has(rawTarget)) continue;
          urlSeenInRepo.add(rawTarget);

          // The outbound URL (Slack/Discord/…) usually EMBEDS the secret token in
          // its path — never return it verbatim to a non-admin `webhooks` user.
          const target = url ? maskSecretUrl(url) : rawTarget;
          const location = `${file}:${lineNo}`;
          const id = makeDiscoveryId("project", location, target);
          if (seen.has(id)) continue;
          seen.add(id);

          out.push({
            id,
            source: "project",
            name: repoName,
            target,
            location,
            detail: `proyecto ${repoName}`,
            enabled: null,
            managed: false,
            raw: clampRaw(maskSecretsInText(content)),
          });
        }
      }

      return out;
    } catch (err) {
      log.warn({ err }, "projects detector failed");
      return [];
    }
  },
};
