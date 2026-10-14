import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { enqueueRefresh } from "../../../shared/remote-cache/refresh-jobs.js";
import { liveFeatures, invalidateLiveConfig } from "../../../shared/remote-cache/live-config.js";
import { closePersistentCache } from "../../../shared/remote-cache/persistent-client.js";
import { forgetVersioned } from "../../../shared/remote-cache/versioned-read.js";
import { resources, canReadResource } from "../../../shared/remote-cache/live-resources.js";
import { cacheScheduleEntry } from "../../../shared/remote-cache/schedule.js";
import { panelConfigDir } from "../../../config/paths.js";
import { ValidationError } from "../../../shared/errors/index.js";

export const liveDataController = {
  capabilities: asyncHandler(async (req, res) => {
    const executor = getExecutor(req), flags = await liveFeatures(executor);
    const allowed: string[] = [];
    for (const key of Object.keys(resources)) {
      const [module, collection] = key.split("/") as [string, string];
      if (await canReadResource(res.locals.user, key) && (await cacheScheduleEntry(executor, module, collection)).enabled) allowed.push(key);
    }
    res.json({ok: true, data: {protocol: 2, ...flags, resources: allowed}});
  }),
  refresh: asyncHandler(async (req, res) => {
    const parsed = z.object({resource: z.string().max(80)}).strict().safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid resource");
    const job = await enqueueRefresh(getExecutor(req), res.locals.user, parsed.data.resource);
    if (!job) {res.status(409).json({ok: false, code: "REFRESH_UNAVAILABLE"}); return;}
    res.status(202).json({ok: true, data: {job: {id: job.jobId}, state: job.state}});
  }),
  configure: asyncHandler(async (req, res) => {
    const parsed = z.object({versionedReads: z.boolean(), events: z.boolean(), watcher: z.boolean()}).strict().safeParse(req.body);
    if (!parsed.success || (parsed.data.events && !parsed.data.versionedReads)) throw new ValidationError("Invalid live-data configuration");
    const executor = getExecutor(req), dir = `${panelConfigDir()}/cache-engine`;
    await executor.mkdir(dir, {recursive: true});
    await executor.writeFile(`${dir}/live-data.json`, JSON.stringify(parsed.data), {mode: 0o600});
    invalidateLiveConfig(executor); forgetVersioned(executor); closePersistentCache(executor);
    res.json({ok: true, data: parsed.data});
  }),
};
