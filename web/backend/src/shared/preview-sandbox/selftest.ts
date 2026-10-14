// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * PIPS — self-test POSITIVO de boot (Fase F2). Ver RUNTIME-DESIGN.md §7.1.
 *
 * El self-test es el GATE que habilita `isAvailable()`. Corre los 7 pasos del
 * §7.1 a través de UN worker probe spawneado por el camino EXACTO de producción
 * (lo provee `pool-supervisor.ts` como `spawnProbe`). Cada paso tiene su propio
 * deadline; un cuelgue ⇒ fallo ⇒ el caller engancha `available=false`. Devuelve
 * el PRIMER paso que falla. Las aserciones son TIER-INDEPENDIENTES (idénticas en
 * Tier 1 y Tier 2): no hay debilitamiento por tier.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * MECANISMO DE PIN DE `child.mjs` (SHA, §7.1 paso 1 / matriz fila 6)
 * ──────────────────────────────────────────────────────────────────────────
 * No hay codegen en build de una constante SHA: el repo NO transforma child.mjs,
 * se embarca tal cual. En su lugar, en `init()`/bootstrap el panel calcula
 * `sha256(readFileSync(childPath))` del MISMO archivo que `buildTier1Command`
 * va a spawnear (lo recibe aquí en `args.expected.hostHash`), y el worker
 * reporta en su frame `ready.hostHash = sha256` del contenido de su propio
 * `__filename` (argv[1]). El paso 1 asserta panel-SHA === ready.hostHash; un
 * mismatch (copia parcial/manipulada) ⇒ unavailable. El ABI/node/v8 (§7.1) se
 * comparan contra `expected.{node,abi,v8}` (= config.{nodeVersion,abi} +
 * process.versions.v8): `modules` mismatch es hard-fail; drift de patch dentro
 * del mismo módulo-ABI puede pasar.
 */
import type { Executor, ExecResult } from "../executor/types.js";
import type { Tier } from "./substrate.js";
import type { PreviewSandboxConfig } from "./config.js";
import { createModuleLogger } from "../logger/index.js";

const log = createModuleLogger("preview-sandbox");

/**
 * Abstracción mínima de un worker probe vista por el self-test. El
 * pool-supervisor la implementa sobre un proceso real (spawn + fd-3 SEQPACKET):
 * - `ready`: el frame `ready` ya recibido (node/abi/v8/hostHash).
 * - `selftest(req)`: pide al child que ejecute un paso interno (scrub de realm,
 *   canary, red, FS, environ) y devuelva `{ok, detail}`. La semántica del `kind`
 *   la entiende child.mjs (A4); aquí sólo se enruta y se acota por deadline.
 * - `dispatchSynthetic`: ejercita un dispatch sintético (timeout/capCall) usado
 *   por los pasos 6 y 7; el supervisor enruta los capCall al `brokerProbe`.
 * - `kill`: SIGKILL del worker (paso 6 prueba el camino de muerte real).
 * - `alive`: `kill -0` lógico para confirmar la muerte tras el SIGKILL.
 */
export interface WorkerReady {
  node: string;
  abi: string;
  v8: string;
  hostHash: string;
}

export type SelftestKind = "realm" | "environ" | "canary" | "network" | "fs";

export interface SyntheticDispatch {
  /** "loop" = while(true) (paso 6); "capExec" = emite server.exec (paso 7). */
  kind: "loop" | "capExec";
  /** Política sintética que el broker probe debe evaluar (paso 7). */
  policy?: { capabilities: string[]; http_allowlist: string[] };
  /** En "capExec": la cap a emitir (server.exec / server.sudo / cap desconocida). */
  emitCap?: string;
  emitMethod?: string;
}

export interface SyntheticResult {
  /** ¿El broker DENEGÓ el capCall sintético? (paso 7). */
  denied?: boolean;
  /** ¿El worker fue SIGKILLeado por deadline? (paso 6). */
  killed?: boolean;
  /** Mensaje de diagnóstico. */
  detail: string;
}

