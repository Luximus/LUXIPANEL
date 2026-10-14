import { assertHostingCreationLease } from "../quota/resource-creation-lock.js";
import { getContextUser } from "../executor/context.js";
import { authorizationRevision } from "../auth/authorization-revision.js";
import { ForbiddenError } from "../errors/index.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * shared/remote-cache/submit-mutation.ts — write-behind mutation submitter.
 *
 * Mirror image of `serveCachedDataTable` (the read path). A controller builds
 * a recipe of generic STEPS (writeFile / sh) describing the mutation; this
 * layer either:
 *
 *   • enqueues the recipe into the per-server Redis (`lpwq:*`) in ONE fast
 *     redis-cli round-trip and returns immediately — the client-side
 *     `worker.py` applies the steps ON the customer's box (no SSH latency
 *     between steps) and then triggers the read collector refresh; OR
 *   • applies the steps live over SSH (legacy synchronous path) when the
 *     queue is disabled, the collection isn't writable, or Redis is
 *     unreachable — so the feature is always fail-safe.
 *
 * The STEPS recipe is the single source of truth: the same recipe is applied
 * by the on-box worker (async) and by `applyStepsLive` (sync fallback). No
 * business logic is duplicated in Python — the panel (TypeScript) owns it.
 *
 * Per-server isolation is preserved: the queue lives in that server's own
 * Redis, resolved through the per-request Executor.
 */

import { createHmac, randomUUID } from "node:crypto";

import { env } from "../../config/env.js";
import { panelConfigDir } from "../../config/paths.js";
import { ErrorCodes } from "../errors/codes.js";
import { eventBus, Events } from "../events/index.js";
import { createModuleLogger } from "../logger/index.js";
import { quoteCmd, quoteArg } from "../executor/quote.js";
import type { Executor } from "../executor/types.js";
import { isWritable } from "../cache/cacheable-modules.js";
import { gunzipB64, gzipB64 } from "./codec.js";
import { getRemoteCacheConn, type RemoteCacheConn } from "./conn.js";
import { escapeSingleQuoted, execWithRedisAuth, redisBase } from "./redis-cli.js";
import {
  wqDoneKey,
  wqJobKey,
  wqStatusKey,
  WQ_CRED_KEY,
  WQ_QUEUE_KEY,
} from "./keys.js";
import { scheduleRefresh } from "./refresh.js";
import { recordActivity } from "../worklog/worklog-recorder.service.js";
import { taxonomyFor } from "../worklog/worklog-taxonomy.js";
import { errMessage } from "../utils/err-message.js";

const log = createModuleLogger("remote-cache.submit");

// ── public types ──────────────────────────────────────────────────────────

/** One step the worker (or applyStepsLive) executes, in order. */
export type MutationStep =
  | {
      type: "writeFile";
      /** Absolute path on the client server. */
      path: string;
      /** UTF-8 contents (plain; we gzip+b64 it for transport). */
      content: string;
      /** Octal mode string, e.g. "0600". Default "0600". */
      mode?: string;
      /** True when the destination is root-owned (uses sudo cp + chmod). */
      root?: boolean;
      /** "user:group" applied via chown (root path only). */
      owner?: string;
    }
  | {
      type: "sh";
      /** Preferred: argv array (no shell). Required when `sudo` is true. */
      argv?: string[];
      /** Unprivileged shell command (only when argv is not given, sudo false). */
      cmd?: string;
      /** Run via sudo (panel passphrase / worker askpass). Requires argv. */
      sudo?: boolean;
      timeoutMs?: number;
      /** Fed to the command's stdin (e.g. `crontab -`). */
      input?: string;
    };

export interface SubmitMutationInput {
  module: string;
  collection: string;
  op: "create" | "update" | "delete";
  /** Scope value for scoped collections (e.g. accountId). */
  scope?: string;
  steps: MutationStep[];
  /**
   * Read collections to refresh after the steps apply. Defaults to
   * `[[module, collection, scope?]]`. Each entry is [module, collection] or
   * [module, collection, scope].
   */
  refresh?: Array<[string, string] | [string, string, string]>;
  requestedBy?: number | string | null;
  /**
   * Override the semi-sync wait (ms) for THIS submit. Use a generous value when
   * the caller MUST observe terminal state before continuing (e.g. users:
   * panel-side getent sync needs the worker to have created the account). The
   * call still returns the instant the job signals done. Defaults to
   * `WRITE_QUEUE_SYNC_WAIT_MS`.
   */
  syncWaitMs?: number;
}

