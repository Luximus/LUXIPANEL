// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Webhook discovery detector — nginx.
 *
 * Detects INCOMING webhook receiver endpoints defined in nginx vhosts on the
 * connected client server. Reads site config directly via the Executor (this
 * module never imports the nginx module — modules don't import each other).
 *
 * Approach: list enabled sites (`/etc/nginx/sites-enabled/`) and conf.d, read
 * each file (`cat`, then `sudo -n cat` if root-owned), parse `server_name` and
 * `location` blocks, and surface locations that look like webhook receivers
 * (path keyword match) or that reverse-proxy (`proxy_pass`).
 *
 * Fail-soft: every path is wrapped so a scan failure resolves to []; never throws.
 */

import type { Executor } from "../../../../shared/executor/index.js";
import { readPrivilegedFileOrEmpty } from "../../../../shared/system/privileged-file-io.js";
import { firstServerNameTokens } from "../../../../shared/nginx/server-name.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import { SITES_ENABLED } from "../../../nginx/nginx-constants.js";
import { makeDiscoveryId, type DiscoveredWebhook } from "../../models/discovery.model.js";
import { clampRaw, type WebhookDetector } from "./types.js";

const log = createModuleLogger("webhooks:discovery:nginx");

const EXEC_TIMEOUT_MS = 8_000;
const MAX_FILES = 100;
const MAX_ITEMS = 200;
const MAX_FILE_BYTES = 256 * 1024;

/** A location is a webhook RECEIVER if its path looks hook-shaped … */
const RECEIVER_PATH_RE =
  /(webhook|hooks?|payload|callback|notify|gh-?webhook|git-?hook|deploy|ci|sci|trigger)/i;
/** … or if its body reverse-proxies. */
const LOCATION_RE = /location\s+([^\s{]+)\s*\{([^}]*)\}/g;
const PROXY_PASS_RE = /\bproxy_pass\s+([^\s;]+)\s*;/i;

/** Read a (possibly root-owned) file's content; "" on any failure. */
async function readFile(executor: Executor, path: string): Promise<string> {
  return readPrivilegedFileOrEmpty(executor, path, {
    timeoutMs: EXEC_TIMEOUT_MS,
    maxBytes: MAX_FILE_BYTES,
  });
}

/** Strip location-modifier prefixes (~, ~*, ^~, =) and whitespace from a path. */
function cleanLocationPath(raw: string): string {
  return raw.replace(/^[\s]*(=|~\*?|\^~)?[\s]*/, "").trim();
}

/**
 * Extract the primary domain from a `server_name` directive, ignoring `_`.
 *
 * The directive regex is shared (`shared/nginx/server-name.ts`); it is anchored
 * to the start of a line, so a COMMENTED-OUT `# server_name old.example;` no
 * longer wins over the live one (the old local regex matched it).
 */
function primaryDomain(content: string): string | null {
  return firstServerNameTokens(content).find((token) => token !== "_") ?? null;
}

/** Parse one site file into discovered webhooks. */
function parseSite(
  content: string,
  filePath: string,
  enabled: boolean,
): DiscoveredWebhook[] {
  const out: DiscoveredWebhook[] = [];
  const domain = primaryDomain(content);
  const name = domain ?? filePath.split("/").pop() ?? filePath;
  const seen = new Set<string>();

  LOCATION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LOCATION_RE.exec(content)) !== null) {
    const rawPath = m[1] ?? "";
    const body = m[2] ?? "";
    const path = cleanLocationPath(rawPath);
    if (!path) continue;

    const proxy = PROXY_PASS_RE.exec(body);
    const proxyTarget = proxy?.[1];
    const isReceiver = RECEIVER_PATH_RE.test(path) || Boolean(proxyTarget);
    if (!isReceiver) continue;

    // Dedupe identical (location path) within this site file.
    const dedupeKey = `${filePath}::${path}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const urlPath = path.startsWith("/") ? path : `/${path}`;
    const target = domain ? `https://${domain}${urlPath}` : `https://${name}${urlPath}`;
    const detail = proxyTarget
      ? `proxy_pass ${proxyTarget}`
      : `location ${path}`;

    out.push({
      id: makeDiscoveryId("nginx", filePath, target),
      source: "nginx",
      name,
      target,
      location: filePath,
      detail,
      enabled,
      managed: false,
      raw: clampRaw(`location ${rawPath} {${body}}`),
    });

    if (out.length >= MAX_ITEMS) break;
  }

  return out;
}

export const nginxDetector: WebhookDetector = {
  source: "nginx",
  async detect(executor: Executor): Promise<DiscoveredWebhook[]> {
    const results: DiscoveredWebhook[] = [];
    try {
      // 1. Enumerate candidate site files.
      const files: { path: string; enabled: boolean }[] = [];

      try {
        const enabled = await executor.exec(
          `ls -1 ${SITES_ENABLED}/ 2>/dev/null | head -n ${MAX_FILES}`,
          { timeoutMs: EXEC_TIMEOUT_MS },
        );
        if (enabled.exitCode === 0) {
          for (const line of enabled.stdout.split("\n")) {
            const n = line.trim();
            if (n) files.push({ path: `${SITES_ENABLED}/${n}`, enabled: true });
          }
        }
      } catch {
        /* ignore — directory may not exist */
      }

      try {
        const confd = await executor.exec(
          `ls -1 /etc/nginx/conf.d/*.conf 2>/dev/null | head -n ${MAX_FILES}`,
          { timeoutMs: EXEC_TIMEOUT_MS },
        );
        if (confd.exitCode === 0) {
          for (const line of confd.stdout.split("\n")) {
            const p = line.trim();
            if (p) files.push({ path: p, enabled: true });
          }
        }
      } catch {
        /* ignore — conf.d may not exist */
      }

      // 2-3. Read and parse each file (bounded).
      for (const { path, enabled } of files.slice(0, MAX_FILES)) {
        if (results.length >= MAX_ITEMS) break;
        const content = await readFile(executor, path);
        if (!content) continue;
        try {
          const found = parseSite(content, path, enabled);
          for (const w of found) {
            results.push(w);
            if (results.length >= MAX_ITEMS) break;
          }
        } catch (err) {
          log.debug({ err, path }, "nginx site parse failed");
        }
      }
    } catch (err) {
      log.warn({ err }, "nginx webhook discovery failed");
      return [];
    }
    return results.slice(0, MAX_ITEMS);
  },
};