export interface WorkerHandle {
  ready: WorkerReady;
  selftest(kind: SelftestKind, opts: { canaryPath?: string; deadlineMs: number }): Promise<{ ok: boolean; detail: string }>;
  dispatchSynthetic(d: SyntheticDispatch, deadlineMs: number): Promise<SyntheticResult>;
  kill(): void;
  alive(): boolean;
}

/** Firma del broker probe (inyectada; NO importamos broker.ts — desacople A1/A2).
 *  `session: any` en el seam de inyección (ver pool-supervisor BrokerHandleCapCall). */
export type BrokerProbeFn = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any,
  capCall: { callId: number; cap: string; method: string; args: unknown },
  ...rest: unknown[]
) => Promise<{ ok: boolean; value?: unknown; error?: string; code?: string }>;

export interface SelfTestArgs {
  config: PreviewSandboxConfig;
  tier: Tier;
  expected: { node: string; abi: string; v8: string; hostHash: string };
  /** Spawnea (o reusa) el worker probe por el camino EXACTO de producción. */
  spawnProbe: () => Promise<WorkerHandle>;
  /** El broker (deny-by-default) usado en el paso 7. */
  brokerProbe: BrokerProbeFn;
  /** Dir de config REAL del panel (para crear el canary 0600 del paso 3). */
  configDir: string;
}

export interface SelfTestResult {
  ok: boolean;
  failedStep?: number;
  detail: string;
}

/** Deadlines por paso (ms). Cada paso es acotado; un cuelgue ⇒ fallo del paso. */
const STEP_DEADLINE_MS = 4000;
const TIMEOUT_STEP_DEADLINE_MS = 2000;
const SYNTH_TIMEOUT_MS = 200; // §7.1 paso 6: while(true), 200ms deadline.

function fail(step: number, detail: string): SelfTestResult {
  log.warn({ step, detail }, "PIPS self-test FAILED");
  return { ok: false, failedStep: step, detail };
}

