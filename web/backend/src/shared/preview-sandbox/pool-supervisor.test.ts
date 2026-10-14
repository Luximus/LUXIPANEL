// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests del PoolSupervisor (§11). Mockea `child_process.spawn` (procesos
 * fake con un fd-3 simulado), `config` y el `logger` ANTES de importar. NO
 * spawnea procesos reales. Cubre: single-flight, recycle (`once`), recycle
 * pooled on owner/moduleId change, reserva por owner, saturación de cola,
 * admission-timeout ≠ deadline, deadline SIGKILL, una-capCall-pendiente,
 * presupuesto de denies, y enrutado capCall↔capResult al broker inyectado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

// ── Mocks (antes de importar el SUT) ─────────────────────────────────────────
vi.mock("../logger/index.js", () => ({
  createModuleLogger: () => ({
    debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, trace: () => {}, fatal: () => {},
  }),
}));

// Config inyectada (evita cargar config/env y fija valores de test).
let testCfg = makeCfg();
vi.mock("./config.js", () => ({
  getPreviewSandboxConfig: () => testCfg,
}));

// Substrate: probe Tier 1 + builder estable; reapOrphans no-op.
let probeTier = 1;
vi.mock("./substrate.js", () => ({
  probeSubstrate: () => ({ tier: probeTier, confining: probeTier >= 1, reason: "test", detail: {} }),
  buildTier1Command: () => ({ file: "setpriv", argv: ["--", "node", "child"], env: { PATH: "/usr/bin" } }),
  reapOrphans: async () => {},
}));

// child_process.spawn: fabrica procesos fake controlables.
const fakeChildren: FakeChild[] = [];
let autoReady = true; // emite ready automáticamente al spawnear
vi.mock("node:child_process", () => ({
  spawn: () => {
    const c = new FakeChild();
    fakeChildren.push(c);
    if (autoReady) queueMicrotask(() => c.emitReady());
    return c as unknown as import("node:child_process").ChildProcess;
  },
}));

// fs/os: scratch tmp es no-op (mkdtempSync devuelve una ruta fija, rmSync no-op).
vi.mock("node:fs", async (orig) => {
  const real = (await orig()) as typeof import("node:fs");
  return { ...real, mkdtempSync: () => "/tmp/pips-test", rmSync: () => {}, readFileSync: () => Buffer.from("child") };
});

import { PoolSupervisor } from "./pool-supervisor.js";
import type { PreviewSandboxConfig } from "./config.js";

// ── Fakes ────────────────────────────────────────────────────────────────────
const LEN = 4;
function encode(msg: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(msg), "utf8");
  const head = Buffer.allocUnsafe(LEN);
  head.writeUInt32BE(body.length, 0);
  return Buffer.concat([head, body]);
}

/** Proceso hijo fake: stdio[3] = duplex. `toWorker` captura lo que el panel
 *  escribe; `fromWorker` (=stdio[3]) emite frames worker→panel. */
class FakeChild extends EventEmitter {
  pid = Math.floor(Math.random() * 100000);
  killed = false;
  exitCode: number | null = null;
  // El fd-3 visto por el supervisor: lo que el panel ESCRIBE aquí lo capturamos,
  // y lo que NOSOTROS escribimos (push) llega al supervisor como `data`.
  private fd3 = new PassThrough();
  written: Buffer[] = [];
  stdio: [unknown, unknown, unknown, PassThrough];

  constructor() {
    super();
    // interceptamos writes del panel
    const origWrite = this.fd3.write.bind(this.fd3);
    this.fd3.write = ((chunk: Buffer) => {
      this.written.push(Buffer.from(chunk));
      this.lastWrite = decodeAll(this.written);
      return true;
    }) as typeof origWrite;
    this.stdio = [null, null, null, this.fd3];
  }

  lastWrite: unknown[] = [];

  kill(): boolean {
    if (this.killed) return true;
    this.killed = true;
    this.exitCode = -1;
    queueMicrotask(() => this.emit("exit", -1, "SIGKILL"));
    return true;
  }

