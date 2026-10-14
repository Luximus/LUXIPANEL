import type { Request, Response } from "express";
import { z } from "zod";
import { kv } from "../../../shared/kv-store/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { asyncHandler } from "../../../shared/types/index.js";

const patchSchema = z.object({
  editorMode: z.enum(["edit", "preview", "split"]).optional(),
  fontSize: z.number().int().min(12).max(20).optional(),
  lastVaultId: z.string().max(128).nullable().optional(),
}).strict();

type Preferences = { editorMode: "edit" | "preview" | "split"; fontSize: number; lastVaultId: string | null };
const defaults: Preferences = { editorMode: "edit", fontSize: 14, lastVaultId: null };

function collection(req: Request) {
  return kv(getExecutor(req)).module("obsidian").collection<Preferences>("preferences");
}

function key(res: Response): string { return `user-${res.locals.user.userId}`; }

export const obsidianPreferencesController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const saved = await collection(req).get(key(res));
    res.json({ ok: true, data: { ...defaults, ...saved } });
  }),
  patch: asyncHandler(async (req: Request, res: Response) => {
    const update = patchSchema.parse(req.body);
    const id = key(res);
    const value = await collection(req).transaction(async (documents) => {
      const next = { ...defaults, ...documents[id], ...update };
      return { next: { ...documents, [id]: next }, result: next };
    });
    res.json({ ok: true, data: value });
  }),
};
