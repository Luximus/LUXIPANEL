// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { HostingAccount } from "../../modules/hosting/models/hosting-account.model.js";
import type { Executor, ExecResult } from "../executor/types.js";

// Avoid loading config/env (and process.exit on missing JWT_SECRET) by stubbing
// the logger this module pulls in.
vi.mock("../logger/index.js", () => ({
  createModuleLogger: () => ({
    debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, trace: () => {}, fatal: () => {},
  }),
}));

// ── Mocks of the dynamically-imported modules ────────────────────────────────
let sites: Array<{ root: string | null; domains: string[] }> = [];
vi.mock("../../modules/nginx/services/index.js", () => ({
  nginxSitesService: { listSites: vi.fn(async () => sites) },
}));

let mailAccounts: Array<{ address: string }> = [];
vi.mock("../../modules/mail/controllers/accounts.helpers.js", () => ({
  readAccountsFromServer: vi.fn(async () => mailAccounts),
}));

let dbs: Record<string, Array<{ name: string }>> = { mysql: [], postgresql: [] };
vi.mock("../../modules/databases/services/databases.service.js", () => ({
  databasesService: { listDatabases: vi.fn(async (_e: unknown, engine: string) => dbs[engine] ?? []) },
}));

const auditAppend = vi.fn(async () => ({}));
vi.mock("../../modules/hosting/repositories/audit.repository.js", () => ({
  hostingAuditRepository: { append: (...a: unknown[]) => auditAppend(...a) },
}));

const {
  checkDiskUsageMb,
  countTenantDomains,
  countTenantEmails,
  countTenantDatabases,
  countTenantSubUsers,
  readTenantUsage,
  assertResourceQuota,
} = await import("./quota-checker.js");
const { QuotaExceededError } = await import("../errors/index.js");

// ── Fake executor whose exec() is scripted per regex ──────────────────────────
function makeExecutor(handlers: Array<{ match: RegExp; out: string; code?: number }>): Executor {
  const exec = vi.fn(async (cmd: string): Promise<ExecResult> => {
    for (const h of handlers) {
      if (h.match.test(cmd)) {
        return { stdout: h.out, stderr: "", exitCode: h.code ?? 0, durationMs: 1 };
      }
    }
    return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
  });
  return { target: { id: "srv", name: "srv" }, exec } as unknown as Executor;
}

function account(overrides: Partial<HostingAccount> = {}): HostingAccount {
  return {
    id: 7,
    username: "sample-user",
    displayName: null,
    email: null,
    passwordHash: "x",
    plan: "basic",
    status: "active",
    tenantGroup: "h-sample-user",
    homeRoot: "/home/sample-user",
    allowedModules: ["nginx", "mail"],
    permissionTemplate: {} as HostingAccount["permissionTemplate"],
    jailEnabled: false,
    diskQuotaMb: 1000,
    bandwidthQuotaMb: 10000,
    maxDomains: 2,
    maxEmailAccounts: 3,
    maxDatabases: 2,
    maxSubUsers: 2,
    notes: null,
    suspendedAt: null,
    expiresAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  sites = [];
  mailAccounts = [];
  dbs = { mysql: [], postgresql: [] };
  auditAppend.mockClear();
});

describe("checkDiskUsageMb", () => {
  it("uses repquota (KB→MB) when it returns data", async () => {
    const ex = makeExecutor([{ match: /repquota/, out: "204800\n" }]); // 200 MB in KB
    const r = await checkDiskUsageMb(ex, "/home/sample-user", "sample-user");
    expect(r).toEqual({ usedMb: 200, method: "quota-tools" });
  });

  it("falls back to du when repquota yields nothing", async () => {
    const ex = makeExecutor([
      { match: /repquota/, out: "" },
      { match: /du -sm/, out: "512\t/home/sample-user\n" },
    ]);
    const r = await checkDiskUsageMb(ex, "/home/sample-user", "sample-user");
    expect(r).toEqual({ usedMb: 512, method: "du-best-effort" });
  });
});