export type SubmitMode = "applied" | "queued" | "sync-fallback";

export interface SubmitMutationResult {
  jobId: string;
  mode: SubmitMode;
  /** Set when a step failed (mode "applied"/"queued") or enqueue degraded. */
  error?: string;
}

export interface JobStatus {
  applied?: boolean;
  viewReady?: boolean;
  resource?: string;
  refreshState?: "ready" | "failed";
  jobId: string;
  state: "queued" | "running" | "done" | "failed";
  error?: string | null;
  failedStep?: number | null;
  attempts?: number;
  startedAt?: number;
  finishedAt?: number;
  ts?: number;
}

// ── redis-cli helpers ───────────────────────────────────────────────────────
// gzip+b64 codec is shared via ./codec.ts (gzipB64/gunzipB64) — same bytes as
// remote-cache/index.ts and the client-side engines.

/** Run a sequence of redis commands in ONE round-trip (fed on stdin). All
 *  values are gzip+b64 tokens (no quotes/newlines) so the printf is safe. */
async function runRedis(
  executor: Executor,
  conn: RemoteCacheConn,
  commands: string[],
  timeoutMs: number,
): Promise<{ ok: boolean; stdout: string }> {
  const payload = commands.join("\\n");
  const shell = `printf '%b' '${payload}\\n' | ${redisBase(conn)}`;
  try {
    const r = await execWithRedisAuth(executor, conn, shell, { timeoutMs });
    return { ok: r.exitCode === 0, stdout: r.stdout };
  } catch (err) {
    log.warn(
      { err: errMessage(err) },
      "write-queue redis-cli exec failed",
    );
    return { ok: false, stdout: "" };
  }
}

// ── HMAC signing (trust boundary with worker.py) ────────────────────────────
// The on-box worker rejects any job whose `hmac` does not match, so a local
// process that can write the loopback Redis can't inject sudo-bearing steps.
// The signature is HMAC-SHA256(key, canonicalJSON(job-without-hmac)). The
// canonical form MUST byte-match worker.py's
// `json.dumps(sort_keys=True, separators=(",",":"), ensure_ascii=False)`:
// recursively sorted object keys, no whitespace, arrays keep their order, UTF-8
// (no \u escaping of non-ASCII). Booleans/null/integers serialize identically
// on both sides.

/** Deterministic, worker-compatible JSON serialization. Exported for the
 *  cross-language parity test (must equal Python's json.dumps(sort_keys=True,
 *  separators=(",",":"), ensure_ascii=False)). */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const body = Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",");
  return `{${body}}`;
}

/** The key file each box's worker verifies against (install-engines.sh, 0640).
 *  LUXIPANEL_CONFIG_DIR is the box default (/etc/luxipanel) — matches the path
 *  the worker computes on its own side. */
const HMAC_KEY_REMOTE_PATH = `${panelConfigDir()}/cache-engine/lpwq.hmac.key`;

// Per-target cache of a successfully read key (per-server isolation: each box
// has its own). Negative reads are NOT cached, so a box provisioned after the
// panel started self-heals on the next submit. Cached entries EXPIRE
// (HMAC_KEY_TTL_MS) and are invalidated on an HMAC rejection, so a key rotation
// (`lpwq.hmac.key`) doesn't leave the panel signing with the stale key forever
// (every job would then be rejected + degraded to applyStepsLive).
const HMAC_KEY_TTL_MS = 5 * 60_000;
const hmacKeyByTarget = new Map<string, { key: string; cachedAt: number }>();
// Per-target "enqueued unsigned" warning latch (was a single process-global
// boolean, which swallowed the warning for every target after the first).
const warnedNoHmac = new Set<string>();

/** Drop the cached signing key for a target (e.g. after an HMAC rejection) so
 *  the next submit re-reads it from the box — recovering from a key rotation. */
function invalidateHmacKey(targetId: string): void {
  hmacKeyByTarget.delete(targetId);
}