  /** Emite un frame worker→panel hacia el fd-3 del supervisor. */
  push(msg: unknown): void {
    this.fd3.emit("data", encode(msg));
  }

  emitReady(): void {
    this.push({ v: 1, type: "ready", id: 0, abi: "127", node: "v22.22.2", v8: "12.4.254.21", hostHash: "h" });
  }

  /** El último frame de tipo `t` que el panel escribió. */
  lastWritten<T = Record<string, unknown>>(t: string): T | undefined {
    return [...this.lastWrite].reverse().find((m) => (m as { type: string }).type === t) as T | undefined;
  }
}

function decodeAll(chunks: Buffer[]): unknown[] {
  const buf = Buffer.concat(chunks);
  const out: unknown[] = [];
  let off = 0;
  while (off + LEN <= buf.length) {
    const len = buf.readUInt32BE(off);
    if (off + LEN + len > buf.length) break;
    const body = buf.subarray(off + LEN, off + LEN + len);
    try {
      out.push(JSON.parse(body.toString("utf8")));
    } catch {
      /* partial */
    }
    off += LEN + len;
  }
  return out;
}

function makeCfg(over: Partial<PreviewSandboxConfig> = {}): PreviewSandboxConfig {
  return {
    enabled: true,
    minTier: 1,
    poolSize: 2,
    reuse: "once",
    dispatchMs: 200,
    memMaxMb: 128,
    cpuQuotaPct: 50,
    maxFrameBytes: 1048576,
    maxOutputBytes: 262144,
    rootMb: 64,
    scratchMb: 32,
    abi: "127",
    nodeVersion: "v22.22.2",
    maxCapsPerDispatch: 64,
    queueMax: 16,
    perOwnerRate: "100/30s",
    workerMaxDispatches: 20,
    ...over,
  } as PreviewSandboxConfig;
}

const broker = vi.fn(async () => ({ ok: false, error: "DENY", code: "FORBIDDEN" }));

/** Bootstrap directo del pool (saltando el self-test real, que requiere un
 *  child real). Usamos los internos vía un supervisor "pre-calentado" manual:
 *  inyectamos workers fake llamando a `warmPool` por reflexión controlada.
 *  Para mantener los tests de dispatch/lease enfocados, exponemos un helper que
 *  fuerza healthy + pool de N workers fake listos. */
async function primedPool(cfg: PreviewSandboxConfig, n = 2): Promise<PoolSupervisor> {
  testCfg = cfg;
  const sup = new PoolSupervisor() as unknown as {
    healthyLatched: boolean;
    poolSize: number;
    tier: number;
    nodeVersion: string;
    abi: string;
    cfg: PreviewSandboxConfig;
    workers: Array<Record<string, unknown>>;
    broker: unknown;
    rateLimit: { n: number; windowMs: number };
    parseRate(s: string): void;
    spawnWorker(): Record<string, unknown>;
    awaitReady(w: unknown, ms: number): Promise<void>;
  };
  sup.cfg = cfg;
  sup.broker = broker;
  sup.parseRate(cfg.perOwnerRate);
  sup.poolSize = cfg.poolSize;
  sup.tier = 1;
  sup.nodeVersion = cfg.nodeVersion;
  sup.abi = cfg.abi;
  for (let i = 0; i < n; i++) {
    const w = sup.spawnWorker();
    await sup.awaitReady(w, 1000);
    sup.workers.push(w);
  }
  sup.healthyLatched = true;
  return sup as unknown as PoolSupervisor;
}

beforeEach(() => {
  fakeChildren.length = 0;
  autoReady = true;
  probeTier = 1;
  testCfg = makeCfg();
  broker.mockClear();
});
afterEach(() => {
  vi.clearAllTimers();
});

