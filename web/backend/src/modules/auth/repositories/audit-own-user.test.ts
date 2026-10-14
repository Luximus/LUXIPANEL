import { describe, expect, it, vi } from "vitest";
const records = vi.hoisted(() => ({
  items: [
    {
      id: "own",
      userId: 7,
      eventType: "login",
      createdAt: "2026-09-30T10:00:00Z",
    },
    {
      id: "other",
      userId: 8,
      eventType: "login",
      createdAt: "2026-09-30T11:00:00Z",
    },
    {
      id: "system",
      userId: null,
      eventType: "login",
      createdAt: "2026-09-30T12:00:00Z",
    },
  ],
}));
vi.mock("../../../shared/data-store/make-kv-store.js", () => ({
  makeKvStore: () => () => ({
    query: async (predicate: (record: unknown) => boolean) =>
      records.items.filter(predicate),
  }),
}));
import { auditRepository } from "./audit.repository.js";
describe("own security audit", () => {
  it("returns only the account entries, excluding other users and anonymous events", async () => {
    expect(
      (await auditRepository.findRecentForUser(7)).map((entry) => entry.id),
    ).toEqual(["own"]);
  });
});
