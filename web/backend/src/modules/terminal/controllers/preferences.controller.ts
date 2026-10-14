// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Request, Response } from "express";
import { z } from "zod";
import { kv } from "../../../shared/kv-store/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { settingsRepository } from "../../admin/repositories/settings.repository.js";

const order = z
  .array(z.enum(["commands", "codex", "claude"]))
  .length(3)
  .refine((value) => new Set(value).size === 3);
const visible = z
  .array(z.enum(["commands", "codex", "claude"]))
  .min(1)
  .max(3)
  .refine((value) => new Set(value).size === value.length);
const patchSchema = z
  .object({
    fontSize: z.number().int().min(11).max(20).optional(),
    historyOrder: order.optional(),
    historyVisible: visible.optional(),
  })
  .strict();
type Preferences = {
  fontSize: number;
  historyOrder: Array<"commands" | "codex" | "claude">;
  historyVisible: Array<"commands" | "codex" | "claude">;
};
const defaults: Preferences = {
  fontSize: 13,
  historyOrder: ["codex", "claude", "commands"],
  historyVisible: ["codex", "claude", "commands"],
};

function store(req: Request) {
  return kv(getExecutor(req))
    .module("terminal")
    .collection<Preferences>("preferences");
}
function key(res: Response): string {
  return `user-${res.locals.user.userId}`;
}

async function current(req: Request, res: Response): Promise<Preferences> {
  const personal = await store(req).get(key(res));
  if (personal) return { ...defaults, ...personal };
  const legacy = await settingsRepository.get(
    "terminal_history_tab_order",
    getExecutor(req),
  );
  const parts = legacy?.split(",");
  const historyOrder = order.safeParse(parts);
  return {
    ...defaults,
    historyOrder: historyOrder.success
      ? historyOrder.data
      : defaults.historyOrder,
  };
}

export const preferencesController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    res.json({ ok: true, data: await current(req, res) });
  }),
  patch: asyncHandler(async (req: Request, res: Response) => {
    const update = patchSchema.parse(req.body);
    const fallback = await current(req, res);
    const id = key(res);
    const next = await store(req).transaction(async (documents) => {
      const value = { ...fallback, ...documents[id], ...update };
      return { next: { ...documents, [id]: value }, result: value };
    });
    res.json({ ok: true, data: next });
  }),
};