/** Resolve the signing key for this target: env override wins; otherwise read
 *  the per-box key over SSH (cached with TTL). Returns null when neither is
 *  available. */
async function resolveHmacKey(executor: Executor): Promise<string | null> {
  if (env.WRITE_QUEUE_HMAC_KEY) return env.WRITE_QUEUE_HMAC_KEY;
  const id = executor.target.id;
  const cached = hmacKeyByTarget.get(id);
  if (cached && Date.now() - cached.cachedAt < HMAC_KEY_TTL_MS) return cached.key;
  try {
    const raw = await executor.readFile(HMAC_KEY_REMOTE_PATH, "utf8");
    const key = (typeof raw === "string" ? raw : raw.toString("utf8")).trim();
    if (key) {
      hmacKeyByTarget.set(id, { key, cachedAt: Date.now() });
      return key;
    }
  } catch {
    // Missing/unreadable (dev, or box not yet re-provisioned) → unsigned.
  }
  return null;
}

/** Attach an `hmac` field to the job in place, or WARN once per target and
 *  leave unsigned. */
async function signJob(
  executor: Executor,
  job: Record<string, unknown>,
): Promise<void> {
  const key = await resolveHmacKey(executor);
  if (!key) {
    const targetId = executor.target.id;
    if (!warnedNoHmac.has(targetId)) {
      log.warn(
        { code: "WARN_QUEUE_NO_HMAC", targetId },
        "write-queue: no HMAC key available; enqueuing UNSIGNED (dev). A fail-closed worker will reject these jobs.",
      );
      warnedNoHmac.add(targetId);
    }
    return;
  }
  job.hmac = createHmac("sha256", key).update(canonicalJson(job), "utf8").digest("hex");
}

// ── job construction ────────────────────────────────────────────────────────

function buildJob(jobId: string, input: SubmitMutationInput) {
  const refresh =
    input.refresh && input.refresh.length
      ? input.refresh
      : [
          input.scope
            ? ([input.module, input.collection, input.scope] as [
                string,
                string,
                string,
              ])
            : ([input.module, input.collection] as [string, string]),
        ];

  // Transport-encode writeFile contents (gzip+b64) so the payload carries no
  // raw newlines/quotes and the worker decodes with common.ungz_b64.
  const steps = input.steps.map((s) => {
    assertStepInputSafe(s);
    if (s.type === "writeFile") {
      return {
        type: "writeFile",
        path: s.path,
        b64gz: gzipB64(s.content),
        mode: s.mode ?? "0600",
        root: Boolean(s.root),
        ...(s.owner ? { owner: s.owner } : {}),
      };
    }
    return {
      type: "sh",
      ...(s.argv ? { argv: s.argv } : {}),
      ...(s.cmd ? { cmd: s.cmd } : {}),
      sudo: Boolean(s.sudo),
      ...(s.timeoutMs ? { timeoutMs: s.timeoutMs } : {}),
      ...(s.input != null ? { input: s.input } : {}),
    };
  });

  return {
    jobId,
    module: input.module,
    collection: input.collection,
    op: input.op,
    scope: input.scope ?? null,
    steps,
    refresh,
    requestedBy: input.requestedBy ?? null,
    requestedAt: Math.floor(Date.now() / 1000),
  };
}

/**
 * Backstop against `chpasswd` stdin injection at the queue layer. Today every
 * `input`-bearing chpasswd step comes from validated builders
 * (`buildCreateSteps`/`buildSetPasswordSteps` → `assertChpasswdSafe`, and
 * `passwordSchema` rejects control chars + ':'), but a future caller could
 * construct a step directly. chpasswd reads `user:pass` lines from stdin; a
 * newline would let an attacker append a second `root:<pass>` line. Validate
 * here so no step that reaches the worker (or `applyStepsLive`) can carry one.
 *
 * Only chpasswd steps are checked — other `input`-bearing steps (e.g.
 * `crontab -`) legitimately contain newlines.
 */
