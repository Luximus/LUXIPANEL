/**
 * Jobs Marketplace — Fase 5 avanzado: hito 50%, propuestas de edición,
 * disputas y rating del profesional.
 * Extraído de `src/api/jobs.ts` (fachada); los consumidores importan `../api/jobs`.
 */

import { request } from "../client";
import type {
  Dispute, EditProposal, Envelope, MilestoneReleaseResult, MilestoneRequest,
  ProfessionalReviewView, Requirement,
} from "./types";

// ── Fase 5 avanzado (hito / edición / disputa / rating) ───────────────────────

/** POST …/requirements/:id/milestone/request (profesional asignado). */
export async function requestMilestone(
  token: string,
  reqId: string,
  note?: string,
): Promise<MilestoneRequest> {
  const body: Record<string, unknown> = {};
  if (note) body.note = note;
  const res = await request<Envelope<{ request: MilestoneRequest }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/milestone/request`,
    token,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data.request;
}

/** POST …/requirements/:id/milestone/approve (comprador). */
export async function approveMilestone(token: string, reqId: string): Promise<MilestoneReleaseResult> {
  const res = await request<Envelope<{ milestone: MilestoneReleaseResult }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/milestone/approve`,
    token,
    { method: "POST" },
  );
  return res.data.milestone;
}

/** POST …/requirements/:id/edit-proposals — propuesta de edición (comprador, in_progress). */
export async function proposeEdit(
  token: string,
  reqId: string,
  patch: Record<string, unknown>,
  topupAmount?: number,
): Promise<EditProposal> {
  const body: Record<string, unknown> = { ...patch };
  if (typeof topupAmount === "number") body.topupAmount = topupAmount;
  const res = await request<Envelope<{ proposal: EditProposal }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/edit-proposals`,
    token,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data.proposal;
}

/** POST …/edit-proposals/:proposalId/accept (profesional). */
export async function acceptEditProposal(token: string, proposalId: string): Promise<Requirement> {
  const res = await request<Envelope<{ requirement: Requirement }>>(
    `/portal/jobs/edit-proposals/${encodeURIComponent(proposalId)}/accept`,
    token,
    { method: "POST" },
  );
  return res.data.requirement;
}

/** POST …/edit-proposals/:proposalId/reject (profesional). */
export async function rejectEditProposal(token: string, proposalId: string): Promise<EditProposal> {
  const res = await request<Envelope<{ proposal: EditProposal }>>(
    `/portal/jobs/edit-proposals/${encodeURIComponent(proposalId)}/reject`,
    token,
    { method: "POST" },
  );
  return res.data.proposal;
}

/** POST …/requirements/:id/dispute — abrir disputa (profesional). */
export async function requestDispute(token: string, reqId: string, reason: string): Promise<Dispute> {
  const res = await request<Envelope<{ dispute: Dispute }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/dispute`,
    token,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
  return res.data.dispute;
}

/** POST …/requirements/:id/dispute/resolve — resolver disputa (comprador o admin).
 *  `refundBps` solo se envía cuando la resolución es `refund_partial`. */
export async function resolveDispute(
  token: string,
  reqId: string,
  resolution: "continue" | "refund_full" | "refund_partial",
  refundBps?: number,
): Promise<Dispute> {
  const body: Record<string, unknown> = { resolution };
  if (resolution === "refund_partial" && typeof refundBps === "number") body.refundBps = refundBps;
  const res = await request<Envelope<{ dispute: Dispute }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/dispute/resolve`,
    token,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data.dispute;
}

/** POST …/requirements/:id/rating — calificar al profesional (comprador). */
export async function submitRating(
  token: string,
  reqId: string,
  rating: number,
  comment?: string,
): Promise<ProfessionalReviewView> {
  const body: Record<string, unknown> = { rating };
  if (comment) body.comment = comment;
  const res = await request<Envelope<{ review: ProfessionalReviewView }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/rating`,
    token,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data.review;
}
