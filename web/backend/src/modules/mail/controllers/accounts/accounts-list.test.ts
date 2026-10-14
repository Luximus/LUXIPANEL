import { beforeEach, expect, it, vi } from "vitest";
import type { Executor } from "../../../../shared/executor/index.js";

const mocks = vi.hoisted(() => ({ accounts: vi.fn(), forwards: vi.fn(), usage: vi.fn(), quotas: vi.fn() }));
vi.mock("../accounts.helpers.js", () => ({ readAccountsFromServer: mocks.accounts, fnv1aId: () => 1 }));
vi.mock("./accounts-forwards.reader.js", () => ({ readForwardsFromServer: mocks.forwards }));
vi.mock("./accounts-usage.helpers.js", () => ({ getAllMailboxUsageMap: mocks.usage, getMaildirQuotaLimitsMap: mocks.quotas }));
import { buildAccountItemsLive } from "./accounts-list.js";
const executor = {} as Executor;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.accounts.mockResolvedValue([{ address: "qa@example.com", domain: "example.com", quotaMb: 100,
    enabled: true, incomingMode: "suspend", outgoingMode: "hold", loginMode: "allow", plusAddressingAutoFolder: false }]);
  mocks.forwards.mockResolvedValue(new Map([["qa@example.com", [{ destination: "other@example.com", keepCopy: true }]]]));
  mocks.quotas.mockResolvedValue(new Map([["qa@example.com", 200]]));
  mocks.usage.mockResolvedValue({ available: true, map: new Map([["qa@example.com", 10485760]]) });
});

it("skips mailbox usage for the fast list while retaining quotas and mail controls", async () => {
  const callback = vi.fn();
  const [row] = await buildAccountItemsLive(executor, false, callback);
  expect(mocks.usage).not.toHaveBeenCalled();
  expect(callback).not.toHaveBeenCalled();
  expect(row).toMatchObject({ usedMb: null, usedPercent: null, quotaMb: 200, forwardCount: 1,
    incomingMode: "suspend", outgoingMode: "hold", loginMode: "allow", plusAddressingAutoFolder: false });
});

it("starts independent SSH reads together and reports the usage probe once", async () => {
  let finish!: (value: Map<string, never>) => void;
  mocks.forwards.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const callback = vi.fn();
  const result = buildAccountItemsLive(executor, true, callback);
  await vi.waitFor(() => expect(mocks.quotas).toHaveBeenCalledOnce());
  expect(mocks.usage).toHaveBeenCalledOnce();
  finish(new Map());
  expect((await result)[0]).toMatchObject({ usedMb: 10, usedPercent: 5 });
  expect(callback).toHaveBeenCalledOnce();
});

it("does not scan usage, quotas or forwards when there are no accounts", async () => {
  mocks.accounts.mockResolvedValue([]);
  expect(await buildAccountItemsLive(executor)).toEqual([]);
  expect(mocks.usage).not.toHaveBeenCalled();
  expect(mocks.quotas).not.toHaveBeenCalled();
  expect(mocks.forwards).not.toHaveBeenCalled();
});
