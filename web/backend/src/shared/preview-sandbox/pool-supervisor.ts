// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * PIPS — supervisor del pool de workers sandbox (Fase F2). Ver RUNTIME-DESIGN.md
 * §3.3, §7.1, §7.2, §7.3.
 *
 * El `PoolSupervisor` corre EN el panel y sólo sostiene HANDLES de procesos hijo
 * (nunca código de módulo). Es estado de INSTANCIA (boot dentro de
 * `runOnPanelHost`), NO per-server. Responsabilidades:
 *   - bootstrap: reap de huérfanos → probe del sustrato → spawn de un worker
 *     probe por el camino EXACTO de producción → self-test 7-pasos → calentar
 *     el pool. NUNCA lanza (se auto-envuelve en try/catch ⇒ unhealthy).
 *   - lease: rate-limit + concurrencia 1 por owner + reserva floor(pool/2) +
 *     cola FIFO acotada con timeout de ADMISIÓN separado del deadline de
 *     ejecución; over-queue ⇒ "sandbox saturated".
 *   - dispatch: single-flight por worker, deadline AGREGADO único, bomba
 *     capCall↔capResult enrutada al broker (inyectado), una capCall pendiente,
 *     caps≤MAX, deny-budget≤20, recycle por política REUSE.
 *   - dispose: cgroup.kill + SIGKILL del árbol unshare + rm scratch.
 *
 * El broker (`broker.ts`, A2) NO se importa: se inyecta `brokerHandleCapCall` en
 * `bootstrap` para mantener A1/A2 desacoplados (y para que el self-test use el
 * mismo handler). El child real (`child.mjs`, A4) y los builders de spawn
 * (`substrate.ts`, A3) se consumen por sus contratos.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cpus } from "node:os";
import { CONFIG_DIR } from "@config/paths.js";
import { createModuleLogger } from "../logger/index.js";
import { getPreviewSandboxConfig, type PreviewSandboxConfig } from "./config.js";
import { probeSubstrate, buildTier1Command, type Tier, type SpawnPlan } from "./substrate.js";
import { FrameDecoder, encodeFrame, type AnyMessage } from "./protocol.js";
import { runSelfTest, type WorkerHandle, type BrokerProbeFn, type SelftestKind } from "./selftest.js";
import type { Capability } from "../module-sdk/index.js";

const log = createModuleLogger("preview-sandbox");

/** Handler del broker inyectado (firma de `broker.handleCapCall`).
 *
 *  La sesión es opaca para el supervisor (la arma `runtime.dispatch`, A2, y se
 *  pasa tal cual). `session: any` es deliberado en ESTE seam de inyección: hace
 *  que el `handleCapCall` real de `broker.ts` (que tipa `session: BrokerSession`)
 *  sea asignable sin que el supervisor importe `broker.ts` (desacople A1/A2).
 *  Un 3er parámetro opcional del broker (p.ej. `maxOutput`) es compatible. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BrokerHandleCapCall = (
  session: any,
  capCall: { callId: number; cap: string; method: string; args: unknown },
  ...rest: unknown[]
) => Promise<{ ok: boolean; value?: unknown; error?: string; code?: string }>;

export interface PoolBootstrapDeps {
  brokerHandleCapCall?: BrokerHandleCapCall;
}

/** Argumentos de un dispatch (los arma `runtime.dispatch`, A2). */
export interface PoolDispatchArgs {
  moduleId: string;
  tool: string;
  input: unknown;
  owner: string;
  ownerUserId: string;
  deadlineMs: number;
  source: { entryBytes: string; manifestHash: string };
  policy: { capabilities: Capability[]; http_allowlist: string[] };
  /** BrokerSession (opaca aquí; se pasa tal cual al broker). */
  session: unknown;
  brokerHandleCapCall: BrokerHandleCapCall;
}

interface WorkerState {
  pid: number;
  child: ChildProcess;
  socket: NodeJS.ReadWriteStream;
  decoder: FrameDecoder;
  ready: boolean;
  dispatchCount: number;
  owner: string | null;
  moduleId: string | null;
  busy: boolean;
  /** (owner, moduleId) del ÚLTIMO dispatch COMPLETADO en este worker (modo
   *  pooled): si el próximo difiere, se recicla incondicionalmente. */
  lastRanOwner: string | null;
  lastRanModuleId: string | null;
  /** Dir scratch del worker (rootfs scrub); se borra al reciclar. */
  scratchDir: string;
  /** Resolver del frame `ready` inicial. */
  onReady?: (r: { node: string; abi: string; v8: string; hostHash: string }) => void;
  /** Último frame `ready` recibido (node/abi/v8/hostHash reportados por el child). */
  lastReady?: { node: string; abi: string; v8: string; hostHash: string };
  /** Bomba de IPC activa del dispatch en curso (si lo hay). */
  pump?: IpcPump | null;
}

