// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Jobs controller — read the status of a write-behind queue job from the
 * per-server Redis. Used by the frontend to poll a create/edit/delete that
 * was enqueued (mode "queued") until it reaches done/failed.
 *
 * It also runs the panel-side STUCK watchdog: a job still "queued" (never
 * picked up by the worker) past WRITE_QUEUE_STUCK_MS means the worker is
 * likely dead on that server, so it raises a notification once.
 */

import { refreshJobStatus } from "../../../shared/remote-cache/refresh-jobs.js";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { readJobStatus } from "../../../shared/remote-cache/submit-mutation.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { env } from "../../../config/env.js";
import { NotFoundError } from "../../../shared/errors/index.js";

// De-dupe stuck alerts: one per (targetId, jobId). Bounded with FIFO eviction
// so a long-lived process across many servers/jobs can't leak memory — once a
// key is evicted the worst case is a single duplicate alert, which is fine.
const STUCK_NOTIFIED_CAP = 5_000;
const stuckNotified = new Set<string>();

function markStuckNotified(key: string): void {
  if (stuckNotified.size >= STUCK_NOTIFIED_CAP) {
    const oldest = stuckNotified.values().next().value;
    if (oldest !== undefined) stuckNotified.delete(oldest);
  }
  stuckNotified.add(key);
}

export const jobsController = {
  /** GET /api/jobs/:id — current status of a queued mutation. */
  get: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const jobId = String(req.params.id || "");
    if (!/^[0-9a-fA-F-]{8,64}$/.test(jobId)) {
      throw new NotFoundError("Job no encontrado");
    }

    const refreshed = await refreshJobStatus(executor, res.locals.user, jobId).catch(() => null);
    if (refreshed) { res.json({ok: true, data: refreshed}); return; }
    const status = await readJobStatus(executor, jobId);
    if (!status) {
      // No status key (expired, never existed, or Redis unreachable). Report
      // as unknown rather than 404 so the UI can stop polling gracefully.
      res.json({ ok: true, data: { jobId, state: "unknown" } });
      return;
    }

    // Stuck watchdog: queued for too long → worker probably dead.
    if (status.state === "queued") {
      const ageMs = Date.now() - (status.ts ?? 0) * 1000;
      const key = `${executor.target.id}:${jobId}`;
      if (ageMs > env.WRITE_QUEUE_STUCK_MS && !stuckNotified.has(key)) {
        markStuckNotified(key);
        eventBus.emit(Events.WRITE_QUEUE_STUCK, {
          targetId: executor.target.id,
          jobId,
          ageMs,
        });
      }
    }

    res.json({ ok: true, data: status });
  }),
};
