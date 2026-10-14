// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Minimal IP allowlist matcher for gateway webhooks. Supports a comma-separated
 * list of exact IPs, IPv4 CIDR subnets AND IPv6 CIDR subnets (the "IP
 * restrictions" field of the Make.com-style create form). An empty list means
 * "no restriction" (allow all).
 */

/** Normalise common IPv4-in-IPv6 / proxy forms to a bare IPv4 when possible. */
function normalize(ip: string): string {
  let s = (ip ?? "").trim();
  if (s.startsWith("::ffff:")) s = s.slice("::ffff:".length);
  // Strip a :port suffix only for IPv4 "a.b.c.d:port" forms.
  const m = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(s);
  if (m) s = m[1]!;
  return s;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = (n << 8) | o;
  }
  return n >>> 0;
}

/** Parse an IPv6 address to a 128-bit BigInt (handles `::` and IPv4 tails), or
 *  null when it isn't a valid IPv6 literal. */
function ipv6ToBigInt(ip: string): bigint | null {
  let s = ip.trim();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  if (!s.includes(":")) return null;

  const halves = s.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string): string[] => (part.length ? part.split(":") : []);

  // Expand a trailing embedded IPv4 (e.g. `::ffff:1.2.3.4`) into two hextets.
  const expandV4 = (groups: string[]): string[] | null => {
    if (groups.length === 0) return groups;
    const last = groups[groups.length - 1]!;
    if (!last.includes(".")) return groups;
    const v4 = ipv4ToInt(last);
    if (v4 === null) return null;
    return [...groups.slice(0, -1), ((v4 >>> 16) & 0xffff).toString(16), (v4 & 0xffff).toString(16)];
  };

  const head = expandV4(toGroups(halves[0] ?? ""));
  const tail = expandV4(halves.length === 2 ? toGroups(halves[1] ?? "") : []);
  if (head === null || tail === null) return null;

  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - (head.length + tail.length);
    if (missing < 0) return null;
    groups = [...head, ...new Array<string>(missing).fill("0"), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;

  let n = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

function matchOne(rule: string, ip: string): boolean {
  const r = rule.trim();
  if (!r) return false;
  if (r.includes("/")) {
    const [net, bitsStr] = r.split("/");
    const bits = Number(bitsStr);
    const netStr = (net ?? "").trim();
    // ── IPv6 CIDR ── (previously any v6 CIDR fell through to a false, silently
    // blocking every request the rule was meant to allow).
    if (netStr.includes(":")) {
      const netInt = ipv6ToBigInt(netStr);
      const ipInt = ipv6ToBigInt(ip);
      if (netInt === null || ipInt === null || !Number.isInteger(bits) || bits < 0 || bits > 128) {
        return false;
      }
      if (bits === 0) return true;
      const mask = ((1n << BigInt(bits)) - 1n) << BigInt(128 - bits);
      return (netInt & mask) === (ipInt & mask);
    }
    // ── IPv4 CIDR ──
    const netInt = ipv4ToInt(normalize(netStr));
    const ipInt = ipv4ToInt(ip);
    if (netInt === null || ipInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
      return false;
    }
    if (bits === 0) return true;
    const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
    return (netInt & mask) === (ipInt & mask);
  }
  // Exact match: bare string compare, then a canonical IPv6 compare so
  // `::1` == `0:0:...:1` etc.
  if (normalize(r) === ip) return true;
  const a = ipv6ToBigInt(r);
  const b = ipv6ToBigInt(ip);
  return a !== null && b !== null && a === b;
}

/** True when `clientIp` is allowed by the comma-separated `allowlist`. */
export function ipAllowed(allowlist: string, clientIp: string): boolean {
  const list = (allowlist ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return true;
  const ip = normalize(clientIp ?? "");
  return list.some((rule) => matchOne(rule, ip));
}
