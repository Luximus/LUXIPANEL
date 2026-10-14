// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Agent↔agent async messages — READ-ONLY REST surface (v1).
 *
 *   GET /api/ai/agent-messages?agentId=…          every message that agent sent or received
 *   GET /api/ai/agent-messages?from=…&to=…        the ordered pair's thread
 *
 * Messages are WRITTEN exclusively by the `agents.send_message` tool (see
 * agent-messages.service) — a human "send on behalf of an agent" endpoint is
 * deliberately NOT exposed here: the sender identity is what gates the
 * recipient allowlist, and the delivered turn carries the sender's user
 * snapshot. This surface only lets the UI show the channel's traffic.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { agentMessagesRepository } from "../repositories/agent-messages.repository.js";
import { toAgentMessageView } from "../models/agent-message.types.js";

function optionalId(req: Request, key: string, locale: unknown): string {
  const raw = req.query[key];
  const id = typeof raw === "string" ? raw.trim() : "";
  if (id.length > 64) throw new ValidationError(apiModuleMessage(locale, "assistantQueryIdInvalid").replace("{field}", () => key));
  return id;
}

export const agentMessagesController = {
  /** Messages of one agent (sent + received) or of an ordered pair (from → to). */
  list: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const agentId = optionalId(req, "agentId", res.locals.locale);
    const from = optionalId(req, "from", res.locals.locale);
    const to = optionalId(req, "to", res.locals.locale);

    let items;
    if (from && to) {
      items = await agentMessagesRepository.listForPair(executor, from, to);
    } else if (agentId) {
      items = await agentMessagesRepository.listForAgent(executor, agentId);
    } else {
      throw new ValidationError(apiModuleMessage(res.locals.locale, "assistantMessageQueryRequired"));
    }
    res.json({ ok: true, messages: items.map(toAgentMessageView) });
  }),
};
