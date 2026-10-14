// Mutadores de la taxonomía de paneles (categorías + tags) — extraído de
// client.ts. La lectura (getPanelTaxonomy) vive en `./taxonomy`.
import { request } from "./request";

// ─── Categorías de paneles ───────────────────────────────────────────────
export async function createPanelCategory(name: string, token: string) {
  return request<{ ok: boolean; category?: { id: string; name: string } }>(
    "/portal/panel-categories",
    token,
    { method: "POST", body: JSON.stringify({ name }) },
  );
}

export async function updatePanelCategory(id: string, name: string, token: string) {
  return request<{ ok: boolean }>(`/portal/panel-categories/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function deletePanelCategory(id: string, token: string) {
  return request<{ ok: boolean }>(`/portal/panel-categories/${id}`, token, {
    method: "DELETE",
  });
}

// ─── Tags de paneles ─────────────────────────────────────────────────────
export async function createPanelTag(categoryId: string, name: string, token: string) {
  return request<{ ok: boolean; tag?: { id: string; name: string } }>(
    `/portal/panel-categories/${categoryId}/tags`,
    token,
    { method: "POST", body: JSON.stringify({ name }) },
  );
}

export async function updatePanelTag(id: string, name: string, token: string) {
  return request<{ ok: boolean }>(`/portal/panel-tags/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function deletePanelTag(id: string, token: string) {
  return request<{ ok: boolean }>(`/portal/panel-tags/${id}`, token, {
    method: "DELETE",
  });
}
