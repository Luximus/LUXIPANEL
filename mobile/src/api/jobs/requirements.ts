/**
 * Jobs Marketplace — requerimientos (CRUD/listado/detalle), ofertas y modalidad
 * "Servidor". Ver la fachada `../jobs.ts` para la convención general.
 */
import { request } from "../client";
import type {
  JobServer,
  Offer,
  Requirement,
  RequirementDetail,
  ServerSessionView,
  TestAttemptView,
} from "./types";
import type { Dispute, EditProposal, MilestoneRequest, ProfessionalReviewView } from "./types";

// ── Envelope canónico del backend ─────────────────────────────────────────────
type Envelope<T> = { ok: boolean; data: T };

// ── Listado / detalle (§ requirements CRUD) ───────────────────────────────────

/** GET /portal/jobs/requirements → mis requerimientos como comprador y profesional. */
export async function listRequirements(
  token: string,
): Promise<{ asBuyer: Requirement[]; asProfessional: Requirement[] }> {
  const res = await request<Envelope<{ asBuyer: Requirement[]; asProfessional: Requirement[] }>>(
    "/portal/jobs/requirements",
    token,
  );
  return { asBuyer: res.data.asBuyer ?? [], asProfessional: res.data.asProfessional ?? [] };
}

/** GET /portal/jobs/requirements/:id (Fase 1): requirement + escrow + ofertas. */
export async function getRequirement(
  token: string,
  id: string,
): Promise<{ requirement: Requirement; escrow: unknown; offers: Offer[] }> {
  const res = await request<Envelope<{ requirement: Requirement; escrow: unknown; offers: Offer[] }>>(
    `/portal/jobs/requirements/${encodeURIComponent(id)}`,
    token,
  );
  return { requirement: res.data.requirement, escrow: res.data.escrow, offers: res.data.offers ?? [] };
}

/** GET /portal/jobs/requirements/:id (proyección F5 §C.7): requirement + ganchos. */
export async function getRequirementDetail(token: string, id: string): Promise<RequirementDetail> {
  const res = await request<Envelope<{
    requirement: Requirement; escrow: unknown; offers: Offer[];
    milestoneRequest: MilestoneRequest | null; editProposal: EditProposal | null;
    dispute: Dispute | null; review: ProfessionalReviewView | null;
    test?: {
      required: boolean; generated: boolean;
      myAttempt: TestAttemptView | null; passed: boolean;
    } | null;
    serverSession?: ServerSessionView | null;
  }>>(
    `/portal/jobs/requirements/${encodeURIComponent(id)}`,
    token,
  );
  const d = res.data;
  return {
    requirement: d.requirement,
    offers: d.offers ?? [],
    milestoneRequest: d.milestoneRequest ?? null,
    editProposal: d.editProposal ?? null,
    dispute: d.dispute ?? null,
    review: d.review ?? null,
    test: d.test ?? null,
    serverSession: d.serverSession ?? null,
  };
}

export interface CreateRequirementPayload {
  title: string;
  description: string;
  country: string;
  language: string;
  workType: string;
  deliverables: string[];
  deadlineAt: string | null;
  acceptedPrice: number;
  executionMode?: "standard" | "server";
  clientServerId?: string | null;
}

/** POST /portal/jobs/requirements → crea el requerimiento (draft). */
export async function createRequirement(
  token: string,
  payload: CreateRequirementPayload,
): Promise<Requirement> {
  const res = await request<Envelope<{ requirement: Requirement }>>(
    "/portal/jobs/requirements",
    token,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return res.data.requirement;
}

/** PATCH /portal/jobs/requirements/:id → edición directa (comprador, draft|published).
 *  El patch puede incluir `acceptedPrice`, `title`, `description`, etc. */
export async function editRequirement(
  token: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<Requirement> {
  const res = await request<Envelope<{ requirement: Requirement }>>(
    `/portal/jobs/requirements/${encodeURIComponent(id)}`,
    token,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return res.data.requirement;
}

/** POST /portal/jobs/requirements/:id/publish → publicar = fondear escrow. */
export async function publishRequirement(token: string, id: string): Promise<unknown> {
  const res = await request<Envelope<unknown>>(
    `/portal/jobs/requirements/${encodeURIComponent(id)}/publish`,
    token,
    { method: "POST" },
  );
  return res.data;
}

/** POST /portal/jobs/requirements/:id/release → liberar pago (comprador, 90/10). */
export async function releaseRequirement(token: string, id: string): Promise<unknown> {
  const res = await request<Envelope<unknown>>(
    `/portal/jobs/requirements/${encodeURIComponent(id)}/release`,
    token,
    { method: "POST" },
  );
  return res.data;
}

/** DELETE /portal/jobs/requirements/:id → cancelar/eliminar (refund 95/5). */
export async function deleteRequirement(token: string, id: string): Promise<void> {
  await request(
    `/portal/jobs/requirements/${encodeURIComponent(id)}`,
    token,
    { method: "DELETE" },
  );
}

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

// ── Modalidad "Servidor" (AI Dev Marketplace) ─────────────────────────────────

/** GET /portal/jobs/servers → servidores registrados del usuario (para selectores). */
export async function listMyServers(token: string): Promise<JobServer[]> {
  const res = await request<{ ok: boolean; data: JobServer[] }>("/portal/jobs/servers", token);
  return (res.data ?? []) as JobServer[];
}

/** POST /portal/ssh/assistant/providers → proveedores IA habilitados en un panel. */
export async function listServerProviders(
  token: string,
  panelId: string,
): Promise<{ providers: string[]; activeProvider?: string }> {
  try {
    const res = await request<{ ok: boolean; data?: { providers: string[]; activeProvider?: string } }>(
      "/portal/ssh/assistant/providers",
      token,
      { method: "POST", body: JSON.stringify({ panelId }) },
    );
    return res.data ?? { providers: [] };
  } catch {
    return { providers: [] };
  }
}

/** POST …/server/reprovision → reintenta el acceso efímero (assignee). */
export async function reprovisionServer(token: string, reqId: string): Promise<{ status: string }> {
  const res = await request<Envelope<{ status: string }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/server/reprovision`,
    token,
    { method: "POST", body: JSON.stringify({}) },
  );
  return res.data;
}

/** POST …/server/exec → ejecuta un comando sobre el servidor del cliente (assignee). */
export async function execServerCommand(
  token: string,
  reqId: string,
  command: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const res = await request<Envelope<{ stdout: string; stderr: string; exitCode: number }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/server/exec`,
    token,
    { method: "POST", body: JSON.stringify({ command }) },
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
