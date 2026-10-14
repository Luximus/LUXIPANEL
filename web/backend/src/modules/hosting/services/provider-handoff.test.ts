// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  link: vi.fn(), account: vi.fn(), user: vi.fn(), groups: vi.fn(), roles: vi.fn(),
  settings: vi.fn(), totp: vi.fn(), sign: vi.fn(), partial: vi.fn(), mint: vi.fn(),
  target: vi.fn(), executor: vi.fn(), cache: vi.fn(),
}));
vi.mock("../repositories/provider.repository.js", () => ({ providerRepository: { findAccount: m.link } }));
vi.mock("./hosting.service.js", () => ({ hostingService: { findById: m.account } }));
vi.mock("../repositories/hosting-account.repository.js", () => ({ hostingAccountRepository: { findAll: async () => ({ rows: [await m.account()] }) } }));
vi.mock("../../nginx/services/nginx-sites.service.js", () => ({ nginxSitesService: {} }));
vi.mock("../../auth/repositories/index.js", () => ({ panelUserRepository: { findByUsername: m.user }, totpRepository: { getByUser: m.totp } }));
vi.mock("../../users/services/system-accounts.service.js", () => ({ systemAccountsService: { userGroups: m.groups } }));
vi.mock("../../users/repositories/role.repository.js", () => ({ roleRepository: { findAll: m.roles } }));
vi.mock("../../admin/services/module-registry.service.js", () => ({ moduleRegistryService: { getAll: () => [
  { id: "files", name: "Files" }, { id: "mail", name: "Mail" }, { id: "assistant", name: "AI" },
] } }));
vi.mock("../../admin/services/security-settings.service.js", () => ({ securitySettingsService: { read: m.settings } }));
vi.mock("../../auth/services/token.service.js", () => ({
  tokenService: { signWithExpiry: m.sign, signPartial: m.partial },
  parseDuration: (_: string, fallback: number) => fallback,
}));
vi.mock("../../auth/services/sso-handoff.service.js", () => ({ ssoHandoffService: { mint: m.mint } }));
vi.mock("../../auth/services/ssh-credentials-cache.service.js", () => ({ sshCredentialsCache: { put: m.cache } }));
vi.mock("../../auth/services/login-acl.service.js", () => ({ loginAclService: { read: async () => null, refresh: async () => {} } }));
vi.mock("../../servers/repositories/targets.repository.js", () => ({ targetsRepository: { getView: m.target, getMaterial: m.target } }));
vi.mock("../../../shared/executor/vault-executor.js", () => ({ getVaultExecutor: m.executor }));

import { providerService } from "./provider.service.js";
import { invalidateRolesCache } from "../../auth/services/auth/auth-roles-cache.js";
import { deriveModulesFromPermissions } from "../../auth/services/role-permissions.service.js";

const provider = { id: "luxisoft", targetId: "local", panelUrl: "https://panel.example.com" } as never;
const account = {
  id: 7, username: "hp123", displayName: "Old hosting label", status: "active",
  notes: "LUXIPANEL_PROVIDER:luxisoft:business", tenantGroup: "h-hp123", homeRoot: "/home/hp123",
  allowedModules: ["mail"], permissionTemplate: { views: ["panel.mail"] },
  maxSubUsers: 2, maxDomains: 3, maxEmailAccounts: 4, maxDatabases: 5,
  diskQuotaMb: 100, bandwidthQuotaMb: 200, jailEnabled: false,
};
const permissions = {
  sidebar: ["files", "preferences"], views: ["panel.files", "panel.preferences"],
  actions: ["files.read", "files.chmod", "files.chown"],
  fileAccess: { allowAll: false, allowPaths: ["/home/hp123"], defaultPath: "/home/hp123" },
};

beforeEach(() => {
  vi.resetAllMocks(); invalidateRolesCache();
  m.link.mockResolvedValue({ accountId: 7, targetId: "local" });
  m.account.mockResolvedValue({ ...account });
  m.user.mockResolvedValue({ id: 91, username: "hp123", displayName: "Panel user", enabled: true, groups: ["outdated"], modules: null });
  m.groups.mockResolvedValue(["business-team"]);
  // Old derivation accidentally stored admin because files.chmod/chown overlap.
  m.roles.mockResolvedValue([{ name: "business-team", modules: ["files", "admin"], permissions }]);
  m.settings.mockResolvedValue({ requireTwoFa: false, sessionDurationHours: 2 });
  m.totp.mockResolvedValue(null);
  m.sign.mockImplementation((_payload, expiresAt) => ({ token: "normal-session", expiresAt }));
  m.partial.mockReturnValue({ token: "partial-session" });
  m.mint.mockResolvedValue("opaque-ticket");
});

