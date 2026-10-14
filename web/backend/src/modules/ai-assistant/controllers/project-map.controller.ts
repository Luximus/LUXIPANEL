// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Project Map endpoints (mounted under /api/ai).
 *
 *   GET  /api/ai/project-map?path=        → cached map for a path (or null)
 *   POST /api/ai/project-map/generate     → start a background generation
 *   GET  /api/ai/project-map/status?jobId → poll a generation job
 *
 * Generation runs as an in-process background task (NOT awaited in the request)
 * so it survives the nginx/Cloudflare gateway timeout for deep scans. The
 * captured executor stays valid while the session's SSH connection is alive;
 * the durable result is the cached sidecar under LUXIPANEL_CONFIG_DIR.
 */

import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { apiModuleMessage, type ModuleMessageKey } from "../../../shared/i18n/module-messages.js";
import { aiOutputLanguage } from "../../../shared/i18n/ai-output-language.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { projectMapRepository } from "../repositories/project-map.repository.js";
import { projectMapService } from "../services/project-map/project-map.service.js";
import type { AssistantProviderId } from "../models/assistant-config.types.js";

interface JobState {
  state: "pending" | "done" | "error";
  path: string;
  errorKey?: ModuleMessageKey;
  startedAt: number;
}

// In-memory job registry. Generation is in-process, so memory is fine; if the
// backend restarts mid-job the status 404s and the frontend falls back to the
// cached map (or lets the user regenerate).
const jobs = new Map<string, JobState>();
const log = createModuleLogger("project-map");
const PROJECT_MAP_JOB_TTL_MS = 15 * 60 * 1000;

function pruneJobs(): void {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (now - j.startedAt > PROJECT_MAP_JOB_TTL_MS) jobs.delete(id);
  }
}

const generateSchema = z.object({
  path: z.string().min(1).max(4096),
  providerId: z.string().min(1).max(40),
});

export const projectMapController = {
  /** GET /api/ai/project-map?path= — return the cached map for a path (or null). */
  get: asyncHandler(async (req: Request, res: Response) => {
    const path = z.string().min(1).max(4096).parse(req.query["path"]);
    const executor = getExecutor(req);
    const doc = await projectMapRepository.get(executor, path, res.locals.locale);
    res.json({ ok: true, map: doc?.map ?? null, updatedAt: doc?.updatedAt ?? null });
  }),

  /** POST /api/ai/project-map/generate — start a background generation. */
  generate: asyncHandler(async (req: Request, res: Response) => {
    const { path, providerId } = generateSchema.parse(req.body);
    if (!path.startsWith("/")) throw new ValidationError(apiModuleMessage(res.locals.locale, "assistantProjectPathAbsolute"));
    const locale = res.locals.locale;
    const executor = getExecutor(req);
    const config = await assistantConfigRepository.load(executor);

    const slot = config.providers[providerId as AssistantProviderId];
    if (!slot) throw new ValidationError(apiModuleMessage(res.locals.locale, "assistantProviderUnconfigured").replace("{provider}", () => providerId));
    if (slot.mode === "api" && !slot.api?.apiKey) {
      throw new ValidationError(apiModuleMessage(res.locals.locale, "assistantProviderApiKeyMissing"));
    }
    if (slot.mode === "cli" && !(slot.cli?.installed && slot.cli?.loggedIn)) {
      throw new ValidationError(apiModuleMessage(res.locals.locale, "assistantProviderCliMissing"));
    }

    pruneJobs();
    const jobId = randomUUID();
    jobs.set(jobId, { state: "pending", path, startedAt: Date.now() });

    // Reuse maps already generated for subfolders of this path (e.g. generating
    // LUXIPANEL when LUXIPANEL/frontend already has its own map).
    const childMaps = await projectMapRepository.listUnder(executor, path, locale);

    // Fire-and-forget: generate, then persist. Errors are captured in the job.
    void (async () => {
      try {
        const map = await projectMapService.generate(executor, {
          dir: path,
          providerId: providerId as AssistantProviderId,
          config,
          locale,
          language: aiOutputLanguage(locale),
          childMaps: childMaps.map((d) => ({ path: d.path, map: d.map })),
        });
        await projectMapRepository.save(executor, path, map, locale);
        const j = jobs.get(jobId);
        if (j) j.state = "done";
      } catch (e) {
        const j = jobs.get(jobId);
        if (j) {
          j.state = "error";
          const message = (e as Error)?.message ?? String(e);
          log.warn({ err: e, jobId }, "project map generation failed");
          j.errorKey = message.startsWith("La IA no devolvió un mapa válido") ? "assistantMapInvalidJson"
            : message.startsWith("La IA no devolvió pestañas con diagramas válidos") ? "assistantMapInvalidTabs"
            : message.startsWith("La generación del mapa tardó demasiado") ? "assistantMapTimeout"
            : "assistantMapGenerationFailed";
        }
      }
    })();

    res.json({ ok: true, jobId });
  }),

  /** GET /api/ai/project-map/status?jobId= — poll a generation job. */
  status: asyncHandler(async (req: Request, res: Response) => {
    const jobId = z.string().min(1).max(80).parse(req.query["jobId"]);
    const job = jobs.get(jobId);
    if (!job) {
      // Unknown job (expired or lost on restart). Tell the client to re-check the cache.
      res.json({ ok: true, state: "unknown" });
      return;
    }
    res.json({ ok: true, state: job.state, error: job.errorKey ? apiModuleMessage(res.locals.locale, job.errorKey) : null });
  }),
};
