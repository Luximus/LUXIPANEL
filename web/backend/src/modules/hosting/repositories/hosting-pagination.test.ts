import { expect, it, vi } from "vitest";
const list = vi.hoisted(() => vi.fn());
vi.mock("../../../shared/data-store/index.js", () => ({ dataStore: () => ({ list }) }));
import { hostingAccountRepository } from "./hosting-account.repository.js";
it("filters and sorts all accounts before slicing, with totals across pages", async () => {
  list.mockResolvedValue(Array.from({ length: 51 }, (_, i) => ({ id: i + 1, username: `user${String(i).padStart(2, "0")}`,
    status: i % 2 ? "suspended" : "active", plan: "basic", createdAt: "2026-09-30" })));
  const page = await hostingAccountRepository.findAll({ status: "active", sortBy: "username", sortDir: "desc", limit: 10, offset: 10 });
  expect(page.total).toBe(26);
  expect(page.counts.active).toBe(26);
  expect(page.rows).toHaveLength(10);
  expect(page.rows[0]!.username).toBe("user30");
  expect(list).toHaveBeenCalledTimes(1);
});
