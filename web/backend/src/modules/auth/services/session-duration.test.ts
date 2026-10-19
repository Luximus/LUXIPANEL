// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { configuredSessionExpiry, refreshedSessionExpiry } from "./session-duration.js";
import type { TokenPayload } from "./token.service.js";

const issued = 1_000_000_000;
const base = { authTime: issued, exp: issued + 48 * 3600 } as TokenPayload;

describe("configured session duration", () => {
  it("caps remembered and ordinary sessions to the configured hours", () => {
    expect(configuredSessionExpiry(12, issued * 1000)).toBe((issued + 12 * 3600) * 1000);
    expect(refreshedSessionExpiry({ ...base, remember: true }, 12, (issued + 1) * 1000)).toBe((issued + 12 * 3600) * 1000);
  });

  it("never extends a shorter existing expiry", () => {
    expect(refreshedSessionExpiry({ ...base, exp: issued + 2 * 3600 }, 12, (issued + 1) * 1000)).toBe((issued + 2 * 3600) * 1000);
  });

  it("rejects expired or malformed session clocks", () => {
    expect(refreshedSessionExpiry(base, 12, (issued + 12 * 3600) * 1000)).toBeNull();
    expect(refreshedSessionExpiry({ ...base, authTime: undefined, iat: undefined }, 12)).toBeNull();
  });
});
