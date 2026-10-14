// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Chat / status controllers — thin wrappers around the agent dispatcher.
 *
 *   GET  /api/ai/status   → enabled + active provider snapshot (no secrets)
 *   POST /api/ai/chat     → non-streaming single-turn convenience endpoint
 *                           (kept for the legacy diagnostics → analyze flow;
 *                            interactive chat uses POST /api/ai/agent SSE)
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ServiceUnavailableError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { agentService, type AgentEvent } from "../services/agent.service.js";

const log = createModuleLogger("ai-chat");

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4096),
      }),
    )
    .min(1)
    .max(50),
  withContext: z.boolean().default(true),
});

export const chatController = {
  /** GET /api/ai/status — non-secret view of the active config. */
  status: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const cfg = await assistantConfigRepository.load(executor);
    const active = cfg.providers[cfg.activeProvider];
    const hasKey = (active.api?.apiKey ?? "").length > 0;
    res.json({
      ok: true,
      data: {
        enabled: cfg.enabled,
        provider: cfg.activeProvider,
        mode: active.mode,
        model: active.api?.model ?? "",
        hasApiKey: hasKey,
      },
    });
  }),

  /**
   * POST /api/ai/chat — single-turn, non-streaming.
   *
   * Drives the agent dispatcher with no tools (forced via `withContext`)
   * and aggregates `text` deltas. Returns the final text. Suitable for the
   * diagnostics "analyze" use case; the interactive chat uses /api/ai/agent.
   */
  chat: asyncHandler(async (req: Request, res: Response) => {
    const body = chatSchema.parse(req.body);
    let content = "";
    let errorMessage: string | null = null;

    for await (const ev of agentService.run(body.messages, {
      withContext: body.withContext,
    }) as AsyncGenerator<AgentEvent>) {
      if (ev.type === "text") content += ev.delta;
      else if (ev.type === "error") {
        errorMessage = ev.message;
        break;
      } else if (ev.type === "done") {
        break;
      }
    }

    if (errorMessage !== null) {
      // Log upstream error server-side with full detail; surface a generic
      // message to the client so we never leak provider internals (API keys,
      // stack traces, host names) over the wire.
      log.warn({ upstreamError: errorMessage }, "ai chat upstream error");
      throw new ServiceUnavailableError(
        "El servicio de IA no está disponible temporalmente. Intenta de nuevo.",
      );
    }
    res.json({ ok: true, data: { content } });
  }),
};
