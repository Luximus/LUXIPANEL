import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cache: vi.fn(), builder: vi.fn(), usage: vi.fn(), disk: vi.fn(), tenant: vi.fn(), context: vi.fn() }));
vi.mock("../../../../shared/types/index.js", () => ({ asyncHandler: (fn: any) => fn }));
vi.mock("../../../../shared/executor/index.js", () => ({ getExecutor: () => ({}) }));
vi.mock("../../../nginx/services/domains.service.js", () => ({ domainsService: {} }));
vi.mock("../../services/index.js", () => ({ dovecotService: {} }));
vi.mock("../../../../shared/executor/context.js", () => ({ getContextUser: mocks.context }));
vi.mock("../../../../shared/tenant/tenant-scope.js", () => ({
  isHostingSession: (ctx: any) => ctx?.hosting === true, getTenantEnvelope: (ctx: any) => ctx,
  isTenantMailAddress: (domains: Set<string>, address: string) => domains.has(address.split("@")[1]!), assertWithinEmailQuota: vi.fn(),
}));
vi.mock("../../../../shared/tenant/tenant-resources.service.js", () => ({ tenantResourcesService: { tenantDomainSet: mocks.tenant } }));
vi.mock("../../../../shared/worklog/worklog-recorder.service.js", () => ({ recordActivity: vi.fn() }));
vi.mock("../../../../shared/events/index.js", () => ({ eventBus: {}, Events: {} }));
vi.mock("../../../../shared/logger/index.js", () => ({ createModuleLogger: () => ({}) }));
vi.mock("../accounts.helpers.js", () => ({ readAccountsFromServer: vi.fn(), fnv1aId: vi.fn() }));
vi.mock("../../services/mailbox-credential.service.js", () => ({ mailboxCredentialService: {} }));
vi.mock("../../services/account-sidecar.service.js", () => ({ accountSidecarService: {} }));
vi.mock("../../services/mail-crypto.service.js", () => ({ mailCryptoService: {} }));
vi.mock("../../../../shared/system/index.js", () => ({ hasStoredSudoPassword: async () => false }));
vi.mock("../../../../shared/remote-cache/serve-cached-datatable.js", () => ({ serveCachedDataTable: mocks.cache }));
vi.mock("./accounts-usage.helpers.js", () => ({ getAllMailboxUsageMap: mocks.usage, getDiskTotalMb: mocks.disk }));
vi.mock("./accounts-state.js", () => ({ applyAccountState: vi.fn(), renameMaildirIfNeeded: vi.fn(), toSidecarSettings: vi.fn() }));
vi.mock("./accounts-list.js", () => ({ buildAccountItemsLive: mocks.builder }));
vi.mock("../_shared/mail-access.js", () => ({ visibleMailDomains: vi.fn() }));
import { accountsController } from "./accounts-crud.controller.js";

const rows = ["other.net", "mine.net", "mine.net"].map((domain, i) => ({ id: i + 1, address: `qa${i}@${domain}`, domain, enabled: true }));
async function list(query: Record<string, string>) {
  let body: any;
  await (accountsController.list as any)({ query }, { json: (data: any) => { body = data; } });
  return body.data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.cache.mockResolvedValue({ rows, fromCache: true });
  mocks.disk.mockResolvedValue(1024);
  mocks.context.mockReturnValue(null);
  mocks.tenant.mockResolvedValue(new Set(["mine.net"]));
});

it("does not execute disk or usage SSH on a cached fast list", async () => {
  expect((await list({ page: "1", includeUsage: "false" })).items).toHaveLength(3);
  expect(mocks.disk).not.toHaveBeenCalled();
  expect(mocks.usage).not.toHaveBeenCalled();
});

it("filters a hosting tenant before computing totals and paginating", async () => {
  mocks.context.mockReturnValue({ hosting: true });
  const result = await list({ page: "2", limit: "1", includeUsage: "false" });
  expect(result.total).toBe(2);
  expect(result.items.map((row: any) => row.address)).toEqual(["qa2@mine.net"]);
  expect(mocks.disk).not.toHaveBeenCalled();
});

it("reuses the cold builder's usage probe and preserves the sudo requirement", async () => {
  mocks.cache.mockImplementation(async ({ liveLoader }: any) => ({ rows: await liveLoader(), fromCache: false }));
  mocks.builder.mockImplementation(async (_executor: any, includeUsage: boolean, onUsage: any) => {
    expect(includeUsage).toBe(true);
    onUsage({ available: false, reason: "sudo_password_required", map: new Map() });
    return rows;
  });
  expect((await list({ page: "1", includeUsage: "true" })).sudoRequired).toBe(true);
  expect(mocks.usage).not.toHaveBeenCalled();
  expect(mocks.disk).toHaveBeenCalledOnce();
});

it("returns all authorized picker options without usage, regardless of table page", async () => {
  mocks.context.mockReturnValue({ hosting: true });
  const result = await list({ catalog: "1", page: "2", limit: "1" });
  expect(result).toEqual([
    { id: 2, address: "qa1@mine.net", domain: "mine.net" },
    { id: 3, address: "qa2@mine.net", domain: "mine.net" },
  ]);
  expect(mocks.disk).not.toHaveBeenCalled();
  expect(mocks.usage).not.toHaveBeenCalled();
});
