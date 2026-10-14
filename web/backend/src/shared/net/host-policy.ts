// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Host policy / SSRF guard for standalone multi-node SSH targets.
 *
 * Adapted from LP-LICENSE-SERVER's `agents/services/host-policy.service.ts`.
 * Every target host the operator registers is resolved (A/AAAA) and screened
 * BEFORE a TCP/SSH connection is opened, so an attacker cannot point a public
 * DNS record at 127.0.0.1 (or a cloud metadata endpoint) to pivot into the
 * panel host's own network.
 *
 * RELAXATION (standalone LAN admin): when `env.SERVERS_ALLOW_PRIVATE` is true
 * — a single-node box that legitimately manages servers on its own LAN — the
 * RFC1918 / loopback / link-local / CGNAT ranges are PERMITTED. The
 * always-forbidden set (cloud metadata `169.254.169.254`, multicast/reserved,
 * malformed) stays blocked regardless. Callers may also override per-call via
 * `HostPolicyOptions.allowPrivate`.
 *
 * The blocked-range table lives in `./private-ranges.ts` and the
 * resolve→screen→pin ALGORITHM in `./resolve-host.ts`, both shared with the
 * outbound-URL guard (`./ssrf-guard.ts`) and the preview-sandbox broker. This
 * file only owns the SSH-target-specific wording of the rejection.
 */

import { env } from "../../config/env.js";
import { HostPolicyError } from "./ssrf-error.js";
import { errMessage } from "../utils/err-message.js";
import { resolveAndPinHost, type HostBlockReason } from "./resolve-host.js";

export { HostPolicyError } from "./ssrf-error.js";

export type HostPolicyOptions = {
  /** Skip DNS resolution (validation deferred to a later re-check). */
  skipDns?: boolean;
  /** Override `env.SERVERS_ALLOW_PRIVATE` for this call. */
  allowPrivate?: boolean;
};

export type HostPolicyResult = {
  /** Validated IP literal to connect to (pin this, do NOT re-resolve), or null when skipDns. */
  pinnedAddress: string | null;
};

function resolveAllowPrivate(opts: HostPolicyOptions): boolean {
  return typeof opts.allowPrivate === "boolean" ? opts.allowPrivate : env.SERVERS_ALLOW_PRIVATE;
}

/** Map the shared rejection reason to this module's historic messages. */
function throwHostPolicy(reason: HostBlockReason): never {
  switch (reason.kind) {
    case "empty":
      throw new HostPolicyError("Hostname is required");
    case "forbidden-literal":
      throw new HostPolicyError("Internal/loopback addresses are not allowed as SSH targets");
    case "loopback-literal":
      throw new HostPolicyError("Loopback addresses are not allowed as SSH targets");
    case "blocked-literal-ip":
      throw new HostPolicyError("This IP address is not allowed as an SSH target");
    case "unresolvable":
      throw new HostPolicyError(`Could not resolve hostname: ${errMessage(reason.cause)}`);
    case "no-records":
      throw new HostPolicyError("Hostname did not resolve to any address");
    case "blocked-record":
      throw new HostPolicyError(`Resolved address ${reason.address} is in a forbidden range`);
  }
}

/**
 * Reject if `host` resolves into a forbidden range. Returns the validated IP
 * literal in `pinnedAddress`; callers opening a socket MUST connect to that
 * pinned IP rather than re-resolving the hostname (defeats DNS rebinding).
 * When `host` is an IP literal, that literal is returned. When `skipDns` is
 * set, `pinnedAddress` is null.
 */
export async function assertSafeTargetHost(
  host: string,
  opts: HostPolicyOptions = {},
): Promise<HostPolicyResult> {
  const { pinnedAddress } = await resolveAndPinHost(host, {
    allowPrivate: resolveAllowPrivate(opts),
    skipDns: opts.skipDns,
    onBlocked: throwHostPolicy,
  });
  return { pinnedAddress };
}
