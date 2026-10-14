// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Terminal snippets repository — file-backed via dataStore.
 *   ${LUXIPANEL_CONFIG_DIR}/terminal/categories.json
 *   ${LUXIPANEL_CONFIG_DIR}/terminal/tags.json
 *   ${LUXIPANEL_CONFIG_DIR}/terminal/snippets.json (each snippet stores tagIds[])
 *
 * Per-user isolation: every doc carries a `userId` and every read filters by it
 * (`getState`/`query`), every mutation goes through `assertOwned` first. Unlike
 * `cli-state.repository` (which partitions the COLLECTION by `-u${uid}`), the
 * snippet stores keep ALL users' docs in one collection scoped by the `userId`
 * field. Switching to per-user collections would orphan every existing seeded
 * library (the data lives in the shared `*.json`) and trigger a re-seed into the
 * new partition; that migration is intentionally deferred. The field filter +
 * `assertOwned` already enforce ownership; the cascade deletes below are atomic
 * (one transaction per store) so they don't pay O(N) serial SFTP round-trips.
 * TODO(migration): if collection-level partitioning is desired, migrate the
 * existing shared sidecars into `-u${uid}` collections first.
 */

import { dataStore, type DataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { ConflictError, NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import type {
  TerminalSnippet,
  TerminalSnippetCategory,
  TerminalSnippetTag,
} from "../models/snippets.model.js";
import { DEFAULT_SNIPPET_GROUPS } from "./snippet-defaults.js";

const MODULE = "terminal";

interface StoredCategory {
  id: number;
  userId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredTag {
  id: number;
  userId: number;
  categoryId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredSnippet {
  id: number;
  userId: number;
  categoryId: number;
  name: string;
  command: string;
  tagIds: number[];
  createdAt: string;
  updatedAt: string;
}

function categoriesStore(executor?: Executor | null) {
  return dataStore<StoredCategory>(executor, MODULE, "categories");
}
function tagsStore(executor?: Executor | null) {
  return dataStore<StoredTag>(executor, MODULE, "tags");
}
function snippetsStore(executor?: Executor | null) {
  return dataStore<StoredSnippet>(executor, MODULE, "snippets");
}

/** Bump when NEW default groups are added to `DEFAULT_SNIPPET_GROUPS`: users
 *  whose recorded version is older get the (idempotent) seeder re-run ONCE, so
 *  existing installations receive the new category without resurrecting
 *  defaults they deleted afterwards. v2 = +"LUXIPANEL" deploy/ops category. */
const SNIPPET_SEED_VERSION = 2;

interface StoredSeedMeta {
  id: number;
  userId: number;
  version: number;
}

function seedMetaStore(executor?: Executor | null) {
  return dataStore<StoredSeedMeta>(executor, MODULE, "snippet-seed-meta");
}

/**
 * Fetch a doc and assert it belongs to `userId`, else `NotFoundError(name)`
 * (missing and not-owned are indistinguishable to the caller, by design).
 */
async function assertOwned<T extends { userId: number }>(
  store: DataStore<T>,
  id: number,
  userId: number,
  name: string,
): Promise<T & { id: string | number }> {
  const doc = await store.get(id);
  if (!doc || doc.userId !== userId) throw new NotFoundError(name);
  return doc;
}

// kv-store always exposes a document's `id` as the (string) map key, but the
// model — and the frontend — treat snippet/category/tag ids as numbers (the
// inline `runSnippet(${id})`/`editSnippet(${id})` handlers emit numeric
// literals and compare with strict `===`). Coerce here so the API contract
// returns numeric ids and those strict comparisons match.
function toNumericId(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function categoryFromStored(d: StoredCategory): TerminalSnippetCategory {
  return {
    id: toNumericId(d.id),
    userId: d.userId,
    name: d.name,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  } as unknown as TerminalSnippetCategory;
}

function tagFromStored(d: StoredTag): TerminalSnippetTag {
  return {
    id: toNumericId(d.id),
    userId: d.userId,
    categoryId: toNumericId(d.categoryId),
    name: d.name,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  } as unknown as TerminalSnippetTag;
}

function snippetFromStored(d: StoredSnippet): TerminalSnippet {
  return {
    id: toNumericId(d.id),
    userId: d.userId,
    categoryId: toNumericId(d.categoryId),
    name: d.name,
    command: d.command,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  } as unknown as TerminalSnippet;
}

export interface SnippetStateItem extends TerminalSnippet {
  tagIds: number[];
}

export interface TerminalSnippetState {
  categories: TerminalSnippetCategory[];
  tags: TerminalSnippetTag[];
  snippets: SnippetStateItem[];
}

export interface SnippetCreateInput {
  name: string;
  categoryId: number;
  command: string;
  tagIds: number[];
}

export interface SnippetUpdateInput extends SnippetCreateInput {}

/** One generated snippet, with tags referenced BY NAME (resolved/created on import). */
export interface SnippetImportItem {
  name: string;
  command: string;
  tags: string[];
}

/** Bulk-import payload: a single target category (by name) + its snippets. */
export interface SnippetImportInput {
  category: string;
  snippets: SnippetImportItem[];
}

export interface SnippetImportResult {
  category: TerminalSnippetCategory;
  created: SnippetStateItem[];
  /** Count of snippets skipped because the name already existed in the category. */
  skipped: number;
}

export const snippetsRepository = {
  async getState(userId: number, executor?: Executor | null): Promise<TerminalSnippetState> {
    let [allCategories, allTags, allSnippets] = await Promise.all([
      categoriesStore(executor).query((d) => d.userId === userId),
      tagsStore(executor).query((d) => d.userId === userId),
      snippetsStore(executor).query((d) => d.userId === userId),
    ]);

    // Primera carga en este servidor (store vacío) → sembrar la librería de
    // snippets por defecto (categorías + tags + comandos de solo lectura).
    // Solo se siembra cuando NO hay nada, así el usuario puede luego
    // editar/borrar/añadir sin que se vuelvan a generar. Reconciliación por
    // VERSIÓN de siembra: si `SNIPPET_SEED_VERSION` avanzó (grupos default
    // nuevos), el seeder idempotente se re-ejecuta UNA vez para este usuario —
    // añade lo que falte sin duplicar ni resucitar borrados posteriores.
    if (executor) {
      const empty = allCategories.length === 0 && allTags.length === 0 && allSnippets.length === 0;
      const meta = empty ? null : await seedMetaStore(executor).find((d) => d.userId === userId);
      if (empty || (meta?.version ?? 1) < SNIPPET_SEED_VERSION) {
        await this.seedDefaults(userId, executor);
        [allCategories, allTags, allSnippets] = await Promise.all([
          categoriesStore(executor).query((d) => d.userId === userId),
          tagsStore(executor).query((d) => d.userId === userId),
          snippetsStore(executor).query((d) => d.userId === userId),
        ]);
      }
    }

    return {
      categories: allCategories
        .map((d) => categoryFromStored(d as unknown as StoredCategory))
        .sort((a, b) => a.name.localeCompare(b.name)),
      tags: allTags
        .map((d) => tagFromStored(d as unknown as StoredTag))
        .sort((a, b) => (a.categoryId - b.categoryId) || a.name.localeCompare(b.name)),
      snippets: allSnippets
        .map((d) => ({
          ...snippetFromStored(d as unknown as StoredSnippet),
          tagIds: ((d as unknown as StoredSnippet).tagIds ?? []).map(toNumericId),
        }))
        .sort((a, b) => (a.categoryId - b.categoryId) || a.name.localeCompare(b.name)),
    };
  },

  /**
   * Seed the default snippet library for `userId` on this server. Idempotent
   * and race-tolerant: writes through the stores directly with find-or-create
   * by name (categories/tags scoped per category, snippets per category+name),
   * so a concurrent first-load can't produce duplicates. Called by `getState`
   * only when the store is empty.
   */
  async seedDefaults(userId: number, executor?: Executor | null): Promise<void> {
    for (const group of DEFAULT_SNIPPET_GROUPS) {
      const catName = group.category.trim();
      let category = await categoriesStore(executor).find(
        (d) => d.userId === userId && d.name === catName,
      );
      if (!category) {
        category = await categoriesStore(executor).create({
          userId,
          name: catName,
          createdAt: "",
          updatedAt: "",
        } as StoredCategory & { id?: string | number });
      }
      const categoryId = toNumericId(category.id);

      const tagIdByName = new Map<string, number>();
      for (const rawTag of group.tags) {
        const name = rawTag.trim();
        let tag = await tagsStore(executor).find(
          (d) => d.userId === userId && toNumericId(d.categoryId) === categoryId && d.name === name,
        );
        if (!tag) {
          tag = await tagsStore(executor).create({
            userId,
            categoryId,
            name,
            createdAt: "",
            updatedAt: "",
          } as StoredTag & { id?: string | number });
        }
        tagIdByName.set(name, toNumericId(tag.id));
      }

      for (const snip of group.snippets) {
        const name = snip.name.trim();
        const exists = await snippetsStore(executor).find(
          (d) => d.userId === userId && toNumericId(d.categoryId) === categoryId && d.name === name,
        );
        if (exists) continue;
        const tagIds = snip.tags
          .map((t) => tagIdByName.get(t.trim()))
          .filter((x): x is number => typeof x === "number");
        await snippetsStore(executor).create({
          userId,
          categoryId,
          name,
          command: snip.command.trim(),
          tagIds,
          createdAt: "",
          updatedAt: "",
        } as StoredSnippet & { id?: string | number });
      }
    }
    // Record the seed version AFTER a full pass: a partial failure leaves the
    // old version so the next getState retries (idempotent), while a recorded
    // version means later user deletions of default items are never re-seeded.
    const meta = await seedMetaStore(executor).find((d) => d.userId === userId);
    if (meta) {
      if ((meta.version ?? 1) < SNIPPET_SEED_VERSION) {
        await seedMetaStore(executor).update(meta.id, { version: SNIPPET_SEED_VERSION });
      }
    } else {
      await seedMetaStore(executor).create({ userId, version: SNIPPET_SEED_VERSION } as StoredSeedMeta & {
        id?: string | number;
      });
    }
  },

  /**
   * Bulk-import generated snippets under ONE category (find-or-create by name),
   * creating any referenced tag (scoped to that category) on the way. Reuses the
   * same race-tolerant find-or-create pattern as `seedDefaults`, and is
   * idempotent per (category, snippet name): a snippet whose name already exists
   * in the category is skipped (counted), never duplicated. Backs the Files
   * module's "Generate terminal snippets from folder" action.
   */
  async importSnippets(
    userId: number,
    input: SnippetImportInput,
    executor?: Executor | null,
  ): Promise<SnippetImportResult> {
    const catName = normalizeName(input.category, "Category");

    let category = await categoriesStore(executor).find(
      (d) => d.userId === userId && d.name === catName,
    );
    if (!category) {
      category = await categoriesStore(executor).create({
        userId,
        name: catName,
        createdAt: "",
        updatedAt: "",
      } as StoredCategory & { id?: string | number });
    }
    const categoryId = toNumericId(category.id);

    // Find-or-create every referenced tag once, up front (deduped by name).
    const wantedTags = new Set<string>();
    for (const snip of input.snippets) {
      for (const raw of snip.tags ?? []) {
        const name = raw.trim();
        if (name) wantedTags.add(name);
      }
    }
    const tagIdByName = new Map<string, number>();
    for (const name of wantedTags) {
      let tag = await tagsStore(executor).find(
        (d) => d.userId === userId && toNumericId(d.categoryId) === categoryId && d.name === name,
      );
      if (!tag) {
        tag = await tagsStore(executor).create({
          userId,
          categoryId,
          name,
          createdAt: "",
          updatedAt: "",
        } as StoredTag & { id?: string | number });
      }
      tagIdByName.set(name, toNumericId(tag.id));
    }

    const created: SnippetStateItem[] = [];
    let skipped = 0;
    for (const snip of input.snippets) {
      const name = normalizeName(snip.name, "Snippet");
      const command = normalizeCommand(snip.command);
      const exists = await snippetsStore(executor).find(
        (d) => d.userId === userId && toNumericId(d.categoryId) === categoryId && d.name === name,
      );
      if (exists) {
        skipped += 1;
        continue;
      }
      const tagIds = (snip.tags ?? [])
        .map((tname) => tagIdByName.get(tname.trim()))
        .filter((x): x is number => typeof x === "number");
      const doc = await snippetsStore(executor).create({
        userId,
        categoryId,
        name,
        command,
        tagIds,
        createdAt: "",
        updatedAt: "",
      } as StoredSnippet & { id?: string | number });
      created.push({ ...snippetFromStored(doc as unknown as StoredSnippet), tagIds });
    }

    return {
      category: categoryFromStored(category as unknown as StoredCategory),
      created,
      skipped,
    };
  },

  async createCategory(userId: number, name: string, executor?: Executor | null): Promise<TerminalSnippetCategory> {
    const normalized = normalizeName(name, "Category");
    const dup = await categoriesStore(executor).find((d) => d.userId === userId && d.name === normalized);
    if (dup) throw new ConflictError(`Category "${normalized}" already exists`);

    const created = await categoriesStore(executor).create({
      userId,
      name: normalized,
      createdAt: "",
      updatedAt: "",
    } as StoredCategory & { id?: string | number });
    return categoryFromStored(created as unknown as StoredCategory);
  },

  async updateCategory(userId: number, id: number, name: string, executor?: Executor | null): Promise<TerminalSnippetCategory> {
    const normalized = normalizeName(name, "Category");
    await assertOwned(categoriesStore(executor), id, userId, "Category");

    const dup = await categoriesStore(executor).find(
      (d) => d.userId === userId && d.name === normalized && d.id !== id,
    );
    if (dup) throw new ConflictError(`Category "${normalized}" already exists`);

    const updated = await categoriesStore(executor).update(id, { name: normalized });
    return categoryFromStored(updated as unknown as StoredCategory);
  },

  async deleteCategory(userId: number, id: number, executor?: Executor | null): Promise<void> {
    await assertOwned(categoriesStore(executor), id, userId, "Category");

    // Cascade: drop all of THIS user's tags and snippets in the category in a
    // single atomic read-modify-write per store, instead of O(N) serial SFTP
    // deletes (each of which rewrote the whole map). The transaction reads the
    // map once, removes the matching docs, and writes once.
    await tagsStore(executor).transaction(async (current) => {
      const next: typeof current = {};
      for (const [key, doc] of Object.entries(current)) {
        if (!(doc.userId === userId && doc.categoryId === id)) next[key] = doc;
      }
      return { next, result: undefined };
    });
    await snippetsStore(executor).transaction(async (current) => {
      const next: typeof current = {};
      for (const [key, doc] of Object.entries(current)) {
        if (!(doc.userId === userId && doc.categoryId === id)) next[key] = doc;
      }
      return { next, result: undefined };
    });

    await categoriesStore(executor).delete(id);
  },

  async createTag(userId: number, categoryId: number, name: string, executor?: Executor | null): Promise<TerminalSnippetTag> {
    const normalized = normalizeName(name, "Tag");
    await assertOwned(categoriesStore(executor), categoryId, userId, "Category");

    const dup = await tagsStore(executor).find(
      (d) => d.userId === userId && d.categoryId === categoryId && d.name === normalized,
    );
    if (dup) throw new ConflictError(`Tag "${normalized}" already exists`);

    const created = await tagsStore(executor).create({
      userId,
      categoryId,
      name: normalized,
      createdAt: "",
      updatedAt: "",
    } as StoredTag & { id?: string | number });
    return tagFromStored(created as unknown as StoredTag);
  },

  async updateTag(userId: number, id: number, categoryId: number, name: string, executor?: Executor | null): Promise<TerminalSnippetTag> {
    const normalized = normalizeName(name, "Tag");
    await assertOwned(tagsStore(executor), id, userId, "Tag");
    await assertOwned(categoriesStore(executor), categoryId, userId, "Category");

    const dup = await tagsStore(executor).find(
      (d) => d.userId === userId && d.categoryId === categoryId && d.name === normalized && d.id !== id,
    );
    if (dup) throw new ConflictError(`Tag "${normalized}" already exists`);

    const updated = await tagsStore(executor).update(id, { categoryId, name: normalized });
    return tagFromStored(updated as unknown as StoredTag);
  },

  async deleteTag(userId: number, id: number, executor?: Executor | null): Promise<void> {
    await assertOwned(tagsStore(executor), id, userId, "Tag");

    // Remove the tag id from any of THIS user's snippets that reference it in a
    // single atomic read-modify-write, instead of one SFTP update per snippet
    // (each of which re-read and rewrote the whole map).
    await snippetsStore(executor).transaction(async (current) => {
      const next: typeof current = { ...current };
      for (const [key, doc] of Object.entries(current)) {
        if (doc.userId === userId && Array.isArray(doc.tagIds) && doc.tagIds.includes(id)) {
          next[key] = { ...doc, tagIds: doc.tagIds.filter((t) => t !== id) };
        }
      }
      return { next, result: undefined };
    });

    await tagsStore(executor).delete(id);
  },

  async createSnippet(userId: number, input: SnippetCreateInput, executor?: Executor | null): Promise<SnippetStateItem> {
    const normalizedName = normalizeName(input.name, "Snippet");
    const command = normalizeCommand(input.command);
    await assertOwned(categoriesStore(executor), input.categoryId, userId, "Category");

    const tagIds = await this.resolveTagIds(userId, input.categoryId, input.tagIds, executor);

    const created = await snippetsStore(executor).create({
      userId,
      categoryId: input.categoryId,
      name: normalizedName,
      command,
      tagIds,
      createdAt: "",
      updatedAt: "",
    } as StoredSnippet & { id?: string | number });

    return { ...snippetFromStored(created as unknown as StoredSnippet), tagIds };
  },

  async updateSnippet(userId: number, id: number, input: SnippetUpdateInput, executor?: Executor | null): Promise<SnippetStateItem> {
    const normalizedName = normalizeName(input.name, "Snippet");
    const command = normalizeCommand(input.command);
    await assertOwned(snippetsStore(executor), id, userId, "Snippet");
    await assertOwned(categoriesStore(executor), input.categoryId, userId, "Category");

    const tagIds = await this.resolveTagIds(userId, input.categoryId, input.tagIds, executor);

    const updated = await snippetsStore(executor).update(id, {
      categoryId: input.categoryId,
      name: normalizedName,
      command,
      tagIds,
    });

    return { ...snippetFromStored(updated as unknown as StoredSnippet), tagIds };
  },

  async deleteSnippet(userId: number, id: number, executor?: Executor | null): Promise<void> {
    await assertOwned(snippetsStore(executor), id, userId, "Snippet");
    await snippetsStore(executor).delete(id);
  },

  async resolveTagIds(userId: number, categoryId: number, tagIds: number[], executor?: Executor | null): Promise<number[]> {
    const unique = Array.from(new Set(tagIds));
    if (unique.length === 0) return [];

    const inCat = await tagsStore(executor).query(
      (d) => d.userId === userId && d.categoryId === categoryId && unique.includes(toNumericId(d.id)),
    );
    if (inCat.length !== unique.length) {
      throw new ValidationError("One or more tags are invalid for the selected category");
    }
    return inCat.map((t) => toNumericId(t.id));
  },
};

function normalizeName(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ValidationError(`${label} name is required`);
  return normalized;
}

function normalizeCommand(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ValidationError("Command is required");
  return normalized;
}
