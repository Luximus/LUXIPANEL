// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization test for `groupAccountSieveInputs` — the PURE grouping the
 * global-filter rebuild uses after bulk-reading forwards/filters/autoresponders
 * (instead of N per-account cache reads). It must reproduce EXACTLY the ordering
 * and selection of the per-account repository methods, because the resulting
 * order drives the generated Sieve script:
 *   - forwards: stored order (forwardRepository.findByAccountId → query() order)
 *   - filters:  position then id (filterRepository.findByAccountId sort)
 *   - autoresponder: FIRST match for the account (autoresponderRepository → find())
 * Any drift here silently changes mail routing, so this locks it in.
 */

import { describe, it, expect } from "vitest";
import { groupAccountSieveInputs, type AccountSieveInputs } from "./global-filters.shared.js";

type Forwards = AccountSieveInputs["forwards"];
type Filters = AccountSieveInputs["filters"];
type Autoresponders = Array<NonNullable<AccountSieveInputs["autoresponder"]>>;

function fwd(accountId: number, destination: string): Forwards[number] {
  return { accountId, destination } as unknown as Forwards[number];
}
function flt(accountId: number, id: number, position: number, name: string): Filters[number] {
  return { accountId, id, position, name } as unknown as Filters[number];
}
function resp(accountId: number, tag: string): Autoresponders[number] {
  return { accountId, subject: tag } as unknown as Autoresponders[number];
}

describe("groupAccountSieveInputs — parity with the per-account read path", () => {
  const accounts = [{ id: 1 }, { id: 2 }, { id: 3 }];

  // Interleaved across accounts to prove grouping keys on accountId, not order.
  const allForwards: Forwards = [
    fwd(1, "a1-first@x.com"),
    fwd(3, "a3-only@x.com"),
    fwd(1, "a1-second@x.com"),
    fwd(1, "a1-third@x.com"),
    fwd(99, "orphan@x.com"), // account not in `accounts` → ignored
  ];
  const allFilters: Filters = [
    flt(1, 50, 2, "a1-pos2"),
    flt(3, 10, 0, "a3-filter"),
    flt(1, 20, 0, "a1-pos0-id20"),
    flt(1, 15, 0, "a1-pos0-id15"), // same position as above, lower id → sorts first
    flt(1, 40, 1, "a1-pos1"),
    flt(99, 1, 0, "orphan"),
  ];
  const allAutoresponders: Autoresponders = [
    resp(1, "a1-first-responder"),
    resp(1, "a1-second-responder"), // duplicate for account 1 → first wins
    resp(99, "orphan"),
  ];

  const grouped = groupAccountSieveInputs(accounts, allForwards, allFilters, allAutoresponders);

  it("keeps forwards in stored order per account", () => {
    expect(grouped.get(1)!.forwards.map((f) => f.destination)).toEqual([
      "a1-first@x.com",
      "a1-second@x.com",
      "a1-third@x.com",
    ]);
    expect(grouped.get(3)!.forwards.map((f) => f.destination)).toEqual(["a3-only@x.com"]);
  });

  it("sorts filters by position then id", () => {
    // position 0 (id 15 before id 20), then position 1, then position 2.
    expect(grouped.get(1)!.filters.map((f) => f.name)).toEqual([
      "a1-pos0-id15",
      "a1-pos0-id20",
      "a1-pos1",
      "a1-pos2",
    ]);
  });

  it("selects the FIRST autoresponder match for the account", () => {
    expect(grouped.get(1)!.autoresponder).toMatchObject({ subject: "a1-first-responder" });
    expect(grouped.get(3)!.autoresponder).toBeUndefined();
  });

  it("gives an account with no forwards/filters/autoresponder empty groups", () => {
    const a2 = grouped.get(2)!;
    expect(a2.forwards).toEqual([]);
    expect(a2.filters).toEqual([]);
    expect(a2.autoresponder).toBeUndefined();
  });

  it("only emits entries for the requested accounts (orphans ignored)", () => {
    expect([...grouped.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });
});
