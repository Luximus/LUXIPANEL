// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Public ingest controller — the live endpoint that RECEIVES data for a
 * receive-data gateway webhook. No session/auth gate (the gateway's own
 * api-key + IP rules do the authentication); mounted in createApp's public
 * zone before any module `requireAuth`.
 */

import type { Request, Response } from "express";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { AppError } from "../../../shared/errors/index.js";
import { gatewayWebhookService } from "../services/gateway-webhook.service.js";
import { API_KEY_HEADER } from "../models/gateway-webhook.model.js";

const log = createModuleLogger("webhook-ingest");

export const ingestController = {
  /** ANY /api/hooks/in/:token */
  receive: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const token = String(req.params.token ?? "");
    try {
      // Prefer the edge-set CF-Connecting-IP: with `trust proxy = 1`, req.ip
      // comes off X-Forwarded-For, which a client can forge if the vhost doesn't
      // overwrite it. Cloudflare stamps CF-Connecting-IP with the real client.
      const clientIp = String(
        (req.headers["cf-connecting-ip"] as string | undefined) ??
          req.ip ??
          req.socket.remoteAddress ??
          "",
      ).trim();
      const result = await gatewayWebhookService.ingest(token, {
        method: req.method,
        ip: clientIp,
        apiKeyHeader: (req.headers[API_KEY_HEADER] as string | undefined) ?? undefined,
        headers: req.headers as Record<string, unknown>,
        query: (req.query ?? {}) as Record<string, unknown>,
        body: req.body,
        rawBody: (req as unknown as { rawBody?: string }).rawBody,
      });
      res.status(result.status).json(result.body);
    } catch (err) {
      log.error({ err, token: token.slice(0, 6) }, "ingest failed");
      throw new AppError("Ingest error", 500, "INGEST_ERROR");
    }
  }),
};
