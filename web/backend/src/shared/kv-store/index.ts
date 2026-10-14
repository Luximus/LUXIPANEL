// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * kvStore — Firebase-like JSON storage for panel data.
 *
 * Layout on the connected server (or panel host when standalone):
 *
 *   ${LUXIPANEL_CONFIG_DIR}/
 *     <module>/
 *       <collection>.json     ← each file = one collection (object map)
 *
 * Inside each collection JSON:
 *
 *   {
 *     "<docId>": { ...fields },
 *     "<docId>": { ...fields }
 *   }
 *
 * This module replaces Drizzle/PostgreSQL repositories. All reads/writes
 * route through `Executor` (the same abstraction used for module commands)
 * so panel hosts that bridge to multiple targets keep their data on the
 * right server.
 */

import path from "node:path";
import { randomUUID } from "node:crypto";
import { quoteArg, quoteCmd, type Executor } from "../executor/index.js";
import { noServerExecutor, requireExecutor } from "../executor/require-executor.js";
import { safeSegment } from "../utils/safe-segment.js";
import { CONFIG_DIR } from "@config/paths.js";
import { createModuleLogger } from "../logger/index.js";
import { KvReadError, KvWriteError } from "../errors/errors.js";
import { getKvReadCache } from "./read-cache.js";
import { getContextUser } from "../executor/context.js";
import { PrivilegeDropExecutor } from "../executor/privilege-drop-executor.js";

const log = createModuleLogger("kv-store");

function baseDir(): string {
  return CONFIG_DIR;
}

// Neutralizes anything outside the allowed charset, caps the length, and
// rejects pure "." / ".." (which `path.posix.join()` would let escape baseDir —
// an LFI/traversal vector). SSOT: `shared/utils/safe-segment.ts`.
const safe = safeSegment;

function collectionPath(moduleName: string, collection: string): string {
  return path.posix.join(baseDir(), safe(moduleName), `${safe(collection)}.json`);
}

// ── Per-collection async mutex ──────────────────────────────────────────────
// Several callers (e.g. parallel agent turns each appending to the SAME
// `conversations-u<uid>` index) run the read→mutate→write cycle concurrently.
// Without serialization they interleave: each reads the pre-write map, mutates
// its own copy, and the last writer clobbers the others' changes (lost updates)
// — and a crash landing inside an interleaved write corrupts the JSON. We
// serialize the WHOLE cycle per on-disk file so appends can't race.
//
// The key must identify the FILE, which is per-server: the connected server's
// `${LUXIPANEL_CONFIG_DIR}` (one per target) + module + collection. Two operator
// sessions on the same server are distinct executor INSTANCES but write the same
// file, so we key by the executor's stable `target.id` when present (serializes
// across instances too), falling back to a WeakMap-assigned id for executors
// without one. The map self-cleans when a chain drains, so it can't grow
// unbounded.
const collectionLocks = new Map<string, Promise<unknown>>();
const executorKeys = new WeakMap<object, string>();
let executorKeySeq = 0;

function executorKey(executor: Executor): string {
  const id = executor.target?.id;
  if (id) return `t:${id}`;
  let k = executorKeys.get(executor as object);
  if (!k) {
    k = `w:${++executorKeySeq}`;
    executorKeys.set(executor as object, k);
  }
  return k;
}

function withCollectionLock<R>(
  executor: Executor,
  moduleName: string,
  collection: string,
  fn: () => Promise<R>,
): Promise<R> {
  const key = `${executorKey(executor)}::${safe(moduleName)}::${safe(collection)}`;
  const prev = collectionLocks.get(key) ?? Promise.resolve();
  // Run fn only after the previous op settles (either outcome), so each caller
  // observes the prior caller's committed write before it reads.
  const run = prev.then(fn, fn);
  // The stored tail must never reject, or the next `.then(fn, fn)` would still
  // run fn on rejection (fine) — but we also don't want an unhandled rejection.
  const link = run.then(
    () => undefined,
    () => undefined,
  );
  collectionLocks.set(key, link);
  // Drop the entry once this is the tail of the chain to bound memory.
  void link.then(() => {
    if (collectionLocks.get(key) === link) collectionLocks.delete(key);
  });
  return run;
}

