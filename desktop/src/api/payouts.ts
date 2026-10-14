/**
 * Capa de API de la feature "Pagos / desembolso de tokens → USD".
 *
 * Endpoints PORTAL (prefijo real `/portal`, sesión de portal como Bearer).
 * Contrato canónico: /var/www/LP-LICENSE-SERVER/PAYOUTS_CONTRACT.md
 *
 * Reusa el helper `request` de `./client` (renovación de sesión + step-up).
 * La tasa es fija por env del backend; el cliente puede calcular el conversor
 * localmente con `tokenUsdRate` (floor a 2 decimales), igual que el backend.
 */
import { request } from "./client";

// ── DTOs (forma estable definida en el contrato) ──────────────────────────

/** Tipos de método de desembolso soportados por el backend. */
export type PayoutMethodType = "paypal" | "bank" | "wompi" | "binance" | "other";

/** Estados posibles de una solicitud de retiro. */
export type PayoutRequestStatus = "requested" | "approved" | "rejected" | "paid";

/** Balance + tasa + mínimos para la pantalla de desembolso. */
export type PayoutConfig = {
  tokenUsdRate: number;
  minTokens: number;
  currency: "USD";
  balance: {
    available: number;
    earned: number;
    pendingPayout: number;
  };
};

export type PayoutMethodDTO = {
  id: string;
  type: PayoutMethodType | string;
  label: string;
  /** Datos no sensibles para mostrar (ej. { email: "j***@x.com", last4: "1234" }). */
  mask: Record<string, string>;
  isDefault: boolean;
  status: "active" | "archived";
  createdAt: string;
};

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

// ── Config / overview ─────────────────────────────────────────────────────

/** GET /portal/payouts/config → tasa, mínimo y balance del usuario. */
export async function getPayoutConfig(token: string): Promise<PayoutConfig> {
  const data = await request<{ ok?: boolean; data?: PayoutConfig }>(
    "/portal/payouts/config",
    token,
  );
  const d = data?.data;
  return {
    tokenUsdRate: typeof d?.tokenUsdRate === "number" ? d.tokenUsdRate : 0,
    minTokens: typeof d?.minTokens === "number" ? d.minTokens : 0,
    currency: "USD",
    balance: {
      available: d?.balance?.available ?? 0,
      earned: d?.balance?.earned ?? 0,
      pendingPayout: d?.balance?.pendingPayout ?? 0,
    },
  };
}

/**
 * Conversor tokens→USD: usa la tasa para calcular localmente, igual que el
 * backend (`usd = floor(tokens * rate * 100) / 100`). No llama a la red.
 */
export function quoteTokensToUsd(tokens: number, rate: number): number {
  if (!Number.isFinite(tokens) || tokens <= 0 || !Number.isFinite(rate) || rate <= 0) return 0;
  return Math.floor(tokens * rate * 100) / 100;
}

// ── Métodos de pago ───────────────────────────────────────────────────────

/** GET /portal/payouts/methods → lista de métodos del usuario. */
export async function getPayoutMethods(token: string): Promise<PayoutMethodDTO[]> {
  const data = await request<{ ok?: boolean; data?: PayoutMethodDTO[] }>(
    "/portal/payouts/methods",
    token,
  );
  return Array.isArray(data?.data) ? data.data : [];
}

export type CreatePayoutMethodInput = {
  type: PayoutMethodType;
  label: string;
  /** Campos sensibles por tipo (el backend los cifra; nunca se devuelven). */
  details: Record<string, unknown>;
  isDefault?: boolean;
};

/** POST /portal/payouts/methods → crea un método (devuelve el DTO con `mask`). */
export async function createPayoutMethod(
  input: CreatePayoutMethodInput,
  token: string,
): Promise<PayoutMethodDTO> {
  const data = await request<{ ok?: boolean; data?: PayoutMethodDTO }>(
    "/portal/payouts/methods",
    token,
    { method: "POST", body: JSON.stringify(input) },
  );
  if (!data?.data) throw new Error("Respuesta inválida del servidor");
  return data.data;
}

export type UpdatePayoutMethodInput = {
  label?: string;
  details?: Record<string, unknown>;
  isDefault?: boolean;
};

/** PATCH /portal/payouts/methods/:id → edita label/details/predeterminado. */
export async function updatePayoutMethod(
  id: string,
  input: UpdatePayoutMethodInput,
  token: string,
): Promise<PayoutMethodDTO> {
  const data = await request<{ ok?: boolean; data?: PayoutMethodDTO }>(
    `/portal/payouts/methods/${id}`,
    token,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  if (!data?.data) throw new Error("Respuesta inválida del servidor");
  return data.data;
}

/** DELETE /portal/payouts/methods/:id → archiva el método (status→archived). */
export async function deletePayoutMethod(id: string, token: string): Promise<void> {
  await request<{ ok?: boolean }>(`/portal/payouts/methods/${id}`, token, {
    method: "DELETE",
  });
}

// ── Solicitud y seguimiento ───────────────────────────────────────────────

/**
 * POST /portal/payouts/request → solicita un retiro. El backend valida
 * `amountTokens >= minTokens` y `<= available`, congela la tasa y mueve los
 * tokens a pending. Lanza con el mensaje de error del backend si falla.
 */
export async function requestPayout(
  payload: { methodId: string; amountTokens: number },
  token: string,
): Promise<PayoutRequestDTO> {
  const data = await request<{ ok?: boolean; data?: PayoutRequestDTO }>(
    "/portal/payouts/request",
    token,
    { method: "POST", body: JSON.stringify(payload) },
  );
  if (!data?.data) throw new Error("Respuesta inválida del servidor");
  return data.data;
}

/** GET /portal/payouts/requests → historial de solicitudes (orden desc). */
export async function getPayoutRequests(token: string): Promise<PayoutRequestDTO[]> {
  const data = await request<{ ok?: boolean; data?: PayoutRequestDTO[] }>(
    "/portal/payouts/requests",
    token,
  );
  return Array.isArray(data?.data) ? data.data : [];
}
