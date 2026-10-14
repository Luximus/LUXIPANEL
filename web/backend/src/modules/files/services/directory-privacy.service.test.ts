// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { execFileSync } from "node:child_process";

vi.mock("./snapshot.service.js", () => ({
  snapshotService: { capture: vi.fn(async () => undefined) },
}));
vi.mock("../../../shared/files-cache/index.js", () => ({
  invalidateDir: vi.fn(),
  invalidateFile: vi.fn(),
  invalidateStat: vi.fn(),
}));
vi.mock("../../nginx/services/index.js", () => ({
  nginxBasicAuthService: {
    statusForDir: vi.fn(async () => ({ enforced: true, site: null, url: null, publicUrl: null })),
    enableForDir: vi.fn(async () => ({ enforced: true, site: null, url: null, publicUrl: null })),
    disableForDir: vi.fn(async () => undefined),
    unpublishDir: vi.fn(async () => undefined),
    listPublishCandidates: vi.fn(async () => []),
    publishDir: vi.fn(async () => ({ enforced: true, site: null, url: null, publicUrl: null })),
  },
  nginxSitesService: { applySslToSite: vi.fn(async () => undefined) },
  certbotService: { issueWithExecutor: vi.fn(async () => ({ success: false })) },
}));

import { apr1, isValidUsername, directoryPrivacyService } from "./directory-privacy.service.js";
import { ALLOWED_BASES, setAllowedBases } from "./filesystem.service.js";

/** Ground-truth apr1 hash from the system openssl, for a fixed salt. */
function opensslApr1(password: string, salt: string): string {
  return execFileSync("openssl", ["passwd", "-apr1", "-salt", salt, password], {
    encoding: "utf-8",
  }).trim();
}

describe("apr1", () => {
  const cases: Array<[string, string]> = [
    ["password", "abcd1234"],
    ["s3cr3t!", "Xy9zAbCd"],
    ["", "salt0000"],
    ["a-much-longer-passphrase-with-symbols-#@!", "kZ12mn34"],
    ["ünîcödé-pä$$", "qP00wR55"],
  ];

  for (const [pw, salt] of cases) {
    it(`matches openssl for "${pw}" / salt ${salt}`, () => {
      expect(apr1(pw, salt)).toBe(opensslApr1(pw, salt));
    });
  }

  it("uses a random 8-char salt when none is given", () => {
    const h = apr1("hello");
    expect(h).toMatch(/^\$apr1\$[./0-9A-Za-z]{8}\$[./0-9A-Za-z]{22}$/);
    expect(apr1("hello")).not.toBe(h); // random salt → different hash
  });
});

describe("isValidUsername", () => {
  it("accepts safe names", () => {
    expect(isValidUsername("john")).toBe(true);
    expect(isValidUsername("a.b_c-d@e")).toBe(true);
  });
  it("rejects colons, spaces and empties", () => {
    expect(isValidUsername("")).toBe(false);
    expect(isValidUsername("a:b")).toBe(false);
    expect(isValidUsername("a b")).toBe(false);
    expect(isValidUsername("a\nb")).toBe(false);
  });
});

describe("directoryPrivacyService.protect — .htpasswd exposure (C2)", () => {
  let originalBases: string[] = [];
  beforeEach(() => { originalBases = [...ALLOWED_BASES]; setAllowedBases(["/srv"]); });
  afterEach(() => setAllowedBases(originalBases));

  function recorder(webGroup: string | null) {
    const calls: string[] = [];
    const writes: Array<{ path: string; data: string; opts?: { mode?: number } }> = [];
    const exec = vi.fn(async (cmd: string) => {
      calls.push(cmd);
      if (cmd.startsWith("getent group")) {
        return { stdout: webGroup ? `${webGroup}\n` : "", stderr: "", exitCode: webGroup ? 0 : 2, durationMs: 1 };
      }
      if (cmd.startsWith("sudo ") && cmd.includes("'cat'")) {
        return { stdout: "", stderr: "", exitCode: 1, durationMs: 1 }; // files absent
      }
      return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
    });
    const writeFile = vi.fn(async (p: string, d: string, opts?: { mode?: number }) => { writes.push({ path: p, data: d, opts }); });
    return { executor: { target: { id: "r", name: "R" }, exec, writeFile } as never, calls, writes };
  }

  it("writes .htpasswd 0640 + chgrp to the webserver group (never 0644)", async () => {
    const { executor, calls, writes } = recorder("www-data");
    await directoryPrivacyService.protect(executor, "/srv/site", { username: "john", password: "pw" });

    const chmod640 = calls.find((c) => c.startsWith("sudo ") && c.includes("'chmod'") && c.includes("'640'"))!;
    expect(chmod640).toContain("/srv/site/.htpasswd");
    const chgrp = calls.find((c) => c.startsWith("sudo ") && c.includes("'chgrp'"))!;
    expect(chgrp).toContain("'www-data'");
    expect(chgrp).toContain("/srv/site/.htpasswd");
    // .htaccess (no secrets) keeps 644; .htpasswd must NOT get 644.
    const chmods644 = calls.filter((c) => c.includes("'chmod'") && c.includes("'644'"));
    expect(chmods644.some((c) => c.includes(".htaccess"))).toBe(true);
    expect(chmods644.some((c) => c.includes(".htpasswd"))).toBe(false);

    // Staged tmp copies are 0600 atomically (they hold the hash lines).
    const tmpWrites = writes.filter((w) => w.path.startsWith("/tmp/.lxp-privacy-"));
    expect(tmpWrites.length).toBeGreaterThan(0);
    for (const w of tmpWrites) expect(w.opts?.mode).toBe(0o600);
    // And the htpasswd body carries an apr1 hash, never the cleartext password.
    const body = tmpWrites.map((w) => w.data).find((d) => d.includes("john:"))!;
    expect(body).toContain("john:$apr1$");
    expect(body).not.toContain(":pw");
  });

  it("falls back to 0644 (with no chgrp) when no webserver group exists", async () => {
    const { executor, calls } = recorder(null);
    await directoryPrivacyService.protect(executor, "/srv/site", { username: "john", password: "pw" });
    expect(calls.some((c) => c.includes("'chgrp'"))).toBe(false);
    const chmods644 = calls.filter((c) => c.includes("'chmod'") && c.includes("'644'"));
    expect(chmods644.some((c) => c.includes(".htpasswd"))).toBe(true);
  });
});
