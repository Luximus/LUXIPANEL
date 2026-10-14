// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rootsMock = vi.fn();
vi.mock("./exposure.service.js", () => ({
  exposureService: { publicRoots: (...a: unknown[]) => rootsMock(...a) },
}));
const records = new Map<string, Record<string, unknown>>();
vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: () => ({
    get: async (id: string) => records.get(String(id)) ?? null,
    list: async () => [...records.values()],
    set: async (id: string, d: Record<string, unknown>) => { const r = { ...d, id }; records.set(String(id), r); return r; },
  }),
}));

const { shareService } = await import("./share.service.js");
const { ALLOWED_BASES, setAllowedBases } = await import("./filesystem.service.js");

let originalBases: string[] = [];
beforeEach(() => { rootsMock.mockReset(); records.clear(); originalBases = [...ALLOWED_BASES]; setAllowedBases(["/var/www"]); });
afterEach(() => setAllowedBases(originalBases));

function recorder() {
  const calls: string[] = [];
  const writes: Array<{ path: string; data: string; opts?: { mode?: number } }> = [];
  const exec = vi.fn(async (cmd: string) => {
    calls.push(cmd);
    // Webserver-group detection probe → pretend www-data exists.
    if (cmd.startsWith("getent group")) return { stdout: "www-data\n", stderr: "", exitCode: 0, durationMs: 1 };
    return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
  });
  const writeFile = vi.fn(async (p: string, d: string, opts?: { mode?: number }) => { writes.push({ path: p, data: d, opts }); });
  return { executor: { target: { id: "r", name: "R" }, exec, writeFile } as never, calls, writes };
}

describe("shareService.create", () => {
  it("rejects a root that is not a public vhost", async () => {
    rootsMock.mockResolvedValue([{ root: "/var/www/site/public", domain: "site.com", ssl: true }]);
    const { executor } = recorder();
    await expect(shareService.create(executor, { path: "/var/www/site/public/x.zip", root: "/var/www/other", expiresInMin: 60 }))
      .rejects.toThrow(/raíz pública/);
  });

  it("stages blob+meta outside the docroot, drops the PHP gatekeeper, and builds the URL", async () => {
    rootsMock.mockResolvedValue([{ root: "/var/www/site/public", domain: "site.com", ssl: true }]);
    const { executor, calls, writes } = recorder();
    const rec = await shareService.create(executor, {
      path: "/var/www/site/public/report.pdf",
      root: "/var/www/site/public",
      expiresInMin: 120,
      password: "secret",
      maxDownloads: 3,
    });
    expect(rec.url).toMatch(/^https:\/\/site\.com\/_lxpshare\.php\?t=/);
    expect(rec.hasPassword).toBe(true);
    expect(rec.maxDownloads).toBe(3);
    expect(rec.filename).toBe("report.pdf");

    // blob copied into the sibling _lxpshare_data (NOT under the docroot).
    const cp = calls.find((c) => c.startsWith("cp "))!;
    expect(cp).toContain("/var/www/site/_lxpshare_data/");
    expect(cp).not.toContain("/public/_lxpshare_data");
    // meta.json written + gatekeeper php in the docroot.
    expect(writes.some((w) => w.path.endsWith("/meta.json"))).toBe(true);
    const php = writes.find((w) => w.path === "/var/www/site/public/_lxpshare.php");
    expect(php?.data).toContain("<?php");
    expect(php?.data).toContain("passwordHash");
    expect(php?.data).toContain("expiresAt");
    expect(php?.data).toContain("maxDownloads");
    // meta stores a PHP-compatible bcrypt hash, never the plaintext password.
    const meta = writes.find((w) => w.path.endsWith("/meta.json"))!;
    expect(meta.data).not.toContain("secret");
    expect(meta.data).toContain("passwordHash");
    expect(JSON.parse(meta.data).passwordHash).toMatch(/^\$2y\$/);
    expect(php?.data).toContain("password_verify");
    expect(php?.data).toContain("flock($fp, LOCK_EX)");
  });

  it("never leaves meta.json world-readable: 0660 atomic + chgrp webserver, a+rX only on dir+blob", async () => {
    rootsMock.mockResolvedValue([{ root: "/var/www/site/public", domain: "site.com", ssl: true }]);
    const { executor, calls, writes } = recorder();
    await shareService.create(executor, {
      path: "/var/www/site/public/report.pdf",
      root: "/var/www/site/public",
      expiresInMin: 60,
      password: "secret",
    });

    // meta.json is written 0660 ATOMICALLY (holds passwordHash + IP log).
    const meta = writes.find((w) => w.path.endsWith("/meta.json"))!;
    expect(meta.opts?.mode).toBe(0o660);

    // No recursive a+rX anymore; the chmod covers ONLY the token dir + blob.
    expect(calls.some((c) => c.startsWith("chmod ") && c.includes("-R"))).toBe(false);
    const chmod = calls.find((c) => c.startsWith("chmod ") && c.includes("a+rX"))!;
    expect(chmod).toContain("/blob");
    expect(chmod).not.toContain("meta.json");

    // meta.json is group-owned by the detected webserver group instead.
    const chgrp = calls.find((c) => c.startsWith("sudo ") && c.includes("'chgrp'"))!;
    expect(chgrp).toContain("'www-data'");
    expect(chgrp).toContain("meta.json");
  });
});

describe("shareService.revoke", () => {
  it("validates the token and removes the staged data", async () => {
    records.set("tok123", { id: "tok123", root: "/var/www/site/public", path: "/x", revoked: false });
    const { executor, calls } = recorder();
    expect(await shareService.revoke(executor, "bad token!")).toBe(false);
    const ok = await shareService.revoke(executor, "tok123");
    expect(ok).toBe(true);
    expect(calls.some((c) => c.startsWith("rm ") && c.includes("_lxpshare_data/tok123"))).toBe(true);
    expect((records.get("tok123") as { revoked?: boolean }).revoked).toBe(true);
  });

  it("keeps the link active in the sidecar if removal fails", async () => {
    records.set("tok456", { id: "tok456", root: "/var/www/site/public", path: "/var/www/site/public/x", revoked: false });
    const { executor } = recorder();
    (executor as { exec: ReturnType<typeof vi.fn> }).exec.mockResolvedValue({ stdout: "", stderr: "denied", exitCode: 1 });
    expect(await shareService.revoke(executor, "tok456")).toBe(false);
    expect(records.get("tok456")?.revoked).toBe(false);
  });
});
