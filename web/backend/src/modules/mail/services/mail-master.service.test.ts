// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";

const storeState: { docs: Map<number, any>; } = { docs: new Map() };

vi.mock("../../../shared/data-store/make-kv-store.js", () => ({
  makeKvStore: () => () => ({
    get: async (id: number) => storeState.docs.get(id) ?? null,
    set: async (id: number, doc: any) => {
      storeState.docs.set(id, doc);
      return doc;
    },
    delete: async (id: number) => storeState.docs.delete(id),
  }),
}));

vi.mock("../../../shared/executor/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/executor/index.js")>();
  return { ...actual, getContextExecutor: () => null };
});

vi.mock("./mail-crypto.service.js", () => ({
  mailCryptoService: {
    encrypt: (plain: string) => `enc:${plain}`,
    decrypt: (enc: string) => {
      if (enc === "BAD" || !enc.startsWith("enc:")) throw new Error("decrypt failed (wrong key)");
      return enc.replace(/^enc:/, "");
    },
  },
}));

vi.mock("./dovecot.service.js", () => ({
  dovecotService: {
    hashPasswordWithExecutor: vi.fn(async (plain: string) => `{SHA512-CRYPT}$6$hash-of-${plain.length}`),
    reloadWithExecutor: vi.fn(async () => undefined),
  },
}));

vi.mock("./staging.helpers.js", () => ({
  execChecked: vi.fn(async () => undefined),
  writeRootOwnedFile: vi.fn(async () => undefined),
}));

import {
  MASTER_USERNAME,
  mailMasterService,
  masterLoginFor,
  masterPaths,
  parseDovecotVersion,
  renderMasterConf,
  renderMasterUsers,
} from "./mail-master.service.js";
import { dovecotService } from "./dovecot.service.js";
import { writeRootOwnedFile } from "./staging.helpers.js";

interface FakeOpts {
  version?: string;
  filesPresent?: boolean;
  doveconfExit?: number;
  targetId?: string;
}

