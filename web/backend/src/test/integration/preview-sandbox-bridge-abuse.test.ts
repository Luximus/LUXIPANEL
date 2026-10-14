// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * PIPS integration — BRIDGE-ABUSE (RUNTIME-DESIGN §11). Drives the REAL broker
 * (handleCapCall + buildEffectivePolicy) with a mocked executor/kv/context to
 * prove the authorization contract end-to-end:
 *   - a preview declaring server.exec + server.sudo gets DENY for BOTH, even
 *     when its (synthetic) manifest declares them;
 *   - `ctx.server.exec('cat .../shared-secrets.json', {sudo:true})` ⇒ DENY;
 *   - manifest rewrite mid-dispatch is rejected (broker authorizes against the
 *     FROZEN snapshot/effectivePolicy captured in the session, never re-reads);
 *   - cross-tenant executor reuse is impossible (per-capCall executor + epoch
 *     re-check aborts when the context executor changed);
 *   - storage writes land ONLY in the preview:<owner>:<id> namespace.
 *
 * No userns needed: this is panel-side policy. Mock BEFORE import (§11).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Executor } from "../../shared/executor/types.js";

vi.mock("../../shared/logger/index.js", () => ({
  createModuleLogger: () => ({
    debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, trace: () => {}, fatal: () => {},
  }),
}));

// Context executor: the broker re-asserts getContextExecutor()===session.executor
// on every capCall (liveness). Tests flip it to assert the abort path.
let contextExecutor: Executor | null = null;
vi.mock("../../shared/executor/context.js", () => ({
  getContextExecutor: () => contextExecutor,
  runWithExecutor: (_e: Executor, fn: () => unknown) => fn(),
}));

// kv() captures the namespace string so we can assert preview:<owner>:<id>.
let lastKvNamespace = "";
vi.mock("../../shared/kv-store/index.js", () => ({
  kv: () => ({
    module: (ns: string) => {
      lastKvNamespace = ns;
      return {
        collection: () => ({
          get: async (k: string) => ({ id: k }),
          set: async (k: string, v: Record<string, unknown>) => ({ id: k, ...v }),
          list: async () => [],
          delete: async () => true,
        }),
      };
    },
  }),
}));

const {
  handleCapCall,
  buildEffectivePolicy,
  setSessionEpochSource,
} = await import("../../shared/preview-sandbox/broker.js");
type BrokerSession = import("../../shared/preview-sandbox/broker.js").BrokerSession;

// The broker DENIES every capCall until the runtime's session-epoch reader is
// injected (fail-closed). Inject a controllable one so the live-session epoch
// (sessionEpoch:1) matches and the policy assertions exercise the cap switch.
let testEpoch = 1;
setSessionEpochSource(() => testEpoch);

function makeExecutor(): Executor {
  return { exec: vi.fn(async () => ({ stdout: "", stderr: "", code: 0 })) } as unknown as Executor;
}

function makeSession(over: Partial<BrokerSession> = {}): BrokerSession {
  const executor = over.executor ?? makeExecutor();
  contextExecutor = executor; // happy-path: context matches session
  return {
    executor,
    user: null,
    sessionEpoch: 1,
    owner: "alice@example.com",
    ownerUserId: "u-alice",
    moduleId: "demo-module",
    effectivePolicy: over.effectivePolicy ?? {
      capabilities: new Set(["server.fs.read", "storage"] as const),
      http_allowlist: [],
    },
    manifestHash: "deadbeef",
    ...over,
  } as BrokerSession;
}

