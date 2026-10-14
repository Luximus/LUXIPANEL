// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Read per-account forwards from the connected server for the accounts list.
 * Authoritative source is the per-account sidecar JSON (one privileged bulk
 * scan); Postfix `virtual_alias_maps` file-backed maps are merged in for
 * externally/manually-configured aliases the panel didn't write.
 */

import path from "node:path";
import { quoteCmd, quoteArg, type Executor } from "../../../../shared/executor/index.js";
import { mailConfig } from "../../../../config/mail.js";
import { fnv1aId } from "../accounts.helpers.js";
import { normalizeAddress, type ForwardEntry } from "./accounts.util.js";

async function readServerFile(executor: Executor, filePath: string): Promise<string> {
  const attempts: Array<() => Promise<string>> = [
    async () => {
      const data = await executor.readFile(filePath, "utf-8");
      return typeof data === "string" ? data : data.toString("utf-8");
    },
    async () => (await executor.exec(quoteCmd("cat", [filePath]))).stdout,
    async () => (await executor.exec(quoteCmd("sudo", ["cat", filePath]))).stdout,
  ];
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch {
      /* fall through to next attempt */
    }
  }
  return "";
}

/**
 * Per-account forwards as managed by the panel. The authoritative source is
 * the account sidecar (`<vmailBase>/<domain>/<local>/luxipanel-mail.json`,
 * see account-sidecar.service.ts) — `forwardsController`/account creation
 * write there and regenerate Sieve from it; they never touch Postfix
 * `virtual_alias_maps`. The list endpoint previously read only a hardcoded
 * `${dirname(vmailbox)}/virtual_aliases`, so panel-created forwards AND
 * manually-configured Postfix aliases both rendered as "-" whenever the real
 * map file had a different name (e.g. `hash:/etc/postfix/virtual`). Now: one
 * privileged bulk scan of all sidecars (same shape as getMaildirQuotaLimitsMap),
 * merged with every file-backed map resolved from `postconf virtual_alias_maps`
 * so externally/manually-managed aliases are picked up regardless of filename.
 */
const ALIAS_MAP_FILE_PREFIXES = [
  "hash:", "btree:", "lmdb:", "cdb:", "dbm:", "sdbm:", "texthash:", "cidr:", "pcre:", "regexp:",
];

/**
 * Resolve the plain-text source file(s) backing Postfix `virtual_alias_maps`
 * via `postconf`. Postfix `hash:/etc/postfix/virtual` is compiled to a
 * `.db`; the editable/readable source is the path without the type prefix.
 * Non-file map types (mysql/ldap/pgsql/proxy/…) are skipped.
 *
 * `postconf` lives in /usr/sbin, which is NOT on PATH for non-interactive
 * SSH commands — so we try absolute paths too, parse output with or without
 * the `name =` prefix, and ALWAYS include the well-known default file names
 * as candidates so a postconf miss can't hide manually-edited aliases.
 * readServerFile() returns "" for a missing path, so extra candidates are
 * harmless.
 */
async function resolvePostfixAliasFiles(executor: Executor): Promise<string[]> {
  const files = new Set<string>([
    mailConfig.postfix.virtual,
    path.join(path.dirname(mailConfig.postfix.vmailbox), "virtual_aliases"),
  ]);
  try {
    const res = await executor.exec(
      "{ command -v postconf >/dev/null 2>&1 && postconf -h virtual_alias_maps; } " +
      "|| /usr/sbin/postconf -h virtual_alias_maps 2>/dev/null " +
      "|| postconf virtual_alias_maps 2>/dev/null",
    );
    if (res.exitCode === 0 && res.stdout) {
      // Output is either `hash:/path, ...` (-h) or `virtual_alias_maps = hash:/path` (no -h).
      const rhs = res.stdout.includes("=")
        ? res.stdout.slice(res.stdout.indexOf("=") + 1)
        : res.stdout;
      for (const token of rhs.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean)) {
        const prefix = ALIAS_MAP_FILE_PREFIXES.find((p) => token.startsWith(p));
        if (prefix) {
          const p = token.slice(prefix.length);
          if (p.startsWith("/")) files.add(p);
        } else if (token.startsWith("/")) {
          files.add(token);
        }
      }
    }
  } catch {
    /* best-effort: the well-known defaults above still cover the common case */
  }
  return [...files];
}

export async function readForwardsFromServer(executor: Executor): Promise<Map<string, ForwardEntry[]>> {
  const forwardsByAddress = new Map<string, ForwardEntry[]>();

  // --- Primary source: per-account sidecar JSON (one privileged exec) ---
  const base = mailConfig.vmail.base;
  const basePrefix = base.replace(/\/+$/, "") + "/";
  const sidecarCmd =
    `sudo find ${quoteArg(base)} -mindepth 3 -maxdepth 3 -name luxipanel-mail.json ` +
    `-exec sh -c 'echo "$1|$(base64 -w0 "$1" 2>/dev/null)"' _ {} \\; 2>/dev/null`;
  try {
    const res = await executor.exec(sidecarCmd);
    if (res.exitCode === 0 && res.stdout) {
      for (const line of res.stdout.split("\n")) {
        const trimmed = line.trim();
        const sep = trimmed.indexOf("|");
        if (sep <= 0) continue;
        const filePath = trimmed.slice(0, sep);
        const b64 = trimmed.slice(sep + 1).trim();
        if (!b64 || !filePath.startsWith(basePrefix)) continue;
        const rel = filePath.slice(basePrefix.length).split("/").filter(Boolean);
        const domain = rel[0];
        const local = rel[1];
        if (!domain || !local) continue;
        const address = normalizeAddress(`${local}@${domain}`);
        if (!address) continue;
        let parsed: { forwards?: Array<{ destination?: unknown; keepCopy?: unknown; enabled?: unknown }> };
        try {
          parsed = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
        } catch {
          continue;
        }
        if (!Array.isArray(parsed.forwards)) continue;
        const items = forwardsByAddress.get(address) ?? [];
        for (const f of parsed.forwards) {
          if (f?.enabled === false) continue;
          const dest = typeof f?.destination === "string" ? f.destination.trim() : "";
          if (!dest) continue;
          items.push({
            id: fnv1aId(`${address}->${dest}`),
            destination: dest,
            keepCopy: f?.keepCopy !== false,
          });
        }
        if (items.length) forwardsByAddress.set(address, items);
      }
    }
  } catch {
    /* best-effort: fall through to virtual_aliases */
  }

  // --- Legacy/external/manual source: every file-backed map resolved from
  // `postconf virtual_alias_maps`. Best-effort; only fills addresses not
  // already covered by the sidecar (the panel-authoritative source). ---
  for (const aliasPath of await resolvePostfixAliasFiles(executor)) {
    const content = await readServerFile(executor, aliasPath);
    if (!content.trim()) continue;

    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const [src, ...rest] = line.split(/\s+/);
      if (!src || rest.length === 0) continue;
      const source = normalizeAddress(src);
      if (!source || forwardsByAddress.has(source)) continue;
      const destinations = rest.join(" ").split(",").map((d) => d.trim()).filter(Boolean);
      const keepCopy = destinations.includes(source);
      const items: ForwardEntry[] = [];
      for (const dest of destinations) {
        if (dest === source) continue;
        items.push({
          id: fnv1aId(`${source}->${dest}`),
          destination: dest,
          keepCopy,
        });
      }
      if (items.length) forwardsByAddress.set(source, items);
    }
  }
  return forwardsByAddress;
}
