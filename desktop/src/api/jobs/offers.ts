/**
 * Jobs Marketplace — ofertas (envío múltiple + aceptar/rechazar).
 * Extraído de `src/api/jobs.ts` (fachada); los consumidores importan `../api/jobs`.
 */

import { request } from "../client";
import type { Envelope, Offer } from "./types";

// ── Ofertas (envío múltiple + aceptar/rechazar) ───────────────────────────────

/** POST /portal/jobs/requirements/:id/offers → enviar oferta a VARIOS profesionales. */
export async function sendOffers(
  token: string,
  reqId: string,
  body: { professionalIds: string[]; message?: string },
): Promise<{ offers: Offer[]; skipped: string[] }> {
  const res = await request<Envelope<{ offers: Offer[]; skipped: string[] }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/offers`,
    token,
    { method: "POST", body: JSON.stringify(body) },
  );
  return { offers: res.data.offers ?? [], skipped: res.data.skipped ?? [] };
}

/** POST /portal/jobs/offers/:id/accept → aceptar oferta (profesional). En modalidad
 *  servidor se envían `professionalServerId` + `provider` (el server del profesional). */
export async function acceptOffer(
  token: string,
  offerId: string,
  opts?: { professionalServerId?: string | null; provider?: string | null },
): Promise<unknown> {
  const body = opts && (opts.professionalServerId || opts.provider)
    ? JSON.stringify({ professionalServerId: opts.professionalServerId ?? null, provider: opts.provider ?? null })
    : undefined;
  const res = await request<Envelope<unknown>>(
    `/portal/jobs/offers/${encodeURIComponent(offerId)}/accept`,
    token,
    body ? { method: "POST", body } : { method: "POST" },
  );
  return res.data;
}

/** POST /portal/jobs/offers/:id/reject → rechazar oferta (profesional). */
export async function rejectOffer(token: string, offerId: string): Promise<unknown> {
  const res = await request<Envelope<unknown>>(
    `/portal/jobs/offers/${encodeURIComponent(offerId)}/reject`,
    token,
    { method: "POST" },
  );
  return res.data;
}
