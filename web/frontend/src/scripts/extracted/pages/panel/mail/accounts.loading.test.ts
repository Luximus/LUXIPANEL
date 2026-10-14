import { beforeEach, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ get: vi.fn(), publish: vi.fn(), scope: "local" }));
vi.mock("/scripts/extracted/lib/mail-api-client.js?v=20260930a", () => ({
  api: { get: mocked.get }, resolveTargetScope: () => mocked.scope,
  LOCAL_TARGET_SCOPE: "local", TARGET_SCOPE_SESSION_KEY: "scope",
}));
vi.mock("./settings", () => ({ updateMailTabCounts: vi.fn() }));
vi.mock("./table-bridge", () => ({ publishMailTable: mocked.publish }));
vi.mock("./domains", () => ({ loadDomains: vi.fn() }));
import { S } from "./state";
import { loadAccounts } from "./accounts";
const row = { id: 1, address: "qa@example.com", enabled: true, quotaMb: 100, usedMb: null, usedPercent: null };
const response = (items: any[], total = items.length) => ({ ok: true, data: { items, total } });
beforeEach(() => {
  vi.clearAllMocks();
  mocked.scope = "local";
  S.accounts = [];
  document.body.innerHTML = '<section data-mail-main-panel="emails"></section>';
});

it("makes the list available before usage and only merges the usage fields", async () => {
  let finish!: (value: any) => void;
  mocked.get.mockImplementation((_url: string, opts: any) => opts.params.includeUsage
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(response([row])));
  expect(await loadAccounts()).toBe(true);
  expect(S.accounts[0]).toMatchObject(row);
  expect(mocked.publish).toHaveBeenCalled();
  S.accounts[0]!.enabled = false;
  finish(response([{ ...row, usedMb: 10, usedPercent: 10 }]));
  await vi.waitFor(() => expect(S.accounts[0]?.usedMb).toBe(10));
  expect(S.accounts[0]?.enabled).toBe(false);
});

it("loads two pages initially and appends two pages on demand", async () => {
  mocked.get.mockImplementation((_url: string, opts: any) => opts.params.includeUsage
    ? Promise.resolve({ ok: false }) : Promise.resolve(response(Array.from({ length: 10 }, (_, index) => ({ ...row, id: (opts.params.page - 1) * 10 + index + 1 })), 101)));
  await loadAccounts();
  expect(S.accounts).toHaveLength(20);
  expect(mocked.get.mock.calls.filter(([, opts]) => !opts.params.includeUsage).map(([,opts]) => opts.params.page)).toEqual([1,2]);
  window.dispatchEvent(new CustomEvent("lxp:data-table:load-more", { detail: { tableId: "mail-accounts-table", pageSize: 10 } }));
  await vi.waitFor(() => expect(S.accounts).toHaveLength(40));
  expect(mocked.get.mock.calls.filter(([, opts]) => !opts.params.includeUsage).map(([,opts]) => opts.params.page)).toEqual([1,2,3,4]);
  expect(mocked.get.mock.calls.every(([, opts]) => opts.params.limit === 10)).toBe(true);
});

it.each(["scope", "root"])("drops late usage after changing the %s", async (kind) => {
  let finish!: (value: any) => void;
  mocked.get.mockImplementation((_url: string, opts: any) => opts.params.includeUsage
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(response([row])));
  await loadAccounts();
  if (kind === "scope") mocked.scope = "remote-b";
  else document.body.innerHTML = '<section data-mail-main-panel="emails"></section>';
  finish(response([{ ...row, usedMb: 50 }]));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(S.accounts[0]?.usedMb).toBeNull();
});

it("keeps the primary list when usage fails", async () => {
  mocked.get.mockImplementation((_url: string, opts: any) => Promise.resolve(opts.params.includeUsage ? { ok: false } : response([row])));
  await loadAccounts();
  expect(S.accounts).toHaveLength(1);
  expect(S.accounts[0]?.usedMb).toBeNull();
});

it("recovers an initial read invalidated by startup in the same target", async () => {
  mocked.get.mockImplementation((_url: string, opts: any) => opts.params.includeUsage
    ? Promise.resolve({ ok: false }) : Promise.resolve(response([row])));
  mocked.get.mockResolvedValueOnce({ ok: false, code: "TARGET_SCOPE_CHANGED", status: 409 });
  expect(await loadAccounts()).toBe(true);
  expect(S.accounts).toHaveLength(1);
  expect(mocked.get.mock.calls.some(([, opts]) => opts.fresh === true)).toBe(true);
});

it("does not retry on a different server after a late invalidation", async () => {
  mocked.get.mockImplementation(() => {
    mocked.scope = "remote-b";
    return Promise.resolve({ ok: false, code: "TARGET_SCOPE_CHANGED", status: 409 });
  });
  expect(await loadAccounts()).toBe(false);
  expect(mocked.get).toHaveBeenCalledTimes(1);
});
