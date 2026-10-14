// Pagos del portal (historial, productos, validación IAP, checkout Wompi) y
// auditoría del gateway SSH por panel — extraído de client.ts.
import { request } from "./request";

export type PaymentRow = {
  id: string;
  reference: string;
  status: string;
  amountUsd: number | null;
  amountCop: number | null;
  tier: string | null;
  billingCycle: string | null;
  purchasePlatform: string | null;
  playStoreId: string | null;
  appleStoreId: string | null;
  createdAt: string;
  expiresAt: string | null;
  product?: { name: string; sku: string; tier: string | null };
};

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  amountUsd: number | null;
  amountCop: number;
  sku: string;
  tier: string | null;
  billingCycle: string;
  validityMonths: number;
  showInApp: boolean;
  showInDesktop: boolean;
  showInPlans: boolean;
  isActive: boolean;
};

export async function getPaymentHistory(token: string, params?: { from?: string; to?: string; status?: string; platform?: string }): Promise<PaymentRow[]> {
  const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : "";
  const data = await request<{ ok: boolean; data: PaymentRow[] }>(`/portal/payments/history${qs ? `?${qs}` : ""}`, token);
  return data.data ?? [];
}

export async function getPaymentProducts(token: string, platform: "app" | "desktop" | "web"): Promise<ProductRow[]> {
  const data = await request<{ ok: boolean; data: ProductRow[] }>(`/portal/payments/products?platform=${platform}`, token);
  return data.data ?? [];
}

export async function validatePlayStorePurchase(token: string, body: { productId: string; packageName: string; purchaseToken: string; productToken: string }): Promise<PaymentRow> {
  const data = await request<{ ok: boolean; data: PaymentRow }>("/portal/payments/validate/play-store", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.data;
}

export async function validateAppleStorePurchase(token: string, body: { productId: string; receiptData: string; transactionId: string }): Promise<PaymentRow> {
  const data = await request<{ ok: boolean; data: PaymentRow }>("/portal/payments/validate/apple-store", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.data;
}

export async function createPortalCheckout(token: string, body: { productId?: string; productSku?: string; tier?: string; billingCycle?: string }): Promise<{ checkoutUrl: string; reference: string; paymentId: string }> {
  const data = await request<{ ok: boolean; checkoutUrl: string; reference: string; paymentId: string }>("/portal/checkout-create", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data;
}

export type ServerAuditEntry = {
  id: string;
  action: string;
  actor: string;
  ip: string | null;
  targetId: string | null;
  meta: unknown;
  createdAt: string;
};

/** Historial de auditoría del gateway SSH para un panel (solo lectura). */
export async function getPanelAudit(token: string, panelId: string, limit = 100): Promise<ServerAuditEntry[]> {
  const data = await request<{ ok: boolean; data: ServerAuditEntry[] }>(
    `/portal/panels/${encodeURIComponent(panelId)}/audit?limit=${limit}`,
    token,
  );
  return data.data ?? [];
}
