// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Private/reserved IP range SSOT — single source of truth for "is this
 * address loopback / private / link-local / reserved", consumed by the
 * SSRF guard, the host policy module, and the preview-sandbox broker.
 *
 * Consumers used to inline their own copies of these ranges; the broker
 * version was strictly weaker (missing IETF 192.0.0.0/24, benchmarking
 * 198.18.0.0/15, multicast 224/4, reserved 240/4), which was a real
 * security smell
 * (`shared/net/ssrf-guard.ts ↔ host-policy.ts`).
 *
 * Public API:
 *   - `isBlockedAddress(ip, opts?)` — true when the literal must not be dialed
 *   - `BlockOptions` — `{ allowPrivate?: boolean }` toggles the strictness
 *
 * The historical semantics are preserved:
 *   - ssrf-guard defaults to strict (private ranges blocked)
 *   - host-policy supports `allowPrivate` for legitimate LAN targets
 *   - preview-sandbox broker treats non-IP literals as blocked (must resolve first)
 */

import net from "node:net";

// ── IPv4 ────────────────────────────────────────────────────────────────────

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    n = (n << 8) | octet;
  }
  return n >>> 0;
}

/** [network base, prefix length] CIDRs treated as non-public for IPv4. */
const BLOCKED_V4: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8], // "this" network / unspecified
  ["10.0.0.0", 8], // RFC1918
  ["100.64.0.0", 10], // CGNAT (RFC6598)
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local
  ["172.16.0.0", 12], // RFC1918
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.168.0.0", 16], // RFC1918
  ["198.18.0.0", 15], // benchmarking
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved / broadcast
];

function isBlockedIpv4Int(ipInt: number): boolean {
  for (const [base, bits] of BLOCKED_V4) {
    const baseInt = ipv4ToInt(base)!;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((ipInt & mask) === (baseInt & mask)) return true;
  }
  return false;
}

// ── IPv6 ────────────────────────────────────────────────────────────────────

function expandIpv6(raw: string): number[] | null {
  let s = raw.toLowerCase().split("%")[0]!; // strip zone id
  // Fold a trailing embedded IPv4 (::ffff:1.2.3.4) into two hextets.
  const v4 = s.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4) {
    const v4int = ipv4ToInt(v4[1]!);
    if (v4int === null) return null;
    const hi = (v4int >>> 16) & 0xffff;
    const lo = v4int & 0xffff;
    s = s.slice(0, v4.index) + hi.toString(16) + ":" + lo.toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(":") : []) : null;
  let groups: string[];
  if (tail === null) {
    groups = head;
  } else {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  }
  if (groups.length !== 8) return null;
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out;
}

function isBlockedIpv6(ip: string): boolean {
  const g = expandIpv6(ip);
  if (g === null) return true; // unparseable → fail closed
  // Unspecified (::) and loopback (::1)
  if (g.every((x) => x === 0)) return true;
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true;
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d): defer to v4.
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
    const v4int = ((g[6]! << 16) | g[7]!) >>> 0;
    return isBlockedIpv4Int(v4int);
  }
  const firstByte = g[0]! >>> 8;
  if ((firstByte & 0xfe) === 0xfc) return true; // unique-local fc00::/7
  if ((g[0]! & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  return false;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface BlockOptions {
  /**
   * When true, allow private/link-local ranges (RFC1918, loopback, etc.)
   * to be dialed. Reserved-but-not-private ranges (multicast 224/4, IETF
   * 192.0.0.0/24, benchmarking 198.18.0.0/15, broadcast 240/4) remain
   * blocked — they are never legitimate dial targets.
   */
  allowPrivate?: boolean;
}

/** Private-only CIDR set for `allowPrivate` mode. */
const PRIVATE_V4: ReadonlyArray<readonly [string, number]> = [
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
];

function isPrivateIpv4Int(ipInt: number): boolean {
  for (const [base, bits] of PRIVATE_V4) {
    const baseInt = ipv4ToInt(base)!;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((ipInt & mask) === (baseInt & mask)) return true;
  }
  return false;
}

function isPrivateIpv6(g: number[]): boolean {
  // IPv4-mapped (::ffff:a.b.c.d) / IPv4-compatible (::a.b.c.d): defer to the v4
  // classifier so e.g. ::ffff:192.168.1.10 counts as private under allowPrivate
  // (otherwise it would be blocked despite SERVERS_ALLOW_PRIVATE=true).
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
    const v4int = ((g[6]! << 16) | g[7]!) >>> 0;
    return isPrivateIpv4Int(v4int);
  }
  const firstByte = g[0]! >>> 8;
  if ((firstByte & 0xfe) === 0xfc) return true; // unique-local fc00::/7
  if ((g[0]! & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  return false;
}

/**
 * Return true when `ip` (a literal, v4 or v6) must NOT be dialed from the
 * panel. Defaults to strict (every range in BLOCKED_V4 + IPv6 equivalents).
 * With `opts.allowPrivate = true`, RFC1918/link-local/loopback are allowed
 * but the always-blocked reserved ranges (multicast, IETF, benchmarking,
 * broadcast, 0.0.0.0) still fail.
 */
export function isBlockedAddress(ip: string, opts: BlockOptions = {}): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    const n = ipv4ToInt(ip);
    if (n === null) return true;
    if (opts.allowPrivate) return !isPrivateIpv4Int(n) && isBlockedIpv4Int(n);
    return isBlockedIpv4Int(n);
  }
  if (family === 6) {
    const g = expandIpv6(ip);
    if (g === null) return true;
    if (opts.allowPrivate) return !isPrivateIpv6(g) && isBlockedIpv6(ip);
    return isBlockedIpv6(ip);
  }
  return true; // not an IP literal → fail closed
}