function assertStepInputSafe(step: MutationStep): void {
  if (step.type !== "sh" || step.input == null) return;
  const isChpasswd =
    (step.argv?.includes("chpasswd") ?? false) ||
    (step.cmd?.includes("chpasswd") ?? false);
  if (!isChpasswd) return;

  // Canonical safe form: exactly one `user:secret` line, optional trailing \n.
  const body = step.input.endsWith("\n") ? step.input.slice(0, -1) : step.input;
  // eslint-disable-next-line no-control-regex
  const hasControl = /[\r\n\t\f\v\x00]/.test(body);
  const colonCount = (body.match(/:/g) ?? []).length;
  if (hasControl || colonCount !== 1) {
    throw new Error(
      "Unsafe chpasswd step input: must be a single 'user:secret' line with no control characters",
    );
  }
}

function stepsNeedSudo(steps: MutationStep[]): boolean {
  return steps.some(
    (s) =>
      (s.type === "sh" && s.sudo) || (s.type === "writeFile" && s.root),
  );
}

// ── live (synchronous) application — fallback + the recipe's TS twin ────────

/** Context every step executor receives. */
interface StepExecutionContext {
  executor: Executor;
}

type StepExecutor = (step: MutationStep, ctx: StepExecutionContext) => Promise<void>;

/** writeFile: user-owned destination → plain writeFile + chmod. */
const writeFileAsUser: StepExecutor = async (step, { executor }) => {
  if (step.type !== "writeFile") throw new Error("writeFileAsUser: wrong step kind");
  await executor.writeFile(step.path, step.content);
  await executor.exec(quoteCmd("chmod", [step.mode ?? "0600", step.path]));
};

/**
 * writeFile: root-owned destination → stage in 0600 tmp, sudo cp/chmod/chown.
 * Tmp file is always cleaned up via the finally block.
 */
const writeFileAsRoot: StepExecutor = async (step, { executor }) => {
  if (step.type !== "writeFile") throw new Error("writeFileAsRoot: wrong step kind");
  const tmp = `/tmp/.lpwq-${randomUUID()}`;
  // 0600: the staged content may carry secrets/policy before it is cp'd
  // into place with its final mode.
  await executor.writeFile(tmp, step.content, { mode: 0o600 });
  try {
    const cp = await executor.exec(quoteCmd("sudo", ["cp", tmp, step.path]));
    if (cp.exitCode !== 0) throw new Error(cp.stderr || "sudo cp failed");
    const chmod = await executor.exec(
      quoteCmd("sudo", ["chmod", (step.mode ?? "0600").replace(/^0/, ""), step.path]),
    );
    if (chmod.exitCode !== 0) throw new Error(chmod.stderr || "sudo chmod failed");
    if (step.owner) {
      const chown = await executor.exec(quoteCmd("sudo", ["chown", step.owner, step.path]));
      if (chown.exitCode !== 0) throw new Error(chown.stderr || "sudo chown failed");
    }
  } finally {
    await executor.exec(quoteCmd("rm", ["-f", tmp])).catch(() => {});
  }
};

/** sh: argv- or cmd-based, no stdin. */
const runShPlain: StepExecutor = async (step, { executor }) => {
  if (step.type !== "sh") throw new Error("runShPlain: wrong step kind");
  const base =
    step.argv && step.argv.length
      ? quoteCmd(step.argv[0]!, step.argv.slice(1))
      : step.cmd;
  if (!base) throw new Error("sh step requires argv or cmd");
  const cmd = step.sudo ? `sudo ${base}` : base;
  const r = await executor.exec(cmd, { timeoutMs: step.timeoutMs ?? 30000 });
  if (r.exitCode !== 0) {
    throw new Error((r.stderr || r.stdout || `exit ${r.exitCode}`).trim());
  }
};

/**
 * sh: stdin required (e.g. chpasswd, crontab -). Stage in 0600 tmp + redirect
 * via `sh -c` (sudo variant: `sudo sh -c`) so the command's stdin and the
 * `sudo -S` prompt never collide. Mirrors worker.py + system-accounts.runCommand.
 */
