// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared helpers for mail-account controllers — these read the canonical
 * account state directly from the connected server (Postfix vmailbox +
 * Dovecot users). No DB.
 */

import { mailConfig } from "../../../config/mail.js";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import { readPrivilegedFile } from "../../../shared/system/privileged-file-io.js";
import { ServiceUnavailableError } from "../../../shared/errors/index.js";
import { normalizeAddress } from "./accounts/accounts.util.js";

export type ServerAccount = {
  address: string;
  domain: string;
  passwordHash: string;
  quotaMb: number;
  enabled: boolean;
  incomingMode: "allow" | "suspend";
  outgoingMode: "allow" | "suspend" | "hold";
  loginMode: "allow" | "suspend";
  plusAddressingAutoFolder: boolean;
  hasExplicitSettings: boolean;
};

/**
 * A DISABLED mail account keeps its real Dovecot password hash on disk so it
 * can be re-enabled later without forcing a password reset, but the hash is
 * rendered non-matching by a leading "!" (Dovecot can't parse "!{SCHEME}…" as a
 * password scheme, so auth always fails). A bare "!" means "disabled, no
 * recoverable password". These helpers convert between the on-disk form and the
 * in-memory {realHash, loginEnabled} pair so disabling never destroys the hash.
 */
const DISABLE_MARKER = "!";

export function decodeDovecotHash(raw: string | undefined | null): { realHash: string; loginEnabled: boolean } {
  const value = (raw ?? "").trim();
  if (!value) return { realHash: "!", loginEnabled: false };
  if (value.startsWith(DISABLE_MARKER)) {
    const inner = value.slice(DISABLE_MARKER.length).trim();
    return { realHash: inner.length > 0 ? inner : "!", loginEnabled: false };
  }
  return { realHash: value, loginEnabled: true };
}

export function encodeDovecotHash(realHash: string | undefined | null, loginEnabled: boolean): string {
  // Strip any stray leading marker(s) first so we never double-encode ("!!…").
  let real = (realHash ?? "").trim();
  while (real.startsWith(DISABLE_MARKER)) real = real.slice(DISABLE_MARKER.length).trim();
  if (loginEnabled) return real.length > 0 ? real : "!";
  // Disabled: hide the real hash behind the marker so re-enable can restore it.
  return real.length > 0 ? DISABLE_MARKER + real : "!";
}

export function fnv1aId(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Math.imul: exact low-32-bit multiply. Plain `hash * 16777619` overflows
    // JS's 2^53 safe-integer range BEFORE `>>> 0`, so it silently produced the
    // WRONG hash — disagreeing with the Python collector's fnv1a (which uses
    // exact arithmetic). Since the accounts DataTable is served from the cache
    // (Python ids), every resolve-by-id (inbox, edit/delete, forwards) missed
    // → 404. Math.imul matches Python's `(h * 16777619) & 0xFFFFFFFF`.
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash & 0x7fffffff;
}

/**
 * Parse the per-account quota (in MB) from a Dovecot passwd-file line.
 *
 * The panel writes `…:userdb_quota_rule=*:storage=<MB>M`, but accounts may
 * also have been provisioned by other tooling, so support the common forms:
 *   - `storage=<n>[K|M|G|T]`  (no unit ⇒ Dovecot counts storage in KiB)
 *   - `bytes=<n>`             (raw bytes)
 *   - `quota=<n>[unit]`       (alias some tools emit)
 * `0`/`unlimited`/`none` ⇒ 0 (unlimited). Falls back to 1024 only when no
 * quota directive is present at all.
 */
