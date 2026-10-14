// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import { decodeDovecotHash, encodeDovecotHash } from "./accounts.helpers.js";

const HASH = "{SHA512-CRYPT}$6$abc$def";

describe("dovecot disabled-hash encoding", () => {
  it("enabled account stores the real hash verbatim", () => {
    expect(encodeDovecotHash(HASH, true)).toBe(HASH);
    expect(decodeDovecotHash(HASH)).toEqual({ realHash: HASH, loginEnabled: true });
  });

  it("disabling preserves the hash behind a non-matching marker", () => {
    const onDisk = encodeDovecotHash(HASH, false);
    expect(onDisk).toBe("!" + HASH);
    // Dovecot can't parse "!{SCHEME}…" => login blocked.
    expect(decodeDovecotHash(onDisk).loginEnabled).toBe(false);
    // …but the real hash round-trips, so re-enable restores login.
    expect(decodeDovecotHash(onDisk).realHash).toBe(HASH);
    expect(encodeDovecotHash(decodeDovecotHash(onDisk).realHash, true)).toBe(HASH);
  });

  it("never double-encodes the marker", () => {
    const once = encodeDovecotHash(HASH, false);
    expect(encodeDovecotHash(once, false)).toBe("!" + HASH);
  });

  it("treats bare '!' and empty as disabled with no recoverable password", () => {
    expect(decodeDovecotHash("!")).toEqual({ realHash: "!", loginEnabled: false });
    expect(decodeDovecotHash("")).toEqual({ realHash: "!", loginEnabled: false });
    expect(decodeDovecotHash(null)).toEqual({ realHash: "!", loginEnabled: false });
    expect(encodeDovecotHash("!", false)).toBe("!");
    expect(encodeDovecotHash("!", true)).toBe("!");
  });
});