const runShWithInput: StepExecutor = async (step, { executor }) => {
  if (step.type !== "sh") throw new Error("runShWithInput: wrong step kind");
  const base =
    step.argv && step.argv.length
      ? quoteCmd(step.argv[0]!, step.argv.slice(1))
      : step.cmd;
  if (!base) throw new Error("sh step requires argv or cmd");
  const tmp = `/tmp/.lpwq-in-${randomUUID()}`;
  // 0600: step.input is fed to a command's stdin and frequently holds a
  // secret (e.g. a chpasswd passphrase); keep it owner-only.
  await executor.writeFile(tmp, step.input!, { mode: 0o600 });
  try {
    const redirected = `${base} < ${quoteArg(tmp)}`;
    const cmd = step.sudo
      ? quoteCmd("sudo", ["sh", "-c", redirected])
      : quoteCmd("sh", ["-c", redirected]);
    const r = await executor.exec(cmd, { timeoutMs: step.timeoutMs ?? 30000 });
    if (r.exitCode !== 0) throw new Error((r.stderr || r.stdout || `exit ${r.exitCode}`).trim());
  } finally {
    await executor.exec(quoteCmd("rm", ["-f", tmp])).catch(() => {});
  }
};

/**
 * Strategy table: each entry decides if it can run the step AND how. The first
 * matching executor wins; new step variants are added as new entries (no edits
 * to `applyStepsLive`). Order matters only when two variants both match — keep
 * the more specific one first.
 */
const STEP_EXECUTORS: Array<{ match: (s: MutationStep) => boolean; run: StepExecutor }> = [
  // writeFile variants
  { match: (s) => s.type === "writeFile" && s.root === true, run: writeFileAsRoot },
  { match: (s) => s.type === "writeFile", run: writeFileAsUser },
  // sh variants — input first (stricter match), plain fallback below
  { match: (s) => s.type === "sh" && s.input != null, run: runShWithInput },
  { match: (s) => s.type === "sh", run: runShPlain },
];

/**
 * Apply the recipe over SSH via the per-request Executor (already sudo-wrapped
 * by `wrapExecutorWithSudo`). Same semantics as worker.py, used when the queue
 * is unavailable. Throws on the first failing step.
 */
export async function applyStepsLive(
  executor: Executor,
  steps: MutationStep[],
): Promise<void> {
  const ctx: StepExecutionContext = { executor };
  for (const step of steps) {
    assertHostingCreationLease();
    const actor = getContextUser();
    if (actor) {
      // Non-admin recipes execute synchronously. A changed authorization
      // epoch cancels the remaining steps instead of trusting queued claims.
      const revision = await authorizationRevision(executor.target.id);
      if (!actor.authorizationRevision || revision !== actor.authorizationRevision) throw new ForbiddenError("Mutation authorization changed");
    }
    assertStepInputSafe(step);
    const handler = STEP_EXECUTORS.find((e) => e.match(step));
    if (!handler) throw new Error(`No executor registered for step type "${step.type}"`);
    await handler.run(step, ctx);
  }
}

// ── status read + semi-sync wait ────────────────────────────────────────────

/**
 * Distinguish a worker HMAC/signature REJECTION from a genuine STEP failure.
 *
 * worker.py's `process_job` rejects a job at the HMAC trust boundary
 * (`_verify_job_hmac` false) BEFORE running any step:
 *   finish("failed", error="job payload HMAC missing or invalid")   // no failedStep
 * A genuine step failure instead runs steps 0..idx and records which one failed:
 *   finish("failed", failedStep=idx, error=...)                     // failedStep set
 *
 * Only the HMAC rejection is safe to re-apply locally via applyStepsLive: the
 * recipe never executed on the box, and the worker already ack'd + deleted the
 * job (worker.py main loop LREMs `processing` and DELs the payload after
 * process_job returns), so it can never run later either — zero double-execution
 * risk. A step failure (job ran partially), a poison job (attempts exceeded —
 * may have run on a prior attempt) and any other failure are NOT re-applied:
 * they must propagate so the caller sees the real error.
 *
 * The signal is the ABSENCE of `failedStep` (a genuine step failure always sets
 * it) combined with an HMAC-shaped error string. Requiring BOTH means a step
 * whose stderr merely contains "hmac" is never mistaken for a signature
 * rejection, and a poison/corrupt failure (no HMAC text) never falls through.
 */
export function isHmacRejection(status: JobStatus): boolean {
  if (status.state !== "failed") return false;
  // A genuine step failure always carries the 0-based index of the failing
  // step; its absence means the worker rejected the job before running any step.
  if (status.failedStep != null) return false;
  return /hmac/i.test(status.error ?? "");
}

