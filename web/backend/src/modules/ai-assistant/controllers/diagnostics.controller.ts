// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Diagnostics controller — automated mail/DNS diagnostics.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { ServiceUnavailableError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { diagnosticsService } from "../services/diagnostics.service.js";
import { agentService, type AgentEvent } from "../services/agent.service.js";
import { apiErrorMessage } from "../../../shared/i18n/errors.js";
import { diagnosticResponseLanguage, localizeDiagnosticChecks } from "./diagnostics-i18n.js";

const log = createModuleLogger("ai-diagnostics");

export const diagnosticsController = {
  /** GET /api/ai/diagnostics/:domain — run diagnostics for a domain. */
  run: asyncHandler(async (req: Request, res: Response) => {
    const domain = z.string().min(3).max(253).parse(req.params.domain);
    const checks = localizeDiagnosticChecks(res.locals.locale, await diagnosticsService.runForDomain(domain));

    const warnings = checks.filter((c) => c.status !== "ok" && c.status !== "unknown");
    res.json({ ok: true, data: { domain, checks, issueCount: warnings.length } });
  }),

  /**
   * POST /api/ai/diagnostics/:domain/analyze
   * Run diagnostics and ask the AI to explain issues and suggest fixes.
   */
  analyze: asyncHandler(async (req: Request, res: Response) => {
    const domain = z.string().min(3).max(253).parse(req.params.domain);
    const checks = localizeDiagnosticChecks(res.locals.locale, await diagnosticsService.runForDomain(domain));

    const summary = checks
      .map((c) => `[${c.status.toUpperCase()}] ${c.name}: ${c.message}${c.detail ? ` (${c.detail})` : ""}`)
      .join("\n");

    let content = "";
    let errorMessage: string | null = null;
    for await (const ev of agentService.run(
      [
        {
          role: "user",
          content:
            `Eres administrador experto de servidores de correo. ` +
            `Analiza estos diagnósticos DNS/correo y entrega recomendaciones accionables.\n\n` +
            `Dominio: ${domain}\n\nResultados:\n${summary}\n\nResponde en ${diagnosticResponseLanguage(res.locals.locale)}.`,
        },
      ],
      { withContext: false },
    ) as AsyncGenerator<AgentEvent>) {
      if (ev.type === "text") content += ev.delta;
      else if (ev.type === "error") { errorMessage = ev.message; break; }
      else if (ev.type === "done") break;
    }

    if (errorMessage !== null) {
      // Log upstream error server-side; never echo provider internals to the client.
      log.warn({ domain, upstreamError: errorMessage }, "ai diagnostics analyze upstream error");
      throw new ServiceUnavailableError(apiErrorMessage(res.locals.locale, "unavailable"));
    }
    res.json({ ok: true, data: { domain, checks, analysis: content } });
  }),
};
