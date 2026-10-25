import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeRolePermissions } from "../../../shared/auth/role-permissions.js";
const state = vi.hoisted(() => ({ revision: 0, enabled: true, groups: [] as string[], accounts: [] as any[], roles: [] as any[], actions: ["mail.read"], unavailable: false }));
vi.mock("./permission-migration.service.js", () => ({ migratePermissionSnapshots: vi.fn() }));
vi.mock("../../../shared/auth/authorization-revision.js", () => ({ authorizationRevision: async () => { if (state.unavailable) throw new Error("Redis unavailable"); return String(state.revision); } }));
vi.mock("../repositories/index.js", () => ({ panelUserRepository: { findById: async () => ({ id: 7, username: "client", enabled: state.enabled }), findByUsername: async () => ({ id: 7, username: "client", enabled: state.enabled }) } }));
vi.mock("../../users/services/system-accounts.service.js", () => ({ systemAccountsService: { userGroups: async () => state.groups } }));
vi.mock("./auth/auth-token.service.js", () => ({ authTokenService: { buildTokenPayload: async () => ({ kind: "user", role: "user", modules: ["mail"], permissions: { actions: state.actions, views: ["panel.mail"] } }) } }));
vi.mock("./auth/auth-roles-cache.js", () => ({ invalidateRolesCache: vi.fn(), getRolesForTarget: async () => state.roles }));
vi.mock("../../hosting/repositories/hosting-account.repository.js", () => ({ hostingAccountRepository: { findAll: async () => ({ rows: state.accounts }), findById: async (id: number) => state.accounts.find(a => a.id === id) } }));
vi.mock("../../hosting/services/hosting-template.service.js", () => ({ hostingTemplateService: { project: async (_executor: unknown, account: unknown) => account } }));
import { resolveLiveAuthorization } from "./live-authorization.service.js";
const executor = (id = "one") => ({ target: { id } }) as never;
const session = (extra: Record<string, unknown> = {}) => ({ userId: 7, username: "client", kind: "user", role: "user", modules: ["admin"], permissions: { actions: ["mail.delete"] }, sessionIssuedAt: Date.now() / 1000, ...extra }) as never;
function account(extra: Record<string, unknown> = {}) {
  return { id: 41, username: "client", tenantGroup: "h-client", homeRoot: "/home/client", status: "active", allowedModules: ["mail", "users"], maxSubUsers: 2, maxDomains: 2, maxEmailAccounts: 2, maxDatabases: 1, diskQuotaMb: 1000,
    templateId: "plan", templateRevision: 1, policyState: "ready", permissionTemplate: normalizeRolePermissions({ version: 2, views: ["panel.mail", "panel.users"], actions: ["mail.read", "mail.delete", "users.view"], fileAccess: { allowPaths: ["/home/client"] } }), ...extra };
}
beforeEach(() => { state.revision++; state.enabled = true; state.groups = []; state.accounts = []; state.roles = []; state.actions = ["mail.read"]; state.unavailable = false; });
describe("live authorization", () => {
  it("uses current group grants instead of signed stale grants", async () => {
    const live = await resolveLiveAuthorization(session(), executor());
    expect(live.kind).toBe("user"); expect(live.modules).toEqual(["mail"]); expect(live.permissions?.actions).toEqual(["mail.read"]);
  });
  it("invalidates its cache immediately on a target revision", async () => {
    await resolveLiveAuthorization(session(), executor()); state.actions = []; state.revision++;
    expect((await resolveLiveAuthorization(session(), executor())).permissions?.actions).toEqual([]);
  });
  it("rejects a disabled account despite a previously valid JWT", async () => {
    await resolveLiveAuthorization(session(), executor()); state.enabled = false; state.revision++;
    await expect(resolveLiveAuthorization(session(), executor())).rejects.toThrow("disabled");
  });
  it("keeps request-specific bridge and MFA claims outside the cache", async () => {
    await resolveLiveAuthorization(session({ bridgeSessionId: "first", mfaAuthenticated: true }), executor());
    const next = await resolveLiveAuthorization(session({ bridgeSessionId: "second", mfaAuthenticated: false }), executor());
    expect(next.bridgeSessionId).toBe("second"); expect(next.mfaAuthenticated).toBe(false);
  });
  it.each(["local", "ssh-identity"])("binds fresh and cached authorization to %s despite operation target changes", async source => {
    const live = await resolveLiveAuthorization(session({ targetId: "panel-target", authorizationSourceTargetId: "stale-source" }), executor(source));
    expect(live.authorizationSourceTargetId).toBe(source);
    expect(live.authorizationRevision).toBe(String(state.revision));
    // A mail-only override can change the execution host without changing
    // the source of the user's grants, including on the next cache hit.
    const cached = await resolveLiveAuthorization(session({ targetId: "mail-target", authorizationSourceTargetId: "untrusted-source" }), executor(source));
    expect(cached.targetId).toBe("mail-target");
    expect(cached.authorizationSourceTargetId).toBe(source);
    expect(cached.authorizationRevision).toBe(live.authorizationRevision);
    state.actions = [];
    state.revision++;
    const revoked = await resolveLiveAuthorization(session({ targetId: "mail-target" }), executor(source));
    expect(revoked.authorizationSourceTargetId).toBe(source);
    expect(revoked.permissions?.actions).toEqual([]);
  });
  it("does not reuse one server's grants on another server", async () => {
    await resolveLiveAuthorization(session(), executor()); state.actions = [];
    expect((await resolveLiveAuthorization(session(), executor("two"))).permissions?.actions).toEqual([]);
  });
  it("fails closed when the revision store is unavailable", async () => {
    await resolveLiveAuthorization(session(), executor()); state.unavailable = true;
    await expect(resolveLiveAuthorization(session(), executor())).rejects.toThrow("Redis unavailable");
  });
  it("links the legacy hosting account id without confusing it with a panel user id", async () => {
    state.accounts = [account()]; state.groups = ["h-client"];
    const live = await resolveLiveAuthorization(session({ kind: "hosting", userId: 41 }), executor());
    expect(live.tenantId).toBe(41); expect(live.userId).toBe(7); expect(live.kind).toBe("user"); expect(live.owner).toBe("client");
  });
  it("rejects a disabled owner with a legacy hosting token", async () => {
    state.accounts = [account()]; state.enabled = false;
    await expect(resolveLiveAuthorization(session({ kind: "hosting", userId: 41 }), executor())).rejects.toThrow("disabled");
  });
  it("does not grant a sub-user the provider-managed root group matrix", async () => {
    state.accounts = [account({ username: "owner", homeRoot: "/home/owner", tenantGroup: "h-owner" })]; state.groups = ["h-owner"];
    const live = await resolveLiveAuthorization(session(), executor());
    expect(live.tenantId).toBe(41); expect(live.permissions?.actions).toEqual([]);
  });
  it("rejects cross-account membership and an old tenant claim", async () => {
    state.accounts = [account()]; state.groups = ["h-client"];
    await expect(resolveLiveAuthorization(session({ tenantId: 999 }), executor())).rejects.toThrow("membership changed");
  });
  it("rejects expired hosting accounts and privileged Linux membership", async () => {
    state.accounts = [account({ expiresAt: "2000-01-01T00:00:00Z" })];
    await expect(resolveLiveAuthorization(session(), executor())).rejects.toThrow("inactive");
    state.accounts = [account()]; state.groups = ["h-client", "sudo"]; state.revision++;
    await expect(resolveLiveAuthorization(session(), executor())).rejects.toThrow("privileged");
  });
  it("checks MFA even when the account projection was cached", async () => {
    state.accounts = [account({ security: { requireMfa: true, sessionHours: 24 } })];
    await resolveLiveAuthorization(session({ mfaAuthenticated: true }), executor());
    await expect(resolveLiveAuthorization(session({ mfaAuthenticated: false }), executor())).rejects.toThrow("MFA");
  });
  it("limits session age independently of JWT refresh", async () => {
    state.accounts = [account({ security: { requireMfa: false, sessionHours: 1 } })];
    await expect(resolveLiveAuthorization(session({ sessionIssuedAt: Date.now() / 1000 - 7200 }), executor())).rejects.toThrow("lifetime");
  });
});
