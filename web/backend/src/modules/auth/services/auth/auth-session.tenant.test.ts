import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ enabled: true, partial: vi.fn(), full: vi.fn(), requireMfa: true }));
vi.mock("../../repositories/index.js", () => ({ totpRepository: { getByUser: async () => ({ enabled: mock.enabled }) } }));
vi.mock("../../../admin/services/security-settings.service.js", () => ({ securitySettingsService: { read: async () => ({ requireTwoFa: false, sessionDurationHours: 24 }) } }));
vi.mock("../token.service.js", () => ({ tokenService: { signPartial: mock.partial, signWithExpiry: mock.full }, parseDuration: () => 86_400_000 }));
vi.mock("./auth-token.service.js", () => ({ authTokenService: { buildTokenPayload: async (u: any) => ({ userId: u.id, username: u.username, kind: "user", role: "user", modules: [] }) } }));
vi.mock("../../../hosting/repositories/hosting-account.repository.js", () => ({ hostingAccountRepository: { findAll: async () => ({ rows: [{ id: 90, username: "owner", tenantGroup: "h-owner", homeRoot: "/home/owner", status: "active", templateId: "plan", security: { requireMfa: mock.requireMfa } }] }) } }));
vi.mock("../../../hosting/services/hosting-template.service.js", () => ({ hostingTemplateService: { project: async (_exec: unknown, account: unknown) => account } }));
import { authSessionService } from "./auth-session.service.js";
const user = () => ({ id: 21, username: "child", groups: ["h-owner"], bridge: { bridgeSessionId: "test", targetId: "server", targetName: "Server", sshUsername: "service", executor: { target: { id: "server" } } as never } });
beforeEach(() => { vi.clearAllMocks(); mock.enabled = true; mock.requireMfa = true; mock.partial.mockReturnValue({ token: "partial" }); });
describe("hosting MFA session", () => {
  it("carries the signed account envelope into the MFA token for a sub-user", async () => {
    await expect(authSessionService.issueSession(user(), false)).resolves.toEqual({ mfaPending: true });
    expect(mock.partial).toHaveBeenCalledWith(expect.objectContaining({ kind: "mfa_pending", userId: 21, owner: "owner", tenantId: 90, homeRoot: "/home/owner", direct: true, bridgeSessionId: "test" }));
    expect(mock.full).not.toHaveBeenCalled();
  });
  it("refuses a full session when the plan requires MFA but TOTP is disabled", async () => {
    mock.enabled = false;
    await expect(authSessionService.issueSession(user(), false)).rejects.toMatchObject({ code: "TWO_FA_REQUIRED" });
    expect(mock.partial).not.toHaveBeenCalled(); expect(mock.full).not.toHaveBeenCalled();
  });
});
