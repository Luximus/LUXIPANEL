/**
 * Obsidian controller — vault registry + note CRUD/search/links on top of the
 * per-request executor. Double path gate: on top of `requireAuth` +
 * `requireModule("obsidian")`, every vault operation re-checks the per-group
 * PATH policy (`canAccessPath`) against the vault and the requested note's
 * physical path for the pinned session user — read for GETs, write for
 * mutations. Admins pass the role policy but remain inside the vault.
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler, type SessionUser } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ForbiddenError, NotFoundError } from "../../../shared/errors/index.js";
import { canAccessPath } from "../../../shared/auth/role-permissions.js";
import { resolveRel } from "../services/path-util.js";
import { physicalNotePath } from "../services/physical-path.js";
import { obsidianService } from "../services/obsidian.service.js";
import { contextContainerService } from "../services/context-container.service.js";
import {
  appendNoteSchema,
  assistantContextSchema,
  createFolderSchema,
  createVaultSchema,
  dailyNoteSchema,
  noteParamSchema,
  renameSchema,
  searchQuerySchema,
  writeNoteSchema,
} from "../models/index.js";

const vaultIdSchema = z.string().min(1).max(128);

function sessionUser(res: Response): SessionUser {
  const user = res.locals.user as SessionUser | undefined;
  if (!user) throw new ForbiddenError("Authentication required");
  return user;
}

/** Enforce the group path policy on the vault's absolute path. */
function requireVaultAccess(res: Response, absPath: string, op: "read" | "write"): void {
  const user = sessionUser(res);
  if (!canAccessPath(user, absPath, op)) {
    throw new ForbiddenError(`Path access denied for ${absPath}`);
  }
}

/** Resolve the :id vault and gate it against the user's path policy. */
async function vaultFor(req: Request, res: Response, op: "read" | "write") {
  const executor = getExecutor(req);
  const id = vaultIdSchema.parse(req.params.id);
  const vault = await obsidianService.getVault(executor, id);
  requireVaultAccess(res, vault.path, op);
  return { executor, vault };
}

async function requireNoteAccess(req: Request, res: Response, vaultPath: string, rel: string, op: "read" | "write") {
  const { root, target } = await physicalNotePath(getExecutor(req), vaultPath, rel);
  requireVaultAccess(res, root, op);
  requireVaultAccess(res, target, op);
  return { root, target };
}

