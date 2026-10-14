// Vistas admin (consumo de usuarios, pagos globales) + administración de
// categorías/tags de paneles.
import { request } from "./request";

// ─── Consumo de usuarios (vista admin) ────────────────────────────────────
export type AdminConsumptionRow = {
  customerId: string;
  name: string | null;
  email: string | null;
  data: { free: number; paid: number; total: number; consumedMb: number; availableMb: number };
  tokens: number;
  purchases: number;
  spentUsd: number;
};
export type AdminConsumptionTotals = {
  consumedMb: number; availableMb: number; spentUsd: number; tokens: number; purchases: number; users: number;
};

/** Consumo + compras de los usuarios NO admin. Solo responde a cuentas admin. */
export async function getAdminConsumption(
  token: string,
): Promise<{ rows: AdminConsumptionRow[]; totals: AdminConsumptionTotals }> {
  const data = await request<{ ok?: boolean; rows?: AdminConsumptionRow[]; totals?: AdminConsumptionTotals }>(
    "/portal/admin/consumption?page=1&limit=100",
    token,
  );
  return {
    rows: Array.isArray(data.rows) ? data.rows : [],
    totals: data.totals ?? { consumedMb: 0, availableMb: 0, spentUsd: 0, tokens: 0, purchases: 0, users: 0 },
  };
}

export type AdminPaymentRow = {
  id: string;
  reference: string;
  status: string;
  amountUsd: number | null;
  tier: string | null;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  productName: string | null;
};

/** Pagos de TODOS los usuarios (solo admin). Normaliza la forma del backend. */
export async function getAdminPayments(token: string): Promise<AdminPaymentRow[]> {
  const data = await request<{ ok?: boolean; payments?: Array<Record<string, any>> }>(
    "/portal/admin/payments?page=1&limit=500",
    token,
  );
  return (Array.isArray(data.payments) ? data.payments : []).map((p) => ({
    id: String(p.id),
    reference: String(p.reference ?? ""),
    status: String(p.status ?? ""),
    amountUsd: typeof p.amountUsd === "number" ? p.amountUsd : typeof p.amount_usd === "number" ? p.amount_usd : null,
    tier: p.tier ?? null,
    createdAt: String(p.createdAt ?? ""),
    customerName: p.customer?.name ?? null,
    customerEmail: p.customer?.email ?? null,
    productName: p.product?.name ?? null,
  }));
}

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
