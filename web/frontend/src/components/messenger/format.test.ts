// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { displayNameFor } from "./format";

const conv = {
  kind: "dm",
  displayTitle: "Ana Pérez",
  otherUser: "ana",
  otherDisplayName: "Ana Pérez",
  memberNames: { ana: "Ana Pérez", operator: "Usuario de prueba" },
};

describe("displayNameFor", () => {
  it("prefers the pre-resolved fallbackName", () => {
    expect(displayNameFor(conv, "ana", { fallbackName: "Ana P." })).toBe("Ana P.");
  });
  it("reads memberNames", () => {
    expect(displayNameFor(conv, "operator", { unknownUser: "Usuario" })).toBe("Usuario de prueba");
  });
  it("falls back to the DM counterpart title", () => {
    expect(displayNameFor({ kind: "dm", otherUser: "ana", displayTitle: "Ana Pérez" }, "ana")).toBe("Ana Pérez");
  });
  it("reads the shared directory", () => {
    const dir = new Map([["bob", "Roberto"]]);
    expect(displayNameFor({ kind: "group" }, "bob", { directory: dir })).toBe("Roberto");
  });
  it("NEVER returns the username", () => {
    expect(displayNameFor({ kind: "group" }, "ghost", { unknownUser: "Usuario" })).toBe("Usuario");
    expect(displayNameFor(null, "ghost", { unknownUser: "Usuario" })).toBe("Usuario");
    expect(displayNameFor(null, null, { unknownUser: "Usuario" })).toBe("Usuario");
  });
  it("ignores blank names in the maps", () => {
    expect(displayNameFor({ memberNames: { x: "   " } }, "x", { unknownUser: "Usuario" })).toBe("Usuario");
  });
});