/**
 * Anti-clobber tripwire. If the collection currently on disk parsed to N>0 keys
 * and the map about to be written collapses to 0 keys — or loses more than 80%
 * of its keys — snapshot the CURRENT bytes to `<file>.bak.<ts>` (0600) and
 * log.warn before overwriting. Legitimate bulk/last-item deletes exist, so this
 * NEVER blocks the write; it only preserves a recoverable copy and surfaces the
 * anomaly (guards against a lost-update / corruption bug silently truncating an
 * index). Best-effort: a failed backup must not block the write.
 */
async function snapshotBeforeShrink(
  executor: Executor,
  moduleName: string,
  collection: string,
  prevCount: number,
  newCount: number,
  prevRaw: string | null,
): Promise<void> {
  if (!prevRaw || prevCount <= 0) return;
  const collapsedToEmpty = newCount === 0;
  const shrankOver80 = newCount < prevCount * 0.2;
  if (!collapsedToEmpty && !shrankOver80) return;
  const backup = `${collectionPath(moduleName, collection)}.bak.${Date.now()}`;
  try {
    await executor.writeFile(backup, prevRaw, { encoding: "utf-8", mode: 0o600 });
    log.warn(
      { moduleName, collection, prevCount, newCount, backup },
      "kv-store write sharply shrinks collection — snapshotted previous content before overwrite",
    );
    await pruneBackups(executor, moduleName, collection, ".json.bak.");
  } catch {
    /* best-effort: a failed backup must not block the write */
  }
}

// Retention for the defensive backups (`.bak.<ts>` / `.corrupt-<ts>`): keep the
// N most recent per collection and unlink the rest. Without this, every shrink /
// corruption event minted a fresh sidecar copy forever — they hold secrets/policy
// and steadily fill LUXIPANEL_CONFIG_DIR. `Date.now()` timestamps are fixed-width
// (13 digits until year 2286), so a lexicographic sort is chronological.
const MAX_BACKUPS_PER_COLLECTION = 5;

async function pruneBackups(
  executor: Executor,
  moduleName: string,
  collection: string,
  infix: string,
): Promise<void> {
  if (typeof executor.readdir !== "function" || typeof executor.unlink !== "function") return;
  try {
    const dir = path.posix.dirname(collectionPath(moduleName, collection));
    const prefix = `${safe(collection)}${infix}`;
    const entries = await executor.readdir(dir);
    const backups = entries
      .map((e) => e.name)
      .filter((name) => name.startsWith(prefix))
      .sort(); // oldest → newest (fixed-width epoch-ms suffix)
    const excess = backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS_PER_COLLECTION));
    for (const name of excess) {
      await executor.unlink(path.posix.join(dir, name)).catch(() => undefined);
    }
  } catch {
    /* best-effort: pruning must never block or fail the write path */
  }
}

/**
 * Does this executor error mean "the file genuinely does not exist" (as opposed
 * to a transient failure — SSH/SFTP hiccup, dropped session, proxy transport
 * error)? Only an ENOENT-class error may be treated as "absent"; everything else
 * is transient and MUST abort the caller (see readRaw), because misreading a
 * transient read failure as "absent" makes the write path overwrite the whole
 * collection with only the current doc (silent data loss).
 *
 *   • Node fs (localExecutor): `err.code === "ENOENT"`.
 *   • ssh2 SFTP (DirectSshExecutor): `err.code === 2` (STATUS_CODE.NO_SUCH_FILE);
 *     the message also carries "No such file".
 *   • LP proxy (LicenseProxyExecutor): the remote error string is bubbled up in
 *     the message, so match on "No such file"/"ENOENT" there too.
 */
export function isFileNotFoundError(err: unknown): boolean {
  if (err == null) return false;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code === "ENOENT") return true; // Node fs
  if (e.code === 2) return true; // ssh2 SFTP STATUS_CODE.NO_SUCH_FILE
  const msg = typeof e.message === "string" ? e.message : String(err);
  return /\bENOENT\b/i.test(msg) || /no such file/i.test(msg);
}

