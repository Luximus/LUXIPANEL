/**
 * Cloudflare published IP ranges — fetched from the PUBLIC endpoints
 * https://www.cloudflare.com/ips-v4 and /ips-v6 (text/plain, one CIDR per
 * line). No auth/token involved: this service does NOT depend on the
 * cloudflare module (modules never import each other).
 *
 * Every line is validated against a strict CIDR regex (IPv4 + IPv6); lines
 * that don't validate are silently discarded. If fewer than 10 IPv4 ranges
 * survive validation the response is considered suspect (Cloudflare publishes
 * ~15 IPv4 ranges) and an AppError 502 is thrown — we never push a truncated
 * or tampered allowlist into UFW.
 */

import { AppError } from "../../../shared/errors/index.js";
import { fetchWithTimeout } from "../../../shared/http/fetch-timeout.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { CloudflareIpRanges } from "../models/index.js";

const log = createModuleLogger("firewall-cloudflare-ips");

const IPS_V4_URL = "https://www.cloudflare.com/ips-v4";
const IPS_V6_URL = "https://www.cloudflare.com/ips-v6";
const CLOUDFLARE_IPS_FETCH_TIMEOUT_MS = 10_000;
/** Cloudflare publishes ~15 IPv4 ranges; fewer than this is suspect. */
const MIN_IPV4_RANGES = 10;

// ── strict CIDR validation ────────────────────────────────────────────────

const IPV4_OCTET = "(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])";
const IPV4_CIDR_RE = new RegExp(
  `^(?:${IPV4_OCTET}\\.){3}${IPV4_OCTET}/(?:3[0-2]|[12]?[0-9])$`,
);

const SEG = "[0-9A-Fa-f]{1,4}";
const IPV6_ADDR =
  `(?:(?:${SEG}:){7}${SEG}` + //          full 8 groups
  `|(?:${SEG}:){1,7}:` + //               a:: …
  `|(?:${SEG}:){1,6}:${SEG}` + //         a::b
  `|(?:${SEG}:){1,5}(?::${SEG}){1,2}` +
  `|(?:${SEG}:){1,4}(?::${SEG}){1,3}` +
  `|(?:${SEG}:){1,3}(?::${SEG}){1,4}` +
  `|(?:${SEG}:){1,2}(?::${SEG}){1,5}` +
  `|${SEG}:(?::${SEG}){1,6}` +
  `|:(?::${SEG}){1,7}` +
  `|::)`; //                              unspecified
const IPV6_CIDR_RE = new RegExp(
  `^${IPV6_ADDR}/(?:12[0-8]|1[01][0-9]|[1-9]?[0-9])$`,
);

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(
      url,
      { headers: { accept: "text/plain" } },
      CLOUDFLARE_IPS_FETCH_TIMEOUT_MS,
    );
    if (!res.ok) {
      throw new AppError(
        `Cloudflare respondió ${res.status} al pedir ${url}`,
        502,
        "CLOUDFLARE_IPS_FETCH_FAILED",
        { url, status: res.status },
      );
    }
    return await res.text();
  } catch (err) {
    if (err instanceof AppError) throw err;
    const reason = errMessage(err);
    throw new AppError(
      `No se pudieron obtener los rangos de IP de Cloudflare (${url}): ${reason}`,
      502,
      "CLOUDFLARE_IPS_FETCH_FAILED",
      { url },
    );
  }
}

function parseCidrs(raw: string, re: RegExp): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && re.test(line));
}

export const cloudflareIpsService = {
  /**
   * Fetch + validate Cloudflare's published IPv4/IPv6 CIDR ranges.
   * Throws AppError 502 on network failure, non-2xx, timeout (10s) or a
   * suspect response (< MIN_IPV4_RANGES valid IPv4 CIDRs).
   */
  async fetchRanges(): Promise<CloudflareIpRanges> {
    const [v4Raw, v6Raw] = await Promise.all([
      fetchText(IPS_V4_URL),
      fetchText(IPS_V6_URL),
    ]);

    const v4 = parseCidrs(v4Raw, IPV4_CIDR_RE);
    const v6 = parseCidrs(v6Raw, IPV6_CIDR_RE);

    if (v4.length < MIN_IPV4_RANGES) {
      throw new AppError(
        `Respuesta sospechosa de ${IPS_V4_URL}: solo ${v4.length} rangos IPv4 válidos (se esperaban al menos ${MIN_IPV4_RANGES})`,
        502,
        "CLOUDFLARE_IPS_SUSPECT",
        { v4Count: v4.length, v6Count: v6.length },
      );
    }

    log.info({ v4: v4.length, v6: v6.length }, "Cloudflare IP ranges fetched");
    return { v4, v6 };
  },
};
