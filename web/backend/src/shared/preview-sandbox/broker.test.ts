// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Broker unit tests (RUNTIME-DESIGN §11). Mock executor/kv/context BEFORE import.
 *
 * Coverage: default DENY; previews denied exec/sudo/fs.write even when the
 * synthetic manifest declares them; effectivePolicy narrows-only; fs.read
 * rejects ../secret-blocklist/symlink; storage namespace is preview:<owner>:<id>
 * (never community:); http DENY by default; SSRF rejects loopback/RFC1918/
 * metadata; session-executor mismatch aborts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Executor } from "../executor/types.js";

// ── Mocks (BEFORE importing the broker) ──────────────────────────────────────

// Stub the logger so importing broker.ts does NOT pull in config/env (which
// process.exit(1)s on a missing/short JWT_SECRET under vitest). Mock BEFORE
// import, mirroring selftest.test.ts / pool-supervisor.test.ts.
vi.mock("../logger/index.js", () => ({
  createModuleLogger: () => ({
    debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, trace: () => {}, fatal: () => {},
  }),
}));

// The executor pinned in context is the SAME object passed to the session in
// the happy path; tests flip it to assert the per-capCall liveness re-check.
let contextExecutor: Executor | null = null;
vi.mock("../executor/context.js", () => ({
  getContextExecutor: () => contextExecutor,
  // runWithExecutor must actually run fn so storage/exec resolve.
  runWithExecutor: (_e: Executor, fn: () => unknown) => fn(),
}));

// kv() captures the module namespace string so we can assert it is preview:…
let lastKvNamespace = "";
const kvStoreDelete = vi.fn(async () => true);
vi.mock("../kv-store/index.js", () => ({
  kv: () => ({
    module: (ns: string) => {
      lastKvNamespace = ns;
      return {
        collection: () => ({
          get: async (k: string) => ({ id: k, hello: "world" }),
          set: async (k: string, v: Record<string, unknown>) => ({ id: k, ...v }),
          list: async () => [{ id: "a" }],
          delete: kvStoreDelete,
        }),
      };
    },
  }),
}));

import {
  handleCapCall,
  buildEffectivePolicy,
  isForbiddenAddress,
  setSessionEpochSource,
  type BrokerSession,
} from "./broker.js";

// The broker DENIES every capCall until a session-epoch source is injected
// (fail-closed). The runtime injects its real reader in production; the tests
// inject a controllable one so `session.sessionEpoch === currentEpoch()` holds
// on the happy path and we can simulate a logout by advancing it.
let testEpoch = 1;
setSessionEpochSource(() => testEpoch);

// ── Helpers ──────────────────────────────────────────────────────────────────

function fakeExecutor(): Executor {
  return {
    target: { id: "t1", name: "server-1" },
    exec: vi.fn(async () => ({ stdout: "PWNED", stderr: "", exitCode: 0, durationMs: 1 })),
    readFile: vi.fn(async (p: string) => `contents-of:${p}`),
    writeFile: vi.fn(async () => {}),
    readdir: vi.fn(async () => []),
    stat: vi.fn(async () => ({}) as never),
    mkdir: vi.fn(async () => {}),
    unlink: vi.fn(async () => {}),
    rename: vi.fn(async () => {}),
    spawn: vi.fn(() => ({}) as never),
  };
}

function makeSession(over: Partial<BrokerSession> = {}): BrokerSession {
  const executor = over.executor ?? fakeExecutor();
  contextExecutor = executor; // liveness re-check passes by default
  return {
    executor,
    user: null,
    sessionEpoch: 1,
    owner: "42",
    ownerUserId: "42",
    moduleId: "mymod",
    effectivePolicy: { capabilities: new Set(["server.fs.read", "storage"]), http_allowlist: [], readPrefix: "/srv/data" },
    manifestHash: "deadbeef",
    ...over,
  };
}

beforeEach(() => {
  lastKvNamespace = "";
  contextExecutor = null;
  testEpoch = 1; // matches makeSession()'s sessionEpoch:1 (live session)
});

