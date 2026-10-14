// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `withImap` login order: the panel's Dovecot master user first, then the
 * per-account credential; connectivity failures don't get replayed per login;
 * the 409 the inbox UI keys on is raised when every login is rejected.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { attempts, outcomes } = vi.hoisted(() => ({
  attempts: [] as Array<{ host: string; user: string; pass: string }>,
  /** Per-user outcome: "ok" | "auth" | "conn". */
  outcomes: new Map<string, "ok" | "auth" | "conn">(),
}));

vi.mock("imapflow", () => ({
  ImapFlow: class {
    private readonly opts: { host: string; auth: { user: string; pass: string } };
    constructor(opts: { host: string; auth: { user: string; pass: string } }) {
      this.opts = opts;
    }
    async connect() {
      attempts.push({ host: this.opts.host, user: this.opts.auth.user, pass: this.opts.auth.pass });
      const outcome = outcomes.get(this.opts.auth.user) ?? "conn";
      if (outcome === "ok") return;
      if (outcome === "auth") {
        const err = Object.assign(new Error("Command failed"), {
          authenticationFailed: true,
          responseText: "[AUTHENTICATIONFAILED] Authentication failed.",
        });
        throw err;
      }
      throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    }
    async logout() {}
    close() {}
  },
}));

vi.mock("../mail-target.js", () => ({
  resolveMailTargetHost: async () => ({ targetHost: "203.0.113.7" }),
}));

vi.mock("../../../../config/mail.js", () => ({
  mailConfig: { imap: { host: "localhost", port: 993, fallbackHosts: [] } },
}));

const { masterState, reportAuthFailure, markVerified } = vi.hoisted(() => ({
  masterState: {
    doc: null as { username: string; passwordEncrypted: string } | null,
    lastError: null as string | null,
  },
  reportAuthFailure: vi.fn(),
  markVerified: vi.fn(async () => undefined),
}));

vi.mock("../mail-master.service.js", () => ({
  mailMasterService: {
    async resolveAuthCandidates(address: string, encryptedPassword: string | null) {
      const out: Array<{ kind: string; user: string; pass: string }> = [];
      if (masterState.doc) {
        out.push({ kind: "master", user: `${address}*${masterState.doc.username}`, pass: masterState.doc.passwordEncrypted.replace(/^enc:/, "") });
      }
      if (encryptedPassword) out.push({ kind: "account", user: address, pass: encryptedPassword.replace(/^enc:/, "") });
      return out;
    },
    lastError: () => masterState.lastError,
    reportAuthFailure,
    markVerified,
  },
}));

import { withImap } from "./imap-connection.js";

const ADDRESS = "support@example.com";
const MASTER_LOGIN = `${ADDRESS}*luxipanel-master`;

beforeEach(() => {
  attempts.length = 0;
  outcomes.clear();
  masterState.doc = null;
  masterState.lastError = null;
  reportAuthFailure.mockClear();
  markVerified.mockClear();
});

describe("withImap login order", () => {
  it("uses the master login first and never sends the account password when it works", async () => {
    masterState.doc = { username: "luxipanel-master", passwordEncrypted: "enc:master-secret" };
    outcomes.set(MASTER_LOGIN, "ok");
    const result = await withImap(ADDRESS, "enc:stale-account-pw", "localhost", 993, async () => "opened");
    expect(result).toBe("opened");
    expect(attempts).toEqual([{ host: "203.0.113.7", user: MASTER_LOGIN, pass: "master-secret" }]);
    expect(markVerified).toHaveBeenCalledTimes(1);
  });

  it("falls back to the per-account credential when the master login is rejected", async () => {
    masterState.doc = { username: "luxipanel-master", passwordEncrypted: "enc:master-secret" };
    outcomes.set(MASTER_LOGIN, "auth");
    outcomes.set(ADDRESS, "ok");
    const result = await withImap(ADDRESS, "enc:account-pw", "localhost", 993, async () => "opened");
    expect(result).toBe("opened");
    expect(attempts.map((a) => a.user)).toEqual([MASTER_LOGIN, ADDRESS]);
    // Auth failure on the master is host-independent: exactly one attempt per login.
    expect(attempts.filter((a) => a.user === MASTER_LOGIN)).toHaveLength(1);
    expect(reportAuthFailure).toHaveBeenCalledTimes(1);
  });

  it("works with master only (no stored account password)", async () => {
    masterState.doc = { username: "luxipanel-master", passwordEncrypted: "enc:master-secret" };
    outcomes.set(MASTER_LOGIN, "ok");
    await expect(withImap(ADDRESS, null, "localhost", 993, async () => 1)).resolves.toBe(1);
  });

  it("raises 409 MAIL_PASSWORD_NOT_SET when neither login exists (with the provisioning error)", async () => {
    masterState.lastError = "doveconf rejected the master-user drop-in";
    await expect(withImap(ADDRESS, null, "localhost", 993, async () => 1)).rejects.toMatchObject({
      statusCode: 409,
      code: "MAIL_PASSWORD_NOT_SET",
      message: expect.stringContaining("doveconf rejected"),
    });
    expect(attempts).toEqual([]);
  });

  it("raises 409 MAIL_CREDENTIAL_INVALID with the 'mailbox password' wording when every login is rejected", async () => {
    masterState.doc = { username: "luxipanel-master", passwordEncrypted: "enc:master-secret" };
    outcomes.set(MASTER_LOGIN, "auth");
    outcomes.set(ADDRESS, "auth");
    await expect(withImap(ADDRESS, "enc:account-pw", "localhost", 993, async () => 1)).rejects.toMatchObject({
      statusCode: 409,
      code: "MAIL_CREDENTIAL_INVALID",
      message: expect.stringContaining("mailbox password"),
    });
  });

  it("does not replay the account credential when no host answered the master login (502)", async () => {
    masterState.doc = { username: "luxipanel-master", passwordEncrypted: "enc:master-secret" };
    // Every host → connection error for every login.
    await expect(withImap(ADDRESS, "enc:account-pw", "localhost", 993, async () => 1)).rejects.toMatchObject({
      statusCode: 502,
      code: "MAIL_IMAP_UNREACHABLE",
    });
    expect(attempts.every((a) => a.user === MASTER_LOGIN)).toBe(true);
  });
});
