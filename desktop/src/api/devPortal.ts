/**
 * Dev-portal (marketplace de módulos) — capa API del cliente DESKTOP.
 *
 * Espejo NATIVO de `frontend/src/lib/portal-marketplace.ts` sobre los MISMOS
 * endpoints `/portal/dev/*` (sesión de portal como Bearer). NO toca backend ni
 * web: solo consume los endpoints existentes.
 *
 * Convención (igual que `api/payouts.ts` / `api/jobs.ts`):
 *  - `token` SIEMPRE primero; cada función usa `request<{ ok; data }>(...)` de
 *    `./client` (Authorization Bearer, 403 step-up, 401 refresh, 429) y
 *    DESEMPAQUETA el envelope devolviendo `res.data`.
 *  - Respuesta canónica `{ ok:true, data }` / `{ ok:false, error }`; `request`
 *    aplana el error a `Error(message)` (sin status).
 *  - Cada code/id se interpola con `encodeURIComponent`.
 *
 * Endpoints (todos bajo `/portal/dev/...`):
 *  - POST  /enroll                     { displayName, githubLogin?, country? } → DeveloperProfile
 *  - GET   /profile                    → DeveloperProfile | null
 *  - PATCH /payout-method              { provider, accountRef }               → DeveloperProfile
 *  - POST  /kyc/start                  {}                                     → KycStartResponse
 *  - GET   /modules                    → DeveloperModule[]
 *  - POST  /modules                    { id, prUrl, scope }
 *  - POST  /modules/:code/resubmit     { prUrl, scope }
 *  - POST  /modules/:code/unpublish    {}
 *  - POST  /modules/:code/republish    {}
 *  - GET   /modules/:code/reviews      → ModuleReviewsResponse
 *  - GET   /earnings                   → EarningsResponse
 *  - GET   /payouts                    → Payout[]
 *  - POST  /payouts                    { amountTokens }                       → Payout
 */
import { request } from "./client";

// ── Tipos del contrato /portal/dev/* (espejo de portal-marketplace.ts) ────────
export type KycStatus = "none" | "pending" | "verified" | "rejected";

export interface DeveloperProfile {
  id: string;
  customerId: string;
  displayName: string | null;
  githubLogin: string | null;
  country: string | null;
  kycStatus: KycStatus | string;
  kycProvider?: string | null;
  payoutProvider: string | null;
  payoutAccountRef: Record<string, unknown> | null;
  agreedTermsAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface KycStartResponse {
  kycStatus: KycStatus | string;
  onboardingUrl: string | null;
  sessionId: string | null;
  provider: "stripe" | "stub" | string;
}

export interface DeveloperModule {
  id: string;
  code: string;
  name: string;
  category: string;
  status: string;
  version: string | null;
  scope: string;
  reviewStatus: string;
  priceTokens: number;
  downloads: number;
  prUrl?: string | null;
  updatedAt?: string;
  createdAt?: string;
}

export interface ReviewEvent {
  id: string;
  versionId: string;
  kind: string;
  result: "pass" | "warn" | "fail" | string;
  reviewer: string | null;
  detail: unknown;
  createdAt: string;
}

export interface ModuleVersion {
  id: string;
  version: string;
  reviewStatus: string;
  prUrl?: string | null;
  repoCommit?: string | null;
  createdAt: string;
}

export interface ModuleReviewsResponse {
  module: { code: string; reviewStatus: string };
  versions: ModuleVersion[];
  events: ReviewEvent[];
}

export interface TokenBalance {
  earned?: number;
  pendingPayout?: number;
  available?: number;
  [k: string]: unknown;
}

export interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  createdAt: string;
  meta?: unknown;
}

export interface EarningsResponse {
  balance: TokenBalance;
  recent: LedgerEntry[];
}

export interface Payout {
  id: string;
  amountTokens: number;
  amountUsd: string;
  provider: string;
  status: string;
  providerRef?: string | null;
  failureReason?: string | null;
  requestedAt: string;
  approvedAt?: string | null;
  paidAt?: string | null;
}

// ── Envelope canónico del backend ─────────────────────────────────────────────
type Envelope<T> = { ok?: boolean; data?: T; error?: string };

// ════════════════════════════════════════════════════════════════════════════
// ENROLL / PROFILE
// ════════════════════════════════════════════════════════════════════════════

export interface EnrollInput {
  displayName: string;
  githubLogin?: string;
  country?: string;
}

/** POST /portal/dev/enroll — alta (o upsert) del developer. También lo reusa el
 *  perfil para editar nombre/github/país sin perder `agreedTermsAt`. */
export async function enrollDeveloper(token: string, input: EnrollInput): Promise<DeveloperProfile> {
  const res = await request<Envelope<DeveloperProfile>>("/portal/dev/enroll", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.data) throw new Error("Respuesta inválida del servidor");
  return res.data;
}

/** GET /portal/dev/profile — perfil del developer, o `null` si aún no enrolado. */
export async function getDeveloperProfile(token: string): Promise<DeveloperProfile | null> {
  const res = await request<Envelope<DeveloperProfile | null>>("/portal/dev/profile", token);
  return res.data ?? null;
}

/** PATCH /portal/dev/payout-method — método de pago del developer. */
export async function updatePayoutMethod(
  token: string,
  provider: string,
  accountRef: Record<string, unknown>,
): Promise<DeveloperProfile> {
  const res = await request<Envelope<DeveloperProfile>>("/portal/dev/payout-method", token, {
    method: "PATCH",
    body: JSON.stringify({ provider, accountRef }),
  });
  if (!res.data) throw new Error("Respuesta inválida del servidor");
  return res.data;
}