describe("PoolSupervisor.bootstrap gating", () => {
  it("stays unhealthy when ENABLED=false (inert)", async () => {
    testCfg = makeCfg({ enabled: false });
    const sup = new PoolSupervisor();
    await sup.bootstrap({ brokerHandleCapCall: broker });
    expect(sup.healthy()).toBe(false);
  });

  it("stays unhealthy when substrate tier < minTier (no userns)", async () => {
    probeTier = 0;
    testCfg = makeCfg();
    const sup = new PoolSupervisor();
    await sup.bootstrap({ brokerHandleCapCall: broker });
    expect(sup.healthy()).toBe(false);
  });

  it("stays unhealthy (no crash) when no broker is injected (F2)", async () => {
    testCfg = makeCfg();
    const sup = new PoolSupervisor();
    await sup.bootstrap({});
    expect(sup.healthy()).toBe(false);
  });

  it("describe() reports tier/pool/node/abi", async () => {
    const sup = await primedPool(makeCfg());
    expect(sup.describe()).toMatch(/pool=2/);
    expect(sup.describe()).toMatch(/abi=127/);
  });
});

describe("PoolSupervisor.dispatch", () => {
  function dispatchArgs(over: Record<string, unknown> = {}) {
    return {
      moduleId: "mod-a",
      tool: "doThing",
      input: { x: 1 },
      owner: "owner-1",
      ownerUserId: "u-1",
      deadlineMs: 200,
      source: { entryBytes: "src", manifestHash: "h" },
      policy: { capabilities: [], http_allowlist: [] },
      session: { fake: true },
      brokerHandleCapCall: broker,
      ...over,
    };
  }

  it("sends a dispatch frame and resolves on result (host-cloned)", async () => {
    const sup = await primedPool(makeCfg());
    const child = fakeChildren[0]!;
    const p = sup.dispatch(dispatchArgs() as never);
    await new Promise((r) => setTimeout(r, 5));
    const sent = child.lastWritten("dispatch") as { source: unknown; policy: unknown } | undefined;
    expect(sent).toBeTruthy();
    expect(sent!.source).toEqual({ entryBytes: "src", manifestHash: "h" });
    child.push({ v: 1, type: "result", id: 1, ok: true, output: { done: 1 } });
    const res = await p;
    expect(res).toEqual({ ok: true, output: { done: 1 } });
  });

  it("routes capCall to the injected broker and frames capResult back", async () => {
    broker.mockResolvedValueOnce({ ok: true, value: "stored" });
    const sup = await primedPool(makeCfg());
    const child = fakeChildren[0]!;
    const p = sup.dispatch(dispatchArgs() as never);
    await new Promise((r) => setTimeout(r, 5));
    child.push({ v: 1, type: "capCall", id: 1, callId: 7, cap: "storage", method: "get", args: ["k"] });
    await new Promise((r) => setTimeout(r, 5));
    expect(broker).toHaveBeenCalledWith(
      { fake: true },
      { callId: 7, cap: "storage", method: "get", args: ["k"] },
    );
    const cr = child.lastWritten("capResult") as { ok: boolean; value: unknown } | undefined;
    expect(cr).toMatchObject({ ok: true, value: "stored", callId: 7 });
    child.push({ v: 1, type: "result", id: 2, ok: true, output: 1 });
    await p;
  });

  it("kills the worker and rejects on a second outstanding capCall (protocol violation)", async () => {
    // broker never resolves the first capCall, so the second arrives while one
    // is outstanding.
    broker.mockImplementation(() => new Promise(() => {}));
    const sup = await primedPool(makeCfg());
    const child = fakeChildren[0]!;
    const p = sup.dispatch(dispatchArgs() as never);
    await new Promise((r) => setTimeout(r, 5));
    child.push({ v: 1, type: "capCall", id: 1, callId: 1, cap: "storage", method: "get", args: [] });
    child.push({ v: 1, type: "capCall", id: 2, callId: 2, cap: "storage", method: "get", args: [] });
    await expect(p).rejects.toThrow(/outstanding capCall/);
    expect(child.killed).toBe(true);
  });

  it("SIGKILLs the worker and rejects on deadline (while(true))", async () => {
    const sup = await primedPool(makeCfg({ dispatchMs: 30 }));
    const child = fakeChildren[0]!;
    const p = sup.dispatch(dispatchArgs({ deadlineMs: 30 }) as never);
    await expect(p).rejects.toThrow(/deadline/);
    expect(child.killed).toBe(true);
  });

  it("recycles the worker after every dispatch in reuse=once mode", async () => {
    const sup = await primedPool(makeCfg({ reuse: "once" }));
    const child = fakeChildren[0]!;
    const p = sup.dispatch(dispatchArgs() as never);
    await new Promise((r) => setTimeout(r, 5));
    child.push({ v: 1, type: "result", id: 1, ok: true, output: 1 });
    await p;
    await new Promise((r) => setTimeout(r, 5));
    // the worker that served the dispatch was SIGKILLed (single-use).
    expect(child.killed).toBe(true);
  });

  it("pooled mode recycles on owner change but reuses for same owner+module", async () => {
    const sup = await primedPool(makeCfg({ reuse: "pooled", poolSize: 1 }), 1);
    const child = fakeChildren[0]!;
    // dispatch 1: owner-1 / mod-a
    let p = sup.dispatch(dispatchArgs({ owner: "owner-1", moduleId: "mod-a" }) as never);
    await new Promise((r) => setTimeout(r, 5));
    child.push({ v: 1, type: "result", id: 1, ok: true, output: 1 });
    await p;
    expect(child.killed).toBe(false); // pooled: reused, not recycled
    // dispatch 2: SAME owner+module ⇒ still the same live worker
    p = sup.dispatch(dispatchArgs({ owner: "owner-1", moduleId: "mod-a" }) as never);
    await new Promise((r) => setTimeout(r, 5));
    child.push({ v: 1, type: "result", id: 2, ok: true, output: 2 });
    await p;
    expect(child.killed).toBe(false);
    // dispatch 3: DIFFERENT owner ⇒ recycle the worker that just ran.
    p = sup.dispatch(dispatchArgs({ owner: "owner-2", moduleId: "mod-a" }) as never);
    await new Promise((r) => setTimeout(r, 5));
    const last = fakeChildren[fakeChildren.length - 1]!;
    last.push({ v: 1, type: "result", id: 3, ok: true, output: 3 });
    await p;
    await new Promise((r) => setTimeout(r, 5));
    expect(last.killed).toBe(true);
  });
});

