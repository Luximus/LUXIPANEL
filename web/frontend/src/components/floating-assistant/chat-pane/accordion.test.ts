// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { accordionToggle, revealChainAccordion, LOOSE_GROUP_ID } from "../conversation-grouping";

describe("accordionToggle", () => {
  it("opening a node closes its siblings only (other levels untouched)", () => {
    const prev = new Set(["A", "A.1", "B"]);
    const next = accordionToggle(prev, "C", ["A", "B", "C"]);
    expect([...next].sort()).toEqual(["A.1", "C"]);
    expect(prev.size).toBe(3); // pure
  });
  it("closing an open node just removes it", () => {
    expect([...accordionToggle(new Set(["A", "B"]), "A", ["A", "B"])]).toEqual(["B"]);
  });
  it("without siblings it behaves like a plain toggle", () => {
    expect([...accordionToggle(new Set(["A"]), "B")].sort()).toEqual(["A", "B"]);
  });
});

describe("revealChainAccordion", () => {
  const parent: Record<string, string | null> = { root1: null, root2: null, child1: "root1", child2: "root1" };
  const siblingsOf = (id: string) => {
    const p = id === LOOSE_GROUP_ID ? null : parent[id] ?? null;
    return [...(p === null ? [LOOSE_GROUP_ID] : []), ...Object.keys(parent).filter((k) => parent[k] === p)];
  };
  it("opens the whole chain and closes the siblings at every level", () => {
    const prev = new Set(["root2", "child2", LOOSE_GROUP_ID]);
    const next = revealChainAccordion(prev, ["child1", "root1"], siblingsOf);
    expect([...next].sort()).toEqual(["child1", "root1"]);
  });
  it("reveals the loose folder closing the root projects", () => {
    const next = revealChainAccordion(new Set(["root1", "child1"]), [LOOSE_GROUP_ID], siblingsOf);
    expect([...next].sort()).toEqual([LOOSE_GROUP_ID, "child1"].sort()); // child1 hidden under closed root1, kept
  });
});