/**
 * Read a collection file. Returns `null` ONLY when the file genuinely does not
 * exist; a transient failure THROWS `KvReadError` so the surrounding
 * read→mutate→write cycle aborts with the on-disk data intact.
 *
 * Why the distinction matters: `readMapEx` maps `null` → `existed=false`, which
 * routes the write through `writeRawCreate` — a full overwrite with just the
 * current mutation's data. If a mere SSH hiccup returned `null`, that overwrite
 * would silently drop every other doc in the collection (the failure mode that
 * emptied the assistant conversations index). The `snapshotBeforeShrink`
 * tripwire does NOT run on the create path, so there is no safety net there.
 */
async function readRaw(executor: Executor, filePath: string): Promise<string | null> {
  let readErr: unknown;
  try {
    const data = await executor.readFile(filePath, "utf-8");
    return typeof data === "string" ? data : data.toString("utf-8");
  } catch (err) {
    readErr = err;
  }
  // Fast path: an unambiguous ENOENT means the file simply doesn't exist (boot /
  // first login against an unpopulated target). There is nothing for `sudo cat`
  // to recover, so skip that second SSH round-trip and return "absent" now.
  if (isFileNotFoundError(readErr)) return null;
  // Direct read failed for a NON-ENOENT reason (unreadable due to perms, or a
  // transient hiccup). Try non-interactive sudo cat: it recovers the permission
  // case (file EXISTS but the panel user can't read it directly) without
  // prompting. exec resolves even on a non-zero exit, so an empty stdout here
  // just means "no content recovered" — we fall through to classify the
  // ORIGINAL read error.
  try {
    const { stdout } = await executor.exec(quoteCmd("sudo", ["-n", "cat", filePath]));
    if (stdout) return stdout;
  } catch {
    // sudo cat itself couldn't run (channel/session error, sudo denied) — fall
    // through to classification below.
  }
  // Neither path yielded content. A genuine ENOENT → null ("doesn't exist",
  // legitimate at boot). Anything else is transient → THROW so the mutation
  // fails clean instead of clobbering the collection.
  if (isFileNotFoundError(readErr)) return null;
  throw new KvReadError(filePath, readErr);
}

// Slow path: ensure the directory exists, write, and assert 0600. Only used
// when the collection file does NOT yet exist or a fast overwrite failed.
async function writeRawCreate(executor: Executor, filePath: string, content: string): Promise<void> {
  const dir = path.posix.dirname(filePath);

  // Combine mkdir + writeFile into ONE proxy/SSH round-trip when the executor
  // supports SFTP batching (managed mode does). Falls back to the per-op path
  // otherwise. mkdir errors are ignored (idempotent — dir may already exist).
  if (executor.batchSftp) {
    try {
      const results = await executor.batchSftp([
        { id: "mkdir", op: "mkdir", path: dir, recursive: true },
        { id: "write", op: "writeFile", path: filePath, data: content },
      ]);
      const wrote = results.find((r) => r.id === "write");
      if (wrote?.ok) {
        // New file: assert owner-only perms (SFTP create honours the remote
        // umask, typically 0644 — these sidecars may hold secrets/policy).
        try {
          await executor.exec(quoteCmd("chmod", ["600", filePath]));
        } catch {
          // non-fatal; perms inherit from the dir umask
        }
        return;
      }
    } catch {
      // fall through to the per-op path below
    }
  }

  // Try without sudo first (works when LUXIPANEL_CONFIG_DIR is owned by the
  // panel user — recommended setup). Fall back to sudo -n only if needed,
  // so the panel boots in unattended environments without password prompts.
  try {
    await executor.exec(quoteCmd("mkdir", ["-p", dir]));
  } catch {
    await executor.exec(quoteCmd("sudo", ["-n", "mkdir", "-p", dir]));
  }
  try {
    await executor.writeFile(filePath, content, { encoding: "utf-8" });
  } catch {
    // SFTP write may fail without write perms — fall back to writing via shell.
    // Base64-encode the payload so the command is a SINGLE line with no control
    // characters. In managed mode this shell fallback travels over LP
    // `/api/agents/exec`, which REJECTS commands containing newlines ("Command
    // contains unsupported control characters"); a raw multi-line JSON `content`
    // interpolated here would make the fallback ALWAYS fail — precisely when the
    // SFTP write already failed. base64 output has no newlines, so we decode it
    // on the box in one line.
    const b64 = Buffer.from(content, "utf-8").toString("base64");
    await executor.exec(
      quoteCmd("sh", ["-lc", `printf '%s' ${quoteArg(b64)} | base64 -d > ${quoteArg(filePath)}`]),
    );
  }
  try {
    await executor.exec(quoteCmd("chmod", ["600", filePath]));
  } catch {
    // chmod failure is non-fatal; perms inherit from the dir umask.
  }
}

