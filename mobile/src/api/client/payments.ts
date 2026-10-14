// Pagos del portal (historial, productos, validación de suscripciones IAP),
// verificación de teléfono por WhatsApp y auditoría del gateway por panel.
import { requestWithPlayIntegrity } from "../../integrity";
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
  amountUsd: number | null;      // precio final tras descuento (lo que cobra la pasarela)
  amountCop: number;             // precio final tras descuento
  baseAmountUsd: number | null;  // precio USD antes del descuento (para tachado)
  baseAmountCop: number;         // precio COP antes del descuento (para tachado)
  discountPercent: number;
  sku: string;
  tier: string | null;
  billingCycle: string;
  validityMonths: number;
  showInApp: boolean;
  showInDesktop: boolean;
  showInPlans: boolean;
  isActive: boolean;
  playStoreSku: string | null;
  appleStoreSku: string | null;
  /** Play "Product ID" (separador "_") = id registrado en Play Store / App Store.
   *  El IAP consulta/compra/empareja por aquí. Alias de playStoreSku/appleStoreSku. */
  productId?: string | null;
  /** Play "Purchase option ID" (separador "-"). */
  purchaseOptionId?: string | null;
  tags?: string[];
};

export async function getPaymentHistory(token: string, params?: { from?: string; to?: string; status?: string; platform?: string }): Promise<PaymentRow[]> {
  const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : "";
  const data = await request<{ ok: boolean; data: PaymentRow[] }>(`/portal/payments/history${qs ? `?${qs}` : ""}`, token);
  return data.data ?? [];
}

export async function getPaymentProducts(token: string, platform: "app" | "desktop" | "web"): Promise<ProductRow[]> {
  // El backend devuelve precios BASE + `discountPercent`; el checkout (pasarela)
  // cobra el USD/COP ya descontado. Aplicamos el mismo descuento para que la UI
  // muestre el precio final, conservando el base para el tachado. En móvil el
  // descuento es 0 (el precio lo fija el SKU de tienda), así que es un no-op.
  type Raw = Omit<ProductRow, "baseAmountUsd" | "baseAmountCop" | "discountPercent"> & {
    discountPercent?: number | null;
  };
  const data = await request<{ ok: boolean; data: Raw[] }>(`/portal/payments/products?platform=${platform}`, token);
  const products = (data.data ?? []).map((r): ProductRow => {
    const discountPercent = Math.min(100, Math.max(0, Math.round(Number(r.discountPercent) || 0)));
    const baseAmountUsd = typeof r.amountUsd === "number" ? r.amountUsd : null;
    const baseAmountCop = typeof r.amountCop === "number" ? r.amountCop : 0;
    const amountUsd = baseAmountUsd != null && discountPercent > 0
      ? baseAmountUsd * (1 - discountPercent / 100)   // USD sin redondear (decimales)
      : baseAmountUsd;
    const amountCop = discountPercent > 0
      ? Math.round(baseAmountCop * (1 - discountPercent / 100))  // COP en pesos
      : baseAmountCop;
    return { ...r, amountUsd, amountCop, baseAmountUsd, baseAmountCop, discountPercent };
  });
  // Precio ascendente: el producto más barato primero, el más caro al final
  // (la tienda muestra los paquetes ordenados por precio, no por categoría).
  products.sort(
    (a, b) =>
      (a.amountUsd ?? 0) - (b.amountUsd ?? 0) ||
      (a.amountCop ?? 0) - (b.amountCop ?? 0),
  );
  return products;
}

// ── Validación de SUSCRIPCIÓN (app-unlock anual, product_kind="license") ──────
// La suscripción anual "app-unlock" se valida contra los endpoints de suscripción
// del backend (Play Developer API / App Store Server API sobre la suscripción).
// El tratamiento IAP sigue siendo NO consumible (acknowledge, no consume).
export async function validatePlaySubscription(token: string, body: { productId: string; packageName: string; purchaseToken: string }): Promise<PaymentRow> {
  // Protected action: iap.playsubscription.validate — el integrity token se
  // vincula a los 3 campos que definen QUÉ suscripción se acredita (productId +
  // packageName + purchaseToken de Play), para impedir replay del token contra
  // otra compra. Ninguno es token de sesión → se hashea tal cual.
  const data = await requestWithPlayIntegrity<{ ok: boolean; data: PaymentRow }>({
    action: "iap.playsubscription.validate",
    payloadRelevantForHash: body,
    run: (headers) =>
      request<{ ok: boolean; data: PaymentRow }>("/portal/payments/validate/play-subscription", token, {
        method: "POST",
        body: JSON.stringify(body),
        headers,
      }),
  });
  return data.data;
}

export async function validateAppleSubscription(token: string, body: { productId: string; receiptData: string }): Promise<PaymentRow> {
  const data = await request<{ ok: boolean; data: PaymentRow }>("/portal/payments/validate/apple-subscription", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.data;
}

// ── Verificación de teléfono por WhatsApp (OTP, estilo luxichat) ──────────
export async function startWhatsappVerification(token: string, phoneE164: string): Promise<{ wa_url: string; expires_at: string; sent: boolean }> {
  const data = await request<{ ok: boolean; data: { wa_url: string; expires_at: string; sent: boolean } }>(
    "/portal/whatsapp/verification/start", token,
    { method: "POST", body: JSON.stringify({ phone_e164: phoneE164 }) },
  );
  return data.data;
}

export async function verifyWhatsappCode(token: string, code: string): Promise<boolean> {
  const data = await request<{ ok: boolean; data: { verified: boolean } }>(
    "/portal/whatsapp/verification/verify", token,
    { method: "POST", body: JSON.stringify({ code }) },
  );
  return Boolean(data.data?.verified);
}

export async function getWhatsappStatus(token: string): Promise<{ whatsapp_verified: boolean; whatsapp_number: string | null }> {
  const data = await request<{ ok: boolean; data: { whatsapp_verified: boolean; whatsapp_number: string | null } }>(
    "/portal/whatsapp/verification/status", token,
  );
  return data.data;
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
