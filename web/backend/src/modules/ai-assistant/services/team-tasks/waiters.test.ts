// SPDX-License-Identifier: AGPL-3.0-only
import { expect, it } from "vitest";
import { hasWaiters, pingWaiters, waitForPing } from "./waiters.js";

it("isolates collection by target and releases only the matching waiter", async () => {
  const abort = new AbortController();
  const wait = waitForPing("leader", 10000, abort.signal, "target-a");
  expect(hasWaiters("leader", "target-a")).toBe(true);
  expect(hasWaiters("leader", "target-b")).toBe(false);
  pingWaiters("leader", "target-b");
  expect(hasWaiters("leader", "target-a")).toBe(true);
  pingWaiters("leader", "target-a");
  await wait;
  expect(hasWaiters("leader", "target-a")).toBe(false);
  abort.abort();
  await waitForPing("leader", 10000, abort.signal, "target-a");
  expect(hasWaiters("leader", "target-a")).toBe(false);
});
