// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../../shared/types/index.js";
import { assertOwner, isAssistantAdministrator } from "./ownership.js";

const admin = {
  userId: 1,
  username: "admin",
  displayName: "Admin",
  role: "admin",
  kind: "admin",
  modules: ["admin"],
} satisfies SessionUser;

const operator = {
  userId: 2,
  username: "operator",
  displayName: "Operator",
  role: "user",
  kind: "user",
  modules: ["assistant"],
} satisfies SessionUser;

describe("assistant ownership", () => {
  it("allows administrators to manage an explicitly global workspace", () => {
    expect(isAssistantAdministrator(admin)).toBe(true);
    expect(() => assertOwner(null, "es", admin)).not.toThrow();
  });

  it("does not turn an ownerless workspace into an ordinary-user write target", () => {
    expect(isAssistantAdministrator(operator)).toBe(false);
    expect(() => assertOwner(null, "es", operator)).toThrow();
  });

  it("keeps individually owned workspaces private even for another administrator", () => {
    const anotherAdmin = { ...admin, userId: 3, username: "other" };
    expect(() => assertOwner(1, "es", admin)).not.toThrow();
    expect(() => assertOwner(1, "es", anotherAdmin)).toThrow();
  });
});