// ── buildEffectivePolicy: narrows-only ───────────────────────────────────────

describe("buildEffectivePolicy", () => {
  it("intersects operator with manifest (author can only narrow)", () => {
    const eff = buildEffectivePolicy(
      { capabilities: ["server.exec", "server.fs.read", "storage"] },
      { capabilities: ["server.fs.read"] }, // author did NOT declare exec/storage
    );
    expect(eff.capabilities.has("server.fs.read")).toBe(true);
    expect(eff.capabilities.has("server.exec")).toBe(false); // not in manifest
  });

  it("defaults to read+storage when no operator sidecar", () => {
    const eff = buildEffectivePolicy(null, { capabilities: ["server.fs.read", "storage", "http"] });
    expect(eff.capabilities.has("server.fs.read")).toBe(true);
    expect(eff.capabilities.has("storage")).toBe(true);
    expect(eff.capabilities.has("http")).toBe(false); // http needs operator opt-in
  });

  it("http effective only when operator AND manifest both grant the host", () => {
    const eff = buildEffectivePolicy(
      { capabilities: ["http"], http_allowlist: ["api.example.com", "evil.test"] },
      { capabilities: ["http"], http_allowlist: ["api.example.com"] },
    );
    expect(eff.capabilities.has("http")).toBe(true);
    expect(eff.http_allowlist).toEqual(["api.example.com"]); // evil.test narrowed away
  });
});

// ── default DENY + hard deny ─────────────────────────────────────────────────

