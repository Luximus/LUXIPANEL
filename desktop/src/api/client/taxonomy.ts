import { request } from "./request";

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

export async function getPanelTaxonomy(token: string): Promise<PanelTaxonomy> {
  const data = await request<PanelTaxonomyResponse>("/portal/panel-taxonomy", token);
  return {
    categories: Array.isArray(data?.categories) ? data.categories : [],
  };
}
