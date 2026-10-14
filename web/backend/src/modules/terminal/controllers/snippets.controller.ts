// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Terminal snippets controller — per-user CRUD for categories, tags and snippets.
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { snippetsRepository } from "../repositories/snippets.repository.js";
import type { AuthenticatedLocals } from "../../../shared/types/index.js";
import { ValidationError } from "../../../shared/errors/index.js";

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

const categorySchema = z.object({
  name: z.string().trim().min(1).max(128),
});

const tagCreateSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(128),
});

const tagUpdateSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(128),
});

const snippetSchema = z.object({
  name: z.string().trim().min(1).max(128),
  categoryId: z.coerce.number().int().positive(),
  command: z.string().trim().min(1),
  tagIds: z.array(z.coerce.number().int().positive()).default([]),
});

// Bulk import: a single target category (by name) + snippets whose tags are
// referenced by name (resolved/created server-side). Backs the Files module's
// "Generate terminal snippets from folder" action.
const snippetImportSchema = z.object({
  category: z.string().trim().min(1).max(128),
  snippets: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(128),
        command: z.string().trim().min(1),
        tags: z.array(z.string().trim().min(1).max(128)).default([]),
      }),
    )
    .min(1)
    .max(200),
});

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `${label} validation failed`,
      result.error.issues.map((issue) => ({
        field: issue.path.join(".") || label.toLowerCase(),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

function userId(res: Response<unknown, AuthenticatedLocals>): number {
  return res.locals.user.userId;
}

export const snippetsController = {
  async list(_req: Request, res: Response<unknown, AuthenticatedLocals>) {
    const data = await snippetsRepository.getState(userId(res));
    res.json({ ok: true, data });
  },

  async createCategory(req: Request, res: Response<unknown, AuthenticatedLocals>) {
    const body = parseOrThrow(categorySchema, req.body, "Category");
    const data = await snippetsRepository.createCategory(userId(res), body.name);
    res.status(201).json({ ok: true, data });
  },

  async updateCategory(req: Request, res: Response<unknown, AuthenticatedLocals>) {
    const params = parseOrThrow(idParamSchema, req.params, "Category id");
    const body = parseOrThrow(categorySchema, req.body, "Category");
    const data = await snippetsRepository.updateCategory(userId(res), params.id, body.name);
    res.json({ ok: true, data });
  },

  async deleteCategory(req: Request, res: Response<unknown, AuthenticatedLocals>) {
    const params = parseOrThrow(idParamSchema, req.params, "Category id");
    await snippetsRepository.deleteCategory(userId(res), params.id);
    res.json({ ok: true });
  },

  async createTag(req: Request, res: Response<unknown, AuthenticatedLocals>) {
    const body = parseOrThrow(tagCreateSchema, req.body, "Tag");
    const data = await snippetsRepository.createTag(userId(res), body.categoryId, body.name);
    res.status(201).json({ ok: true, data });
  },

  async updateTag(req: Request, res: Response<unknown, AuthenticatedLocals>) {
    const params = parseOrThrow(idParamSchema, req.params, "Tag id");
    const body = parseOrThrow(tagUpdateSchema, req.body, "Tag");
    const data = await snippetsRepository.updateTag(userId(res), params.id, body.categoryId, body.name);
    res.json({ ok: true, data });
  },

  async deleteTag(req: Request, res: Response<unknown, AuthenticatedLocals>) {
    const params = parseOrThrow(idParamSchema, req.params, "Tag id");
    await snippetsRepository.deleteTag(userId(res), params.id);
    res.json({ ok: true });
  },

  async createSnippet(req: Request, res: Response<unknown, AuthenticatedLocals>) {
    const body = parseOrThrow(snippetSchema, req.body, "Snippet");
    const data = await snippetsRepository.createSnippet(userId(res), {
      ...body,
      tagIds: body.tagIds ?? [],
    });
    res.status(201).json({ ok: true, data });
  },

  async importSnippets(req: Request, res: Response<unknown, AuthenticatedLocals>) {
    const body = parseOrThrow(snippetImportSchema, req.body, "Snippet import");
    const data = await snippetsRepository.importSnippets(userId(res), {
      category: body.category,
      snippets: body.snippets.map((s) => ({ ...s, tags: s.tags ?? [] })),
    });
    res.status(201).json({ ok: true, data });
  },

  async updateSnippet(req: Request, res: Response<unknown, AuthenticatedLocals>) {
    const params = parseOrThrow(idParamSchema, req.params, "Snippet id");
    const body = parseOrThrow(snippetSchema, req.body, "Snippet");
    const data = await snippetsRepository.updateSnippet(userId(res), params.id, {
      ...body,
      tagIds: body.tagIds ?? [],
    });
    res.json({ ok: true, data });
  },

  async deleteSnippet(req: Request, res: Response<unknown, AuthenticatedLocals>) {
    const params = parseOrThrow(idParamSchema, req.params, "Snippet id");
    await snippetsRepository.deleteSnippet(userId(res), params.id);
    res.json({ ok: true });
  },
};
