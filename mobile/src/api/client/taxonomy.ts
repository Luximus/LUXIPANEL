import { type ReadOptions, readCache, request, TTL } from "./request";

type PanelTaxonomyResponse = {
  categories?: PanelTaxonomy["categories"];
};

export type PanelTaxonomy = {
  categories: Array<{
    id: string;
    name: string;
    tags: Array<{ id: string; name: string }>;
  }>;
};

export function getPanelTaxonomy(token: string, opts?: ReadOptions): Promise<PanelTaxonomy> {
  return readCache.fetch(`taxonomy|${token}`, async () => {
    const data = await request<PanelTaxonomyResponse>("/portal/panel-taxonomy", token);
    return { categories: Array.isArray(data?.categories) ? data.categories : [] };
  }, { ttlMs: TTL.taxonomy, force: opts?.force });
}

/** Tira la taxonomía cacheada (tras crear/renombrar/borrar categorías o etiquetas). */
export function invalidateTaxonomyCache(): void {
  readCache.invalidatePrefix("taxonomy|");
}