export const obsidianController = {
  /** GET /api/obsidian/vaults — registered vaults + live exists/noteCount. */
  listVaults: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = getExecutor(req);
    const vaults = await obsidianService.listVaults(executor);
    // Non-admins only see vaults their group path policy lets them read.
    const visible = vaults.filter((v) => canAccessPath(user, v.path, "read"))
      .map((v) => ({ ...v, canWrite: canAccessPath(user, v.path, "write") }));
    res.json({ ok: true, data: visible });
  }),

  /** POST /api/obsidian/vaults — create a directory or register an existing one. */
  createVault: asyncHandler(async (req: Request, res: Response) => {
    const input = createVaultSchema.parse(req.body);
    requireVaultAccess(res, input.path, "write");
    const executor = getExecutor(req);
    const vault = await obsidianService.createVault(executor, input);
    res.json({ ok: true, data: vault });
  }),

  /** DELETE /api/obsidian/vaults/:id — deregister only; files are untouched. */
  deleteVault: asyncHandler(async (req: Request, res: Response) => {
    const { executor, vault } = await vaultFor(req, res, "write");
    await obsidianService.deleteVault(executor, vault.id);
    res.json({ ok: true });
  }),

  /** GET /api/obsidian/vaults/:id/tree — folders + notes (md/canvas only). */
  tree: asyncHandler(async (req: Request, res: Response) => {
    const { executor, vault } = await vaultFor(req, res, "read");
    const tree = await obsidianService.getTree(executor, vault);
    const user = sessionUser(res);
    res.json({ ok: true, data: {
      folders: tree.folders.filter((p) => canAccessPath(user, resolveRel(vault.path, p), "read")),
      notes: tree.notes.filter((n) => canAccessPath(user, resolveRel(vault.path, n.path), "read"))
        .map((n) => ({ ...n, canWrite: canAccessPath(user, resolveRel(vault.path, n.path), "write") })),
    } });
  }),

  /** GET /api/obsidian/vaults/:id/note?path=rel — read one note (≤2MB). */
  readNote: asyncHandler(async (req: Request, res: Response) => {
    const { path } = noteParamSchema.parse(req.query);
    const { executor, vault } = await vaultFor(req, res, "read");
    const physical = await requireNoteAccess(req, res, vault.path, path, "read");
    const note = await obsidianService.readNote(executor, vault, path);
    res.json({ ok: true, data: { ...note, canWrite: canAccessPath(sessionUser(res), physical.root, "write") && canAccessPath(sessionUser(res), physical.target, "write") } });
  }),

  /** PUT /api/obsidian/vaults/:id/note — create/update a note. */
  writeNote: asyncHandler(async (req: Request, res: Response) => {
    const { path, content } = writeNoteSchema.parse(req.body);
    const { executor, vault } = await vaultFor(req, res, "write");
    await requireNoteAccess(req, res, vault.path, path, "write");
    const result = await obsidianService.writeNote(executor, vault, path, content);
    res.json({ ok: true, data: result });
  }),

  /** POST /api/obsidian/vaults/:id/note/append — append to a note (creates if missing). */
  appendNote: asyncHandler(async (req: Request, res: Response) => {
    const { path, content } = appendNoteSchema.parse(req.body);
    const { executor, vault } = await vaultFor(req, res, "write");
    await requireNoteAccess(req, res, vault.path, path, "write");
    const result = await obsidianService.appendNote(executor, vault, path, content);
    res.json({ ok: true, data: result });
  }),

  /** POST /api/obsidian/vaults/:id/daily — append to Daily/YYYY-MM-DD.md (server's date). */
  dailyNote: asyncHandler(async (req: Request, res: Response) => {
    const { content, date } = dailyNoteSchema.parse(req.body ?? {});
    const { executor, vault } = await vaultFor(req, res, "write");
    const day = await obsidianService.resolveDailyDate(executor, date);
    await requireNoteAccess(req, res, vault.path, `Daily/${day}.md`, "write");
    const result = await obsidianService.dailyNote(executor, vault, content, day);
    res.json({ ok: true, data: result });
  }),

  today: asyncHandler(async (req: Request, res: Response) => {
    const { executor, vault } = await vaultFor(req, res, "read");
    const date = await obsidianService.resolveDailyDate(executor);
    const path = `Daily/${date}.md`;
    const physical = await requireNoteAccess(req, res, vault.path, path, "read");
    let note: { path: string; content: string } | null = null;
    try {
      note = await obsidianService.readNote(executor, vault, path);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
    const exists = note !== null;
    res.json({ ok: true, data: { date, path, exists, content: note?.content ?? "", canWrite: canAccessPath(sessionUser(res), physical.root, "write") && canAccessPath(sessionUser(res), physical.target, "write") } });
  }),

  /** POST /api/obsidian/vaults/:id/note/rename — move/rename inside the vault. */
  renameNote: asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = renameSchema.parse(req.body);
    const { executor, vault } = await vaultFor(req, res, "write");
    await requireNoteAccess(req, res, vault.path, from, "write");
    await requireNoteAccess(req, res, vault.path, to, "write");
    const result = await obsidianService.renameNote(executor, vault, from, to);
    res.json({ ok: true, data: result });
  }),

  /** DELETE /api/obsidian/vaults/:id/note?path=rel — delete one note. */
  deleteNote: asyncHandler(async (req: Request, res: Response) => {
    const { path } = noteParamSchema.parse(req.query);
    const { executor, vault } = await vaultFor(req, res, "write");
    await requireNoteAccess(req, res, vault.path, path, "write");
    await obsidianService.deleteNote(executor, vault, path);
    res.json({ ok: true });
  }),

  /** POST /api/obsidian/vaults/:id/folders — mkdir -p inside the vault. */
  createFolder: asyncHandler(async (req: Request, res: Response) => {
    const { path } = createFolderSchema.parse(req.body);
    const { executor, vault } = await vaultFor(req, res, "write");
    await requireNoteAccess(req, res, vault.path, path, "write");
    const result = await obsidianService.createFolder(executor, vault, path);
    res.json({ ok: true, data: result });
  }),

  /** GET /api/obsidian/vaults/:id/search?q= — literal content search. */
  search: asyncHandler(async (req: Request, res: Response) => {
    const { q } = searchQuerySchema.parse(req.query);
    const { executor, vault } = await vaultFor(req, res, "read");
    const hits = await obsidianService.search(executor, vault, q);
    const user = sessionUser(res);
    res.json({ ok: true, data: hits.filter((hit) => canAccessPath(user, resolveRel(vault.path, hit.path), "read")) });
  }),

  /** GET /api/obsidian/vaults/:id/links?path=rel — outgoing + backlinks. */
  links: asyncHandler(async (req: Request, res: Response) => {
    const { path } = noteParamSchema.parse(req.query);
    const { executor, vault } = await vaultFor(req, res, "read");
    await requireNoteAccess(req, res, vault.path, path, "read");
    const links = await obsidianService.links(executor, vault, path);
    const user = sessionUser(res);
    res.json({ ok: true, data: { ...links, backlinks: links.backlinks.filter((hit) => canAccessPath(user, resolveRel(vault.path, hit.path), "read")) } });
  }),

  /** POST /api/obsidian/vaults/:id/assistant-context — seed CLAUDE/AGENTS/GEMINI.md. */
  assistantContext: asyncHandler(async (req: Request, res: Response) => {
    const { overwrite } = assistantContextSchema.parse(req.body ?? {});
    const { executor, vault } = await vaultFor(req, res, "write");
    const result = await obsidianService.writeAssistantContext(executor, vault, overwrite);
    res.json({ ok: true, data: result });
  }),

  /** GET /api/obsidian/containers — registered context containers. */
  listContainers: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const data = await contextContainerService.listContainers(executor);
    res.json({ ok: true, data });
  }),

  /**
   * POST /api/obsidian/containers/sync — back-fill a context container for
   * every git repo, assistant project and loose chat that doesn't have one.
   * Idempotent.
   */
  syncContainers: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const summary = await contextContainerService.syncAll(executor, { includeChats: true });
    res.json({ ok: true, data: summary });
  }),
};
