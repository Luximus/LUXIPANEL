import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { Executor } from "../../../../shared/executor/types.js";
import type { SessionUser } from "../../../../shared/types/index.js";
import { runWithExecutor } from "../../../../shared/executor/context.js";
import { mailConfig } from "../../../../config/mail.js";

const mocks = vi.hoisted(() => ({ accounts: vi.fn(), hash: vi.fn(), credential: vi.fn(), sidecar: vi.fn(), revision: vi.fn(), refresh: vi.fn() }));
vi.mock("../accounts.helpers.js", async original => ({
  ...await original<typeof import("../accounts.helpers.js")>(), readAccountsFromServer: mocks.accounts,
}));
vi.mock("../../services/index.js", () => ({ dovecotService: { hashPasswordWithExecutor: mocks.hash }, postfixService: {} }));
vi.mock("../../services/mailbox-credential.service.js", () => ({ mailboxCredentialService: { setPassword: mocks.credential } }));
vi.mock("../../services/account-sidecar.service.js", () => ({ accountSidecarService: { update: mocks.sidecar } }));
vi.mock("../../../../shared/auth/authorization-revision.js", () => ({ authorizationRevision: mocks.revision }));
vi.mock("../../../../shared/remote-cache/refresh.js", () => ({ scheduleRefresh: mocks.refresh }));
vi.mock("../../../../shared/worklog/worklog-recorder.service.js", () => ({ recordActivity: vi.fn() }));
vi.mock("../../../../shared/events/index.js", () => ({ eventBus: { emit: vi.fn() }, Events: { ACCOUNT_UPDATED: "account.updated" } }));
vi.mock("../../../nginx/services/domains.service.js", () => ({ domainsService: {} }));
vi.mock("../../../../shared/tenant/tenant-resources.service.js", () => ({ tenantResourcesService: {} }));
vi.mock("../../../../shared/remote-cache/serve-cached-datatable.js", () => ({ serveCachedDataTable: vi.fn() }));
vi.mock("./accounts-usage.helpers.js", () => ({ getAllMailboxUsageMap: vi.fn(), getDiskTotalMb: vi.fn() }));
vi.mock("./accounts-list.js", () => ({ buildAccountItemsLive: vi.fn() }));
vi.mock("../_shared/mail-access.js", () => ({ visibleMailDomains: vi.fn() }));

import { accountsController } from "./accounts-crud.controller.js";
import { fnv1aId, type ServerAccount } from "../accounts.helpers.js";

const address = "qa@example.test";
const newHash = "{SHA512-CRYPT}new-hash";
const account: ServerAccount = { address, domain: "example.test", passwordHash: "{SHA512-CRYPT}old-hash",
  quotaMb: 100, enabled: true, incomingMode: "allow", outgoingMode: "allow", loginMode: "allow",
  plusAddressingAutoFolder: true, hasExplicitSettings: true };
function passwordRequest(kind: "admin" | "user" = "admin") {
  const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  const writeFile = vi.fn().mockResolvedValue(undefined);
  const executor = { target: { id: "mail-server", name: "Mail" }, exec, writeFile } as unknown as Executor;
  const user: SessionUser = { userId: 7, username: "operator", displayName: "Operator", role: kind, kind, modules: ["mail"],
    targetId: "panel-target", authorizationSourceTargetId: "identity-server", authorizationRevision: "7" };
  const run = () => runWithExecutor(executor, () => new Promise<unknown>((resolve, reject) => {
    const res = { locals: { mailExecutor: executor, user }, json: resolve } as unknown as Response;
    const req = { params: { id: String(fnv1aId(address)) }, body: { password: "new-password" }, res } as unknown as Request;
    accountsController.update(req, res, reject);
  }), user.userId, user);
  return { executor, exec, writeFile, run };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.accounts.mockResolvedValue([account, { ...account, address: "other@example.test" }]);
  mocks.hash.mockResolvedValue(newHash);
  mocks.credential.mockResolvedValue(undefined);
  mocks.sidecar.mockResolvedValue(undefined);
  mocks.refresh.mockResolvedValue(undefined);
  mocks.revision.mockImplementation(async (target: string) => target === "identity-server" ? "7" : "0");
});

describe("mail password updates on an independent server", () => {
  it.each(["admin", "user"] as const)("updates the mailbox and saved credential for an authorized %s", async kind => {
    const { executor, exec, writeFile, run } = passwordRequest(kind);
    await expect(run()).resolves.toMatchObject({ ok: true, job: { mode: "applied" } });
    expect(mocks.accounts).toHaveBeenCalledWith(executor);
    expect(mocks.hash).toHaveBeenCalledWith("new-password", executor);
    expect(writeFile).toHaveBeenCalledWith(expect.stringMatching(/^\/tmp\/\.lpwq-/),
      expect.stringContaining(`${address}:${newHash}:`), { mode: 0o600 });
    expect(writeFile).toHaveBeenCalledWith(expect.any(String),
      expect.stringContaining("other@example.test:{SHA512-CRYPT}old-hash:"), { mode: 0o600 });
    expect(exec).toHaveBeenCalledWith(expect.stringContaining(mailConfig.dovecot.usersFile));
    expect(mocks.credential).toHaveBeenCalledWith(address, "new-password", executor);
    expect(mocks.sidecar).toHaveBeenCalledWith(executor, address, expect.any(Function));
    expect(mocks.refresh).toHaveBeenCalledWith(executor, "mail", "accounts", undefined);
    expect(mocks.revision.mock.calls.every(([target]) => target === "identity-server")).toBe(true);
  });

  it("does not write the new hash or saved credential after authorization is revoked", async () => {
    mocks.revision.mockResolvedValue("8");
    const { exec, writeFile, run } = passwordRequest();
    await expect(run()).rejects.toThrow("Mutation authorization changed");
    expect(exec).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(mocks.sidecar).not.toHaveBeenCalled();
    expect(mocks.credential).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