/**
 * Atomically replace an EXISTING collection file: write the new content to a
 * sibling temp then `rename()` it over the target. A same-directory rename is
 * atomic on POSIX filesystems, so a crash/restart (pm2 reload, OOM-kill) mid-
 * write can never leave a truncated/empty collection — a reader always sees
 * either the old complete file or the new complete one.
 *
 * REAL INCIDENT (2026-07-04): the previous hot path did a direct in-place
 * `writeFile` (O_TRUNC then write). An OOM-kill landed inside that window and
 * truncated the assistant `conversations-u<uid>.json` index to 0 bytes. An
 * empty file reads back as an empty map (not "corrupt"), so nothing was
 * preserved; the list self-healed via transcript reconstruction but the minted
 * metas are bare — every agent-bound chat was flattened to a loose chat
 * (agentId/projectId/title lost). Atomic replace removes that window entirely.
 *
 * The temp is written with mode 0600 and rename preserves it, so a fresh inode
 * never lands group/world-readable (sidecars may hold secrets/policy). Both
 * `writeFile({mode})` and `rename` are established primitives on every executor
 * (direct SSH + the managed license proxy → LP), so no wire-protocol change is
 * needed. Returns false when the executor can't rename (or the attempt fails),
 * letting the caller fall back to the legacy in-place write.
 */
async function atomicReplace(executor: Executor, filePath: string, content: string): Promise<boolean> {
  if (typeof executor.rename !== "function") return false;
  // randomUUID (no Date.now/pid): dos escrituras concurrentes del mismo sidecar
  // (dos panels, un reload de pm2, o mutación+collect simultáneos) nunca comparten
  // el tmp → el rename final no puede borrar los datos del otro (cierra la race
  // que la docstring de "crash-safety" prometía pero no cumplía).
  const tmp = `${filePath}.tmp-${randomUUID()}`;
  try {
    await executor.writeFile(tmp, content, { encoding: "utf-8", mode: 0o600 });
    await executor.rename(tmp, filePath);
    return true;
  } catch {
    // Best-effort cleanup of the orphaned temp; never mask the write failure.
    try {
      await executor.unlink?.(tmp);
    } catch {
      /* temp may not exist / unlink unsupported — ignore */
    }
    return false;
  }
}

async function writeRaw(executor: Executor, filePath: string, content: string, existed: boolean): Promise<void> {
  // Hot path — the slow case users feel (consultar / pasar página / guardar /
  // eliminar repeatedly on data that already exists). Prefer an ATOMIC replace
  // (temp + rename) so a mid-write crash can never truncate the collection;
  // the extra rename is a cheap metadata op on the kept-alive channel and buys
  // crash-safety the raw in-place write lacked (see atomicReplace).
  if (existed) {
    // Executors that CAN rename (direct SSH + managed LP proxy) must go through
    // the atomic temp+rename path — never an in-place O_TRUNC overwrite, whose
    // truncation window is exactly what emptied the conversations index on an
    // OOM-kill. If the first atomic attempt fails (transient hiccup mid-write),
    // retry ONCE; if it STILL fails, THROW — the mutation fails clean and the
    // on-disk file is left whole. We must NOT silently drop to the truncating
    // in-place write to "save" the operation.
    if (typeof executor.rename === "function") {
      if (await atomicReplace(executor, filePath, content)) return;
      if (await atomicReplace(executor, filePath, content)) return;
      throw new KvWriteError(filePath, new Error("atomic replace failed after retry"));
    }
    // Executor genuinely can't rename → legacy in-place overwrite is the only
    // option (single round-trip, preserves the file's existing mode).
    try {
      await executor.writeFile(filePath, content, { encoding: "utf-8" });
      return;
    } catch {
      // Perms/dir changed underneath us — fall back to the full create path.
    }
  }
  await writeRawCreate(executor, filePath, content);
}

