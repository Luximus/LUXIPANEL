/**
 * Canonical request hash — APP side.
 *
 * This file's `buildCanonicalRequestString` core is IDENTICAL (byte-for-byte
 * output) to the backend's copy at
 * backend/src/modules/play-integrity/canonical-request-hash.ts. The ONLY
 * difference is the hashing call (expo-crypto here, node:crypto on the server).
 *
 * The hash binds a Play Integrity token to a specific (action, payload): the
 * app computes it, requests an integrity token over it, and the backend
 * recomputes it from the REAL request body and compares verdicts. The client
 * never sends the hash — the server is the source of truth for it.
 *
 * Rules (must match the backend exactly):
 *   - recursively sort object keys (ascending, default Array.sort)
 *   - preserve array order
 *   - drop `undefined` values
 *   - SHA-256 over the UTF-8 string
 *   - HEX lowercase output
 */
import * as Crypto from "expo-crypto";

export type CanonicalRequest = { v: 1; action: string; payload: unknown };

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = canonicalize(v);
  }
  return out;
}

export function buildCanonicalRequestString(action: string, payload: unknown): string {
  return JSON.stringify(canonicalize({ v: 1, action, payload }));
}

/**
 * Compute the SHA-256 (hex, lowercase) of the canonical request string. Async
 * because expo-crypto's digest is async on-device. Produces the identical hex
 * string to the backend `computeRequestHash` for the same (action, payload).
 */
export async function computeRequestHash(action: string, payload: unknown): Promise<string> {
  const s = buildCanonicalRequestString(action, payload);
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}