describe("provider access uses the ordinary panel identity", () => {
  it("uses real user id and current group permissions through normal session issuance", async () => {
    const before = Date.now();
    expect(await providerService.issueHandoff(provider, "business")).toEqual({
      url: "https://panel.example.com/api/auth/sso/handoff", ticket: "opaque-ticket", expiresInSeconds: 60,
    });
    const [payload, expiry] = m.sign.mock.calls[0]!;
    expect(payload).toMatchObject({ userId: 91, username: "hp123", displayName: "Panel user", role: "user", kind: "user",
      modules: ["files"], local: true, targetId: "local", owner: "hp123", homeRoot: "/home/hp123", tenantId: 7 });
    expect(payload.permissions.views).toContain("panel.files");
    expect(payload.permissions.views).not.toContain("panel.mail");
    expect(payload.permissions.fileAccess.allowAll).toBe(false);
    expect(payload.permissions.actions).toContain("files.chmod");
    expect(payload.permissions.views).not.toContain("panel.settings");
    expect(m.groups).toHaveBeenCalledWith("hp123");
    expect(m.totp).toHaveBeenCalledWith(91);
    expect(expiry).toBeGreaterThanOrEqual(before + 2 * 60 * 60_000);
    expect(m.mint).toHaveBeenCalledWith({ token: "normal-session", expiresAt: expiry, remember: false });
    expect(m.cache).not.toHaveBeenCalled();
  });

  it("uses updated group selections on the next entry", async () => {
    await providerService.issueHandoff(provider, "business");
    invalidateRolesCache();
    m.roles.mockResolvedValue([{ name: "business-team", modules: ["files"], permissions: { sidebar: ["mail"], views: ["panel.mail"], actions: [] } }]);
    await providerService.issueHandoff(provider, "business");
    const payload = m.sign.mock.calls[1]![0];
    expect(payload.modules).toEqual(["mail"]);
    expect(payload.permissions.views).toContain("panel.mail");
    expect(payload.permissions.views).not.toContain("panel.files");
  });

  it.each([false, undefined])("rejects disabled or missing panel users (%s)", async (enabled) => {
    m.user.mockResolvedValue(enabled === undefined ? null : { id: 91, username: "hp123", enabled });
    await expect(providerService.issueHandoff(provider, "business")).rejects.toThrow();
    expect(m.sign).not.toHaveBeenCalled(); expect(m.mint).not.toHaveBeenCalled();
  });

  it.each([{ status: "suspended" }, { expiresAt: "2020-01-01T00:00:00Z" }])("rejects inactive hosting resources", async (patch) => {
    m.account.mockResolvedValue({ ...account, ...patch });
    await expect(providerService.issueHandoff(provider, "business")).rejects.toThrow("inactiva");
    expect(m.mint).not.toHaveBeenCalled();
  });

  it.each(["global", "user", "race"])("does not bypass %s MFA", async (mode) => {
    if (mode === "global") m.settings.mockResolvedValue({ requireTwoFa: true, sessionDurationHours: 2 });
    else if (mode === "user") m.totp.mockResolvedValue({ enabled: true });
    else m.totp.mockResolvedValueOnce(null).mockResolvedValue({ enabled: true });
    await expect(providerService.issueHandoff(provider, "business")).rejects.toThrow();
    expect(m.sign).not.toHaveBeenCalled(); expect(m.mint).not.toHaveBeenCalled();
  });

  it("rejects foreign target links and lost provider ownership", async () => {
    m.link.mockResolvedValue({ accountId: 7, targetId: "foreign" });
    await expect(providerService.issueHandoff(provider, "business")).rejects.toThrow();
    m.link.mockResolvedValue({ accountId: 7, targetId: "local" });
    m.account.mockResolvedValue({ ...account, notes: "LUXIPANEL_PROVIDER:another:business" });
    await expect(providerService.issueHandoff(provider, "business")).rejects.toThrow("vinculación");
    expect(m.mint).not.toHaveBeenCalled();
  });

  it("binds remote bridge ownership to the real panel user and session lifetime", async () => {
    const remote = { ...provider as object, targetId: "remote" } as never;
    m.link.mockResolvedValue({ accountId: 7, targetId: "remote" });
    m.target.mockResolvedValue({ enabled: true, hostFingerprint: "approved", target: { enabled: true, hostFingerprint: "approved", name: "Remote" }, material: { host: "remote.example.com" } });
    m.executor.mockResolvedValue({ target: { id: "remote", name: "Remote" } });
    await providerService.issueHandoff(remote, "business");
    const payload = m.sign.mock.calls[0]![0];
    expect(payload).toMatchObject({ userId: 91, kind: "user", direct: true, targetId: "remote" });
    expect(m.cache.mock.calls[0]![1]).toMatchObject({ userId: 91, owner: "hp123", targetId: "remote" });
    expect(m.cache.mock.calls[0]![2]).toBeGreaterThanOrEqual(7199);
  });

  it("file ownership actions and preferences never imply administrator", () => {
    expect(deriveModulesFromPermissions(permissions)).toEqual(["files"]);
    expect(deriveModulesFromPermissions({ sidebar: ["settings"], views: ["panel.settings"] })).toContain("admin");
  });
});
