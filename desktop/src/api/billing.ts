/**
 * Capa de API del nuevo modelo de facturación: wallet de datos (MB),
 * wallet de tokens (marketplace), catálogo de módulos y portal de developer.
 *
 * Todos estos endpoints viven bajo `/portal/*` (espejo de customer-api) y se
 * consumen con la sesión de portal vigente — reusa el helper `request` de
 * `./client`.
 */
import { request } from "./client";

// ── Wallet de tokens (marketplace) ────────────────────────────────
export type TokenBalance = {
  available: number;
  earned: number;
  pendingPayout: number;
  usdPerToken: number;
  availableUsd: number;
  earnedUsd: number;
};

export type TokenLedgerEntry = {
  id: string;
  type: string;
  amount: number;
  bucket: string;
  balanceAfter: number;
  moduleId: string | null;
  billingPeriod: string | null;
  createdAt: string;
};

export type TokenPack = {
  id: string;
  sku: string;
  name: string;
  tokenAmount: number;
  amountCop: number | null;      // precio final tras descuento (lo que cobra la pasarela)
  amountUsd: number | null;      // precio final en USD tras descuento
  baseAmountCop: number | null;  // precio COP antes del descuento (para tachado)
  baseAmountUsd: number | null;  // precio USD antes del descuento (para tachado)
  discountPercent: number;
  channel: string;
  /** SKUs de tienda para IAP móvil (null en packs solo-web). */
  playStoreSku?: string | null;
  appleStoreSku?: string | null;
};

// ── Planes Luxipanel (catálogo público de productos) ──────────────
// Espejo del componente de planes del frontend (`frontend/src/lib/
// luxipanel-plans.ts`): carga `/public/luxipanel-plans`, aplica el descuento
// (precio base → precio final), marca "gratis" y ordena por categoría/precio,
// para que el escritorio cargue los productos igual que la web.
export type PlanCard = {
  id: string;             // productId (UUID) — usado por purchasePlan/checkout
  sku: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  tier: string | null;
  packageTier: string | null;
  validityMonths: number;
  numKeys: number;
  amountUsd: number;      // precio final en USD tras descuento (lo que cobra la pasarela)
  baseAmountUsd: number;  // precio USD antes del descuento (para tachado)
  amountCop: number;      // precio final tras descuento
  basePriceCop: number;   // precio antes del descuento
  discountPercent: number;
  trialDays: number;
  isFree: boolean;
};

type LuxipanelPlanRow = {
  id?: string | null;
  sku?: string | null;
  tier?: string | null;
  packageTier?: string | null;
  amountCop?: number | null;
  amountUsd?: number | null;
  numKeys?: number | null;
  discountPercent?: number | null;
  name?: string | null;
  description?: string | null;
  validityMonths?: number | null;
  trialDays?: number | null;
  logoUrl?: string | null;
};

// Orden de las categorías comerciales (define el orden de las tarjetas).
const PACKAGE_TIER_ORDER = ["entrepreneur", "business", "enterprise", "corporation"] as const;

function packageTierRank(packageTier: string | null | undefined): number {
  const idx = PACKAGE_TIER_ORDER.indexOf((packageTier ?? "") as (typeof PACKAGE_TIER_ORDER)[number]);
  return idx >= 0 ? idx + 1 : 0;
}

// Solo URLs absolutas http(s); cualquier otra cosa se descarta para no pintar
// imágenes rotas en la tarjeta.
function normalizeLogoUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function clampDiscount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return Math.round(value);
}

function applyDiscount(amount: number, percent: number): number {
  if (percent <= 0) return amount;
  return Math.round(amount * (1 - percent / 100));
}

export async function getLuxipanelPlans(token: string): Promise<PlanCard[]> {
  const data = await request<{ ok?: boolean; plans?: LuxipanelPlanRow[] }>("/public/luxipanel-plans", token);
  const rows = Array.isArray(data.plans) ? data.plans : [];
  const cards = rows
    .filter((row) => {
      const id = typeof row.id === "string" && row.id.trim();
      const amountCop = row.amountCop ?? null;
      return id && typeof amountCop === "number" && Number.isFinite(amountCop) && amountCop >= 0;
    })
    .map((row): PlanCard => {
      const basePriceCop = row.amountCop ?? 0;
      const discountPercent = clampDiscount(row.discountPercent);
      const amountCop = applyDiscount(basePriceCop, discountPercent);
      const numKeys =
        typeof row.numKeys === "number" && Number.isFinite(row.numKeys) && row.numKeys > 0 ? Math.floor(row.numKeys) : 1;
      const validityMonths =
        typeof row.validityMonths === "number" && Number.isFinite(row.validityMonths) && row.validityMonths > 0
          ? Math.floor(row.validityMonths)
          : 1;
      const trialDays =
        typeof row.trialDays === "number" && Number.isFinite(row.trialDays) && row.trialDays > 0 ? Math.floor(row.trialDays) : 0;
      const baseAmountUsd =
        typeof row.amountUsd === "number" && Number.isFinite(row.amountUsd) && row.amountUsd >= 0 ? row.amountUsd : 0;
      // El USD es la fuente de verdad y la pasarela cobra el USD ya descontado
      // (wompi.service.ts). Sin redondear: el USD lleva decimales (≠ COP en pesos).
      const amountUsd = discountPercent > 0 ? baseAmountUsd * (1 - discountPercent / 100) : baseAmountUsd;
      return {
        id: (row.id ?? "").trim(),
        sku: (row.sku ?? "").trim(),
        name: (row.name ?? "").trim(),
        description: typeof row.description === "string" ? row.description.trim() || null : null,
        logoUrl: normalizeLogoUrl(row.logoUrl),
        tier: row.tier ?? null,
        packageTier: row.packageTier ?? null,
        validityMonths,
        numKeys,
        amountUsd,
        baseAmountUsd,
        amountCop,
        basePriceCop,
        discountPercent,
        trialDays,
        isFree: amountCop === 0,
      };
    });

  // Ordenar por PRECIO ascendente: el más barato primero, el más caro al final
  // (USD es la fuente de verdad; COP y la categoría comercial solo desempatan).
  cards.sort(
    (a, b) =>
      a.amountUsd - b.amountUsd ||
      a.amountCop - b.amountCop ||
      (packageTierRank(a.packageTier) || 99) - (packageTierRank(b.packageTier) || 99),
  );
  return cards;
}