describe("handleCapCall default DENY / hard deny", () => {
  it("denies an unknown capability string", async () => {
    const r = await handleCapCall(makeSession(), { callId: 1, cap: "fs.delete-everything", method: "x", args: {} });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("CAP_DENIED");
  });

  it("denies server.exec even when effectivePolicy declares it (hard deny)", async () => {
    const r = await handleCapCall(
      makeSession({
        effectivePolicy: { capabilities: new Set(["server.exec"]), http_allowlist: [] },
      }),
      { callId: 1, cap: "server.exec", method: "exec", args: { cmd: "cat /etc/luxipanel/shared-secrets.json" } },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain("hard-denied");
  });

  it("denies server.sudo unconditionally", async () => {
    const r = await handleCapCall(
      makeSession({ effectivePolicy: { capabilities: new Set(["server.sudo"]), http_allowlist: [] } }),
      { callId: 1, cap: "server.sudo", method: "exec", args: {} },
    );
    expect(r.ok).toBe(false);
  });

  it("denies server.fs.write even when declared", async () => {
    const r = await handleCapCall(
      makeSession({ effectivePolicy: { capabilities: new Set(["server.fs.write"]), http_allowlist: [] } }),
      { callId: 1, cap: "server.fs.write", method: "writeFile", args: { path: "/root/.ssh/authorized_keys" } },
    );
    expect(r.ok).toBe(false);
  });

  it("denies a known cap with a non-whitelisted method", async () => {
    const r = await handleCapCall(makeSession(), { callId: 1, cap: "server.fs.read", method: "openSync", args: {} });
    expect(r.ok).toBe(false);
  });
});

// ── session liveness ─────────────────────────────────────────────────────────

describe("handleCapCall session liveness", () => {
  it("aborts when the context executor no longer matches the captured session", async () => {
    const session = makeSession();
    contextExecutor = fakeExecutor(); // a DIFFERENT executor now in scope
    const r = await handleCapCall(session, { callId: 1, cap: "storage", method: "get", args: { key: "k" } });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("SESSION_EXECUTOR_MISMATCH");
  });

  it("DENIES (epoch stale) when the session epoch advanced — logout/dispose revocation", async () => {
    const session = makeSession(); // sessionEpoch:1, contextExecutor === session.executor
    testEpoch = 2; // a logout bumped the runtime epoch after this dispatch was admitted
    const r = await handleCapCall(session, { callId: 1, cap: "storage", method: "get", args: { key: "k" } });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("SESSION_EPOCH_STALE");
  });

  it("authorizes when ambient executor is null (broker runs outside the request ALS scope)", async () => {
    // In production the broker runs from the pool pump (panel-host scope), so
    // getContextExecutor() is null. That MUST NOT fail-close, or every capCall
    // would be denied. The epoch is what guards revocation.
    const session = makeSession();
    contextExecutor = null; // out of ALS scope, as in the real pump callback
    const r = await handleCapCall(session, { callId: 1, cap: "storage", method: "get", args: { key: "k" } });
    expect(r.ok).toBe(true);
  });

  it("DENIES every cap when no epoch source is injected (fail-closed default)", async () => {
    setSessionEpochSource(() => Number.NaN); // simulate un-wired broker
    const session = makeSession();
    const r = await handleCapCall(session, { callId: 1, cap: "storage", method: "get", args: { key: "k" } });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("SESSION_EPOCH_STALE");
    setSessionEpochSource(() => testEpoch); // restore for the rest of the suite
  });
});

// ── fs.read confinement ──────────────────────────────────────────────────────

describe("handleCapCall fs.read confinement", () => {
  it("reads inside the operator read-prefix", async () => {
    const r = await handleCapCall(makeSession(), {
      callId: 1,
      cap: "server.fs.read",
      method: "readFile",
      args: { path: "report.txt", encoding: "utf-8" },
    });
    expect(r.ok).toBe(true);
    expect(String(r.value)).toContain("/srv/data/report.txt");
  });

  it("rejects traversal escape from the read-prefix", async () => {
    const r = await handleCapCall(makeSession(), {
      callId: 1,
      cap: "server.fs.read",
      method: "readFile",
      args: { path: "../../etc/luxipanel/shared-secrets.json" },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects an absolute path on the secret/ssh/cron blocklist", async () => {
    const r = await handleCapCall(
      makeSession({
        effectivePolicy: { capabilities: new Set(["server.fs.read"]), http_allowlist: [], readPrefix: "/etc" },
      }),
      { callId: 1, cap: "server.fs.read", method: "readFile", args: { path: "luxipanel/shared-secrets.json" } },
    );
    expect(r.ok).toBe(false);
  });

  it("denies fs.read when no operator read-prefix is set", async () => {
    const r = await handleCapCall(
      makeSession({ effectivePolicy: { capabilities: new Set(["server.fs.read"]), http_allowlist: [] } }),
      { callId: 1, cap: "server.fs.read", method: "readFile", args: { path: "x" } },
    );
    expect(r.ok).toBe(false);
  });
});

// ── storage namespacing ──────────────────────────────────────────────────────

describe("handleCapCall storage namespacing", () => {
  it("resolves storage to preview:<owner>:<id> (never community:<id>)", async () => {
    const r = await handleCapCall(makeSession(), { callId: 1, cap: "storage", method: "get", args: { key: "k" } });
    expect(r.ok).toBe(true);
    expect(lastKvNamespace).toBe("preview:42:mymod");
    expect(lastKvNamespace).not.toContain("community:");
  });
});

// ── http default deny + SSRF ─────────────────────────────────────────────────

describe("handleCapCall http", () => {
  it("denies http by default (no operator sidecar)", async () => {
    const r = await handleCapCall(makeSession(), {
      callId: 1,
      cap: "http",
      method: "fetch",
      args: { url: "https://api.example.com/x" },
    });
    expect(r.ok).toBe(false);
  });
});

describe("isForbiddenAddress (anti-SSRF)", () => {
  it("rejects loopback / RFC1918 / CGNAT / link-local / metadata / ULA / mapped / unspecified", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.9.9",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "100.64.0.1", // CGNAT
      "0.0.0.0",
      "::1",
      "fe80::1",
      "fd00::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isForbiddenAddress(ip), ip).toBe(true);
    }
  });

  it("allows a public address", () => {
    expect(isForbiddenAddress("1.1.1.1")).toBe(false);
    expect(isForbiddenAddress("93.184.216.34")).toBe(false);
  });
});