function parseQuotaMbFromDovecotLine(line: string): number {
  if (/(?:storage|bytes|quota(?:_rule\d*)?)=(?:0\b|none|unlimited)/i.test(line)) return 0;

  const bytesMatch = line.match(/bytes=(\d+)/i);
  if (bytesMatch) {
    const bytes = Number.parseInt(bytesMatch[1] || "0", 10);
    if (Number.isFinite(bytes) && bytes > 0) return Math.max(1, Math.round(bytes / (1024 * 1024)));
  }

  const storageMatch = line.match(/storage=(\d+)\s*([kmgt])?/i);
  if (storageMatch) {
    const n = Number.parseInt(storageMatch[1] || "0", 10);
    if (Number.isFinite(n) && n > 0) {
      const unit = (storageMatch[2] || "").toLowerCase();
      switch (unit) {
        case "t": return n * 1024 * 1024;
        case "g": return n * 1024;
        case "m": return n;
        case "k": return Math.max(1, Math.round(n / 1024));
        default:  return Math.max(1, Math.round(n / 1024)); // unitless storage = KiB
      }
    }
  }
  // No quota directive in the passwd line → unknown (0 = treat as
  // unlimited). NEVER fabricate a uniform 1024 here: that made every
  // account show a bogus "1.00 GB". The real limit (if any) comes from
  // Dovecot's maildirsize, resolved in the controller.
  return 0;
}

function parseDovecotUsers(content: string): Map<string, { passwordHash: string; quotaMb: number }> {
  const out = new Map<string, { passwordHash: string; quotaMb: number }>();
  for (const raw of content.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const firstColon = trimmed.indexOf(":");
    if (firstColon < 1) continue;
    const address = normalizeAddress(trimmed.slice(0, firstColon));
    if (!address) continue;
    const rest = trimmed.slice(firstColon + 1);
    const secondColon = rest.indexOf(":");
    const passwordHash = (secondColon >= 0 ? rest.slice(0, secondColon) : rest).trim() || "!";
    const quotaMb = parseQuotaMbFromDovecotLine(trimmed);
    out.set(address, { passwordHash, quotaMb });
  }
  return out;
}

function parsePostfixVmailbox(content: string): string[] {
  const out = new Set<string>();
  for (const raw of content.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const candidate = trimmed.split(/\s+/)[0] ?? "";
    const address = normalizeAddress(candidate);
    if (address) out.add(address);
  }
  return [...out];
}

type SidecarSettings = {
  incomingMode: "allow" | "suspend";
  outgoingMode: "allow" | "suspend" | "hold";
  loginMode: "allow" | "suspend";
  plusAddressingAutoFolder: boolean;
  hasExplicitSettings: boolean;
};

export function normalizeIncomingMode(value: unknown): "allow" | "suspend" {
  return value === "suspend" ? "suspend" : "allow";
}

export function normalizeOutgoingMode(value: unknown): "allow" | "suspend" | "hold" {
  return value === "suspend" || value === "hold" ? value : "allow";
}

export function normalizeLoginMode(value: unknown): "allow" | "suspend" {
  return value === "suspend" ? "suspend" : "allow";
}

async function readAccountSettingsFromSidecars(executor: Executor): Promise<Map<string, SidecarSettings>> {
  const out = new Map<string, SidecarSettings>();
  const base = mailConfig.vmail.base;
  const basePrefix = base.replace(/\/+$/, "") + "/";
  const cmd =
    `sudo find ${quoteArg(base)} -mindepth 3 -maxdepth 3 -name luxipanel-mail.json ` +
    `-exec sh -c 'echo "$1|$(base64 -w0 "$1" 2>/dev/null)"' _ {} \\; 2>/dev/null`;
  try {
    const res = await executor.exec(cmd);
    if (res.exitCode !== 0 || !res.stdout) return out;
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
      let parsed: { settings?: Record<string, unknown> };
      try {
        parsed = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
      } catch {
        continue;
      }
      const raw = parsed.settings;
      if (!raw || typeof raw !== "object") continue;
      out.set(address, {
        incomingMode: normalizeIncomingMode(raw.incomingMode),
        outgoingMode: normalizeOutgoingMode(raw.outgoingMode),
        loginMode: normalizeLoginMode(raw.loginMode),
        plusAddressingAutoFolder: raw.plusAddressingAutoFolder !== false,
        hasExplicitSettings: true,
      });
    }
  } catch {
    /* best-effort */
  }
  return out;
}