/** Bomba de un dispatch: rutea capCall↔capResult y resuelve en `result`. */
interface IpcPump {
  onMessage(msg: AnyMessage): void;
  onClose(): void;
}

const PROBE_DEADLINE_MS = 5000;

export class PoolSupervisor {
  private cfg: PreviewSandboxConfig = getPreviewSandboxConfig();
  private tier: Tier = 0;
  private healthyLatched = false;
  private poolSize = 0;
  private nodeVersion = "";
  private abi = "";
  private workers: WorkerState[] = [];
  private broker: BrokerHandleCapCall | null = null;

  // Per-owner state.
  private ownerInflight = new Map<string, number>();
  private ownerBucket = new Map<string, { tokens: number; resetAt: number }>();
  private rateLimit = { n: 6, windowMs: 30_000 };

  // Bounded FIFO admission queue.
  private queue: Array<{ owner: string; resolve: (w: WorkerState) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }> = [];

  private monotonicId = 1;

  // ── bootstrap ────────────────────────────────────────────────────────────
  async bootstrap(deps: PoolBootstrapDeps = {}): Promise<void> {
    try {
      this.cfg = getPreviewSandboxConfig();
      this.broker = deps.brokerHandleCapCall ?? null;
      this.parseRate(this.cfg.perOwnerRate);

      if (!this.cfg.enabled) {
        log.info("PIPS pool: PREVIEW_SANDBOX_ENABLED=false ⇒ inert");
        this.healthyLatched = false;
        return;
      }

      // (a) Reap de huérfanos de una instancia previa (crash-safe), §3.3.
      await this.reapOrphansSafe();

      // (b) Probe estructural del sustrato.
      const probe = probeSubstrate();
      this.tier = probe.tier;
      if (probe.tier < this.cfg.minTier || probe.tier === 0) {
        log.warn(
          { tier: probe.tier, minTier: this.cfg.minTier, reason: probe.reason },
          "PIPS pool: substrate below min tier ⇒ unavailable",
        );
        this.healthyLatched = false;
        return;
      }

      // (c) SHA del child.mjs (pin estático §7.1 paso 1) + esperados ABI/v8.
      const childPath = this.childPath();
      let hostHash: string;
      try {
        hostHash = createHash("sha256").update(readFileSync(childPath)).digest("hex");
      } catch (e) {
        log.warn({ childPath, err: (e as Error)?.message }, "PIPS pool: child.mjs unreadable ⇒ unavailable");
        this.healthyLatched = false;
        return;
      }
      const expected = {
        node: this.cfg.nodeVersion,
        abi: this.cfg.abi,
        v8: process.versions.v8,
        hostHash,
      };
      this.nodeVersion = expected.node;
      this.abi = expected.abi;

      if (!this.broker) {
        // F2 corre el self-test PERO no hay broker ⇒ paso 7 no demostrable ⇒
        // unhealthy (fail-closed). El broker llega en F3 (runtime.init lo inyecta).
        log.warn("PIPS pool: no broker injected (F2) ⇒ self-test cannot prove deny-by-default ⇒ unavailable");
        this.healthyLatched = false;
        return;
      }

      // (d) Self-test 7-pasos por el camino EXACTO de producción.
      const broker = this.broker;
      const result = await runSelfTest({
        config: this.cfg,
        tier: this.tier,
        expected,
        spawnProbe: () => this.spawnProbeWorker(expected),
        brokerProbe: broker as BrokerProbeFn,
        configDir: CONFIG_DIR,
      });
      if (!result.ok) {
        log.warn({ failedStep: result.failedStep, detail: result.detail }, "PIPS self-test failed ⇒ unavailable");
        this.healthyLatched = false;
        return;
      }

      // (e) Calentar el pool: clamp(1, floor(cpus/2), poolSize, 8).
      const target = clamp(1, Math.floor(cpus().length / 2), this.cfg.poolSize, 8);
      this.poolSize = target;
      await this.warmPool(target, expected);
      if (this.workers.filter((w) => w.ready).length < 1) {
        log.warn("PIPS pool: could not warm ≥1 healthy worker ⇒ unavailable");
        this.healthyLatched = false;
        return;
      }
      this.healthyLatched = true;
      log.info({ tier: this.tier, pool: this.poolSize, node: this.nodeVersion }, "PIPS pool healthy");
    } catch (e) {
      // bootstrap NUNCA lanza: cualquier error ⇒ unhealthy + WARN accionable.
      log.warn({ err: (e as Error)?.message ?? String(e) }, "PIPS pool bootstrap threw ⇒ unavailable");
      this.healthyLatched = false;
    }
  }

