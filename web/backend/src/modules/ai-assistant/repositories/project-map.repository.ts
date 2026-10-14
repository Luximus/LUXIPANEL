// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-server cache of generated project maps. Stored as a sidecar under
 * LUXIPANEL_CONFIG_DIR on the connected server (module "assistant",
 * collection "project-maps"), keyed by a slug of the absolute project path, so
 * reopening the map is instant and only "Regenerate" spends tokens again.
 */

import { createHash } from "node:crypto";
import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { ProjectMap } from "../services/project-map/project-map.service.js";
import { apiLocale, type ApiLocale } from "../../../shared/i18n/errors.js";

const MODULE = "assistant";
const COLLECTION = "project-maps";

export interface ProjectMapDoc {
  id?: string;
  /** Absolute project path on the connected server. */
  path: string;
  locale?: ApiLocale;
  map: ProjectMap;
  createdAt?: string;
  updatedAt?: string;
}

/** Stable, filesystem-safe id for a project path. */
export function pathSlug(absPath: string, locale?: ApiLocale): string {
  return createHash("sha1").update(locale ? `${locale}\0${absPath}` : absPath).digest("hex").slice(0, 24);
}

const store = makeKvStore<ProjectMapDoc>({ module: MODULE, collection: COLLECTION, idStrategy: "uuid" });

export const projectMapRepository = {
  async get(executor: Executor, absPath: string, requestedLocale: unknown): Promise<ProjectMapDoc | null> {
    const locale = apiLocale(requestedLocale);
    const scoped = await store(executor).get(pathSlug(absPath, locale));
    if (scoped) return scoped;
    // Before locale-aware caching, maps were always generated in Spanish.
    return locale === "es" ? store(executor).get(pathSlug(absPath)) : null;
  },

  async save(executor: Executor, absPath: string, map: ProjectMap, requestedLocale: unknown): Promise<ProjectMapDoc> {
    const locale = apiLocale(requestedLocale);
    return store(executor).set(pathSlug(absPath, locale), { path: absPath, locale, map });
  },

  /** All cached maps whose path is a strict descendant of `absPath` (its
   *  subfolders), so a parent generation can reuse the children it already has. */
  async listUnder(executor: Executor, absPath: string, requestedLocale: unknown): Promise<ProjectMapDoc[]> {
    const prefix = absPath.endsWith("/") ? absPath : `${absPath}/`;
    const locale = apiLocale(requestedLocale);
    const all = await store(executor).list();
    const byPath = new Map<string, ProjectMapDoc>();
    for (const doc of all) {
      if (typeof doc.path !== "string" || !doc.path.startsWith(prefix)) continue;
      if (doc.locale !== locale && !(locale === "es" && doc.locale == null)) continue;
      if (!byPath.has(doc.path) || doc.locale === locale) byPath.set(doc.path, doc);
    }
    return [...byPath.values()];
  },
};
