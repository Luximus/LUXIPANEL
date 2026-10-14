// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Webhook discovery detector — git-hook.
 *
 * Discovers executable Git hook scripts on the connected client server. Such
 * hooks (post-receive, post-merge, …) frequently POST to webhook URLs or
 * trigger deploys, so they are webhook-shaped for visibility. Read-only,
 * `managed: false`.
 *
 * Strategy (bounded shell scans via the per-server Executor):
 *   1. find <roots> -maxdepth N -type d -path '*\/.git/hooks'   (head -n 200)
 *   2. per dir: find <dir> -maxdepth 1 -type f -perm -u+x ! -name '*.sample' (head -n 50)
 *   3. per file: head -c 4000 <file> → first URL via WEBHOOK_URL_RE
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
  type WebhookDetector,
} from "./types.js";

const log = createModuleLogger("webhook-discovery:git-hooks");

const HOOKS_DIR_LIMIT = 200;
const HOOKS_PER_DIR_LIMIT = 50;
const HOOK_READ_BYTES = 4000;
const RAW_SNIPPET_CHARS = 200;
const EXEC_TIMEOUT_MS = 8000;

/** Repo name = basename of the dir two levels above `.git/hooks`. */
function repoNameFromHooksDir(hooksDir: string): string {
  // .../<repo>/.git/hooks  →  dirname x3 = <repo>
  const repoDir = path.dirname(path.dirname(path.dirname(hooksDir)));
  return path.basename(repoDir) || "";
}

export const gitHooksDetector: WebhookDetector = {
  source: "git-hook",
  async detect(executor: Executor): Promise<DiscoveredWebhook[]> {
    try {
      const roots = DISCOVERY_SCAN_ROOTS.map((r) => quoteArg(r)).join(" ");
      const dirCmd =
        `find ${roots} -maxdepth ${DISCOVERY_MAX_DEPTH} -type d -path '*/.git/hooks' 2>/dev/null` +
        ` | head -n ${HOOKS_DIR_LIMIT}`;
      const dirRes = await executor.exec(dirCmd, { timeoutMs: EXEC_TIMEOUT_MS });
      const hooksDirs = dirRes.stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const out: DiscoveredWebhook[] = [];

      for (const hooksDir of hooksDirs) {
        let hookFiles: string[] = [];
        try {
          const fileCmd =
            `find ${quoteArg(hooksDir)} -maxdepth 1 -type f -perm -u+x ! -name '*.sample' 2>/dev/null` +
            ` | head -n ${HOOKS_PER_DIR_LIMIT}`;
          const fileRes = await executor.exec(fileCmd, { timeoutMs: EXEC_TIMEOUT_MS });
          hookFiles = fileRes.stdout
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
        } catch (err) {
          log.debug({ err, hooksDir }, "git-hook: list hooks failed");
          continue;
        }

        const repoName = repoNameFromHooksDir(hooksDir);

        for (const hookFile of hookFiles) {
          const base = path.basename(hookFile);
          let script = "";
          try {
            const readRes = await executor.exec(
              `head -c ${HOOK_READ_BYTES} ${quoteArg(hookFile)} 2>/dev/null`,
              { timeoutMs: EXEC_TIMEOUT_MS },
            );
            script = readRes.stdout ?? "";
          } catch (err) {
            log.debug({ err, hookFile }, "git-hook: read script failed");
            script = "";
          }

          const url = firstUrl(script);
          const target = url ?? "(script local)";
          const name = repoName || base;

          out.push({
            id: makeDiscoveryId("git-hook", hookFile, target),
            source: "git-hook",
            name,
            target,
            location: hookFile,
            detail: `hook: ${base}`,
            enabled: true,
            managed: false,
            raw: clampRaw(script.slice(0, RAW_SNIPPET_CHARS)),
          });
        }
      }

      return out;
    } catch (err) {
      log.warn({ err }, "git-hooks detector failed");
      return [];
    }
  },
};