  /** Latched true sólo tras self-test verde + ≥1 worker caliente. */
  healthy(): boolean {
    return this.healthyLatched;
  }

  /** Número de workers calientes (ready) en el pool — para la señal DEGRADED. */
  workerCount(): number {
    return this.workers.filter((w) => w.ready).length;
  }

  /** Target de pool YA CLAMPED que el bootstrap intentó calentar
   *  (clamp(1, floor(cpus/2), poolSize, 8)). La señal DEGRADED compara contra
   *  esto, NO contra el `poolSize` crudo de config (en un host de pocos CPUs el
   *  target legítimo puede ser < config.poolSize y no es una degradación). */
  targetPoolSize(): number {
    return this.poolSize;
  }

  describe(): string {
    return `tier=${this.tier} pool=${this.poolSize} node=v${this.nodeVersion.replace(/^v/, "")} abi=${this.abi}`;
  }

  // ── lease ──────────────────────────────────────────────────────────────────
  async lease(owner: string): Promise<WorkerState> {
    if (!this.healthyLatched) throw new Error("preview sandbox not healthy");

    // Rate-limit por owner (token bucket).
    if (!this.takeToken(owner)) {
      throw new Error("sandbox rate limit exceeded for owner");
    }
    // Concurrencia 1 por owner.
    if ((this.ownerInflight.get(owner) ?? 0) >= 1) {
      throw new Error("sandbox concurrency limit (1 in-flight per owner)");
    }
    // Reserva por owner: no más de floor(poolSize/2) workers ocupados por un owner.
    const reservation = Math.max(1, Math.floor(this.poolSize / 2));
    const ownerBusy = this.workers.filter((w) => w.busy && w.owner === owner).length;
    const free = this.workers.find((w) => w.ready && !w.busy);

    if (free && ownerBusy < reservation) {
      this.markLeased(free, owner);
      return free;
    }

    // Sin worker libre (o por encima de la reserva) ⇒ cola FIFO acotada con
    // TIMEOUT DE ADMISIÓN separado del deadline de ejecución.
    if (this.queue.length >= this.cfg.queueMax) {
      throw new Error("sandbox saturated");
    }
    return await new Promise<WorkerState>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((q) => q.timer === timer);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(new Error("sandbox admission timeout"));
      }, this.admissionTimeoutMs());
      this.queue.push({ owner, resolve, reject, timer });
    });
  }

  private admissionTimeoutMs(): number {
    // Admisión = 2× el deadline de dispatch (panel-controlado; NO consume el
    // presupuesto de ejecución del módulo). Cota dura para no colgar al cliente.
    return Math.min(30_000, this.cfg.dispatchMs * 2);
  }

  private markLeased(w: WorkerState, owner: string): void {
    w.busy = true;
    w.owner = owner;
    this.ownerInflight.set(owner, (this.ownerInflight.get(owner) ?? 0) + 1);
  }

  private releaseOwner(owner: string): void {
    const n = (this.ownerInflight.get(owner) ?? 0) - 1;
    if (n <= 0) this.ownerInflight.delete(owner);
    else this.ownerInflight.set(owner, n);
  }

  /** Tras liberar/recyclar un worker, intenta drenar la cola FIFO. */
  private drainQueue(): void {
    while (this.queue.length > 0) {
      const free = this.workers.find((w) => w.ready && !w.busy);
      if (!free) break;
      const head = this.queue[0]!;
      const reservation = Math.max(1, Math.floor(this.poolSize / 2));
      const ownerBusy = this.workers.filter((w) => w.busy && w.owner === head.owner).length;
      if (ownerBusy >= reservation) {
        // El head está sobre su reserva; no podemos servirlo aún. Para no
        // bloquear a otros owners, busca el primer encolado servible.
        const idx = this.queue.findIndex(
          (q) => this.workers.filter((w) => w.busy && w.owner === q.owner).length < reservation,
        );
        if (idx < 0) break;
        const q = this.queue.splice(idx, 1)[0]!;
        clearTimeout(q.timer);
        this.markLeased(free, q.owner);
        q.resolve(free);
        continue;
      }
      this.queue.shift();
      clearTimeout(head.timer);
      this.markLeased(free, head.owner);
      head.resolve(free);
    }
  }

  // ── dispatch ───────────────────────────────────────────────────────────────
  async dispatch(args: PoolDispatchArgs): Promise<{ ok: boolean; output: unknown }> {
    const worker = await this.lease(args.owner);
    // Política de reciclado pooled (§3.3): recicla SIEMPRE si este dispatch
    // corre en un worker que ya sirvió a OTRO owner o a OTRO moduleId. Se decide
    // ANTES de re-pinnear (compara binding previo). En modo `once` esto es
    // irrelevante (recicla incondicionalmente).
    const realmChanged =
      worker.lastRanOwner !== null &&
      (worker.lastRanOwner !== args.owner || worker.lastRanModuleId !== args.moduleId);
    worker.moduleId = args.moduleId;
    let timer: NodeJS.Timeout | undefined;
    let settled = false;
    let outstandingCap = false;
    let capCount = 0;
    let denyCount = 0;
    const broker = args.brokerHandleCapCall;

    return await new Promise<{ ok: boolean; output: unknown }>((resolve, reject) => {
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        worker.pump = null;
        fn();
      };

      const fault = (msg: string) => {
        finish(() => {
          this.afterDispatch(worker, args.owner, args.moduleId, /*recycle*/ true);
          reject(new Error(msg));
        });
      };

      const pump: IpcPump = {
        onMessage: (msg: AnyMessage) => {
          if (settled) return;
          if (msg.type === "capCall") {
            if (outstandingCap) return fault("protocol violation: more than one outstanding capCall");
            if (++capCount > this.cfg.maxCapsPerDispatch) return fault("cap budget exceeded");
            outstandingCap = true;
            const callId = (msg as { callId: number }).callId;
            const capMsg = msg as { callId: number; cap: string; method: string; args: unknown };
            void broker(args.session, { callId, cap: capMsg.cap, method: capMsg.method, args: capMsg.args })
              .then((res) => {
                if (settled) return;
                outstandingCap = false;
                if (!res.ok) {
                  if (++denyCount > 20) return fault("deny budget exceeded (hostile child)");
                }
                this.send(worker, {
                  v: 1,
                  type: "capResult",
                  id: this.nextId(),
                  callId,
                  ok: res.ok,
                  value: res.value,
                  error: res.error,
                  code: res.code,
                });
              })
              .catch((e) => fault(`broker threw: ${(e as Error)?.message ?? e}`));
            return;
          }
          if (msg.type === "result") {
            const r = msg as { ok: boolean; output: unknown };
            finish(() => {
              const recycle = this.cfg.reuse === "once" || realmChanged || this.atReuseCap(worker);
              this.afterDispatch(worker, args.owner, args.moduleId, recycle);
              // Host-clone del output (nunca confiar en el `JSON.stringify` del
              // child): re-serializa una copia ya parseada por el decoder.
              resolve({ ok: r.ok, output: hostClone(r.output) });
            });
            return;
          }
          if (msg.type === "log") {
            const l = msg as { level: string; msg: string };
            log.debug({ moduleId: args.moduleId, level: l.level }, l.msg);
            return;
          }
          if (msg.type === "selftest" || msg.type === "pong" || msg.type === "ready") {
            return; // ignorables en el camino de dispatch
          }
          return fault(`unexpected worker frame in dispatch: ${msg.type}`);
        },
        onClose: () => fault("worker socket closed mid-dispatch"),
      };
      worker.pump = pump;

      // Deadline AGREGADO único (load + execute + todos los round-trips). El
      // módulo NO puede resetearlo/extenderlo.
      timer = setTimeout(() => fault("dispatch deadline exceeded"), args.deadlineMs);

      // Frame de dispatch (copy-by-value de source + policy efectiva).
      try {
        this.send(worker, {
          v: 1,
          type: "dispatch",
          id: this.nextId(),
          moduleId: args.moduleId,
          tool: args.tool,
          input: args.input,
          deadlineMs: args.deadlineMs,
          source: args.source,
          policy: args.policy,
        });
      } catch (e) {
        fault(`failed to send dispatch frame: ${(e as Error)?.message ?? e}`);
      }
    });
  }

  /** ¿El worker alcanzó el tope de dispatches reutilizables (modo pooled)? */
  private atReuseCap(w: WorkerState): boolean {
    return w.dispatchCount + 1 >= this.cfg.workerMaxDispatches;
  }

  private afterDispatch(w: WorkerState, owner: string, moduleId: string, recycle: boolean): void {
    this.releaseOwner(owner);
    w.dispatchCount += 1;
    w.lastRanOwner = owner;
    w.lastRanModuleId = moduleId;
    if (recycle) {
      this.killWorker(w, "recycle");
      // Reemplazo eager FUERA del camino crítico.
      setImmediate(() => {
        void this.spawnPoolWorker();
        this.drainQueue();
      });
    } else {
      // pooled: conserva moduleId/owner; sólo se libera para reuso.
      w.busy = false;
      this.drainQueue();
    }
  }

  // ── dispose ──────────────────────────────────────────────────────────────
  async dispose(): Promise<void> {
    this.healthyLatched = false;
    for (const q of this.queue.splice(0)) {
      clearTimeout(q.timer);
      try {
        q.reject(new Error("preview sandbox disposing"));
      } catch {
        /* ignore */
      }
    }
    const workers = this.workers.splice(0);
    for (const w of workers) this.killWorker(w, "dispose");
    // cgroup.kill (A3) si está disponible — reap defensivo de árboles unshare.
    await this.reapOrphansSafe();
  }

  // ── internals ──────────────────────────────────────────────────────────────
  private nextId(): number {
    return this.monotonicId++;
  }

  private send(w: WorkerState, msg: AnyMessage): void {
    const frame = encodeFrame(msg, this.cfg.maxFrameBytes);
    w.socket.write(frame);
  }

  private childPath(): string {
    // child.mjs vive junto a este archivo (mismo dir del subsistema).
    const here = fileURLToPath(import.meta.url);
    return join(here, "..", "child.mjs");
  }

  private buildPlan(scrubRoot: string): SpawnPlan {
    // Tier 1 (piso). El rootfs scrub real lo prepara el child.mjs/substrate; el
    // plan pasa rutas DENTRO del root. F4 (A3) añade el builder Tier 2.
    return buildTier1Command({
      scrubRoot,
      nodePathInRoot: process.execPath,
      childPathInRoot: this.childPath(),
    });
  }

  /** Spawnea un worker real con socketpair fd-3 SEQPACKET. */
  private spawnWorker(): WorkerState {
    const scratchDir = mkdtempSync(join(tmpdir(), "pips-"));
    const plan = this.buildPlan(scratchDir);
    const child = spawn(plan.file, plan.argv, {
      stdio: ["ignore", "pipe", "pipe", "pipe"], // fd3 = pipe (SEQPACKET en prod, pipe en test)
      env: {
        ...plan.env,
        LXP_CONFIG_DIR: CONFIG_DIR,
        LXP_MAX_FRAME: String(this.cfg.maxFrameBytes),
      },
    });
    const socket = child.stdio[3] as unknown as NodeJS.ReadWriteStream;
    const decoder = new FrameDecoder("fromWorker", this.cfg.maxFrameBytes);
    const w: WorkerState = {
      pid: child.pid ?? -1,
      child,
      socket,
      decoder,
      ready: false,
      dispatchCount: 0,
      owner: null,
      moduleId: null,
      busy: false,
      lastRanOwner: null,
      lastRanModuleId: null,
      scratchDir,
      pump: null,
    };
    if (socket && typeof socket.on === "function") {
      socket.on("data", (chunk: Buffer) => {
        let msgs: AnyMessage[];
        try {
          msgs = decoder.push(chunk);
        } catch (e) {
          // Violación de protocolo (v≠1, tipo desconocido, id reusado, over-frame).
          log.warn({ pid: w.pid, err: (e as Error)?.message }, "PIPS worker protocol violation ⇒ kill");
          this.killWorker(w, "protocol");
          if (w.pump) w.pump.onClose();
          return;
        }
        for (const msg of msgs) {
          if (!w.ready && msg.type === "ready") {
            w.ready = true;
            const r = msg as { node: string; abi: string; v8: string; hostHash: string };
            w.lastReady = { node: r.node, abi: r.abi, v8: r.v8, hostHash: r.hostHash };
            if (w.onReady) w.onReady(w.lastReady);
            continue;
          }
          if (w.pump) w.pump.onMessage(msg);
        }
      });
      socket.on("error", () => {
        if (w.pump) w.pump.onClose();
      });
      socket.on("close", () => {
        if (w.pump) w.pump.onClose();
      });
    }
    child.on("exit", () => {
      w.ready = false;
      if (w.pump) w.pump.onClose();
    });
    return w;
  }

  /** Spawnea + espera el frame `ready` (con deadline). Lo añade al pool. */
  private async spawnPoolWorker(): Promise<WorkerState | null> {
    try {
      const w = this.spawnWorker();
      await this.awaitReady(w, PROBE_DEADLINE_MS);
      this.workers.push(w);
      return w;
    } catch (e) {
      log.warn({ err: (e as Error)?.message }, "PIPS pool: worker spawn failed");
      return null;
    }
  }

  private awaitReady(w: WorkerState, ms: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (w.ready) return resolve();
      const t = setTimeout(() => {
        w.onReady = undefined;
        this.killWorker(w, "ready-timeout");
        reject(new Error("worker ready timeout"));
      }, ms);
      w.onReady = () => {
        clearTimeout(t);
        w.onReady = undefined;
        resolve();
      };
    });
  }

  private async warmPool(target: number, _expected: { node: string; abi: string; v8: string; hostHash: string }): Promise<void> {
    const tasks: Array<Promise<WorkerState | null>> = [];
    for (let i = 0; i < target; i++) tasks.push(this.spawnPoolWorker());
    await Promise.all(tasks);
  }

  /** Worker probe para el self-test: un `WorkerHandle` sobre un proceso real. */
  private async spawnProbeWorker(expected: {
    node: string;
    abi: string;
    v8: string;
    hostHash: string;
  }): Promise<WorkerHandle> {
    const w = this.spawnWorker();
    await this.awaitReady(w, PROBE_DEADLINE_MS);
    // El frame ready real ya pobló `w.lastReady`; el self-test lo compara contra
    // `expected`. Si por carrera no se pobló, cae a los esperados (que harán que
    // el paso 1 pase trivialmente sólo si coinciden — fail-closed si no).
    const r = w.lastReady ?? {
      node: expected.node,
      abi: expected.abi,
      v8: expected.v8,
      hostHash: expected.hostHash,
    };
    const handle: WorkerHandle = {
      ready: r,
      selftest: async (kind: SelftestKind, opts) => this.runWorkerSelftest(w, kind, opts),
      dispatchSynthetic: async (d, deadlineMs) => this.runSynthetic(w, d, deadlineMs),
      kill: () => this.killWorker(w, "probe-kill"),
      alive: () => !w.child.killed && w.child.exitCode === null,
    };
    return handle;
  }

  /** Pide al child que ejecute un paso interno y devuelva {ok, detail}. */
  private runWorkerSelftest(
    w: WorkerState,
    kind: SelftestKind,
    opts: { canaryPath?: string; deadlineMs: number },
  ): Promise<{ ok: boolean; detail: string }> {
    return new Promise((resolve) => {
      let settled = false;
      const id = this.nextId();
      const t = setTimeout(() => {
        if (settled) return;
        settled = true;
        w.pump = null;
        resolve({ ok: false, detail: `selftest(${kind}) timed out` });
      }, opts.deadlineMs);
      w.pump = {
        onMessage: (msg: AnyMessage) => {
          if (settled) return;
          if (msg.type === "selftest") {
            const st = msg as { ok: boolean; detail: string };
            settled = true;
            clearTimeout(t);
            w.pump = null;
            resolve({ ok: st.ok, detail: st.detail });
          }
        },
        onClose: () => {
          if (settled) return;
          settled = true;
          clearTimeout(t);
          w.pump = null;
          resolve({ ok: false, detail: `selftest(${kind}) worker closed` });
        },
      };
      try {
        // Reusa el frame `dispatch` con un tool reservado de self-test. child.mjs
        // (A4) entiende este protocolo de pasos internos.
        this.send(w, {
          v: 1,
          type: "dispatch",
          id,
          moduleId: "__pips_selftest__",
          tool: `__selftest__:${kind}`,
          input: { canaryPath: opts.canaryPath ?? null },
          deadlineMs: opts.deadlineMs,
          source: { entryBytes: "", manifestHash: "0".repeat(64) },
          policy: { capabilities: [], http_allowlist: [] },
        });
      } catch {
        settled = true;
        clearTimeout(t);
        w.pump = null;
        resolve({ ok: false, detail: `selftest(${kind}) send failed` });
      }
    });
  }

  /** Dispatch sintético (loop/capExec) para los pasos 6 y 7. */
  private runSynthetic(
    w: WorkerState,
    _d: { kind: "loop" | "capExec" },
    deadlineMs: number,
  ): Promise<{ killed?: boolean; denied?: boolean; detail: string }> {
    return new Promise((resolve) => {
      let settled = false;
      const t = setTimeout(() => {
        if (settled) return;
        settled = true;
        // Deadline vencido ⇒ SIGKILL (prueba el kill path real).
        this.killWorker(w, "synthetic-timeout");
        w.pump = null;
        resolve({ killed: true, detail: "synthetic loop SIGKILLed on deadline" });
      }, deadlineMs);
      w.pump = {
        onMessage: () => {
          /* el loop nunca responde; el camino válido es el deadline */
        },
        onClose: () => {
          if (settled) return;
          settled = true;
          clearTimeout(t);
          w.pump = null;
          resolve({ killed: true, detail: "synthetic worker closed" });
        },
      };
      try {
        this.send(w, {
          v: 1,
          type: "dispatch",
          id: this.nextId(),
          moduleId: "__pips_selftest__",
          tool: "__selftest__:loop",
          input: null,
          deadlineMs,
          source: { entryBytes: "while(true){}", manifestHash: "0".repeat(64) },
          policy: { capabilities: [], http_allowlist: [] },
        });
      } catch {
        settled = true;
        clearTimeout(t);
        resolve({ killed: false, detail: "synthetic send failed" });
      }
    });
  }

  private killWorker(w: WorkerState, _why: string): void {
    try {
      if (!w.child.killed) w.child.kill("SIGKILL");
    } catch {
      /* ignore */
    }
    const idx = this.workers.indexOf(w);
    if (idx >= 0) this.workers.splice(idx, 1);
    try {
      rmSync(w.scratchDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  /** Reap de huérfanos (cgroup.kill + units Tier-2 + scan). A3 provee el helper
   *  real en substrate.ts; aquí lo invocamos defensivamente si existe. */
  private async reapOrphansSafe(): Promise<void> {
    try {
      const mod = (await import("./substrate.js")) as { reapOrphans?: () => Promise<void> };
      if (typeof mod.reapOrphans === "function") await mod.reapOrphans();
    } catch {
      /* helper aún no presente (F4) o falló ⇒ best-effort, no bloquea boot */
    }
  }

  private parseRate(spec: string): void {
    const m = /^(\d+)\/(\d+)s$/.exec(spec.trim());
    if (m) {
      this.rateLimit = { n: Number.parseInt(m[1]!, 10), windowMs: Number.parseInt(m[2]!, 10) * 1000 };
    } else {
      this.rateLimit = { n: 6, windowMs: 30_000 };
    }
  }

  private takeToken(owner: string): boolean {
    const now = Date.now();
    let b = this.ownerBucket.get(owner);
    if (!b || now >= b.resetAt) {
      b = { tokens: this.rateLimit.n, resetAt: now + this.rateLimit.windowMs };
      this.ownerBucket.set(owner, b);
    }
    if (b.tokens <= 0) return false;
    b.tokens -= 1;
    return true;
  }
}

function clamp(min: number, ...vals: number[]): number {
  // clamp(1, floor(cpus/2), poolSize, 8): el mínimo de los candidatos, acotado
  // por abajo a `min` y por arriba a 8.
  const candidates = vals.filter((v) => Number.isFinite(v) && v > 0);
  const lo = candidates.length ? Math.min(...candidates) : min;
  return Math.max(min, Math.min(lo, 8));
}

/** Host-clone: re-serializa una copia ya parseada (nunca el JSON.stringify del
 *  child). Acota por el output cap implícito vía structuredClone/JSON. */
function hostClone(v: unknown): unknown {
  try {
    return structuredClone(v);
  } catch {
    return JSON.parse(JSON.stringify(v ?? null));
  }
}
