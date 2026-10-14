/**
 * Jobs Marketplace — CRUD de requerimientos (`/portal/jobs/requirements*`).
 * Extraído de `src/api/jobs.ts` (fachada); los consumidores importan `../api/jobs`.
 */

import { request } from "../client";
import type {
  Dispute, EditProposal, Envelope, MilestoneRequest, Offer,
  ProfessionalReviewView, Requirement, RequirementDetail, ServerSessionView,
} from "./types";

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
    test?: RequirementDetail["test"];
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