function decodeStatus(raw: string | null): JobStatus | null {
  if (!raw || raw === "(nil)") return null;
  try {
    return JSON.parse(gunzipB64(raw)) as JobStatus;
  } catch {
    return null;
  }
}

/** Read a job's current status from the per-server Redis (one redis-cli). */
export async function readJobStatus(
  executor: Executor,
  jobId: string,
): Promise<JobStatus | null> {
  const conn = await getRemoteCacheConn(executor);
  if (!conn) return null;
  // Use a LITERAL backslash-n (printf '%b' expands it) so the command string
  // carries NO real newline — the LP SSH proxy rejects control characters
  // (breaks write-behind for SSO-bridged sessions). Mirrors runRedis().
  const shell =
    `printf '%b' ${escapeSingleQuoted(`GET ${wqStatusKey(jobId)}\\n`)} | ` +
    `${redisBase(conn)} --no-raw`;
  try {
    const r = await execWithRedisAuth(executor, conn, shell, {
      timeoutMs: env.REMOTE_CACHE_EXEC_TIMEOUT_MS,
    });
    if (r.exitCode !== 0) return null;
    let line = r.stdout.split(/\r?\n/)[0] ?? "";
    line = line.trim();
    if (line.startsWith('"') && line.endsWith('"')) line = line.slice(1, -1);
    return decodeStatus(line);
  } catch {
    return null;
  }
}

/** Block (one BLPOP) until the worker signals the job terminal or timeout. */
async function waitForTerminal(
  executor: Executor,
  conn: RemoteCacheConn,
  jobId: string,
  waitMs: number,
): Promise<JobStatus | null> {
  const waitSec = Math.max(1, Math.ceil(waitMs / 1000));
  // Literal backslash-n (printf '%b' expands it) — no real newline in the
  // command string (the LP SSH proxy rejects control characters).
  const shell =
    `printf '%b' ${escapeSingleQuoted(`BLPOP ${wqDoneKey(jobId)} ${waitSec}\\n`)} | ` +
    redisBase(conn);
  try {
    const r = await execWithRedisAuth(executor, conn, shell, { timeoutMs: waitMs + 1500 });
    if (r.exitCode !== 0) return null;
    // BLPOP returns the list key then the value (or nothing on timeout).
    if (!r.stdout.trim()) return null;
  } catch {
    return null;
  }
  return readJobStatus(executor, jobId);
}

// ── orchestrator ─────────────────────────────────────────────────────────────