describe("ownership-scoped counts", () => {
  it("countTenantDomains counts only vhosts rooted under homeRoot", async () => {
    sites = [
      { root: "/home/sample-user/site1", domains: ["a.com"] },
      { root: "/home/sample-user", domains: ["b.com"] },
      { root: "/var/www/other", domains: ["evil.com"] }, // outside → not counted
    ];
    expect(await countTenantDomains(makeExecutor([]), "/home/sample-user")).toBe(2);
  });

  it("countTenantEmails counts mailboxes in tenant domains only", async () => {
    sites = [{ root: "/home/sample-user/web", domains: ["mine.com"] }];
    mailAccounts = [
      { address: "a@mine.com" },
      { address: "b@mine.com" },
      { address: "c@notmine.com" }, // domain not owned → not counted
    ];
    expect(await countTenantEmails(makeExecutor([]), account())).toBe(2);
  });

  it("countTenantEmails returns 0 when tenant owns no domains", async () => {
    sites = [];
    mailAccounts = [{ address: "a@mine.com" }];
    expect(await countTenantEmails(makeExecutor([]), account())).toBe(0);
  });

  it("countTenantDatabases matches <owner> and <owner>_* across engines", async () => {
    dbs = {
      mysql: [{ name: "sample-user" }, { name: "sample-user_app" }, { name: "shared" }],
      postgresql: [{ name: "sample-user_blog" }, { name: "postgres" }],
    };
    expect(await countTenantDatabases(makeExecutor([]), "sample-user")).toBe(3);
  });

  it("countTenantSubUsers excludes the owner and dedups", async () => {
    const ex = makeExecutor([
      { match: /getent group/, out: "h-sample-user:x:5001:sample-user,alice,bob,alice\n" },
    ]);
    expect(await countTenantSubUsers(ex, "h-sample-user", "sample-user")).toBe(2);
  });

  it("inconclusive: counts return null on exec/list failure (enforcement fails closed)", async () => {
    const ex = {
      target: { id: "srv", name: "srv" },
      exec: vi.fn(async () => { throw new Error("ssh down"); }),
    } as unknown as Executor;
    // A thrown probe is INCONCLUSIVE (null), not a genuine 0 — so
    // assertResourceQuota can fail closed instead of over-provisioning. The
    // /stats card coalesces null → 0 for its fail-open display.
    expect(await countTenantSubUsers(ex, "h-sample-user", "sample-user")).toBeNull();
  });
});

describe("readTenantUsage", () => {
  it("aggregates + flags near-cap warnings (≥85%)", async () => {
    sites = [
      { root: "/home/sample-user/s1", domains: ["mine.com"] },
      { root: "/home/sample-user/s2", domains: ["two.com"] },
    ]; // 2/2 domains → 100% → warning
    mailAccounts = [{ address: "a@mine.com" }];
    const ex = makeExecutor([
      { match: /repquota/, out: "" },
      { match: /du -sm/, out: "950\t/home/sample-user\n" }, // 950/1000 = 95% → warning
      { match: /getent group/, out: "h-sample-user:x:5001:sample-user\n" }, // 0 sub-users
    ]);
    const u = await readTenantUsage(ex, account());
    expect(u.domainsUsed).toBe(2);
    expect(u.emailAccountsUsed).toBe(1);
    expect(u.subUsersUsed).toBe(0);
    expect(u.quotaMethod).toBe("du-best-effort");
    expect(u.warnings.some((w) => w.startsWith("Disco"))).toBe(true);
    expect(u.warnings.some((w) => w.startsWith("Dominios"))).toBe(true);
  });
});

describe("assertResourceQuota", () => {
  it("passes when current+1 <= max", async () => {
    sites = [{ root: "/home/sample-user/s1", domains: ["mine.com"] }]; // 1 domain, max 2
    await expect(
      assertResourceQuota({ executor: makeExecutor([]), account: account(), resource: "domain" }),
    ).resolves.toBeUndefined();
    expect(auditAppend).not.toHaveBeenCalled();
  });

  it("throws QuotaExceededError (402) + audits when cap reached", async () => {
    dbs = { mysql: [{ name: "sample-user_a" }, { name: "sample-user_b" }], postgresql: [] }; // 2 == max 2
    let err: unknown;
    try {
      await assertResourceQuota({ executor: makeExecutor([]), account: account(), resource: "database" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(QuotaExceededError);
    expect((err as InstanceType<typeof QuotaExceededError>).statusCode).toBe(402);
    expect((err as InstanceType<typeof QuotaExceededError>).code).toBe("QUOTA_EXCEEDED");
    expect(auditAppend).toHaveBeenCalledTimes(1);
  });

  it("never throws for Infinity caps (legacy/unlimited)", async () => {
    dbs = { mysql: [{ name: "sample-user_a" }], postgresql: [] };
    await expect(
      assertResourceQuota({
        executor: makeExecutor([]),
        account: account({ maxDatabases: Infinity }),
        resource: "database",
      }),
    ).resolves.toBeUndefined();
  });
});