/** POST /portal/dev/kyc/start — inicia la verificación de identidad (KYC). */
export async function startKyc(token: string): Promise<KycStartResponse> {
  const res = await request<Envelope<KycStartResponse>>("/portal/dev/kyc/start", token, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.data) throw new Error("Respuesta inválida del servidor");
  return res.data;
}

// ════════════════════════════════════════════════════════════════════════════
// MODULES
// ════════════════════════════════════════════════════════════════════════════

/** GET /portal/dev/modules — módulos publicados/enviados por el developer. */
export async function listDeveloperModules(token: string): Promise<DeveloperModule[]> {
  const res = await request<Envelope<DeveloperModule[]>>("/portal/dev/modules", token);
  return Array.isArray(res.data) ? res.data : [];
}

/** POST /portal/dev/modules — envía un módulo NUEVO a revisión. */
export async function submitModule(
  token: string,
  input: { id: string; prUrl: string; scope: string },
): Promise<void> {
  await request<Envelope<unknown>>("/portal/dev/modules", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** POST /portal/dev/modules/:code/resubmit — reenvía un módulo con un nuevo PR. */
export async function resubmitModule(
  token: string,
  code: string,
  input: { prUrl: string; scope: string },
): Promise<void> {
  await request<Envelope<unknown>>(
    `/portal/dev/modules/${encodeURIComponent(code)}/resubmit`,
    token,
    { method: "POST", body: JSON.stringify(input) },
  );
}

/** POST /portal/dev/modules/:code/unpublish — despublica un módulo. */
export async function unpublishModule(token: string, code: string): Promise<void> {
  await request<Envelope<unknown>>(
    `/portal/dev/modules/${encodeURIComponent(code)}/unpublish`,
    token,
    { method: "POST", body: JSON.stringify({}) },
  );
}

/** POST /portal/dev/modules/:code/republish — reactiva un módulo despublicado. */
export async function republishModule(token: string, code: string): Promise<void> {
  await request<Envelope<unknown>>(
    `/portal/dev/modules/${encodeURIComponent(code)}/republish`,
    token,
    { method: "POST", body: JSON.stringify({}) },
  );
}

/** GET /portal/dev/modules/:code/reviews — historial de revisión (timeline). */
export async function getModuleReviews(token: string, code: string): Promise<ModuleReviewsResponse> {
  const res = await request<Envelope<ModuleReviewsResponse>>(
    `/portal/dev/modules/${encodeURIComponent(code)}/reviews`,
    token,
  );
  if (!res.data) throw new Error("Respuesta inválida del servidor");
  return res.data;
}

// ════════════════════════════════════════════════════════════════════════════
// EARNINGS / PAYOUTS
// ════════════════════════════════════════════════════════════════════════════

/** GET /portal/dev/earnings — balance + movimientos recientes de tokens. */
export async function getEarnings(token: string): Promise<EarningsResponse> {
  const res = await request<Envelope<EarningsResponse>>("/portal/dev/earnings", token);
  return {
    balance: res.data?.balance ?? {},
    recent: Array.isArray(res.data?.recent) ? res.data.recent : [],
  };
}

/** GET /portal/dev/payouts — historial de retiros del developer. */
export async function listPayouts(token: string): Promise<Payout[]> {
  const res = await request<Envelope<Payout[]>>("/portal/dev/payouts", token);
  return Array.isArray(res.data) ? res.data : [];
}

/** POST /portal/dev/payouts — solicita un retiro de `amountTokens`. */
export async function requestDevPayout(token: string, amountTokens: number): Promise<Payout> {
  const res = await request<Envelope<Payout>>("/portal/dev/payouts", token, {
    method: "POST",
    body: JSON.stringify({ amountTokens }),
  });
  if (!res.data) throw new Error("Respuesta inválida del servidor");
  return res.data;
}

// ── Helpers PUROS (badges + validación), espejo de portal-marketplace.ts ──────
const REVIEW_STATUS_BADGE: Record<string, string> = {
  enviado: "badge badge-voided",
  revision: "badge badge-pending",
  correccion: "badge badge-declined",
  publico: "badge badge-approved",
  inactivo: "badge badge-voided",
  suspendido: "badge badge-declined",
};

const RESULT_BADGE: Record<string, string> = {
  pass: "badge badge-approved",
  warn: "badge badge-pending",
  fail: "badge badge-declined",
};

/** Clase del badge para un estado de revisión de módulo. Desconocido → voided. */
export function reviewStatusBadgeClass(status: string): string {
  return REVIEW_STATUS_BADGE[status] ?? "badge badge-voided";
}

/** Clase del badge para el resultado de un evento de revisión. */
export function reviewResultBadgeClass(result: string): string {
  return RESULT_BADGE[result] ?? "badge badge-voided";
}

/** Clase del badge para el estado de KYC. */
export function kycBadgeClass(status: string): string {
  switch (status) {
    case "verified": return "badge badge-approved";
    case "pending": return "badge badge-pending";
    case "rejected": return "badge badge-declined";
    default: return "badge badge-voided";
  }
}

/** Validación PURA del importe de retiro: entero positivo (el mínimo lo impone
 *  el backend; aquí solo bloqueamos lo no numérico/≤0). */
export function isValidPayoutAmount(value: unknown): boolean {
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}
