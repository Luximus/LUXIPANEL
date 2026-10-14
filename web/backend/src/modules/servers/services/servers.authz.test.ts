// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Authorization matrix for the single SSH vault. `userMayUseTarget` is the one
 * rule shared by list filtering, the sidebar switch, and the assistant's
 * cross-server tools — so it must be exhaustively pinned.
 */

import { describe, it, expect } from "vitest";
import { userMayUseTarget, type TargetViewer } from "./servers.service.js";

const admin: TargetViewer = { userId: 1, isAdmin: true };
const alice: TargetViewer = { userId: 10, isAdmin: false };
const bob: TargetViewer = { userId: 20, isAdmin: false };
const anon: TargetViewer = { userId: null, isAdmin: false };

describe("userMayUseTarget", () => {
  it("admin may use anything (global, private, disabled-scope)", () => {
    expect(userMayUseTarget({ visibility: "global", ownerId: null, allowedUserIds: [] }, admin)).toBe(true);
    expect(userMayUseTarget({ visibility: "private", ownerId: 10, allowedUserIds: [] }, admin)).toBe(true);
    expect(userMayUseTarget({ visibility: "global", ownerId: null, allowedUserIds: ["999"] }, admin)).toBe(true);
  });

  it("legacy target (no visibility) reads as global", () => {
    expect(userMayUseTarget({ ownerId: 1, allowedUserIds: [] }, alice)).toBe(true);
  });

  it("global with empty allowlist is usable by any authenticated user", () => {
    expect(userMayUseTarget({ visibility: "global", ownerId: null, allowedUserIds: [] }, alice)).toBe(true);
    expect(userMayUseTarget({ visibility: "global", ownerId: null, allowedUserIds: [] }, bob)).toBe(true);
  });

  it("global with allowlist honors the allowlist (string-compared ids)", () => {
    const t = { visibility: "global" as const, ownerId: null, allowedUserIds: ["10"] };
    expect(userMayUseTarget(t, alice)).toBe(true);
    expect(userMayUseTarget(t, bob)).toBe(false);
    expect(userMayUseTarget(t, anon)).toBe(false);
  });

  it("private target is owner-only for non-admins", () => {
    const t = { visibility: "private" as const, ownerId: 10, allowedUserIds: [] };
    expect(userMayUseTarget(t, alice)).toBe(true);
    expect(userMayUseTarget(t, bob)).toBe(false);
    expect(userMayUseTarget(t, anon)).toBe(false);
  });

  it("private target with a null owner is nobody's (except admin)", () => {
    const t = { visibility: "private" as const, ownerId: null, allowedUserIds: [] };
    expect(userMayUseTarget(t, alice)).toBe(false);
    expect(userMayUseTarget(t, admin)).toBe(true);
  });
});
