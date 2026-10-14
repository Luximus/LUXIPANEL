/**
 * Tienda de módulos (marketplace) — capa API del cliente DESKTOP.
 *
 * Espejo de `frontend/src/lib/portal-premium-modules.ts` sobre los MISMOS
 * endpoints `/portal/premium-modules/*`, consumidos con el token del portal.
 * Sigue la convención de `api/jobs.ts` / `api/admin.ts`:
 *  - `token` SIEMPRE primero; cada función usa `request<...>(path, token, init)`
 *    de `./client` (Authorization Bearer, 401 refresh, 403 step-up, 429).
 *  - El backend responde con la envoltura `{ ok, ... }`; aquí validamos `ok`
 *    (el `request` central ya lanza en errores HTTP, pero un `{ ok:false }` con
 *    HTTP 200 lo convertimos en `Error(error)` como hace la web).
 *  - Cada id se interpola con `encodeURIComponent`.
 *
 * OJO: la tienda cobra en TOKENS (`priceTokens`). NO se porta ningún residuo de
 * MB/datos/diamantes (`diamondCost` del modelo web queda FUERA a propósito).
 */

import { request } from "./client";

// ── Modelo del módulo del marketplace (espejo del contrato backend) ───────────
export type ModuleTag = "free" | "premium" | string;
export type ModuleKind = "module" | "mcp_server" | string;
export type ModuleStatus = "active" | "disabled" | "development" | string;

export interface MarketplaceModule {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  tag: ModuleTag;
  kind: ModuleKind;
  version: string | null;
  rating: number;
  downloads: number;
  views: number;
  createdBy: string;
  scriptPath: string | null;
  scriptHash: string | null;
  features: string[];
  featuresI18n: Record<string, string[]> | null;
  configSchema: unknown;
  /** Costo en TOKENS del módulo (0 = gratis). */
  priceTokens: number;
  repoUrl: string | null;
  creatorCustomerId: string | null;
  status: ModuleStatus;
  createdAt: string;
  updatedAt: string;
}

/** Payload de creación/edición (mismo cuerpo que arma el submit de la web). */
export interface MarketplaceModulePayload {
  code?: string;
  name: string | undefined;
  description: string;
  category: string | undefined;
  tag: string;
  kind: string;
  version: string;
  rating: number;
  createdBy: string;
  repoUrl: string;
  scriptPath: string | null;
  scriptHash: string | null;
  features: string[];
  featuresI18n: Record<string, string[]>;
  configSchema: unknown;
  priceTokens: number;
  status: "active" | "disabled" | "development";
}

type ListResponse = { ok: boolean; modules?: MarketplaceModule[]; error?: string };
type MutateResponse = { ok: boolean; module?: MarketplaceModule; error?: string };
type TranslateResponse = { ok: boolean; featuresI18n?: Record<string, string[]>; error?: string };

/** GET /portal/premium-modules → catálogo completo del marketplace. */
export async function getMarketplaceModules(token: string): Promise<MarketplaceModule[]> {
  const data = await request<ListResponse>("/portal/premium-modules", token);
  if (!data.ok) throw new Error(data.error || "Could not load modules");
  return Array.isArray(data.modules) ? data.modules : [];
}

/** POST /portal/premium-modules → crea un módulo (el `code` viaja en el payload). */
export async function createMarketplaceModule(
  token: string,
  payload: MarketplaceModulePayload,
): Promise<MarketplaceModule | null> {
  const data = await request<MutateResponse>("/portal/premium-modules", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!data.ok) throw new Error(data.error || "Could not save the module");
  return data.module ?? null;
}

/** PUT /portal/premium-modules/:id → actualiza un módulo (sin cambiar el code). */
export async function updateMarketplaceModule(
  token: string,
  id: string,
  payload: Omit<MarketplaceModulePayload, "code">,
): Promise<MarketplaceModule | null> {
  const data = await request<MutateResponse>(`/portal/premium-modules/${encodeURIComponent(id)}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!data.ok) throw new Error(data.error || "Could not save the module");
  return data.module ?? null;
}

/** DELETE /portal/premium-modules/:id → elimina un módulo del catálogo. */
export async function deleteMarketplaceModule(token: string, id: string): Promise<void> {
  const data = await request<MutateResponse>(`/portal/premium-modules/${encodeURIComponent(id)}`, token, {
    method: "DELETE",
  });
  if (!data.ok) throw new Error(data.error || "Could not delete the module");
}

/**
 * POST /portal/premium-modules/translate-features → traduce las capacidades del
 * módulo (fuente en `sourceLocale`, por defecto "es") al resto de idiomas. La IA
 * lo aplica en el backend; aquí sólo devolvemos el mapa `{ locale: string[] }`.
 */
export async function translateModuleFeatures(
  token: string,
  features: string[],
  sourceLocale = "es",
): Promise<Record<string, string[]>> {
  const data = await request<TranslateResponse>("/portal/premium-modules/translate-features", token, {
    method: "POST",
    body: JSON.stringify({ features, sourceLocale }),
  });
  if (!data.ok || !data.featuresI18n) throw new Error(data.error || "Could not translate the capabilities");
  return data.featuresI18n;
}
