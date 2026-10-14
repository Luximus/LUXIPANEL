// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { runWithExecutor } from "../../shared/executor/context.js";
import type { SessionUser } from "../../shared/types/index.js";
import { assertHostingFormAllowed, assertNginxAdmin, filterOwnedSites } from "./nginx-access.js";

const hosting = {
  userId: 7, kind: "hosting", owner: "tenant", tenantGroup: "tenant",
  homeRoot: "/home/tenant", maxSubUsers: 0,
} as SessionUser;
const admin = { userId: 1, kind: "admin" } as SessionUser;
const asUser = <T>(user: SessionUser, fn: () => T) =>
  runWithExecutor(null as never, fn, user.userId, user);

describe("NGINX account scope", () => {
  it("limits a hosting account to sites under its home", () => {
    const sites = [
      { root: "/home/tenant/public_html", name: "own" },
      { root: "/home/other/public_html", name: "other" },
      { root: null, name: "proxy" },
    ];
    expect(asUser(hosting, () => filterOwnedSites(sites)).map((site) => site.name)).toEqual(["own"]);
  });

  it("rejects global controls, raw edits and roots outside the tenant", () => {
    asUser(hosting, () => {
      expect(() => assertNginxAdmin()).toThrow();
      expect(() => assertHostingFormAllowed({ mode: "raw" })).toThrow();
      expect(() => assertHostingFormAllowed({ mode: "form", form: { kind: "static", root: "/home/other/public_html" } })).toThrow();
      expect(() => assertHostingFormAllowed({ mode: "form", form: { kind: "proxy", root: "/home/tenant/public_html" } })).toThrow();
      expect(() => assertHostingFormAllowed({ mode: "form", form: { kind: "php", root: "/home/tenant/public_html" } })).not.toThrow();
    });
    expect(() => asUser(admin, assertNginxAdmin)).not.toThrow();
  });
});
