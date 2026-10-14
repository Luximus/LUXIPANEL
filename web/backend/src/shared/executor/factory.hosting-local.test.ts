// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getExecutor, getExecutorAsync } from "./factory.js";
import { PrivilegeDropExecutor } from "./privilege-drop-executor.js";

function requestWith(user: Record<string, unknown>): Request {
  return { res: { locals: { bridgedSession: { local: true, targetId: "local" }, user } } } as unknown as Request;
}

describe("local hosting executor", () => {
  it("keeps ordinary panel users with a tenant scope running as their owner", async () => {
    const req = requestWith({ kind: "user", tenantId: 7, username: "hp123", owner: "hp123", homeRoot: "/home/hp123" });
    expect(getExecutor(req)).toBeInstanceOf(PrivilegeDropExecutor);
    expect(await getExecutorAsync(req)).toBeInstanceOf(PrivilegeDropExecutor);
  });

  it("rejects an ordinary tenant user with missing scope fields", () => {
    expect(() => getExecutor(requestWith({ kind: "user", tenantId: 7, username: "hp123" }))).toThrow("invalid local hosting envelope");
  });
  it("drops local hosting operations to the signed Linux owner", async () => {
    const req = requestWith({ kind: "hosting", username: "hp123", owner: "hp123", homeRoot: "/home/hp123", jailEnabled: false });
    expect(getExecutor(req)).toBeInstanceOf(PrivilegeDropExecutor);
    expect(await getExecutorAsync(req)).toBeInstanceOf(PrivilegeDropExecutor);
  });

  it("fails closed on an invalid hosting envelope", () => {
    const req = requestWith({ kind: "hosting", username: "hp123", owner: "root", homeRoot: "/root" });
    expect(() => getExecutor(req)).toThrow("invalid local hosting envelope");
  });

  it("keeps an admin's local executor outside the tenant wrapper", () => {
    expect(getExecutor(requestWith({ kind: "admin", username: "admin" }))).not.toBeInstanceOf(PrivilegeDropExecutor);
  });
});
