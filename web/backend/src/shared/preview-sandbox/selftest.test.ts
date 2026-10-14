// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests del self-test PIPS (§7.1 / §11). Mockea el `WorkerHandle` y el
 * `brokerProbe`; NO spawnea procesos reales (los pasos live-spawn van en la
 * suite de integración, que hace skip sin userns). Cada test ejercita que el
 * self-test devuelve el PRIMER paso que falla y que el camino verde pasa los 7.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Stub the logger so importing selftest.ts does NOT pull in config/env (which
// process.exit(1)s on a missing JWT_SECRET under vitest). Mock BEFORE import.
vi.mock("../logger/index.js", () => ({
  createModuleLogger: () => ({
    debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, trace: () => {}, fatal: () => {},
  }),
}));

import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSelfTest, type WorkerHandle, type BrokerProbeFn } from "./selftest.js";
import type { PreviewSandboxConfig } from "./config.js";

const cfg = { reuse: "once" } as unknown as PreviewSandboxConfig;
const expected = { node: "v22.22.2", abi: "127", v8: "12.4.254.21", hostHash: "deadbeef" };

let configDir: string;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "pips-selftest-cfg-"));
});
afterEach(() => {
  try {
    rmSync(configDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

/** Worker handle "perfecto": todos los pasos internos pasan, el loop muere. */
function goodWorker(over: Partial<WorkerHandle> = {}): WorkerHandle {
  return {
    ready: { ...expected },
    selftest: vi.fn(async () => ({ ok: true, detail: "ok" })),
    dispatchSynthetic: vi.fn(async () => ({ killed: true, detail: "killed" })),
    kill: vi.fn(),
    alive: vi.fn(() => false),
    ...over,
  };
}

/** Broker que DENIEGA todo (deny-by-default correcto). */
const denyAllBroker: BrokerProbeFn = vi.fn(async () => ({ ok: false, error: "DENY", code: "FORBIDDEN" }));

function args(worker: WorkerHandle, broker: BrokerProbeFn = denyAllBroker) {
  return {
    config: cfg,
    tier: 1 as const,
    expected,
    spawnProbe: async () => worker,
    brokerProbe: broker,
    configDir,
  };
}

describe("PIPS self-test (7 steps)", () => {
  it("passes all 7 steps with a perfect worker + deny-by-default broker", async () => {
    const r = await runSelfTest(args(goodWorker()));
    expect(r.ok).toBe(true);
    expect(r.failedStep).toBeUndefined();
    // the structural canary file is cleaned up
    expect(existsSync(join(configDir, ".pips-canary"))).toBe(false);
  });

  it("step 1: fails on ABI (modules) mismatch", async () => {
    const w = goodWorker({ ready: { ...expected, abi: "115" } });
    const r = await runSelfTest(args(w));
    expect(r.ok).toBe(false);
    expect(r.failedStep).toBe(1);
    expect(r.detail).toMatch(/ABI mismatch/);
  });

  it("step 1: fails on child.mjs hostHash mismatch (tampered shim)", async () => {
    const w = goodWorker({ ready: { ...expected, hostHash: "0000" } });
    const r = await runSelfTest(args(w));
    expect(r.failedStep).toBe(1);
    expect(r.detail).toMatch(/SHA mismatch/);
  });

  it("step 2: fails when the realm is not scrubbed", async () => {
    const w = goodWorker({
      selftest: vi.fn(async (kind: string) => ({ ok: kind !== "realm", detail: kind })),
    });
    const r = await runSelfTest(args(w));
    expect(r.failedStep).toBe(2);
  });

  it("step 3: fails when the canary is reachable inside the jail", async () => {
    const w = goodWorker({
      selftest: vi.fn(async (kind: string) => ({ ok: kind !== "canary", detail: kind })),
    });
    const r = await runSelfTest(args(w));
    expect(r.failedStep).toBe(3);
    expect(r.detail).toMatch(/scrub not structural/);
    // canary still cleaned up even on failure
    expect(existsSync(join(configDir, ".pips-canary"))).toBe(false);
  });

  it("step 4: fails when network is not cut (ECONNREFUSED routable)", async () => {
    const w = goodWorker({
      selftest: vi.fn(async (kind: string) => ({ ok: kind !== "network", detail: kind })),
    });
    const r = await runSelfTest(args(w));
    expect(r.failedStep).toBe(4);
  });

  it("step 5: fails when FS confinement is breached", async () => {
    const w = goodWorker({
      selftest: vi.fn(async (kind: string) => ({ ok: kind !== "fs", detail: kind })),
    });
    const r = await runSelfTest(args(w));
    expect(r.failedStep).toBe(5);
  });

  it("step 6: fails when the timeout/kill path does not fire", async () => {
    const w = goodWorker({ dispatchSynthetic: vi.fn(async () => ({ killed: false, detail: "no kill" })) });
    const r = await runSelfTest(args(w));
    expect(r.failedStep).toBe(6);
  });

  it("step 6: fails when the worker is still alive after SIGKILL", async () => {
    const w = goodWorker({ alive: vi.fn(() => true) });
    const r = await runSelfTest(args(w));
    expect(r.failedStep).toBe(6);
    expect(r.detail).toMatch(/still alive/);
  });

  it("step 7: fails if the broker does NOT deny server.exec by default", async () => {
    const allowExec: BrokerProbeFn = vi.fn(async (_s, c) =>
      c.cap === "server.exec" ? { ok: true, value: "ran" } : { ok: false },
    );
    const r = await runSelfTest(args(goodWorker(), allowExec));
    expect(r.failedStep).toBe(7);
    expect(r.detail).toMatch(/server\.exec/);
  });

  it("step 7: fails if the broker does NOT deny an unknown capability", async () => {
    const allowUnknown: BrokerProbeFn = vi.fn(async (_s, c) =>
      c.cap.startsWith("totally.unknown") ? { ok: true } : { ok: false },
    );
    const r = await runSelfTest(args(goodWorker(), allowUnknown));
    expect(r.failedStep).toBe(7);
    expect(r.detail).toMatch(/unknown capability/);
  });

  it("step 7: fails if sudo is granted even when the synthetic policy lists it", async () => {
    const allowSudo: BrokerProbeFn = vi.fn(async (_s, c) =>
      c.cap === "server.sudo" ? { ok: true } : { ok: false },
    );
    const r = await runSelfTest(args(goodWorker(), allowSudo));
    expect(r.failedStep).toBe(7);
    expect(r.detail).toMatch(/server\.sudo/);
  });

  it("step 0: fails (no crash) when the probe worker never starts", async () => {
    const r = await runSelfTest({
      ...args(goodWorker()),
      spawnProbe: async () => {
        throw new Error("userns unavailable");
      },
    });
    expect(r.ok).toBe(false);
    expect(r.failedStep).toBe(0);
  });
});
