/**
 * Shared parity fixtures for the canonical request hash.
 *
 * The SAME fixture set (identical `action`, `payload` and `expectedHex`) must
 * live on both sides so app and backend can each assert their
 * `computeRequestHash` produces exactly `expectedHex`. If the two
 * implementations ever diverge, one of them fails its assertion.
 *
 * `expectedHex` = SHA-256 (hex, lowercase) of
 * `buildCanonicalRequestString(action, payload)` computed with the shared core.
 * They exercise the canonicalization rules: sorted object keys (top-level AND
 * nested), preserved array order, and dropped `undefined`.
 */
export type HashFixture = {
  name: string;
  action: string;
  payload: unknown;
  expectedHex: string;
};

export const CANONICAL_HASH_FIXTURES: HashFixture[] = [
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
