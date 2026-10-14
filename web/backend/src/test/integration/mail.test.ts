vi.mock("../../shared/redis/index.js", () => ({ getRedis: () => ({ exists: async () => 0, get: async () => null, set: async () => "OK", incr: async () => 1, publish: async () => 0 }) }));
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Integration tests — Mail module endpoints
 *
 * Verifies module permission guards, account CRUD shapes,
 * and CSRF enforcement on mutating endpoints.
 */

import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("../../shared/executor/factory.js", async () =>
  (await import("../helpers/executor.helper.js")).executorFactoryMock());

vi.mock("../../config/auth.js", () => ({
  authConfig: {
    jwt: {
      secret: "test-secret-key-at-least-32-characters-long!!",
      expiresIn: "1h",
      rememberExpiresIn: "7d",
    },
    cookie: {
      sessionName: "luxipanel_session",
      csrfName: "luxipanel_csrf",
      secure: false,
      sameSite: "lax" as const,
      domain: "",
      legacyDomains: [],
    },
  },
}));

vi.mock("../../modules/auth/repositories/index.js", () => ({
  panelUserRepository: {
    findAllWithRoles: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  auditRepository: { append: vi.fn().mockResolvedValue(undefined) },
}));

// vi.hoisted: vi.mock factories are hoisted above top-level `const`s, so any
// shared fixture they reference must be hoisted too.
// The mail module is server-file based now (no DB): accounts live in
// /etc/postfix/vmailbox + /etc/dovecot/users on the connected server, read via
// `readAccountsFromServer` and written via the write-behind queue
// (`submitMutation`). We mock at those seams.
const { mockServerAccount } = vi.hoisted(() => ({
  mockServerAccount: {
    address: "user@example.com",
    domain: "example.com",
    passwordHash: "{BLF-CRYPT}existing-hash",
    quotaMb: 1024,
    enabled: true,
    incomingMode: "allow" as const,
    outgoingMode: "allow" as const,
    loginMode: "allow" as const,
    plusAddressingAutoFolder: true,
    hasExplicitSettings: true,
  },
}));

// Canonical account state read from the connected server. Keep the pure
// helpers (fnv1aId, encode/decodeDovecotHash) real via importOriginal.
vi.mock("../../modules/mail/controllers/accounts.helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../modules/mail/controllers/accounts.helpers.js")>();
  return {
    ...actual,
    readAccountsFromServer: vi.fn().mockResolvedValue([mockServerAccount]),
  };
});

// create validates the domain against the DNS/NGINX domains service.
vi.mock("../../modules/nginx/services/domains.service.js", () => ({
  domainsService: {
    list: vi.fn().mockResolvedValue([{ name: "example.com" }]),
  },
}));

// Write-behind queue: mutations are submitted as step recipes; return an
// applied job so controllers respond without touching Redis/SSH.
vi.mock("../../shared/remote-cache/submit-mutation.js", () => ({
  submitMutation: vi.fn().mockResolvedValue({ jobId: "test-job-1", mode: "applied" }),
}));

vi.mock("../../modules/mail/services/mail-crypto.service.js", () => ({
  mailCryptoService: {
    encrypt: vi.fn().mockReturnValue("encrypted"),
    decrypt: vi.fn().mockReturnValue("plaintext"),
  },
}));

