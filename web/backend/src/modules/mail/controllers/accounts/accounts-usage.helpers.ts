// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Privileged mailbox-usage/quota reads for the accounts list — per-account
 * disk usage (doveadm quota with a `find` byte-sweep fallback), the filesystem
 * total behind the storage card, and per-account maildir quota limits. All run
 * on the connected server via the `Executor`; failures surface as
 * `available: false` rather than a misleading 0.
 */

import { quoteArg, type Executor } from "../../../../shared/executor/index.js";
import { mailConfig } from "../../../../config/mail.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";

const log = createModuleLogger("accounts-ctrl");

export type MailboxUsage = {
  /** address (lowercased) -> used bytes. Only present when `available` is true. */
  map: Map<string, number>;
  /**
   * Whether usage could actually be computed. `false` means the privileged
   * read failed (e.g. no NOPASSWD sudo on the target) — callers must surface
   * "unavailable", NOT a misleading 0.
   */
  available: boolean;
  /** Why it was unavailable, when known — drives the sudo-password prompt. */
  reason?: "sudo_password_required";
};

/** Heuristic: did this exec fail because sudo wanted a password / was denied? */
function isSudoPrivilegeError(text: string | undefined): boolean {
  if (!text) return false;
  return /a password is required|a terminal is required|not allowed to execute|incorrect password|sudo:.*command not found/i.test(text);
}

/**
 * Fetch disk usage for ALL accounts. Primary source is `doveadm quota get -A`
 * (single exec, authoritative — matches the quota Dovecot actually enforces).
 * Falls back to a `find <vmailBase> | awk` byte sweep. Both run with `sudo -n`
 * (non-interactive: fail fast instead of hanging on a password prompt).
 *
 * Returns `available: false` when the privileged read is denied so the caller
 * can show "n/d" instead of a fake 0.
 */
export async function getAllMailboxUsageMap(executor: Executor, addresses: string[]): Promise<MailboxUsage> {
  const map = new Map<string, number>(addresses.map((a) => [a.toLowerCase(), 0]));
  if (addresses.length === 0) return { map, available: true };

  // --- Primary: doveadm quota (tab-separated, one exec). STORAGE is KiB. ---
  const doveadmCmd = "sudo -n doveadm -f tab quota get -A 2>&1";
  try {
    const out = await executor.exec(doveadmCmd);
    if (!isSudoPrivilegeError(out.stdout) && !isSudoPrivilegeError(out.stderr)) {
      let matched = 0;
      for (const line of out.stdout.split("\n")) {
        const cols = line.split("\t");
        if (cols.length < 5) continue;
        const user = cols[0]?.trim().toLowerCase();
        const type = cols[2]?.trim().toUpperCase();
        if (!user || !user.includes("@") || type !== "STORAGE") continue;
        const kib = Number.parseInt((cols[3] ?? "").trim(), 10);
        if (!Number.isFinite(kib) || kib < 0) continue;
        if (map.has(user)) {
          map.set(user, kib * 1024);
          matched++;
        }
      }
      if (matched > 0) {
        log.info({ matched, total: addresses.length }, "getAllMailboxUsageMap: usage from doveadm quota");
        return { map, available: true };
      }
    }
    log.info({ stdoutSnippet: out.stdout.slice(0, 300) }, "getAllMailboxUsageMap: doveadm yielded no usable rows, falling back to find");
  } catch (err) {
    log.info({ err }, "getAllMailboxUsageMap: doveadm exec failed, falling back to find");
  }

  // --- Fallback: find byte sweep over the maildir tree. ---
  const vmailBase = mailConfig.vmail.base;
  // Path structure: <vmailBase>/<domain>/<local>/Maildir/...
  // With find -printf '%s|%p\n' and awk -F'[|/]':
  //   $1 = size, $2 = "" (before leading /), then one field per path component.
  // domainField and localField depend on depth of vmailBase.
  const vmailDepth = vmailBase.replace(/^\/+/, "").split("/").filter(Boolean).length;
  const domainField = vmailDepth + 3; // +1 for size, +1 for empty leading field, +1 for first component
  const localField = domainField + 1;

  const awkProg = `{key=$${localField}"@"$${domainField}; sums[key]+=$1} END{for(k in sums) print k" "sums[k]}`;
  // Capture sudo's stderr so a privilege failure is detectable (don't 2>/dev/null it away).
  const findCmd = `sudo -n find ${quoteArg(vmailBase)} -mindepth 4 -type f -printf '%s|%p\\n' 2>&1 | awk -F'[|/]' '${awkProg}'`;

  try {
    const out = await executor.exec(findCmd);
    log.info({ vmailBase, vmailDepth, domainField, localField, stdoutSnippet: out.stdout.slice(0, 600), stderrSnippet: out.stderr?.slice(0, 300) }, "getAllMailboxUsageMap: find raw output");
    if (isSudoPrivilegeError(out.stdout) || isSudoPrivilegeError(out.stderr)) {
      return { map, available: false, reason: "sudo_password_required" };
    }
    for (const line of out.stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.includes("|")) continue; // skip raw "size|path" leftover lines
      const lastSpace = trimmed.lastIndexOf(" ");
      if (lastSpace < 1) continue;
      const addr = trimmed.slice(0, lastSpace).toLowerCase();
      const bytes = Number.parseInt(trimmed.slice(lastSpace + 1), 10);
      if (addr.includes("@") && Number.isFinite(bytes) && bytes >= 0 && map.has(addr)) {
        map.set(addr, bytes);
      }
    }
    return { map, available: true };
  } catch (err) {
    log.warn({ err }, "getAllMailboxUsageMap: bulk find failed");
    return { map, available: false };
  }
}

