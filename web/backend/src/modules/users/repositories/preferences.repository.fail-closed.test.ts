// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit test — fail-closed invariant. With NO explicit executor and NO context
 * executor in scope, the per-server sidecar access must throw (managed-only:
 * there is no panel-host fallback, to prevent cross-server data leakage).
 *
 * Uses the REAL kv/dataStore on purpose — do NOT mock it here.
 */

import { describe, expect, it } from "vitest";
import { preferencesRepository } from "./preferences.repository.js";

describe("preferencesRepository fail-closed", () => {
  it("throws when no server executor is in scope on read", async () => {
    await expect(preferencesRepository.findByUserId(1)).rejects.toThrow(/no executor/i);
  });

  it("throws when no server executor is in scope on write", async () => {
    await expect(preferencesRepository.upsert(1, { theme: "dark" })).rejects.toThrow(/no executor/i);
  });
});
