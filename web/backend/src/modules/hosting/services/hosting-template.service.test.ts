import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ store: { list: vi.fn(), get: vi.fn(), set: vi.fn(), create: vi.fn(), delete: vi.fn() }, accounts: { findAll: vi.fn(), update: vi.fn() }, roles: { findByName: vi.fn(), update: vi.fn() }, invalidate: vi.fn(), apply: vi.fn(), epoch: vi.fn(), events: [] as string[], providers: [] as any[] }));
vi.mock("../repositories/hosting-template.repository.js", () => ({ hostingTemplateStore: () => mock.store }));
vi.mock("../repositories/hosting-account.repository.js", () => ({ hostingAccountRepository: mock.accounts }));
vi.mock("../../users/repositories/role.repository.js", () => ({ roleRepository: mock.roles }));
vi.mock("../repositories/provider.repository.js", () => ({ providerRepository: { list: async () => mock.providers } }));
vi.mock("./hosting-runtime.service.js", () => ({ hostingRuntimeService: { invalidate: mock.invalidate, apply: mock.apply } }));
vi.mock("../../../shared/auth/authorization-revision.js", () => ({ authorizationChanged: mock.epoch }));
vi.mock("../../../shared/redis/index.js", () => ({ getRedis: () => ({ set: async () => "OK", eval: async () => 1 }) }));
import { hostingTemplateService } from "./hosting-template.service.js";
import { normalizeRolePermissions } from "../../../shared/auth/role-permissions.js";
const executor = { target: { id: "server-one" } } as never;
const permissions = { version: 2, sidebar: ["files"], views: ["panel.files"], actions: ["files.read", "files.write"], fileAccess: { allowAll: false, allowPaths: ["."], denyPaths: [], readOnlyPaths: [], defaultPath: "." }, commandPolicy: { allowAll: false, groups: [], allowCommands: [], denyCommands: [] } };
const input = () => ({ name: "Shared plan", permissions: structuredClone(permissions), limits: { diskQuotaMb: 1024, maxDomains: 2, maxEmailAccounts: 3, maxDatabases: 1, maxSubUsers: 2, cpuPercent: 100, memoryMb: 256, maxProcesses: 32 }, security: { shell: "disabled", maxTerminalSessions: 1, commandTimeoutSeconds: 20, sessionHours: 1, requireMfa: false, mailTargetIds: [] } });
const plan = () => ({ ...input(), id: "plan", revision: 1 });
function account() { const base = normalizeRolePermissions({ ...permissions, fileAccess: { ...permissions.fileAccess, allowPaths: ["/home/client"], defaultPath: "/home/client" } }); return { id: 9, username: "client", status: "active", templateId: "plan", tenantGroup: "h-client", homeRoot: "/home/client", templateBase: base, permissionTemplate: base, policyState: "ready", runtimeRevision: 1, limitOverrides: { maxDomains: 1 } } as any; }
beforeEach(() => {
  vi.clearAllMocks(); mock.events = []; mock.providers = [];
  mock.store.get.mockResolvedValue(plan()); mock.store.set.mockImplementation(async () => { mock.events.push("publish"); }); mock.store.create.mockImplementation(async input => input);
  mock.accounts.findAll.mockResolvedValue({ rows: [] }); mock.accounts.update.mockResolvedValue({});
  mock.roles.findByName.mockResolvedValue({ id: 5, permissions: account().templateBase });
  mock.invalidate.mockImplementation(async () => { mock.events.push("fence"); }); mock.apply.mockResolvedValue(undefined);
});
describe("reusable hosting templates", () => {
  it("creates an explicit finite v2 matrix with terminal disabled", async () => {
    const result = await hostingTemplateService.create(executor, input());
    expect(result.revision).toBe(1); expect(result.permissions.version).toBe(2); expect(result.security.shell).toBe("disabled");
  });
  it("rejects root actions and an unrestricted command policy", async () => {
    const unrestricted = input(); unrestricted.permissions.commandPolicy.allowAll = true;
    await expect(hostingTemplateService.create(executor, unrestricted)).rejects.toThrow("explicit command");
    const root = input(); root.permissions.actions = ["files.read", "mail.service"]; root.permissions.views.push("panel.mail");
    await expect(hostingTemplateService.create(executor, root)).rejects.toThrow("administrator");
  });
  it("uses revision comparison to reject concurrent lost updates", async () => {
    await expect(hostingTemplateService.update(executor, "plan", 2, input())).rejects.toThrow("reload"); expect(mock.store.set).not.toHaveBeenCalled(); expect(mock.invalidate).not.toHaveBeenCalled();
  });
  it("fences linked accounts before publishing and reconciles every account", async () => {
    mock.accounts.findAll.mockResolvedValue({ rows: [account()] });
    const result = await hostingTemplateService.update(executor, "plan", 1, input());
    expect(mock.events.indexOf("fence")).toBeLessThan(mock.events.indexOf("publish")); expect(result.template.revision).toBe(2); expect(result.accounts).toEqual([{ accountId: 9, state: "ready" }]); expect(mock.epoch).toHaveBeenCalledWith("server-one");
  });
  it("keeps failed native application pending and revokes the marker again", async () => {
    mock.accounts.findAll.mockResolvedValue({ rows: [account()] }); mock.apply.mockRejectedValue(new Error("quota unavailable"));
    const result = await hostingTemplateService.update(executor, "plan", 1, input());
    expect(result.accounts[0].state).toBe("pending"); expect(mock.invalidate.mock.calls.length).toBeGreaterThanOrEqual(3); expect(mock.roles.update).not.toHaveBeenCalled();
  });
  it("keeps a suspended account's native runtime fenced after plan updates", async () => {
    const suspended = { ...account(), status: "suspended" }; await hostingTemplateService.reconcile(executor, suspended, plan() as never);
    expect(mock.invalidate).toHaveBeenCalledTimes(2);
  });
  it("prevents deleting an assigned template or provider default", async () => {
    mock.accounts.findAll.mockResolvedValue({ rows: [account()] }); await expect(hostingTemplateService.remove(executor, "plan")).rejects.toThrow("hosting accounts");
    mock.accounts.findAll.mockResolvedValue({ rows: [] }); mock.providers = [{ templateId: "plan", targetId: "server-one" }]; await expect(hostingTemplateService.remove(executor, "plan")).rejects.toThrow("provider default");
  });
  it("projects ceilings even while reconciliation is pending, retaining account reductions", async () => {
    const next = plan(); next.revision = 2; next.permissions.actions = ["files.read"];
    const projected = await hostingTemplateService.project(executor, account(), next as never);
    expect(projected.permissionTemplate.actions).toEqual(["files.read"]); expect(projected.maxDomains).toBe(1); expect(projected.policyState).toBe("pending");
  });
});
