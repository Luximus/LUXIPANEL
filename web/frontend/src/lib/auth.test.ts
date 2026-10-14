// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import {
  isAdmin,
  hasAction,
  canSeeSidebar,
  getInitials,
  type SessionUser,
} from "./auth";

function makeUser(over: Partial<SessionUser> = {}): SessionUser {
  return {
    userId: 1,
    username: "jdoe",
    displayName: "John Doe",
    role: "member",
    modules: [],
    kind: "user",
    ...over,
  };
}

describe("isAdmin", () => {
  it("is true only for admin kind", () => {
    expect(isAdmin(makeUser({ kind: "admin" }))).toBe(true);
    expect(isAdmin(makeUser({ kind: "user" }))).toBe(false);
  });
});

describe("hasAction", () => {
  it("grants admins every action", () => {
    expect(hasAction(makeUser({ kind: "admin" }), "files.delete")).toBe(true);
  });

  it("matches an exact action", () => {
    const u = makeUser({ permissions: perms({ actions: ["files.read"] }) });
    expect(hasAction(u, "files.read")).toBe(true);
    expect(hasAction(u, "files.write")).toBe(false);
  });

  it("matches the wildcard '*'", () => {
    const u = makeUser({ permissions: perms({ actions: ["*"] }) });
    expect(hasAction(u, "anything.goes")).toBe(true);
  });

  it("matches a per-prefix wildcard like 'files.*'", () => {
    const u = makeUser({ permissions: perms({ actions: ["files.*"] }) });
    expect(hasAction(u, "files.delete")).toBe(true);
    expect(hasAction(u, "mail.delete")).toBe(false);
  });

  it("denies when there are no permissions at all", () => {
    expect(hasAction(makeUser(), "files.read")).toBe(false);
  });
});

describe("canSeeSidebar", () => {
  it("admins see everything", () => {
    expect(canSeeSidebar(makeUser({ kind: "admin" }), "billing")).toBe(true);
  });

  it("honors the sidebar allowlist and wildcard", () => {
    expect(canSeeSidebar(makeUser({ permissions: perms({ sidebar: ["files"] }) }), "files")).toBe(true);
    expect(canSeeSidebar(makeUser({ permissions: perms({ sidebar: ["files"] }) }), "mail")).toBe(false);
    expect(canSeeSidebar(makeUser({ permissions: perms({ sidebar: ["*"] }) }), "anything")).toBe(true);
    expect(canSeeSidebar(makeUser(), "files")).toBe(false);
  });
});

describe("getInitials", () => {
  it("uses the first letters of the first two name parts", () => {
    expect(getInitials(makeUser({ displayName: "John Doe" }))).toBe("JD");
    expect(getInitials(makeUser({ displayName: "  ada   byron  " }))).toBe("AB");
  });

  it("falls back to the first two chars of a single-word name", () => {
    expect(getInitials(makeUser({ displayName: "Madonna" }))).toBe("MA");
  });

  it("falls back to username when displayName is empty", () => {
    expect(getInitials(makeUser({ displayName: "", username: "neo" }))).toBe("NE");
  });
});

// permissions object requires the full shape; build a minimal one and merge.
function perms(over: Partial<NonNullable<SessionUser["permissions"]>>): SessionUser["permissions"] {
  return {
    sidebar: [],
    views: [],
    actions: [],
    fileAccess: { allowAll: false, allowPaths: [], denyPaths: [], readOnlyPaths: [] },
    commandPolicy: { allowAll: false, groups: [], allowCommands: [], denyCommands: [] },
    ...over,
  };
}
