// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * The ONE "resolve a host, screen every answer, pin the address" routine.
 *
 * Three copies of this algorithm existed (`net/host-policy.ts`,
 * `net/ssrf-guard.ts`, `preview-sandbox/broker.ts`) and only ONE of them pinned
 * the vetted address — the other two re-resolved before connecting, leaving a
 * DNS-rebinding (TOCTOU) window. This module is the single implementation:
 *
 *   1. IP literal   → screen it directly, no DNS, and pin it.
 *   2. hostname     → `dns.lookup(all)` ONCE, reject if **any** answer is in a
 *                     blocked range (an attacker must not be able to slip a
 *                     private A record past us by ordering), pin the first.
 *
 * It is deliberately message-free: callers pass an `onBlocked` handler that
 * throws THEIR error with THEIR wording (`SsrfBlockedError` for outbound URLs,
 * `HostPolicyError` for SSH targets), so no HTTP contract changes when a call
 * site migrates onto it. Both of those extend the same `SsrfBlockedError`
 * (400 / `SSRF_BLOCKED`) — see `./ssrf-error.ts`.
 *
 * `node:dns/promises` (not `node:dns`) is the import on purpose: it is the
 * specifier the existing unit tests mock.
 */

import { lookup } from "node:dns/promises";
import net from "node:net";
import { isBlockedAddress } from "./private-ranges.js";

/** Hostnames that are never legitimate targets, whatever DNS says. */
const FORBIDDEN_HOSTS_LITERAL: ReadonlySet<string> = new Set([
  "ip6-localhost",
  "ip6-loopback",
  "broadcasthost",
]);

/** Hostnames that always mean loopback — blocked unless `allowPrivate`. */
const LOOPBACK_HOSTS_LITERAL: ReadonlySet<string> = new Set(["localhost"]);

/** Cloud metadata endpoint — NEVER reachable, even with `allowPrivate`. */
export function isCloudMetadataAddress(ip: string): boolean {
  return ip === "169.254.169.254";
}

/**
 * `true` when `ip` must not be dialed. Delegates to the shared blocked-range
 * table (`private-ranges.ts`) and always blocks the cloud-metadata endpoint,
 * even when RFC1918/link-local are permitted (`allowPrivate`, LAN admin mode).
 */
export function isForbiddenAddress(ip: string, allowPrivate = false): boolean {
  if (isCloudMetadataAddress(ip)) return true;
  return isBlockedAddress(ip, { allowPrivate });
}

/** Why a host was rejected — the caller turns this into its own error. */
export type HostBlockReason =
  | { kind: "empty" }
  /** Literal hostname that is never allowed (`ip6-localhost`, …). */
  | { kind: "forbidden-literal"; host: string }
  /** Literal loopback hostname (`localhost`) with `allowPrivate` off. */
  | { kind: "loopback-literal"; host: string }
  /** The host IS an IP literal and that IP is in a blocked range. */
  | { kind: "blocked-literal-ip"; host: string; address: string }
  | { kind: "unresolvable"; host: string; cause: unknown }
  | { kind: "no-records"; host: string }
  /** DNS answered, but one of the answers is in a blocked range. */
  | { kind: "blocked-record"; host: string; address: string };

export interface ResolveAndPinOptions {
  /** Permit RFC1918/loopback/link-local (LAN admin). Default `false`. */
  allowPrivate?: boolean;
  /** Skip DNS entirely (validation deferred); `pinnedAddress` comes back null. */
  skipDns?: boolean;
  /** MUST throw. Receives the structured rejection reason. */
  onBlocked: (reason: HostBlockReason) => never;
}

export interface ResolveAndPinResult {
  /** Normalized (trimmed/lowercased) hostname that was screened. */
  host: string;
  /** Vetted IP to connect to — do NOT re-resolve. `null` only with `skipDns`. */
  pinnedAddress: string | null;
  /** IP family of `pinnedAddress` (4/6), or `null` with `skipDns`. */
  family: 4 | 6 | null;
}

/**
 * Screen `rawHost` and return the address a socket must connect to.
 *
 * @throws whatever `onBlocked` throws (it must throw).
 */
export async function resolveAndPinHost(
  rawHost: string,
  opts: ResolveAndPinOptions,
): Promise<ResolveAndPinResult> {
  // Explicit `never` annotation so TS treats every `onBlocked(...)` call as a
  // terminating statement (definite-assignment / narrowing below depend on it).
  const onBlocked: (reason: HostBlockReason) => never = opts.onBlocked;
  const allowPrivate = opts.allowPrivate ?? false;
  const host = String(rawHost ?? "").trim().toLowerCase();

  if (!host) onBlocked({ kind: "empty" });
  if (FORBIDDEN_HOSTS_LITERAL.has(host)) onBlocked({ kind: "forbidden-literal", host });
  if (LOOPBACK_HOSTS_LITERAL.has(host) && !allowPrivate) {
    onBlocked({ kind: "loopback-literal", host });
  }

  if (net.isIP(host) !== 0) {
    if (isForbiddenAddress(host, allowPrivate)) {
      onBlocked({ kind: "blocked-literal-ip", host, address: host });
    }
    return { host, pinnedAddress: host, family: net.isIP(host) === 6 ? 6 : 4 };
  }

  if (opts.skipDns) return { host, pinnedAddress: null, family: null };

  let records: Array<{ address: string; family: number }> = [];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch (err) {
    onBlocked({ kind: "unresolvable", host, cause: err });
  }
  if (!records || records.length === 0) onBlocked({ kind: "no-records", host });
  for (const rec of records) {
    if (isForbiddenAddress(rec.address, allowPrivate)) {
      onBlocked({ kind: "blocked-record", host, address: rec.address });
    }
  }
  // Pin the FIRST answer — every record was screened above, so any of them is
  // safe and pinning removes the second lookup an attacker could rebind.
  const first = records[0]!;
  return {
    host,
    pinnedAddress: first.address,
    family: first.family === 6 || net.isIP(first.address) === 6 ? 6 : 4,
  };
}