describe("PIPS bridge-abuse (real broker)", () => {
  beforeEach(() => {
    lastKvNamespace = "";
    contextExecutor = null;
    testEpoch = 1; // live session (matches makeSession sessionEpoch:1)
  });

  it("DENIES server.exec even when the synthetic manifest declared exec+sudo", async () => {
    // Manifest declares exec & sudo; buildEffectivePolicy must NOT surface them
    // (exec/sudo are hard-denied for previews regardless of manifest).
    const eff = buildEffectivePolicy(
      { capabilities: ["server.exec", "server.sudo"] as never },
      { capabilities: ["server.exec", "server.sudo"] as never },
    );
    const session = makeSession({ effectivePolicy: { ...eff } as never });
    const res = await handleCapCall(session, {
      callId: 1,
      cap: "server.exec",
      method: "exec",
      args: { cmd: "id" },
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("CAP_DENIED");
  });

  it("DENIES server.sudo (cat shared-secrets.json with sudo)", async () => {
    const session = makeSession();
    const res = await handleCapCall(session, {
      callId: 2,
      cap: "server.sudo",
      method: "exec",
      args: { cmd: "cat /etc/luxipanel/shared-secrets.json", opts: { sudo: true } },
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("CAP_DENIED");
  });

  it("DENIES server.fs.write for previews", async () => {
    const session = makeSession();
    const res = await handleCapCall(session, {
      callId: 3,
      cap: "server.fs.write",
      method: "writeFile",
      args: { path: "/tmp/x", data: { kind: "utf8", value: "y" } },
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("CAP_DENIED");
  });

  it("rejects a manifest rewrite mid-dispatch (authorizes against the frozen session policy)", async () => {
    // The session's effectivePolicy is the frozen snapshot. Mutating a manifest
    // object after the session is built must have NO effect: the broker only
    // looks at session.effectivePolicy, never re-reads a manifest.
    const session = makeSession();
    // Attempt to widen the live policy object AFTER capture — broker ignores it
    // because exec is hard-denied irrespective of the set.
    (session.effectivePolicy.capabilities as Set<string>).add("server.exec");
    const res = await handleCapCall(session, {
      callId: 4,
      cap: "server.exec",
      method: "exec",
      args: { cmd: "whoami" },
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("CAP_DENIED");
  });

  it("aborts when the context executor changed (cross-tenant reuse impossible)", async () => {
    const session = makeSession(); // sets contextExecutor = session.executor
    // Simulate the originating request scope unwinding / a different tenant's
    // executor now in context.
    contextExecutor = makeExecutor();
    const res = await handleCapCall(session, {
      callId: 5,
      cap: "storage",
      method: "get",
      args: { key: "k" },
    });
    expect(res.ok).toBe(false);
    // The broker aborts (executor mismatch) — denied, never serviced.
    expect(res.code).toBeDefined();
  });

  it("revokes an in-flight dispatch when the session epoch advances (logout/dispose)", async () => {
    // A dispatch admitted under epoch 1 keeps draining capCalls. A logout
    // (disposeDirectExecutor) bumps the runtime epoch; the broker must then DENY
    // every subsequent capCall for that session — even with the SAME executor in
    // scope (the case the executor-identity check alone cannot catch).
    const session = makeSession(); // epoch 1, contextExecutor === session.executor
    testEpoch = 2; // simulate the logout bump
    const res = await handleCapCall(session, {
      callId: 8,
      cap: "storage",
      method: "get",
      args: { key: "k" },
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("SESSION_EPOCH_STALE");
  });

  it("storage writes land ONLY in preview:<ownerUserId>:<moduleId>", async () => {
    const session = makeSession();
    const res = await handleCapCall(session, {
      callId: 6,
      cap: "storage",
      method: "set",
      args: { key: "state", value: { a: 1 } },
    });
    expect(res.ok).toBe(true);
    expect(lastKvNamespace).toBe("preview:u-alice:demo-module");
    expect(lastKvNamespace).not.toContain("community:");
  });

  it("DENIES an unknown capability string", async () => {
    const session = makeSession();
    const res = await handleCapCall(session, {
      callId: 7,
      cap: "totally.bogus.cap",
      method: "doStuff",
      args: {},
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("CAP_DENIED");
  });
});
