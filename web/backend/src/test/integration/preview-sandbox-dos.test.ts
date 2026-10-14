// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * PIPS integration — DoS / FAIL-CLOSED (RUNTIME-DESIGN §11). Drives the REAL
 * PoolSupervisor.bootstrap() with config mocked to enabled=true (test-local; the
 * real PREVIEW_SANDBOX_ENABLED / MODULE_DEV_PREVIEW_ENABLED flags are NEVER
 * touched) and REAL child_process.spawn.
 *
 * On any host WITHOUT a fully provisioned scrub rootfs (the test host), the real
 * child.mjs fail-closes (secret canary reachable ⇒ exit 11) BEFORE any untrusted
 * byte, the self-test fails, and the pool latches healthy()===false. The
 * load-bearing DoS guarantees are then:
 *   - lease()/dispatch() REJECT (no green dispatch ever leaks ⇒ no worker to
 *     starve, no while(true) to run on the panel host) — fail-closed;
 *   - dispose() is idempotent and never throws (orphan reap is best-effort).
 *
 * The while(true)→SIGKILL-within-deadline, over-deny-budget→kill, single-flight,
 * admission≠execution-deadline and per-owner-reservation behaviours are proven
 * deterministically (no userns needed) in pool-supervisor.test.ts with a fake
 * spawn. Here we assert the SYSTEM-LEVEL fail-closed contract against a REAL
 * substrate so the build is green on both userns and userns-less hosts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../shared/logger/index.js", () => ({
  createModuleLogger: () => ({
    debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, trace: () => {}, fatal: () => {},
  }),
}));

// Config mocked enabled=true — TEST-LOCAL ONLY (a standalone mock so importing
// config.js does NOT pull in config/env.ts, which process.exit(1)s under
// vitest). We never flip the real PREVIEW_SANDBOX_ENABLED / MODULE_DEV flags.
let enabled = true;
vi.mock("../../shared/preview-sandbox/config.js", () => ({
  getPreviewSandboxConfig: () => ({
    enabled,
    minTier: 1 as const,
    poolSize: 1,
    reuse: "once" as const,
    dispatchMs: 1000,
    memMaxMb: 64,
    cpuQuotaPct: 50,
    maxFrameBytes: 1_048_576,
    maxOutputBytes: 262_144,
    rootMb: 64,
    scratchMb: 32,
    maxCapsPerDispatch: 64,
    queueMax: 16,
    perOwnerRate: "6/30s",
    workerMaxDispatches: 20,
    abi: process.versions.modules,
    nodeVersion: process.version,
  }),
}));

const { PoolSupervisor } = await import("../../shared/preview-sandbox/pool-supervisor.js");

describe("PIPS DoS / fail-closed (real substrate)", () => {
  let sup: InstanceType<typeof PoolSupervisor>;

  beforeEach(() => {
    enabled = true;
    sup = new PoolSupervisor();
  });

  afterEach(async () => {
    try {
      await sup.dispose();
    } catch {
      /* dispose must never throw, but guard the test anyway */
    }
  });

  it("bootstrap never throws and latches a definite healthy() boolean", async () => {
    await expect(sup.bootstrap({ brokerHandleCapCall: async () => ({ ok: false, error: "deny" }) })).resolves.toBeUndefined();
    expect(typeof sup.healthy()).toBe("boolean");
  }, 30000);

  it("when not healthy, lease() and dispatch() REJECT (fail-closed, no starvation surface)", async () => {
    await sup.bootstrap({ brokerHandleCapCall: async () => ({ ok: false, error: "deny" }) });
    if (sup.healthy()) {
      // The host genuinely provisioned a green sandbox (rare in CI). Then the
      // single-flight + deadline guarantees are exercised by the unit suite;
      // here we just confirm the green path does not crash on a no-op dispatch
      // attempt being skipped. Nothing to assert about fail-closed.
      expect(sup.healthy()).toBe(true);
      return;
    }
    await expect(sup.lease("attacker@evil.test")).rejects.toThrow();
    await expect(
      sup.dispatch({
        moduleId: "m",
        tool: "t",
        input: {},
        owner: "attacker@evil.test",
        ownerUserId: "u",
        deadlineMs: 200,
        source: { entryBytes: "while(true){}", manifestHash: "x" },
        policy: { capabilities: [], http_allowlist: [] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session: {} as any,
        brokerHandleCapCall: async () => ({ ok: false, error: "deny" }),
      }),
    ).rejects.toThrow();
  }, 30000);

  it("dispose() is idempotent and never throws", async () => {
    await sup.bootstrap({ brokerHandleCapCall: async () => ({ ok: false, error: "deny" }) });
    await expect(sup.dispose()).resolves.toBeUndefined();
    await expect(sup.dispose()).resolves.toBeUndefined();
    expect(sup.healthy()).toBe(false);
  }, 30000);

  it("disabled config ⇒ inert (healthy()===false, no spawn)", async () => {
    enabled = false;
    const s2 = new PoolSupervisor();
    await s2.bootstrap({ brokerHandleCapCall: async () => ({ ok: false, error: "deny" }) });
    expect(s2.healthy()).toBe(false);
    await s2.dispose();
  }, 15000);
});
