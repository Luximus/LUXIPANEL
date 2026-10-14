/**
 * Tests for the chpasswd stdin-injection backstop in submit-mutation.
 *
 * The validated builders already guard the password (passwordSchema +
 * assertChpasswdSafe), but `applyStepsLive`/`buildJob` must reject any
 * `chpasswd` step whose `input` is not a single `user:secret` line — so a
 * future caller constructing a step directly cannot smuggle a second
 * `root:<pass>` line via a newline.
 */

import { createHmac } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import { applyStepsLive, canonicalJson, type MutationStep } from "./submit-mutation.js";
import type { Executor } from "../executor/types.js";

function mockExecutor() {
  const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  const writeFile = vi.fn().mockResolvedValue(undefined);
  const executor = {
    target: { id: "srv-test", name: "srv-test" },
    exec,
    writeFile,
  } as unknown as Executor;
  return { executor, exec, writeFile };
}

describe("applyStepsLive — chpasswd input backstop", () => {
  it("rejects a chpasswd step whose input injects a second line (newline)", async () => {
    const { executor, exec, writeFile } = mockExecutor();
    const steps: MutationStep[] = [
      { type: "sh", argv: ["chpasswd"], sudo: true, input: "alice:pw\nroot:pwned\n" },
    ];
    await expect(applyStepsLive(executor, steps)).rejects.toThrow(/Unsafe chpasswd/i);
    // Must throw BEFORE touching the executor.
    expect(writeFile).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
  });

  it("rejects a chpasswd step whose input has an extra ':'", async () => {
    const { executor } = mockExecutor();
    const steps: MutationStep[] = [
      { type: "sh", argv: ["chpasswd"], sudo: true, input: "alice:pw:extra\n" },
    ];
    await expect(applyStepsLive(executor, steps)).rejects.toThrow(/Unsafe chpasswd/i);
  });

  it("allows a well-formed chpasswd step (single user:secret line)", async () => {
    const { executor, exec } = mockExecutor();
    const steps: MutationStep[] = [
      { type: "sh", argv: ["chpasswd"], sudo: true, input: "alice:s3cr3t\n" },
    ];
    await expect(applyStepsLive(executor, steps)).resolves.toBeUndefined();
    expect(exec).toHaveBeenCalled();
  });

  it("does NOT reject non-chpasswd stdin steps that legitimately contain newlines", async () => {
    const { executor, exec } = mockExecutor();
    const steps: MutationStep[] = [
      { type: "sh", argv: ["crontab", "-"], sudo: false, input: "* * * * * echo a\n0 0 * * * echo b\n" },
    ];
    await expect(applyStepsLive(executor, steps)).resolves.toBeUndefined();
    expect(exec).toHaveBeenCalled();
  });
});

describe("canonicalJson — worker.py HMAC parity", () => {
  it("sorts object keys recursively, stays compact, preserves array order", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(true)).toBe("true");
  });

  it("byte-matches Python json.dumps(sort_keys,separators,ensure_ascii=False) incl. non-ASCII", () => {
    // The exact string + digest below were produced by BOTH node and Python
    // over the same object (see A1 parity check). If canonicalJson drifts from
    // the worker's canonical form, every signed job would be rejected on-box.
    const job = {
      jobId: "j1",
      module: "users",
      collection: "system",
      op: "create",
      scope: null,
      steps: [
        { type: "sh", argv: ["useradd", "-m", "José"], sudo: true },
        { type: "writeFile", path: "/x", b64gz: "AAA", mode: "0640", root: true },
      ],
      refresh: [["users", "system"]],
      requestedBy: 7,
      requestedAt: 1721577600,
    };
    const canon =
      '{"collection":"system","jobId":"j1","module":"users","op":"create",' +
      '"refresh":[["users","system"]],"requestedAt":1721577600,"requestedBy":7,' +
      '"scope":null,"steps":[{"argv":["useradd","-m","José"],"sudo":true,"type":"sh"},' +
      '{"b64gz":"AAA","mode":"0640","path":"/x","root":true,"type":"writeFile"}]}';
    expect(canonicalJson(job)).toBe(canon);
    // HMAC-SHA256(key="c0ffee", canon) — identical hex on both languages.
    expect(createHmac("sha256", "c0ffee").update(canon, "utf8").digest("hex")).toBe(
      "d2a8b22e8746d0393e02c4f76c4f9d1316ab1bddd27e0eb7d329a72bc22ca79f",
    );
  });
});
