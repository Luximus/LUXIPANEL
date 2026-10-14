import { describe, it, expect } from "vitest";
import { buildCanonicalRequestString, computeRequestHash } from "./canonical-request-hash";
import { CANONICAL_HASH_FIXTURES } from "./canonical-request-hash.fixtures";

describe("buildCanonicalRequestString (canonicalización)", () => {
  it("ordena claves de objeto (top-level y anidadas)", () => {
    const a = buildCanonicalRequestString("x", { b: 1, a: { d: 2, c: 3 } });
    const b = buildCanonicalRequestString("x", { a: { c: 3, d: 2 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"action":"x","payload":{"a":{"c":3,"d":2},"b":1},"v":1}');
  });

  it("preserva el orden de los arrays", () => {
    const s = buildCanonicalRequestString("x", { arr: [3, 1, 2] });
    expect(s).toContain('"arr":[3,1,2]');
  });

  it("descarta claves undefined", () => {
    const s = buildCanonicalRequestString("x", { a: 1, b: undefined });
    expect(s).toBe('{"action":"x","payload":{"a":1},"v":1}');
  });
});

describe("computeRequestHash (paridad con fixtures backend)", () => {
  for (const fx of CANONICAL_HASH_FIXTURES) {
    it(`coincide con expectedHex: ${fx.name}`, async () => {
      const hex = await computeRequestHash(fx.action, fx.payload);
      expect(hex).toBe(fx.expectedHex);
    });
  }
});