/**
 * Total size (MB) of the filesystem that holds the maildir tree. Used for the
 * "Uso total de almacenamiento" card so its limit reflects the real server
 * disk, not the sum of per-account quotas. `df -kP` needs no sudo.
 */
export async function getDiskTotalMb(executor: Executor): Promise<number | null> {
  try {
    const out = await executor.exec(`df -kP ${quoteArg(mailConfig.vmail.base)} 2>/dev/null | tail -1`);
    if (out.exitCode !== 0) return null;
    const cols = out.stdout.trim().split(/\s+/);
    // Filesystem 1024-blocks Used Available Capacity Mounted-on
    const blocks1k = Number.parseInt(cols[1] ?? "", 10);
    if (!Number.isFinite(blocks1k) || blocks1k <= 0) return null;
    return Math.round(blocks1k / 1024);
  } catch {
    return null;
  }
}

/**
 * Per-account quota limit (MB) from Dovecot's maildir-quota `maildirsize`
 * file (first line = `<limitBytes>S[,<limitCount>C]`). On this fleet the
 * Dovecot passwd file carries no quota directive and `doveadm quota` has no
 * quota plugin loaded, so `maildirsize` is the only per-user limit source.
 * One privileged exec for all accounts. Missing file / `0S` ⇒ no entry
 * (unlimited). Path: `<vmailBase>/<domain>/<user>/.../maildirsize`.
 */
export async function getMaildirQuotaLimitsMap(executor: Executor): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const base = mailConfig.vmail.base;
  const cmd =
    `sudo find ${quoteArg(base)} -mindepth 3 -maxdepth 4 -name maildirsize ` +
    `-exec sh -c 'echo "$1|$(head -n1 "$1" 2>/dev/null)"' _ {} \\; 2>/dev/null`;
  try {
    const res = await executor.exec(cmd);
    if (res.exitCode !== 0 || !res.stdout) return out;
    const basePrefix = base.replace(/\/+$/, "") + "/";
    for (const line of res.stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes("|")) continue;
      const sep = trimmed.indexOf("|");
      const filePath = trimmed.slice(0, sep);
      const firstLine = trimmed.slice(sep + 1).trim();
      const limitMatch = firstLine.match(/^(\d+)S/);
      if (!limitMatch) continue;
      const limitBytes = Number.parseInt(limitMatch[1] || "0", 10);
      if (!Number.isFinite(limitBytes) || limitBytes <= 0) continue; // 0S = unlimited
      if (!filePath.startsWith(basePrefix)) continue;
      const rel = filePath.slice(basePrefix.length).split("/").filter(Boolean);
      if (rel.length < 3) continue; // <domain>/<user>/.../maildirsize
      const domain = rel[0];
      const local = rel[1];
      if (!domain || !local) continue;
      out.set(`${local}@${domain}`.toLowerCase(), Math.max(1, Math.round(limitBytes / (1024 * 1024))));
    }
  } catch (err) {
    log.warn({ err }, "getMaildirQuotaLimitsMap: failed");
  }
  log.info(
    { found: out.size, sample: [...out.entries()].slice(0, 5).map(([a, m]) => `${a}=${m}MB`) },
    "getMaildirQuotaLimitsMap: per-account quota limits",
  );
  return out;
}