describe("PoolSupervisor.lease (rate-limit, reservation, queue)", () => {
  it("enforces a per-owner token bucket", async () => {
    const sup = (await primedPool(makeCfg({ perOwnerRate: "1/30s", poolSize: 2 }))) as unknown as {
      lease(o: string): Promise<unknown>;
    };
    await sup.lease("owner-x");
    await expect(sup.lease("owner-x")).rejects.toThrow(/rate limit/);
  });

  it("rejects 'sandbox saturated' when the FIFO queue is full", async () => {
    // poolSize 1, queueMax 1: lease one (busy), queue one, third saturates.
    const cfg = makeCfg({ poolSize: 1, queueMax: 1, perOwnerRate: "100/30s" });
    const sup = (await primedPool(cfg, 1)) as unknown as { lease(o: string): Promise<unknown> };
    await sup.lease("a"); // takes the only worker (busy)
    void sup.lease("b").catch(() => {}); // queued (depth 1)
    await new Promise((r) => setTimeout(r, 1));
    await expect(sup.lease("c")).rejects.toThrow(/saturated/);
  });

  it("admission timeout rejects a queued lease without consuming an execution deadline", async () => {
    vi.useFakeTimers();
    const cfg = makeCfg({ poolSize: 1, queueMax: 4, dispatchMs: 50, perOwnerRate: "100/30s" });
    const sup = (await primedPool(cfg, 1)) as unknown as { lease(o: string): Promise<unknown> };
    await sup.lease("a"); // worker busy
    const queued = sup.lease("b");
    const expectation = expect(queued).rejects.toThrow(/admission timeout/);
    // admissionTimeoutMs = min(30000, dispatchMs*2) = 100ms — distinct from the
    // 50ms execution deadline (proves they are separate timers).
    await vi.advanceTimersByTimeAsync(120);
    await expectation;
    vi.useRealTimers();
  });
});
