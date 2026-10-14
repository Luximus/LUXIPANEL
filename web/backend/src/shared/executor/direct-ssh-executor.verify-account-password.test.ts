// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization + security-regression tests for
 * `DirectSshExecutor.verifyAccountPassword`.
 *
 * This method is AUTH-ADJACENT: it validates a Linux account password before a
 * login keypair is minted (`users.controller.generateLoginKey`). It is NOT on
 * the panel login path (that is `loginLocal`/PAM), but a wrong verdict here
 * either mis-encrypts a private key (false negative) or — the real risk —
 * accepts an unverified password (false positive). The two `su`-fallback
 * branches used to FAIL OPEN (return `true` when verification was impossible);
 * these tests pin the corrected FAIL-CLOSED behaviour plus the decidable
 * branches that were always correct.
 *
 * ssh2's `Client` is mocked so no socket is opened. The password-auth probe
 * (`new Client()`) is driven by `probeOutcome`; the `su` fallback overrides the
 * instance's private `connect()` with a fake admin client.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

// Keep the import graph light (worklog pulls redis/env chains we don't exercise).
vi.mock("./worklog/worklog-recorder.service.js", () => ({ recordActivity: () => {} }));

// Controls what the password-auth probe (`new Client()`) does.
let probeOutcome: "ready" | "authfail" | "othererror" = "ready";

class MockClient extends EventEmitter {
  connect(): void {
    queueMicrotask(() => {
      if (probeOutcome === "ready") this.emit("ready");
      else if (probeOutcome === "authfail")
        this.emit("error", new Error("All configured authentication methods failed"));
      else this.emit("error", new Error("ECONNREFUSED"));
    });
  }
  end(): void {
    /* noop */
  }
}

vi.mock("ssh2", () => ({ Client: MockClient }));

const { DirectSshExecutor } = await import("./direct-ssh-executor.js");

function makeExecutor() {
  return new DirectSshExecutor("t", "t", {
    host: "example.test",
    port: 22,
    username: "admin",
  } as never);
}

/** Fake `su` PTY stream: an EventEmitter with the surface verifyAccountPassword
 *  touches. `.drive(code)` emits a password prompt then closes with `code`. */
function makeSuStream() {
  const stream = new EventEmitter() as EventEmitter & {
    stderr: EventEmitter;
    write: () => void;
    close: () => void;
    drive: (code: number) => void;
  };
  stream.stderr = new EventEmitter();
  stream.write = () => {};
  stream.close = () => {};
  stream.drive = (code: number) => {
    queueMicrotask(() => {
      stream.emit("data", Buffer.from("Password: "));
      queueMicrotask(() => stream.emit("close", code));
    });
  };
  return stream;
}

/** Override the instance's private `connect()` with a fake admin client whose
 *  `exec` behaviour is supplied by `execImpl`. */
function stubAdminExec(
  exec: InstanceType<typeof DirectSshExecutor>,
  execImpl: (cb: (err: Error | null, stream?: unknown) => void) => void,
) {
  (exec as unknown as { connect: () => Promise<unknown> }).connect = async () => ({
    exec: (_cmd: string, _opts: unknown, cb: (err: Error | null, stream?: unknown) => void) =>
      execImpl(cb),
  });
}

beforeEach(() => {
  probeOutcome = "ready";
});

describe("verifyAccountPassword — decidable branches (characterization)", () => {
  it("rejects a syntactically invalid username without connecting", async () => {
    const exec = makeExecutor();
    expect(await exec.verifyAccountPassword("bad name", "pw")).toBe(false);
    expect(await exec.verifyAccountPassword("1leading", "pw")).toBe(false);
    expect(await exec.verifyAccountPassword("UPPER", "pw")).toBe(false);
  });

  it("rejects an empty password without connecting", async () => {
    const exec = makeExecutor();
    expect(await exec.verifyAccountPassword("root", "")).toBe(false);
  });

  it("returns true when password-auth SSH connects (ready)", async () => {
    probeOutcome = "ready";
    const exec = makeExecutor();
    expect(await exec.verifyAccountPassword("root", "correct")).toBe(true);
  });

  it("returns false on a non-auth connection error (no fallback)", async () => {
    probeOutcome = "othererror";
    const exec = makeExecutor();
    expect(await exec.verifyAccountPassword("root", "whatever")).toBe(false);
  });

  it("falls back to `su` when the server denies password auth: exit 0 → true", async () => {
    probeOutcome = "authfail";
    const exec = makeExecutor();
    stubAdminExec(exec, (cb) => {
      const stream = makeSuStream();
      cb(null, stream);
      stream.drive(0);
    });
    expect(await exec.verifyAccountPassword("root", "correct")).toBe(true);
  });

  it("falls back to `su`: non-zero exit → false", async () => {
    probeOutcome = "authfail";
    const exec = makeExecutor();
    stubAdminExec(exec, (cb) => {
      const stream = makeSuStream();
      cb(null, stream);
      stream.drive(1);
    });
    expect(await exec.verifyAccountPassword("root", "wrong")).toBe(false);
  });
});

describe("verifyAccountPassword — FAIL-CLOSED security regression", () => {
  it("returns FALSE (never true) when `su` cannot be exec'd", async () => {
    // Previously fail-open (resolve(true)): 'can't verify' was treated as 'valid'.
    probeOutcome = "authfail";
    const exec = makeExecutor();
    stubAdminExec(exec, (cb) => cb(new Error("exec channel open failure")));
    expect(await exec.verifyAccountPassword("root", "unknown")).toBe(false);
  });

  it("returns FALSE (never true) when the admin connection cannot be opened", async () => {
    // Previously fail-open (catch { return true }).
    probeOutcome = "authfail";
    const exec = makeExecutor();
    (exec as unknown as { connect: () => Promise<unknown> }).connect = async () => {
      throw new Error("connect refused");
    };
    expect(await exec.verifyAccountPassword("root", "unknown")).toBe(false);
  });
});