export async function submitMutation(
  executor: Executor,
  input: SubmitMutationInput,
): Promise<SubmitMutationResult> {
  const jobId = randomUUID();
  const job = buildJob(jobId, input);

  // Worklog: every successfully applied/enqueued mutation is significant
  // user activity. Fail-open fire-and-forget — never touches the data path.
  const recordWorklog = () =>
    void recordActivity({
      module: input.module,
      action: `${input.op}_${input.collection}`,
      category: taxonomyFor(input.module).category,
      stacks: taxonomyFor(input.module).stacks,
    });

  const refreshAll = async () => {
    for (const entry of job.refresh) {
      await scheduleRefresh(
        executor,
        entry[0],
        entry[1],
        entry[2] as string | undefined,
      );
    }
  };

  const runLive = async (
    reason: string,
    degraded: boolean,
    skipWorklog = false,
  ): Promise<SubmitMutationResult> => {
    await applyStepsLive(executor, input.steps);
    // The HMAC-rejection path already recorded the activity at enqueue time;
    // don't double-count it. The Redis-down / enqueue-failed paths return before
    // enqueue records, so they DO record here.
    if (!skipWorklog) recordWorklog();
    await refreshAll();
    if (degraded) {
      eventBus.emit(Events.WRITE_QUEUE_DEGRADED, {
        targetId: executor.target.id,
        module: input.module,
        collection: input.collection,
        op: input.op,
        reason,
      });
    }
    return { jobId, mode: "applied", error: degraded ? reason : undefined };
  };

  // Kill-switch or collection not migrated → legacy synchronous path.
  if (getContextUser() || !env.WRITE_QUEUE_ENABLED || !isWritable(input.module, input.collection)) {
    return runLive("queue disabled or collection not writable", false);
  }

  const conn = await getRemoteCacheConn(executor);
  if (!conn) {
    // Cache stack not provisioned → can't queue; apply live, flag degraded.
    return runLive("per-server Redis not provisioned", true);
  }

  // Build the redis command sequence. Order matters: SET job/status BEFORE
  // RPUSH so the worker never pops an id whose payload isn't set yet.
  const ttl = env.WRITE_QUEUE_JOB_TTL_SECONDS;
  const commands: string[] = [];

  if (stepsNeedSudo(input.steps)) {
    const pass = await Promise.resolve(executor.getSudoPasswordHint?.());
    if (pass) {
      const credVal = gzipB64(JSON.stringify({ passphrase: pass, storedAt: Date.now() }));
      commands.push(`SET ${WQ_CRED_KEY} ${credVal} EX ${env.WRITE_QUEUE_CRED_TTL_SECONDS}`);
    }
    // No passphrase available: the worker's sudo step will surface an
    // actionable error; we still enqueue so the failure is visible/retryable.
  }

  // Sign the payload so the on-box worker (fail-closed HMAC) accepts it. Done
  // right before serialization: the signature covers the canonical job WITHOUT
  // the `hmac` field, exactly as the worker recomputes it.
  await signJob(executor, job as unknown as Record<string, unknown>);

  const jobVal = gzipB64(JSON.stringify(job));
  const statusVal = gzipB64(JSON.stringify({ jobId, state: "queued", ts: Math.floor(Date.now() / 1000) }));
  commands.push(`SET ${wqJobKey(jobId)} ${jobVal} EX ${ttl}`);
  commands.push(`SET ${wqStatusKey(jobId)} ${statusVal} EX ${ttl}`);
  commands.push(`RPUSH ${WQ_QUEUE_KEY} ${jobId}`);

  const { ok } = await runRedis(executor, conn, commands, env.REMOTE_CACHE_EXEC_TIMEOUT_MS);
  if (!ok) {
    return runLive("enqueue failed (redis-cli error)", true);
  }
  // Enqueued successfully — record now (the runLive path records on its own).
  recordWorklog();

  // Semi-sync wait: many on-box jobs finish in well under a second.
  const waitMs = input.syncWaitMs ?? env.WRITE_QUEUE_SYNC_WAIT_MS;
  if (waitMs > 0) {
    const final = await waitForTerminal(executor, conn, jobId, waitMs);
    if (final?.state === "done") return { jobId, mode: "applied" };
    if (final?.state === "failed") {
      // The worker rejected the job at the HMAC trust boundary BEFORE running
      // any step (panel enqueued unsigned / with a divergent canonical form
      // while a fail-closed worker requires HMAC — the classic deploy-window
      // skew, or a key not yet provisioned on the box). The recipe never
      // executed and the worker already ack'd/deleted the job, so re-applying it
      // live carries no double-execution risk. Degrade to the synchronous twin
      // exactly like the "Redis unreachable" path so queued CRUD
      // (mail/firewall/cron/users) is not left dead during that window.
      if (isHmacRejection(final)) {
        // The cached key is likely stale (rotated on the box). Drop it so the
        // next submit re-reads the current key instead of re-signing with the
        // rejected one and degrading forever.
        invalidateHmacKey(executor.target.id);
        log.warn(
          {
            code: ErrorCodes.WRITE_QUEUE_HMAC_REJECTED,
            jobId,
            targetId: executor.target.id,
            module: input.module,
            collection: input.collection,
            error: final.error ?? null,
          },
          "write-queue: worker rejected job at HMAC boundary; applying live (degraded)",
        );
        return runLive("worker rejected job (HMAC signature)", true, true);
      }
      eventBus.emit(Events.WRITE_QUEUE_JOB_FAILED, {
        targetId: executor.target.id,
        module: input.module,
        collection: input.collection,
        op: input.op,
        jobId,
        error: final.error ?? null,
      });
      // Surface the failure to the caller with the same semantics as the
      // legacy synchronous path (the controller's asyncHandler turns it into
      // an error response). The notification was already emitted above.
      throw new Error(final.error ?? "La operación falló en el servidor");
    }
  }

  return { jobId, mode: "queued" };
}
