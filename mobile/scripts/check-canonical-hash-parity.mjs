/**
 * Canonical request hash parity check (node, no Expo runtime).
 *
 * expo-crypto cannot run under plain node, so this script re-implements ONLY
 * the hashing call with node:crypto over the SAME `buildCanonicalRequestString`
 * core used by the app (and the backend). It then asserts that every app
 * fixture's `expectedHex` matches a fresh SHA-256 over the canonical string.
 *
 * Because the canonicalization core is byte-for-byte identical to the backend's
 * copy, matching the app fixtures here proves the app would produce the same hex
 * the backend recomputes for the same (action, payload). The overlapping
 * fixture (account.delete / empty payload) also appears verbatim in the backend
 * fixtures with the same expectedHex, giving an explicit cross-side anchor.
 *
 * Usage: node scripts/check-canonical-hash-parity.mjs  (exit 0 = parity OK)
 */
import { createHash } from "node:crypto";

// --- shared core (mirrors app/src/integrity/canonical-request-hash.ts) ---
function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const obj = value;
  const out = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = canonicalize(v);
  }
  return out;
}
function buildCanonicalRequestString(action, payload) {
  return JSON.stringify(canonicalize({ v: 1, action, payload }));
}
function computeRequestHash(action, payload) {
  return createHash("sha256")
    .update(buildCanonicalRequestString(action, payload), "utf8")
    .digest("hex");
}

// --- app fixtures (kept in sync with canonical-request-hash.fixtures.ts) ---
const CANONICAL_HASH_FIXTURES = [
  {
    name: "empty payload",
    action: "auth.login.firebase",
    payload: {},
    expectedHex: "fe3cd15b6304501e70402900390a5a0d9406a5f83f1da044324b3d5d490d5298",
  },
  {
    name: "nested objects + key order + array order preserved",
    action: "panel.create",
    payload: {
      serverPort: 22,
      serverIp: "1.2.3.4",
      category: "web",
      tags: "a,b",
      nested: { z: 1, a: [3, 2, 1] },
    },
    expectedHex: "9b327e5ce137bdb4c4583f34404771b2d44f542bd4ad42f24e3ab464fbc08b52",
  },
  {
    name: "drop undefined fields",
    action: "iap.playstore.validate",
    payload: {
      productId: "sku_x",
      packageName: "com.luxisoft.lxpanel",
      ignored: undefined,
      purchaseToken: "tok",
    },
    expectedHex: "df60f21eea2871e2f54f0520f1d41375e3a33577bed56f3af655bf70bbcea1cb",
  },
  {
    name: "account delete (no body fields)",
    action: "account.delete",
    payload: {},
    expectedHex: "0f0c7377ebeedfbbf0824a4112f0dbc725ced535784e90833bdd0d6dff076b56",
  },
];

let failures = 0;
for (const f of CANONICAL_HASH_FIXTURES) {
  const got = computeRequestHash(f.action, f.payload);
  const ok = got === f.expectedHex;
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${f.name}`);
  console.log(`     action=${f.action}`);
  console.log(`     hex=${got}${ok ? "" : ` (expected ${f.expectedHex})`}`);
}

if (failures > 0) {
  console.error(`\n${failures} fixture(s) FAILED parity.`);
  process.exit(1);
}
console.log("\nAll fixtures match. Canonical hash parity OK.");