// `existed` = the collection file was present on the target. It lets the
// write path skip the mkdir/chmod round-trips on the hot overwrite case.
// `corrupt` + `raw` = the file was present but its JSON did not parse; the
// map is empty (so reads don't crash) but the write path MUST preserve `raw`
// before it clobbers the file, otherwise a corrupt index silently truncates
// to whatever single doc the caller happens to be writing (real incident:
// assistant `conversations` index emptied on the next append).
async function readMapEx<T>(
  executor: Executor,
  moduleName: string,
  collection: string,
): Promise<{ map: Record<string, T>; existed: boolean; corrupt: boolean; raw: string | null }> {
  const raw = await readRaw(executor, collectionPath(moduleName, collection));
  const existed = raw !== null;
  if (!raw || !raw.trim()) {
    // A file that EXISTS but is empty/blank is the fingerprint of a truncated
    // in-place write (a crash between O_TRUNC and the data flush) — the exact
    // failure that emptied the assistant conversations index. Atomic replace
    // (see atomicReplace) now prevents it, but surface it if it ever recurs so
    // the loss isn't silent. There is nothing to preserve (no bytes), and the
    // caller's per-collection self-heal (e.g. reconstructMissingIndex) rebuilds
    // from disk on the next read.
    if (existed) log.warn({ moduleName, collection }, "kv-store collection file exists but is empty (possible truncated write)");
    return { map: {}, existed, corrupt: false, raw };
  }
  try {
    return { map: JSON.parse(raw) as Record<string, T>, existed, corrupt: false, raw };
  } catch (err) {
    log.warn({ moduleName, collection, err: (err as Error).message }, "Corrupt kv-store JSON");
    return { map: {}, existed, corrupt: true, raw };
  }
}

/** Memo key. Scoped by executor → a memo can never serve one server's bytes to
 *  another (the per-server isolation invariant is not negotiable). */
function memoKey(executor: Executor, moduleName: string, collection: string): string {
  return `${executorKey(executor)}|${moduleName}|${collection}`;
}

/**
 * READ path. Inside a `withKvReadCache` scope each collection is read at most
 * once and concurrent readers share the in-flight promise; outside one, this is
 * exactly the previous behaviour (a round-trip per read).
 *
 * Only reads consult the memo. Mutators go through `readMapEx` directly, INSIDE
 * the collection lock, so the anti-clobber / corrupt-preservation guarantees are
 * untouched — and they drop the memo entry for what they wrote (`dropMemo`), so
 * a later read in the same scope sees the new bytes rather than a stale map.
 */
async function readMap<T>(executor: Executor, moduleName: string, collection: string): Promise<Record<string, T>> {
  const memo = getKvReadCache();
  if (!memo) return (await readMapEx<T>(executor, moduleName, collection)).map;

  const key = memoKey(executor, moduleName, collection);
  const hit = memo.get(key);
  if (hit) return (await hit) as Record<string, T>;

  const p = readMapEx<T>(executor, moduleName, collection).then((r) => r.map);
  memo.set(key, p);
  // Never memoize a rejection: a KvReadError must stay loud on every read, not
  // be replayed from the memo for the rest of the scope.
  p.catch(() => memo.delete(key));
  return (await p) as Record<string, T>;
}

/** Invalidate a collection's memo after a write in the same scope. */
function dropMemo(executor: Executor, moduleName: string, collection: string): void {
  getKvReadCache()?.delete(memoKey(executor, moduleName, collection));
}

/**
 * Snapshot a corrupt collection file to a sibling `<collection>.json.corrupt-<ts>`
 * before the caller overwrites it. Best-effort (0600, secrets/policy may be
 * inside) and only reached on the rare corrupt-overwrite path, so at most one
 * backup is minted per corruption event (the overwrite writes valid JSON, so
 * the next read parses cleanly). Never throws — preservation must not block the
 * write that heals the file.
 */
