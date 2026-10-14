/**
 * Capa de API del nuevo modelo de facturación: wallet de datos (MB),
 * wallet de tokens (marketplace), catálogo de módulos y portal de developer.
 *
 * Todos estos endpoints viven bajo `/portal/*` (espejo de customer-api) y se
 * consumen con la sesión de portal vigente — reusa el helper `request` de
 * `./client`.
 */
import { request } from "./client";
import { requestWithPlayIntegrity } from "../integrity";
import { createRequestCache } from "../lib/request-cache";

// ── Caché de saldos (TTL corto + single-flight) ─────────────────────────────
// En el arranque piden el saldo A LA VEZ: el controller de cada pestaña (gate de
// datos), el DashboardScreen (chip MB), el ProfileTab y el modal de Pagos → 4+
// peticiones idénticas. El TTL es CORTO a propósito: el saldo BAJA al consumir
// (sondeo de métricas) y el sondeo periódico va a 30s, así que 5s solo colapsa
// la ráfaga simultánea sin poder mostrar un saldo viejo. Tras una COMPRA se
// invalida explícitamente (`invalidateBillingCache`) para que el saldo nuevo
// aparezca al instante.
const billingCache = createRequestCache();
const WALLET_TTL_MS = 5_000;
const PACKS_TTL_MS = 300_000;

/** Tira los saldos cacheados (tras una compra acreditada / checkout). */
export function invalidateBillingCache(): void {
  billingCache.clear();
}

// ── Entitlement de desbloqueo de la app (suscripción anual "app-unlock") ─────
export type AppUnlockEntitlement = {
  /** true mientras la suscripción anual esté vigente. */
  appUnlocked: boolean;
  /** ISO de vencimiento de la suscripción (null si nunca se compró / no aplica). */
  appUnlockedUntil: string | null;
};

/**
 * Estado de la suscripción anual que DESBLOQUEA conectar servidores en la app.
 * Requiere sesión de portal. Se consulta al abrir el gestor de servidores y al
 * arrancar para gatear el alta/conexión de servidores standalone.
 */
export async function getAppUnlockEntitlement(token: string): Promise<AppUnlockEntitlement> {
  const res = await request<{ ok: boolean; data: AppUnlockEntitlement }>(
    "/portal/payments/entitlement",
    token,
  );
  return {
    appUnlocked: Boolean(res.data?.appUnlocked),
    appUnlockedUntil: res.data?.appUnlockedUntil ?? null,
  };
}

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
  /** Play "Product ID" (separador "_") = id registrado en la tienda; el IAP
   *  consulta/compra/empareja por aquí. Alias de playStoreSku/appleStoreSku. */
  productId?: string | null;
  /** Play "Purchase option ID" (separador "-"). */
  purchaseOptionId?: string | null;
  tags?: string[];
};

// ── Tokens ────────────────────────────────────────────────────────
export function getTokenBalance(token: string, opts?: { force?: boolean }): Promise<TokenBalance> {
  return billingCache.fetch(`tokens|${token}`, async () => {
    const res = await request<{ ok: boolean; tokens: TokenBalance }>("/portal/tokens", token);
    return res.tokens;
  }, { ttlMs: WALLET_TTL_MS, force: opts?.force });
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
// cobra el USD/COP ya descontado. Aplicamos el mismo descuento para la UI y
// conservamos el base para el tachado. En móvil el descuento es 0 (el precio lo
// fija el SKU de tienda), así que es un no-op.
type TokenPackRow = Omit<TokenPack, "amountCop" | "amountUsd" | "baseAmountCop" | "baseAmountUsd" | "discountPercent"> & {
  amountCop: number | null;
  amountUsd: number | null;
  discountPercent?: number | null;
};

export function getTokenPacks(
  token: string,
  channel: "web" | "mobile" | "all",
  opts?: { force?: boolean },
): Promise<TokenPack[]> {
  // Catálogo (no saldo): estático dentro de la sesión. Lo piden a la vez el
  // arranque IAP del controller y el modal de Pagos.
  return billingCache.fetch(
    `packs|${channel}|${token}`,
    () => fetchTokenPacks(token, channel),
    { ttlMs: PACKS_TTL_MS, force: opts?.force },
  );
}

async function fetchTokenPacks(token: string, channel: "web" | "mobile" | "all"): Promise<TokenPack[]> {
  const res = await request<{ ok: boolean; packs: TokenPackRow[] }>(
    `/portal/tokens/packs?channel=${encodeURIComponent(channel)}`,
    token,
  );
  const packs = (res.packs ?? []).map((p): TokenPack => {
    const discountPercent = Math.min(100, Math.max(0, Math.round(Number(p.discountPercent) || 0)));
    const baseAmountUsd = typeof p.amountUsd === "number" ? p.amountUsd : null;
    const baseAmountCop = typeof p.amountCop === "number" ? p.amountCop : null;
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
  const res = await request<{ ok: boolean; checkout: unknown }>("/portal/tokens/checkout", token, {
    method: "POST",
    body: JSON.stringify({ packId }),
  });
  invalidateBillingCache(); // el saldo puede acreditarse tras el checkout
  return res;
}

export type TokenIapPayload =
  | { platform: "apple"; productId: string; receipt: string; transactionId: string }
  | { platform: "google"; productId: string; packageName: string; purchaseToken: string; productToken?: string };

export async function verifyTokenIap(token: string, payload: TokenIapPayload): Promise<{ paymentId: string }> {
  // Protected action: iap.tokens.verify (POST /portal/tokens/iap/verify).
  // payloadRelevantForHash = the full IAP payload (platform + productId + the
  // store-specific purchase tokens). Every field selects WHICH purchase is being
  // credited to the token wallet, so the integrity token is bound to all of them
  // to prevent replay against a different purchase. No session-auth fields here.
  const res = await requestWithPlayIntegrity<{ ok: boolean; paymentId: string }>({
    action: "iap.tokens.verify",
    payloadRelevantForHash: payload,
    run: (headers) =>
      request<{ ok: boolean; paymentId: string }>("/portal/tokens/iap/verify", token, {
        method: "POST",
        body: JSON.stringify(payload),
        headers,
      }),
  });
  invalidateBillingCache(); // compra acreditada → el saldo cacheado ya no vale
  return res;
}