/** `quoteCmd` single-quotes every argv → compare on the unquoted form. */
function plain(cmd: string): string {
  return cmd.replace(/'/g, "");
}

function fakeExecutor(opts: FakeOpts = {}): Executor {
  const exec = vi.fn(async (raw: string) => {
    const cmd = plain(raw);
    if (cmd.includes("doveconf") && cmd.includes("head")) {
      return { stdout: `# ${opts.version ?? "2.4.1"} (abc): /etc/dovecot/dovecot.conf`, stderr: "", exitCode: 0, durationMs: 1 };
    }
    if (cmd.includes("doveconf")) {
      return { stdout: "", stderr: opts.doveconfExit ? "doveconf: Fatal: bad syntax" : "", exitCode: opts.doveconfExit ?? 0, durationMs: 1 };
    }
    if (cmd.includes("test -s")) {
      return { stdout: "", stderr: "", exitCode: opts.filesPresent ? 0 : 1, durationMs: 1 };
    }
    return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
  });
  return {
    target: { id: opts.targetId ?? "srv-1" },
    exec,
    writeFile: vi.fn(async () => undefined),
    unlink: vi.fn(async () => undefined),
  } as unknown as Executor;
}

function execCmds(executor: Executor): string[] {
  return (executor.exec as ReturnType<typeof vi.fn>).mock.calls.map((c) => plain(String(c[0])));
}

beforeEach(() => {
  storeState.docs.clear();
  mailMasterService._resetCache();
  vi.mocked(writeRootOwnedFile).mockClear();
  vi.mocked(dovecotService.reloadWithExecutor).mockClear();
});

describe("pure helpers", () => {
  it("derives the master files next to the users file", () => {
    const p = masterPaths("/etc/dovecot/users");
    expect(p.masterUsersFile).toBe("/etc/dovecot/master-users");
    expect(p.confFile).toBe("/etc/dovecot/conf.d/95-luxipanel-master.conf");
  });

  it("parses the doveconf header for 2.4 and 2.3", () => {
    expect(parseDovecotVersion("# 2.4.1 (a9f5e5f0e): /etc/dovecot/dovecot.conf")).toMatchObject({ major: 2, minor: 4, raw: "2.4.1" });
    expect(parseDovecotVersion("# 2.3.19.1 (9b53102964): /etc/dovecot/dovecot.conf")).toMatchObject({ major: 2, minor: 3 });
    expect(parseDovecotVersion("")).toBeNull();
  });

  it("renders the 2.4 named passdb block", () => {
    const conf = renderMasterConf({ major: 2, minor: 4 }, "/etc/dovecot/master-users");
    expect(conf).toContain("auth_master_user_separator = *");
    expect(conf).toContain(`passdb ${MASTER_USERNAME} {`);
    expect(conf).toContain("passwd_file_path = /etc/dovecot/master-users");
    expect(conf).toContain("master = yes");
    expect(conf).not.toContain("args =");
  });

  it("renders the 2.3 classic block (and for an unknown version)", () => {
    for (const v of [{ major: 2, minor: 3 }, null]) {
      const conf = renderMasterConf(v, "/etc/dovecot/master-users");
      expect(conf).toContain("passdb {");
      expect(conf).toContain("args = /etc/dovecot/master-users");
      expect(conf).not.toContain("passwd_file_path");
    }
  });

  it("renders the master-users line and the master login", () => {
    expect(renderMasterUsers("{SHA512-CRYPT}$6$x")).toBe(`${MASTER_USERNAME}:{SHA512-CRYPT}$6$x\n`);
    expect(masterLoginFor("a@b.com")).toBe(`a@b.com*${MASTER_USERNAME}`);
  });
});

describe("getOrProvision", () => {
  it("provisions on first use: hash, files, doveconf check, reload, encrypted store", async () => {
    const executor = fakeExecutor();
    const doc = await mailMasterService.getOrProvision(executor);
    expect(doc).not.toBeNull();
    expect(doc!.username).toBe(MASTER_USERNAME);
    expect(doc!.passwordEncrypted.startsWith("enc:")).toBe(true);
    expect(doc!.dovecotVersion).toBe("2.4.1");

    const writes = vi.mocked(writeRootOwnedFile).mock.calls.map((c) => [c[2], c[3]] as [string, string]);
    expect(writes.map((w) => w[0])).toEqual(["/etc/dovecot/master-users", "/etc/dovecot/conf.d/95-luxipanel-master.conf"]);
    expect(writes[0][1]).toMatch(new RegExp(`^${MASTER_USERNAME}:\\{SHA512-CRYPT\\}`));
    expect(writes[1][1]).toContain(`passdb ${MASTER_USERNAME} {`);

    const cmds = execCmds(executor);
    expect(cmds.some((c) => c.includes("sudo doveconf -n >/dev/null"))).toBe(true);
    expect(dovecotService.reloadWithExecutor).toHaveBeenCalledTimes(1);
    expect(storeState.docs.get(1)).toMatchObject({ username: MASTER_USERNAME });
    // The plaintext never reaches the store.
    expect(JSON.stringify(storeState.docs.get(1))).not.toMatch(/"passwordEncrypted":"[^e]/);
  });

  it("is idempotent when the store and the server files exist (no rewrite, no reload)", async () => {
    storeState.docs.set(1, {
      id: 1, username: MASTER_USERNAME, passwordEncrypted: "enc:keep", createdAt: "2026-01-01T00:00:00.000Z",
      rotatedAt: null, verifiedAt: null, dovecotVersion: "2.4.1",
    });
    const executor = fakeExecutor({ filesPresent: true });
    const doc = await mailMasterService.getOrProvision(executor);
    expect(doc!.passwordEncrypted).toBe("enc:keep");
    expect(writeRootOwnedFile).not.toHaveBeenCalled();
    expect(dovecotService.reloadWithExecutor).not.toHaveBeenCalled();
  });

  it("re-installs the SAME password when the server files went missing", async () => {
    storeState.docs.set(1, {
      id: 1, username: MASTER_USERNAME, passwordEncrypted: "enc:keep", createdAt: "2026-01-01T00:00:00.000Z",
      rotatedAt: null, verifiedAt: null, dovecotVersion: "2.4.1",
    });
    const executor = fakeExecutor({ filesPresent: false });
    const doc = await mailMasterService.getOrProvision(executor);
    expect(doc!.passwordEncrypted).toBe("enc:keep");
    expect(dovecotService.hashPasswordWithExecutor).toHaveBeenCalledWith("keep", executor);
    expect(dovecotService.reloadWithExecutor).toHaveBeenCalledTimes(1);
  });

  it("rolls the drop-in back and yields null (cached failure) when doveconf rejects it", async () => {
    const executor = fakeExecutor({ doveconfExit: 1 });
    const doc = await mailMasterService.getOrProvision(executor);
    expect(doc).toBeNull();
    expect(dovecotService.reloadWithExecutor).not.toHaveBeenCalled();
    expect(execCmds(executor).some((c) => c.includes("rm -f /etc/dovecot/conf.d/95-luxipanel-master.conf"))).toBe(true);
    expect(mailMasterService.lastError(executor)).toMatch(/doveconf rejected/);
    expect(storeState.docs.size).toBe(0);
    // Second call within the failure window doesn't retry.
    (executor.exec as ReturnType<typeof vi.fn>).mockClear();
    expect(await mailMasterService.getOrProvision(executor)).toBeNull();
    expect(execCmds(executor)).toEqual([]);
  });

  it("shares one in-flight provisioning between concurrent callers", async () => {
    const executor = fakeExecutor();
    const [a, b] = await Promise.all([
      mailMasterService.getOrProvision(executor),
      mailMasterService.getOrProvision(executor),
    ]);
    expect(a).toBe(b);
    expect(dovecotService.reloadWithExecutor).toHaveBeenCalledTimes(1);
  });

  it("renders the 2.3 block on an older Dovecot", async () => {
    const executor = fakeExecutor({ version: "2.3.19.1" });
    const doc = await mailMasterService.getOrProvision(executor);
    expect(doc!.dovecotVersion).toBe("2.3.19.1");
    const conf = String(vi.mocked(writeRootOwnedFile).mock.calls[1][3]);
    expect(conf).toContain("args = /etc/dovecot/master-users");
  });
});

describe("ensure / rotate / disable / status", () => {
  it("rotate mints a new password and keeps createdAt", async () => {
    const executor = fakeExecutor({ filesPresent: true });
    const first = await mailMasterService.ensure(executor);
    const second = await mailMasterService.ensure(executor, { rotate: true });
    expect(second.passwordEncrypted).not.toBe(first.passwordEncrypted);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.rotatedAt).not.toBeNull();
  });

  it("disable removes the files, reloads and forgets the credential", async () => {
    const executor = fakeExecutor({ filesPresent: true });
    await mailMasterService.ensure(executor);
    await mailMasterService.disable(executor);
    expect(storeState.docs.size).toBe(0);
    expect(dovecotService.reloadWithExecutor).toHaveBeenCalledTimes(2);
    const status = await mailMasterService.status(fakeExecutor({ filesPresent: false }));
    expect(status.enabled).toBe(false);
  });
});

describe("resolveAuthCandidates", () => {
  it("returns master first then the account credential (context executor absent → account only)", async () => {
    // getContextExecutor is mocked to null → no master available.
    const list = await mailMasterService.resolveAuthCandidates("a@b.com", "enc:secret");
    expect(list).toEqual([{ kind: "account", user: "a@b.com", pass: "secret" }]);
    expect(await mailMasterService.resolveAuthCandidates("a@b.com", null)).toEqual([]);
  });

  it("skips an undecryptable per-account credential instead of throwing", async () => {
    // No master in this context (getContextExecutor null) and the stored account
    // password can't be decrypted (previous key) → empty list, NOT a throw.
    await expect(mailMasterService.resolveAuthCandidates("a@b.com", "BAD")).resolves.toEqual([]);
  });
});
