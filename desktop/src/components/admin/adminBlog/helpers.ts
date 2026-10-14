import type { BlogCategory } from "../../../api/blog";

export type BlogTab = "publish" | "categories" | "tags";
export type FailedField = "title" | "category" | "content" | null;

/** Base pública del blog (mismo host que usa AdminScreen para "Ver público"). */
export const PUBLIC_BLOG_BASE = "https://luxisoft.com";

/** Parte un texto libre de hashtags en una lista limpia: corta por espacios y
 *  comas, quita la # inicial y descarta vacíos/duplicados. */
export function parseHashtags(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const piece of raw.split(/[\s,]+/)) {
    const tag = piece.replace(/^#+/, "").trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** Deriva un slug URL-safe: minúsculas, sin acentos (NFD), separadores a "-",
 *  recorta "-" sobrantes y limita a 80 caracteres. */
export function slugify(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function fmtTokens(n: number): string {
  return new Intl.NumberFormat("es").format(Math.round(n || 0));
}

/** Convención de comparación de categoría activa por nombre. */
export function findCategoryByName(cats: BlogCategory[], name: string): BlogCategory | null {
  return cats.find((c) => c.name === name) ?? null;
}
