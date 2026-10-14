/**
 * Capa de API de "Pagos" (desembolso de tokens → USD) para la app móvil.
 *
 * Todos los endpoints viven bajo `/portal/payouts/*` (customer-scoped,
 * `requirePortalAuth`) y se consumen con la sesión de portal vigente reusando
 * el helper `request` de `./client`. DTOs según PAYOUTS_CONTRACT.md.
 */
import { request } from "./client";

// ── DTOs (forma estable del contrato) ─────────────────────────────
export type PayoutBalance = {
  available: number;
  earned: number;
  pendingPayout: number;
};

export type PayoutConfig = {
  tokenUsdRate: number;
  minTokens: number;
  currency: "USD";
  balance: PayoutBalance;
};

export type PayoutMethodType = "paypal" | "bank" | "wompi" | "binance" | "other";

export type PayoutMethodDTO = {
  id: string;
  type: string;
  label: string;
  mask: Record<string, string>;
  isDefault: boolean;
  status: "active" | "archived";
  createdAt: string;
};

export type PayoutRequestStatus = "requested" | "approved" | "rejected" | "paid";

export type PayoutRequestDTO = {
  id: string;
  amountTokens: number;
  amountUsd: number;
  currency: "USD";
  rate: number;
  status: PayoutRequestStatus;
  methodLabel: string | null;
  rejectionReason: string | null;
  requestedAt: string;
  decidedAt: string | null;
  paidAt: string | null;
};

export type PayoutQuote = { tokens: number; usd: number; rate: number };

// ── Config / overview ─────────────────────────────────────────────
export async function getPayoutConfig(token: string): Promise<PayoutConfig> {
  const res = await request<{ ok: boolean; data: PayoutConfig }>("/portal/payouts/config", token);
  return res.data;
}

// ── Métodos de desembolso ─────────────────────────────────────────
export async function getPayoutMethods(token: string): Promise<PayoutMethodDTO[]> {
  const res = await request<{ ok: boolean; data: PayoutMethodDTO[] }>("/portal/payouts/methods", token);
  return res.data ?? [];
}

export type CreatePayoutMethodInput = {
  type: PayoutMethodType;
  label: string;
  details: Record<string, unknown>;
  isDefault?: boolean;
};

export async function createPayoutMethod(token: string, input: CreatePayoutMethodInput): Promise<PayoutMethodDTO> {
  const res = await request<{ ok: boolean; data: PayoutMethodDTO }>("/portal/payouts/methods", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export type UpdatePayoutMethodInput = {
  label?: string;
  details?: Record<string, unknown>;
  isDefault?: boolean;
};

export async function updatePayoutMethod(
  token: string,
  id: string,
  input: UpdatePayoutMethodInput,
): Promise<PayoutMethodDTO> {
  const res = await request<{ ok: boolean; data: PayoutMethodDTO }>(
    `/portal/payouts/methods/${encodeURIComponent(id)}`,
    token,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return res.data;
}

export async function deletePayoutMethod(token: string, id: string): Promise<void> {
  await request<{ ok: boolean }>(`/portal/payouts/methods/${encodeURIComponent(id)}`, token, {
    method: "DELETE",
  });
}

// ── Solicitud y seguimiento ───────────────────────────────────────
export async function requestPayout(
  token: string,
  input: { methodId: string; amountTokens: number },
): Promise<PayoutRequestDTO> {
  const res = await request<{ ok: boolean; data: PayoutRequestDTO }>("/portal/payouts/request", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function getPayoutRequests(token: string): Promise<PayoutRequestDTO[]> {
  const res = await request<{ ok: boolean; data: PayoutRequestDTO[] }>("/portal/payouts/requests", token);
  return res.data ?? [];
}

// ── Conversor (opcional; el cliente también calcula localmente) ────
export async function getPayoutQuote(token: string, tokens: number): Promise<PayoutQuote> {
  const res = await request<{ ok: boolean; data: PayoutQuote }>(
    `/portal/payouts/quote?tokens=${encodeURIComponent(String(tokens))}`,
    token,
  );
  return res.data;
}

/** usd = floor(tokens * rate * 100) / 100. Espejo exacto del cálculo backend. */
export function tokensToUsd(tokens: number, rate: number): number {
  if (!Number.isFinite(tokens) || !Number.isFinite(rate) || tokens <= 0 || rate <= 0) return 0;
  return Math.floor(tokens * rate * 100) / 100;
}