/** Envuelve una promesa con un deadline; si vence, resuelve a fallo (no cuelga). */
async function withDeadline<T>(p: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  let t: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((resolve, reject) => {
    t = setTimeout(() => {
      // `onTimeout` may THROW (e.g. step 0's spawn-timeout). Route that throw
      // into the promise's reject — NEVER let it escape the timer callback as
      // an uncaught exception (it would fire after Promise.race already settled
      // when the underlying op also failed). The caller try/catches it.
      try {
        resolve(onTimeout());
      } catch (e) {
        reject(e);
      }
    }, ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t) clearTimeout(t);
  }
}

/**
 * Ejecuta los 7 pasos del §7.1. NUNCA lanza (el caller envuelve en try/catch de
 * todos modos, pero aquí devolvemos un resultado tipado). Devuelve el primer
 * paso que falla.
 */
export async function runSelfTest(args: SelfTestArgs): Promise<SelfTestResult> {
  const { expected, brokerProbe } = args;
  let worker: WorkerHandle;
  try {
    worker = await withDeadline(args.spawnProbe(), STEP_DEADLINE_MS, () => {
      throw new Error("probe worker spawn timed out");
    });
  } catch (e) {
    return fail(0, `probe worker did not start: ${(e as Error)?.message ?? e}`);
  }

  // ── Paso 1: pin ABI/host-hash ────────────────────────────────────────────
  // `modules` (ABI) mismatch es hard-fail (UB boundary); patch drift dentro del
  // mismo módulo-ABI puede pasar (no obligamos `node` exacto). hostHash debe
  // calzar el SHA del child.mjs computado panel-side.
  {
    const r = worker.ready;
    if (r.abi !== expected.abi) {
      return fail(1, `ABI mismatch: worker modules=${r.abi} expected=${expected.abi}`);
    }
    if (r.v8 !== expected.v8) {
      return fail(1, `V8 mismatch: worker v8=${r.v8} expected=${expected.v8}`);
    }
    if (r.hostHash !== expected.hostHash) {
      return fail(1, `child.mjs SHA mismatch: worker hostHash=${r.hostHash} expected=${expected.hostHash}`);
    }
  }

  // ── Paso 2: realm scrub + environ limpio ─────────────────────────────────
  {
    const realm = await withDeadline(worker.selftest("realm", { deadlineMs: STEP_DEADLINE_MS }), STEP_DEADLINE_MS, () => ({
      ok: false,
      detail: "realm scrub probe timed out",
    }));
    if (!realm.ok) return fail(2, `realm not scrubbed: ${realm.detail}`);
    const environ = await withDeadline(
      worker.selftest("environ", { deadlineMs: STEP_DEADLINE_MS }),
      STEP_DEADLINE_MS,
      () => ({ ok: false, detail: "environ probe timed out" }),
    );
    if (!environ.ok) return fail(2, `child environ not a subset of the allowed set: ${environ.detail}`);
  }

  // ── Paso 3: canary estructural de ausencia de secreto ────────────────────
  // El panel crea un archivo 0600 propiedad-del-panel bajo el CONFIG_DIR REAL;
  // el jail intenta abrirlo (+ shared-secrets.json + mTLS key) y CADA uno debe
  // dar EACCES/ENOENT. El canary específicamente prueba que el deny es
  // ESTRUCTURAL (mount-scrub), no incidental (archivo ausente). Se borra después.
  {
    const canaryPath = `${args.configDir}/.pips-canary`;
    let created = false;
    try {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(canaryPath, "pips-canary-secret\n", { mode: 0o600 });
      created = true;
    } catch (e) {
      // Si no podemos crear el canary, NO podemos probar el deny estructural ⇒
      // fail-closed (no asumimos que el scrub está; lo exigimos demostrado).
      return fail(3, `could not create structural canary under config dir: ${(e as Error)?.message ?? e}`);
    }
    try {
      const r = await withDeadline(
        worker.selftest("canary", { canaryPath, deadlineMs: STEP_DEADLINE_MS }),
        STEP_DEADLINE_MS,
        () => ({ ok: false, detail: "canary probe timed out" }),
      );
      if (!r.ok) return fail(3, `secret/canary reachable inside jail (scrub not structural): ${r.detail}`);
    } finally {
      if (created) {
        try {
          const { unlinkSync } = await import("node:fs");
          unlinkSync(canaryPath);
        } catch {
          /* best-effort cleanup */
        }
      }
    }
  }

  // ── Paso 4: corte de red (LOAD-BEARING) ──────────────────────────────────
  // connect 127.0.0.1:8080 + 1.1.1.1:443 ⇒ ambos ENETUNREACH/EAFNOSUPPORT.
  // ECONNREFUSED = FAIL (probaría loopback up). loopback DOWN + ruta vacía.
  {
    const r = await withDeadline(worker.selftest("network", { deadlineMs: STEP_DEADLINE_MS }), STEP_DEADLINE_MS, () => ({
      ok: false,
      detail: "network probe timed out",
    }));
    if (!r.ok) return fail(4, `network not cut (ECONNREFUSED or routable loopback): ${r.detail}`);
  }

  // ── Paso 5: confinamiento de FS ──────────────────────────────────────────
  {
    const r = await withDeadline(worker.selftest("fs", { deadlineMs: STEP_DEADLINE_MS }), STEP_DEADLINE_MS, () => ({
      ok: false,
      detail: "fs probe timed out",
    }));
    if (!r.ok) return fail(5, `fs confinement breached (write outside /scratch or host paths present): ${r.detail}`);
  }

  // ── Paso 6: timeout end-to-end + camino de muerte real ───────────────────
  // dispatch while(true) con 200ms deadline ⇒ el panel SIGKILLea y aflora el
  // timeout; `alive()` confirma la muerte (prueba el kill path, no sólo el timer).
  {
    const r = await withDeadline(
      worker.dispatchSynthetic({ kind: "loop" }, SYNTH_TIMEOUT_MS),
      TIMEOUT_STEP_DEADLINE_MS,
      () => ({ killed: false, detail: "synthetic loop dispatch did not surface a timeout in time" }),
    );
    if (!r.killed) return fail(6, `timeout/kill path did not fire: ${r.detail}`);
    if (worker.alive()) return fail(6, "worker still alive after SIGKILL (kill path proven non-functional)");
  }

  // ── Paso 7: capability deny-by-default ───────────────────────────────────
  // Tras el paso 6 el worker probe ya fue muerto; re-spawneamos uno fresco para
  // ejercitar el broker. El broker DENY se prueba directamente con `brokerProbe`
  // (panel-side, executor stub throwaway): server.exec sin grant ⇒ DENY; cap
  // desconocida ⇒ DENY; política que lista server.sudo ⇒ DENY (sudo nunca).
  {
    const stub = makeThrowawayExecutor();
    const session = makeThrowawaySession(stub);

    const denyExec = await withDeadline(
      brokerProbe(session, { callId: 1, cap: "server.exec", method: "exec", args: ["id"] }),
      STEP_DEADLINE_MS,
      () => ({ ok: true } as { ok: boolean }),
    );
    if (denyExec.ok) return fail(7, "broker did NOT deny server.exec by default for a preview");

    const denyUnknown = await withDeadline(
      brokerProbe(session, { callId: 2, cap: "totally.unknown.cap", method: "x", args: null }),
      STEP_DEADLINE_MS,
      () => ({ ok: true } as { ok: boolean }),
    );
    if (denyUnknown.ok) return fail(7, "broker did NOT deny an unknown capability string");

    const denySudo = await withDeadline(
      // Política sintética que LISTA sudo: el broker debe denegar sudo SIEMPRE.
      brokerProbe(makeThrowawaySession(stub, ["server.sudo"]), {
        callId: 3,
        cap: "server.sudo",
        method: "exec",
        args: ["id"],
      }),
      STEP_DEADLINE_MS,
      () => ({ ok: true } as { ok: boolean }),
    );
    if (denySudo.ok) return fail(7, "broker did NOT deny server.sudo even when the synthetic policy lists it");
  }

  log.info({ tier: args.tier }, "PIPS self-test PASSED (all 7 steps green)");
  return { ok: true, detail: `self-test green on tier=${args.tier}` };
}

/**
 * Executor stub de un solo uso para el paso 7. Corre AL BOOT sin servidor
 * conectado: cualquier método que el broker intentara ejecutar LANZA, de modo
 * que el único camino que puede "pasar" es el de DENY (que nunca llega a tocar
 * el executor). Si el broker, por bug, intentara ejecutar, el throw lo delata.
 */
function makeThrowawayExecutor(): Executor {
  const boom = (): never => {
    throw new Error("throwaway executor invoked during self-test (broker should have DENIED, not executed)");
  };
  return {
    target: { id: "__pips_selftest__", name: "pips-selftest" },
    exec: async (): Promise<ExecResult> => boom(),
    readFile: async () => boom(),
    writeFile: async () => boom(),
    readdir: async () => boom(),
    stat: async () => boom(),
    mkdir: async () => boom(),
    unlink: async () => boom(),
    rename: async () => boom(),
    spawn: () => boom(),
  } as unknown as Executor;
}

/** Sesión de broker sintética; `effectivePolicy.capabilities` es un Set vacío
 *  salvo que se pase un grant explícito (para probar el DENY de sudo). */
function makeThrowawaySession(executor: Executor, caps: string[] = []): {
  executor: Executor;
  user: null;
  sessionEpoch: number;
  owner: string;
  ownerUserId: string;
  moduleId: string;
  effectivePolicy: { capabilities: Set<string>; http_allowlist: string[]; readPrefix?: string };
  manifestHash: string;
} {
  return {
    executor,
    user: null,
    sessionEpoch: 0,
    owner: "__pips_selftest__",
    ownerUserId: "__pips_selftest__",
    moduleId: "__pips_selftest__",
    effectivePolicy: { capabilities: new Set(caps), http_allowlist: [] },
    manifestHash: "0".repeat(64),
  };
}