/**
 * Read a canonical mail-state file from the connected server.
 *
 * SECURITY / SAFETY (audit §5): an older version returned `""` on ANY failure
 * (SFTP error, permission-denied `cat`, sudo hiccup, SSH blip), which
 * `readAccountsFromServer` turned into `[]`. Because create/update/delete
 * REGENERATE the whole `/etc/dovecot/users` + `/etc/postfix/vmailbox` from that
 * list, a single transient read failure during a write silently wiped EVERY
 * mailbox on the box. The three outcomes are now produced by the shared
 * `readPrivilegedFile` ladder and mapped here to this module's legacy shape:
 *   - definitive read (SFTP ok, or `cat`/`sudo cat` exit 0) → content,
 *   - definitely-absent file → `""` (fresh server, first account),
 *   - inconclusive (perm denied, transport error) → `null`, so callers fail
 *     closed instead of destroying state.
 */
async function readServerFile(executor: Executor, filePath: string): Promise<string | null> {
  const res = await readPrivilegedFile(executor, filePath, {
    // SFTP first (works when the SSH user can read the file directly).
    sftpFirst: true,
    // Plain `sudo` (not `-n`): the executor boundary injects `-S` + the stored
    // passphrase for this module's commands.
    sudo: "sudo",
  });
  if (res.status === "read") return res.content;
  return res.status === "missing" ? "" : null;
}

export async function readAccountsFromServer(executor: Executor): Promise<ServerAccount[]> {
  const vmailboxContent = await readServerFile(executor, mailConfig.postfix.vmailbox);
  const usersContent = await readServerFile(executor, mailConfig.dovecot.usersFile);
  // Fail closed: if EITHER canonical file could not be read conclusively, abort.
  // Returning an empty/partial list here would let create/update/delete
  // regenerate the postfix/dovecot files from an incomplete snapshot and wipe
  // every mailbox that momentarily "disappeared".
  if (vmailboxContent === null || usersContent === null) {
    throw new ServiceUnavailableError(
      "No se pudo leer el estado de las cuentas de correo del servidor; operación cancelada para no perder datos.",
    );
  }
  const vmailboxAddresses = parsePostfixVmailbox(vmailboxContent);
  const usersByAddress = parseDovecotUsers(usersContent);
  const sidecarSettingsByAddress = await readAccountSettingsFromSidecars(executor);

  // The account registry is the UNION of both files. A DISABLED account is
  // intentionally removed from the Postfix vmailbox (so Postfix rejects
  // incoming mail) but stays in the Dovecot users file with a "!" hash. If we
  // sourced addresses from the vmailbox alone, disabling an account would make
  // it VANISH from the list instead of showing as disabled — it must remain
  // visible/manageable so it can be re-enabled.
  const addresses = [...new Set([...vmailboxAddresses, ...usersByAddress.keys()])];
  if (addresses.length === 0) return [];

  const out: ServerAccount[] = [];
  for (const address of addresses) {
    const [, domain] = address.split("@");
    if (!domain) continue;
    const userInfo = usersByAddress.get(address);
    const decoded = decodeDovecotHash(userInfo?.passwordHash);
    const quotaMb = userInfo?.quotaMb ?? 0; // 0 = unlimited/unknown (real limit resolved via maildirsize)
    const settings = sidecarSettingsByAddress.get(address);
    out.push({
      address,
      domain,
      // In-memory passwordHash is always the REAL hash (marker stripped) so the
      // update handler can re-apply it verbatim when re-enabling.
      passwordHash: decoded.realHash,
      quotaMb,
      enabled: userInfo ? decoded.loginEnabled : true,
      incomingMode: settings?.incomingMode ?? (decoded.loginEnabled ? "allow" : "suspend"),
      outgoingMode: settings?.outgoingMode ?? "allow",
      loginMode: settings?.loginMode ?? (decoded.loginEnabled ? "allow" : "suspend"),
      plusAddressingAutoFolder: settings?.plusAddressingAutoFolder ?? true,
      hasExplicitSettings: settings?.hasExplicitSettings ?? false,
    });
  }
  return out;
}
