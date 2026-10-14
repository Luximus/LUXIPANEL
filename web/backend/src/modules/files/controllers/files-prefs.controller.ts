// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Files-prefs controller — client/developer UI mode per user (#25).
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import type { AuthenticatedLocals } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { filesPrefsService } from "../services/index.js";
import { serverSettingsService } from "../../admin/services/server-settings.service.js";
import { ForbiddenError } from "../../../shared/errors/index.js";

const setSchema = z.object({ mode: z.enum(["client", "developer"]) });
const shortcutKeys = ["newFile", "newFolder", "upload", "paste", "save", "delete", "back", "refresh", "search", "newTab", "clearSelection", "openFiles", "toggleEditor", "viewList", "viewGrid", "projects", "rescanProjects", "projectMap", "compare", "git", "copyPath", "download"] as const;
function shortcutIdentity(value: string): string | null {
  const parts = value.toLowerCase().replace(/\s/g, "").split("+");
  const aliases: Record<string, string> = { control: "ctrl", option: "alt", cmd: "meta", command: "meta", win: "meta" };
  const key = parts.pop();
  if (!key || !/^(?:[a-z0-9]|f(?:[1-9]|1[0-2]))$/.test(key)) return null;
  const mods = parts.map((part) => aliases[part] || part);
  if (!mods.length || mods.some((part) => !["ctrl", "alt", "shift", "meta"].includes(part))) return null;
  if (new Set(mods).size !== mods.length) return null;
  return `${["ctrl", "alt", "shift", "meta"].map((part) => Number(mods.includes(part))).join("")}:${key}`;
}
const shortcutSchema = z.record(z.enum(shortcutKeys), z.string().max(60)).refine((shortcuts) => {
  const identities = Object.values(shortcuts).map(shortcutIdentity);
  return !identities.includes(null) && identities.length === new Set(identities).size;
}, "Atajos inválidos o duplicados");
const patchSchema = z.object({
  mode: z.enum(["client", "developer"]).optional(),
  showHidden: z.boolean().optional(),
  favoriteRoots: z.array(z.string().regex(/^\//).max(4096)).max(50).optional(),
  treeExpansionMode: z.enum(["multiple", "single"]).optional(),
  shortcuts: shortcutSchema.optional(),
}).strict();

function userId(res: Response): string {
  const id = (res.locals as AuthenticatedLocals).user?.userId;
  if (id === undefined || id === null) throw new ForbiddenError("Authentication required");
  return String(id);
}

export const filesPrefsController = {
  preferences: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const data = await filesPrefsService.get(executor, userId(res));
    let legacyShortcuts: Record<string, string> | undefined;
    if (!data.shortcuts && res.locals.user?.kind === "admin") {
      const bag = await serverSettingsService.readAll(executor);
      const converted: Record<string, string> = {};
      for (const key of shortcutKeys) {
        const legacy = `files_shortcut_${key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`;
        const value = bag[legacy]?.value;
        if (value) converted[key] = value;
      }
      if (Object.keys(converted).length) legacyShortcuts = converted;
    }
    res.json({ ok: true, data: { ...data, legacyShortcuts } });
  }),

  patchPreferences: asyncHandler(async (req: Request, res: Response) => {
    const values = patchSchema.parse(req.body);
    const data = await filesPrefsService.patch(getExecutor(req), userId(res), values);
    res.json({ ok: true, data });
  }),
  /** GET /api/files/mode */
  get: asyncHandler(async (req: Request, res: Response) => {
    const mode = await filesPrefsService.getMode(getExecutor(req), userId(res));
    res.json({ ok: true, data: { mode } });
  }),

  /** PUT /api/files/mode */
  set: asyncHandler(async (req: Request, res: Response) => {
    const { mode } = setSchema.parse(req.body);
    const next = await filesPrefsService.setMode(getExecutor(req), userId(res), mode);
    res.json({ ok: true, data: { mode: next } });
  }),
};