async function preserveCorrupt(
  executor: Executor,
  moduleName: string,
  collection: string,
  raw: string | null,
): Promise<void> {
  if (!raw) return;
  const src = collectionPath(moduleName, collection);
  const backup = `${src}.corrupt-${Date.now()}`;
  try {
    await executor.writeFile(backup, raw, { encoding: "utf-8", mode: 0o600 });
    log.warn({ moduleName, collection, backup }, "Preserved corrupt kv-store JSON before overwrite");
    await pruneBackups(executor, moduleName, collection, ".json.corrupt-");
  } catch {
    /* best-effort: a failed backup must not block healing the file */
  }
}

async function writeMap<T>(
  executor: Executor,
  moduleName: string,
  collection: string,
  value: Record<string, T>,
  existed: boolean,
  guard?: { prevCount: number; prevRaw: string | null },
): Promise<void> {
  // Anti-clobber tripwire runs BEFORE the overwrite, using the pre-mutation key
  // count + original bytes captured by the caller (no extra round-trip).
  if (existed && guard) {
    await snapshotBeforeShrink(
      executor,
      moduleName,
      collection,
      guard.prevCount,
      Object.keys(value).length,
      guard.prevRaw,
    );
  }
  await writeRaw(executor, collectionPath(moduleName, collection), JSON.stringify(value, null, 2), existed);
  // Single write funnel for every mutator → the one place the scope-local read
  // memo must be invalidated. Without this, a read AFTER a write in the same
  // `withKvReadCache` scope would replay the pre-write map.
  dropMemo(executor, moduleName, collection);
}

/**
 * Choose the executor for a kv-store operation.
 *
 *   • If a connected-server executor was passed (e.g. DirectSshExecutor for
 *     a logged-in target), use it — data lands at that target's
 *     `${LUXIPANEL_CONFIG_DIR}` (one config dir per server).
 *   • Otherwise resolve the request-scoped executor pinned by the auth
 *     middleware (`runWithExecutor`) so every per-server read/write lands on
 *     the connected server even when the caller didn't thread the executor.
 *
 * LUXIPANEL is managed-only: there is NO authoritative panel-host store.
 * If neither an explicit nor a context executor is available we FAIL CLOSED
 * — we must never silently read/write the panel host's filesystem, because
 * that single store would be shared across every bridged server and leak
 * one server's data into another.
 */
const KV_NO_EXECUTOR = noServerExecutor(
  "kv-store: no executor in scope — a per-server executor is required " +
    "(managed-only: panel-host fallback is disabled to prevent cross-server data leakage)",
);

function pickExecutor(executor?: Executor | null): Executor {
  return requireExecutor(executor, KV_NO_EXECUTOR);
}

export interface CollectionStore<T = Record<string, unknown>> {
  get(id: string): Promise<T | null>;
  list(): Promise<Array<T & { id: string }>>;
  /** Predicate-based list. */
  query(predicate: (doc: T & { id: string }) => boolean): Promise<Array<T & { id: string }>>;
  set(id: string, value: T): Promise<T & { id: string }>;
  /** Upsert + merge. Returns the merged document. */
  update(id: string, patch: Partial<T>): Promise<T & { id: string }>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  /** Find first matching predicate. */
  find(predicate: (doc: T & { id: string }) => boolean): Promise<(T & { id: string }) | null>;
  /** Atomic mutator over the whole map. */
  transaction<R>(fn: (current: Record<string, T>) => Promise<{ next: Record<string, T>; result: R }>): Promise<R>;
}

export interface ModuleStore {
  collection<T = Record<string, unknown>>(name: string): CollectionStore<T>;
}

