import { describe, expect, it } from "vitest";
import type { TenantEnvelope } from "../../../shared/tenant/tenant-scope.js";
import { scopeSessionMap } from "./session-scope.js";

describe("scopeSessionMap", () => {
  it("returns only sessions for the tenant owner and its sub-users", () => {
    const env = { owner: "owner", tenantGroup: "h-owner", homeRoot: "/home/owner" } as TenantEnvelope;
    const sessions = {
      owner: { online: true },
      child: { online: true },
      other: { online: true },
      root: { online: true },
    };
    const users = [
      { username: "owner", homeDir: "/home/owner" },
      { username: "child", homeDir: "/home/owner/child" },
      { username: "other", homeDir: "/home/other" },
      { username: "root", homeDir: "/root" },
    ];
    expect(scopeSessionMap(sessions, users, [], env)).toEqual({ owner: sessions.owner, child: sessions.child });
  });
});
