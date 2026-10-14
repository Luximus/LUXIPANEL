// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared i18n helpers for the DataTable config builders. Every
 * `*-table-config.ts` takes a translated namespace subtree and falls back to
 * Spanish per-key so a table never renders empty if a key is missing. The
 * `Dict`/`pick` pair used to be re-declared verbatim in ~12 files; it lives
 * here now as the single source of truth.
 */

/**
 * A flat i18n string map (a namespace subtree). Values are `unknown` so the
 * same helper covers both strict `Record<string, string>` subtrees and looser
 * ones (some namespaces nest objects alongside strings).
 */
export type Dict = Record<string, unknown>;

/** Returns `dict[key]` when it is a string, otherwise the Spanish `fallback`. */
export const pick = (dict: Dict | undefined, key: string, fallback: string): string =>
  dict && typeof dict[key] === "string" ? (dict[key] as string) : fallback;

/**
 * Shape of a module's `*TableMessages` prop (E-07): a bag of OPTIONAL namespace
 * subtrees keyed by the sub-namespaces that module's builders read. Six configs
 * re-declared this same `{ …?: Dict }` object type by hand.
 *
 *   export type CloudflareTableMessages = TableMessages<"dns" | "access" | "common">;
 */
export type TableMessages<Section extends string> = Partial<Record<Section, Dict>>;