export function kv(executor?: Executor | null): { module(name: string): ModuleStore } {
  const baseExecutor = pickExecutor(executor);
  return {
    module(moduleName: string): ModuleStore {
      return {
        collection<T>(collection: string): CollectionStore<T> {
          // Private assistant documents are panel metadata, not customer files.
          // Elevate only the authenticated user's exact collection namespace;
          // shared/other-user collections stay behind the normal executor.
          const user = getContextUser();
          const ownMetadata = moduleName === "assistant" && user && Number.isSafeInteger(user.userId) && collection.endsWith(`-u${user.userId}`) && /^[a-z][a-z0-9-]*$/.test(collection);
          const exec = ownMetadata && baseExecutor instanceof PrivilegeDropExecutor
            ? baseExecutor.trustedServiceExecutorFor(user.owner ?? "") ?? baseExecutor
            : baseExecutor;
          return {
            async get(id) {
              const map = await readMap<T>(exec, moduleName, collection);
              const doc = map[id];
              if (doc == null) return null;
              // Inject the map key as `id`, same as list/query/find do — the
              // key is the canonical id. Without this, a doc whose body lacks
              // an embedded `id` (e.g. a hand-edited sidecar) reads back with
              // `id: undefined` from get() but WITH an id from list(), and
              // identity comparisons like `child.parentAgentId === parent.id`
              // silently fail (real case: team delegation found 0 subordinates
              // for a leader loaded via get()). Guarded to plain objects so a
              // primitive/array doc is returned untouched.
              if (typeof doc === "object" && !Array.isArray(doc)) {
                return { ...(doc as object), id } as T;
              }
              return doc;
            },
            async list() {
              const map = await readMap<T>(exec, moduleName, collection);
              return Object.entries(map).map(([id, doc]) => ({ ...(doc as object), id } as T & { id: string }));
            },
            async query(predicate) {
              const map = await readMap<T>(exec, moduleName, collection);
              return Object.entries(map)
                .map(([id, doc]) => ({ ...(doc as object), id } as T & { id: string }))
                .filter(predicate);
            },
            async find(predicate) {
              const map = await readMap<T>(exec, moduleName, collection);
              for (const [id, doc] of Object.entries(map)) {
                const item = { ...(doc as object), id } as T & { id: string };
                if (predicate(item)) return item;
              }
              return null;
            },
            async set(id, value) {
              return withCollectionLock(exec, moduleName, collection, async () => {
                const { map, existed, corrupt, raw } = await readMapEx<T>(exec, moduleName, collection);
                if (corrupt) await preserveCorrupt(exec, moduleName, collection, raw);
                const prevCount = Object.keys(map).length;
                const { id: _ignore, ...rest } = (value as unknown) as { id?: string; [k: string]: unknown };
                map[id] = rest as T;
                await writeMap(exec, moduleName, collection, map, existed, { prevCount, prevRaw: raw });
                return { ...(rest as object), id } as T & { id: string };
              });
            },
            async update(id, patch) {
              return withCollectionLock(exec, moduleName, collection, async () => {
                const { map, existed, corrupt, raw } = await readMapEx<T>(exec, moduleName, collection);
                if (corrupt) await preserveCorrupt(exec, moduleName, collection, raw);
                const prevCount = Object.keys(map).length;
                const current = (map[id] as object) ?? {};
                const next = { ...(current as object), ...(patch as object) } as T;
                map[id] = next;
                await writeMap(exec, moduleName, collection, map, existed, { prevCount, prevRaw: raw });
                return { ...(next as object), id } as T & { id: string };
              });
            },
            async delete(id) {
              return withCollectionLock(exec, moduleName, collection, async () => {
                const { map, existed, corrupt, raw } = await readMapEx<T>(exec, moduleName, collection);
                if (corrupt) await preserveCorrupt(exec, moduleName, collection, raw);
                const prevCount = Object.keys(map).length;
                if (!(id in map)) return false;
                delete map[id];
                await writeMap(exec, moduleName, collection, map, existed, { prevCount, prevRaw: raw });
                return true;
              });
            },
            async count() {
              const map = await readMap<T>(exec, moduleName, collection);
              return Object.keys(map).length;
            },
            async transaction(fn) {
              return withCollectionLock(exec, moduleName, collection, async () => {
                const { map, existed, corrupt, raw } = await readMapEx<T>(exec, moduleName, collection);
                if (corrupt) await preserveCorrupt(exec, moduleName, collection, raw);
                const prevCount = Object.keys(map).length;
                const { next, result } = await fn(map);
                await writeMap(exec, moduleName, collection, next, existed, { prevCount, prevRaw: raw });
                return result;
              });
            },
          };
        },
      };
    },
  };
}
