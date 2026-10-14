import { randomUUID } from "node:crypto";
import type { Executor } from "../executor/types.js";
import type { SessionUser } from "../types/index.js";
import { getRedis } from "../redis/index.js";
import { cacheIdentity, liveFeatures } from "./live-config.js";
import { cacheScheduleEntry } from "./schedule.js";
import { panelConfigDir } from "../../config/paths.js";
import { escapeSingleQuoted } from "./redis-cli.js";
import { canReadResource } from "./live-resources.js";
import { readVersioned, forgetVersioned } from "./versioned-read.js";

type Job = {jobId: string; state: "queued" | "processing" | "done" | "failed"; resource: string; ts: number; viewReady: boolean; error?: string};
const pending = new WeakMap<object, Map<string, {job: Job; ready: Promise<boolean>}>>();
const ownerKey = (executor: Executor, user: SessionUser, id: string) =>
  `lxp:data-refresh:${JSON.stringify([executor.target.id, user.userId, user.username, user.owner ?? "", id])}`;
const store = (executor: Executor, user: SessionUser, job: Job) => getRedis().set(ownerKey(executor, user, job.jobId), JSON.stringify(job), "EX", 600);

export async function refreshJobStatus(executor: Executor, user: SessionUser, id: string): Promise<Job | null> {
  const raw = await getRedis().get(ownerKey(executor, user, id));
  if (!raw) return null;
  const job = JSON.parse(raw) as Job;
  if (!(await canReadResource(user, job.resource))) return null;
  // A process restart must not leave a persistent status spinning forever.
  if (["queued", "processing"].includes(job.state) && Date.now() / 1000 - job.ts > 180)
    return {...job, state: "failed", error: "REFRESH_INTERRUPTED", viewReady: false};
  return job;
}

export async function enqueueRefresh(executor: Executor, user: SessionUser, resource: string): Promise<Job | null> {
  if (!(await canReadResource(user, resource))) return null;
  const [module, collection] = resource.split("/") as [string, string];
  if (!(await liveFeatures(executor)).versionedReads || !(await cacheScheduleEntry(executor, module, collection)).enabled) return null;
  const identity = cacheIdentity(executor);
  let running = pending.get(identity);
  if (!running) { running = new Map(); pending.set(identity, running); }
  const key = JSON.stringify([user.userId, user.username, resource]);
  const previous = running.get(key);
  if (previous) return await previous.ready ? {...previous.job} : null;
  if (running.size >= 32) return null;
  const job: Job = {jobId: randomUUID(), state: "queued", resource, ts: Date.now() / 1000, viewReady: false};
  // Reserve before the first await: concurrent requests share this job id.
  let stored!: (ok: boolean) => void;
  const ready = new Promise<boolean>(resolve => {stored = resolve;});
  running.set(key, {job, ready});
  try { await store(executor, user, job); stored(true); }
  catch (error) { running.delete(key); stored(false); throw error; }
  void (async () => {
    try {
      job.state = "processing"; await store(executor, user, job);
      const path = escapeSingleQuoted(`${panelConfigDir()}/cache-engine/engines/dispatcher.sh`);
      const result = await executor.exec(`LXP_REFRESH_STRICT=1 LXP_COLLECT_LIGHT=1 LXP_INVALIDATE=1 bash ${path} --entry ${module} ${collection}`, {timeoutMs: 150_000});
      if (result.exitCode !== 0) throw new Error("REFRESH_FAILED");
      // A list request started before collection must not satisfy this job.
      forgetVersioned(executor, module, collection);
      const view = await readVersioned(executor, module, collection);
      if (!view || view.meta.state === "stale" || view.meta.collectedAt < Math.floor(job.ts)) throw new Error("VIEW_NOT_READY");
      job.state = "done"; job.viewReady = true;
    } catch { job.state = "failed"; job.error = "VIEW_REFRESH_FAILED"; }
    finally {
      await store(executor, user, job).catch(() => undefined);
      if (running!.get(key)?.job.jobId === job.jobId) running!.delete(key);
    }
  })();
  return {...job};
}