// ── Tokens ────────────────────────────────────────────────────────
export async function getTokenBalance(token: string): Promise<TokenBalance> {
  const res = await request<{ ok: boolean; tokens: TokenBalance }>("/portal/tokens", token);
  return res.tokens;
}

export async function getTokenLedger(
  token: string,
  params?: { limit?: number; offset?: number },
): Promise<TokenLedgerEntry[]> {
  const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : "";
  const res = await request<{ ok: boolean; ledger: TokenLedgerEntry[] }>(
    `/portal/tokens/ledger${qs ? `?${qs}` : ""}`,
    token,
  );
  return res.ledger ?? [];
}

// El backend devuelve precios BASE + `discountPercent`; el checkout (pasarela)
// cobra el USD/COP ya descontado. Aquí aplicamos el mismo descuento para que la
// UI muestre el precio final, conservando el base para el tachado.
type TokenPackRow = Omit<TokenPack, "amountCop" | "amountUsd" | "baseAmountCop" | "baseAmountUsd" | "discountPercent"> & {
  amountCop: number | null;
  amountUsd: number | null;
  discountPercent?: number | null;
};

export async function getTokenPacks(token: string, channel: "web" | "mobile" | "all"): Promise<TokenPack[]> {
  const res = await request<{ ok: boolean; packs: TokenPackRow[] }>(
    `/portal/tokens/packs?channel=${encodeURIComponent(channel)}`,
    token,
  );
  const packs = (res.packs ?? []).map((p): TokenPack => {
    const discountPercent = clampDiscount(p.discountPercent);
    const baseAmountUsd = typeof p.amountUsd === "number" ? p.amountUsd : null;
    const baseAmountCop = typeof p.amountCop === "number" ? p.amountCop : null;
    // USD sin redondear (decimales); COP redondeado a pesos.
    const amountUsd = baseAmountUsd != null && discountPercent > 0
      ? baseAmountUsd * (1 - discountPercent / 100)
      : baseAmountUsd;
    const amountCop = baseAmountCop != null && discountPercent > 0
      ? Math.round(baseAmountCop * (1 - discountPercent / 100))
      : baseAmountCop;
    return { ...p, amountUsd, amountCop, baseAmountUsd, baseAmountCop, discountPercent };
  });
  // Precio ascendente: el pack más barato primero, el más caro al final.
  packs.sort(
    (a, b) =>
      (a.amountUsd ?? 0) - (b.amountUsd ?? 0) ||
      (a.amountCop ?? 0) - (b.amountCop ?? 0) ||
      (a.tokenAmount ?? 0) - (b.tokenAmount ?? 0),
  );
  return packs;
}

export async function createTokenCheckout(token: string, packId: string): Promise<{ checkout: unknown }> {
  return request<{ ok: boolean; checkout: unknown }>("/portal/tokens/checkout", token, {
    method: "POST",
    body: JSON.stringify({ packId }),
  });
}

export type PaymentStatus = "pending" | "approved" | "declined" | "voided" | "refunded" | "error";

/** Estado real de un pago por su `reference` (GET /checkout/result). Lo usa el
 *  modal de checkout para confirmar si quedó aprobado/rechazado/pendiente tras
 *  volver de Wompi. El crédito lo aplica el webhook async, así que conviene
 *  sondear hasta un estado terminal. */
export async function getPaymentStatus(token: string, reference: string): Promise<PaymentStatus> {
  const res = await request<{ ok?: boolean; status?: string }>(
    `/checkout/result?reference=${encodeURIComponent(reference)}`,
    token,
  );
  const st = res?.status;
  return st === "approved" || st === "declined" || st === "voided" || st === "refunded" || st === "error"
    ? st
    : "pending";
}

export type TokenIapPayload =
  | { platform: "apple"; productId: string; receipt: string; transactionId: string }
  | { platform: "google"; productId: string; packageName: string; purchaseToken: string; productToken?: string };

export async function verifyTokenIap(token: string, payload: TokenIapPayload): Promise<{ paymentId: string }> {
  return request<{ ok: boolean; paymentId: string }>("/portal/tokens/iap/verify", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