vi.mock("../../modules/mail/services/account-sidecar.service.js", () => ({
  accountSidecarService: {
    update: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    readAll: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../modules/mail/services/mailbox-credential.service.js", () => ({
  mailboxCredentialService: {
    setPassword: vi.fn().mockResolvedValue(undefined),
    getEncrypted: vi.fn().mockResolvedValue(null),
    rekey: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../modules/mail/services/dovecot.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../modules/mail/services/dovecot.service.js")>();
  return {
    ...actual, // keep pure renderers (renderDovecotUsersContent) real
    dovecotService: {
      hashPasswordWithExecutor: vi.fn().mockResolvedValue("{BLF-CRYPT}hashed"),
      ensureMaildirWithExecutor: vi.fn().mockResolvedValue(undefined),
      regenerateUsersFileWithExecutor: vi.fn().mockResolvedValue(undefined),
      reloadWithExecutor: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock("../../modules/mail/services/postfix.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../modules/mail/services/postfix.service.js")>();
  return {
    ...actual, // keep pure renderers (renderPostfixMailboxContent/DomainsContent) real
    postfixService: {
      regenerateMailboxMapWithExecutor: vi.fn().mockResolvedValue(undefined),
      regenerateDomainMapWithExecutor: vi.fn().mockResolvedValue(undefined),
      reloadWithExecutor: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock("../../modules/mail/services/sieve.service.js", () => ({
  sieveService: {
    writeAccountFiltersAndForwardsWithExecutor: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../shared/events/index.js", () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() },
  Events: {
    MAIL_ACCOUNT_CREATED: "mail:account_created",
    MAIL_ACCOUNT_DELETED: "mail:account_deleted",
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────

import { buildTestApp } from "../helpers/app.helper.js";
import { registerMailModule } from "../../modules/mail/index.js";
import { fnv1aId } from "../../modules/mail/controllers/accounts.helpers.js";
import {
  signTestToken,
  TEST_USER_PAYLOAD,
} from "../helpers/token.helper.js";

const MAIL_USER_PAYLOAD = { ...TEST_USER_PAYLOAD, modules: ["mail"] };
const app = buildTestApp([registerMailModule]);

// Accounts are identified by the FNV-1a hash of their address (no DB ids).
const mockAccountId = fnv1aId(mockServerAccount.address);

const mailAuth  = () => `Bearer ${signTestToken(MAIL_USER_PAYLOAD)}`;

// ── Tests ─────────────────────────────────────────────────────────────────

describe("GET /api/accounts", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/api/accounts");
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user without mail module", async () => {
    // Admins bypass per-user module checks (requireModule grants kind=admin
    // access to every enabled module), so this must be a non-admin token.
    const noMailToken = signTestToken({ ...TEST_USER_PAYLOAD, modules: [] });
    const res = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${noMailToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 200 for user with mail module", async () => {
    const res = await request(app)
      .get("/api/accounts")
      .set("Authorization", mailAuth());

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("includes pagination metadata when list query params are sent", async () => {
    // Without list query params the endpoint returns a bare array; with them
    // it returns { items, total, page, pageSize, totalPages, ... }.
    const res = await request(app)
      .get("/api/accounts?page=1&limit=20")
      .set("Authorization", mailAuth());

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeDefined();
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.page).toBe(1);
  });
});

describe("POST /api/accounts", () => {
  const csrfToken = "test-csrf-67890";

  it("returns 401 without auth", async () => {
    const res = await request(app).post("/api/accounts").send({});
    expect(res.status).toBe(401);
  });

  it("returns 403 without CSRF token", async () => {
    const res = await request(app)
      .post("/api/accounts")
      .set("Authorization", mailAuth())
      .send({ email: "new@example.com", password: "ValidPass1" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CSRF_ERROR");
  });

  it("returns 400 for missing address", async () => {
    const res = await request(app)
      .post("/api/accounts")
      .set("Authorization", mailAuth())
      .set("Cookie", `luxipanel_csrf=${csrfToken}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ password: "ValidPass1" }); // missing address / localPart+domain

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it("returns 201 with valid data and CSRF", async () => {
    const res = await request(app)
      .post("/api/accounts")
      .set("Authorization", mailAuth())
      .set("Cookie", `luxipanel_csrf=${csrfToken}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ address: "new@example.com", password: "ValidPass1" });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.address).toBe("new@example.com");
    expect(res.body.data.id).toBe(fnv1aId("new@example.com"));
  });
});

describe("DELETE /api/accounts/:id", () => {
  const csrfToken = "test-csrf-delete";

  it("returns 401 without auth", async () => {
    const res = await request(app).delete(`/api/accounts/${mockAccountId}`);
    expect(res.status).toBe(401);
  });

  it("returns 403 without CSRF", async () => {
    const res = await request(app)
      .delete(`/api/accounts/${mockAccountId}`)
      .set("Authorization", mailAuth());

    expect(res.status).toBe(403);
  });

  it("returns 200 when account exists", async () => {
    const res = await request(app)
      .delete(`/api/accounts/${mockAccountId}`)
      .set("Authorization", mailAuth())
      .set("Cookie", `luxipanel_csrf=${csrfToken}`)
      .set("X-CSRF-Token", csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("GET /api/accounts/:accountId/forwards", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get(`/api/accounts/${mockAccountId}/forwards`);
    expect(res.status).toBe(401);
  });

  it("returns 200 with forwards list", async () => {
    const res = await request(app)
      .get(`/api/accounts/${mockAccountId}/forwards`)
      .set("Authorization", mailAuth());

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
