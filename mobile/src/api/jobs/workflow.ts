/**
 * Jobs Marketplace — Fase 5 avanzada (hito / edición / disputa / rating) y
 * Fase 11 (test técnico previo). Ver la fachada `../jobs.ts` para la
 * convención general.
 */
import { request } from "../client";
import type {
  Dispute,
  EditProposal,
  MilestoneReleaseResult,
  MilestoneRequest,
  ProfessionalReviewView,
  PublicTest,
  Requirement,
  TestAttemptView,
  TestSubmitResult,
} from "./types";

// ── Envelope canónico del backend ─────────────────────────────────────────────
type Envelope<T> = { ok: boolean; data: T };

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

// ── Fase 11: test técnico previo (fetchers, §A del contrato F11) ──────────────

/** PUT …/test/require — el COMPRADOR exige/quita el test del requerimiento. */
export async function setRequiresTest(
  token: string,
  reqId: string,
  requiresTest: boolean,
): Promise<{ requiresTest: boolean }> {
  const res = await request<Envelope<{ requiresTest: boolean }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/test/require`,
    token,
    { method: "PUT", body: JSON.stringify({ requiresTest }) },
  );
  return { requiresTest: Boolean(res.data.requiresTest) };
}

/** POST …/test/generate — genera/regenera el test (eje MB). Solo conteo + aiUsed. */
export async function generateTest(
  token: string,
  reqId: string,
): Promise<{ questionCount: number; aiUsed: boolean }> {
  const res = await request<Envelope<{ questionCount: number; aiUsed: boolean }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/test/generate`,
    token,
    { method: "POST", body: JSON.stringify({}) },
  );
  return { questionCount: Number(res.data.questionCount ?? 0), aiUsed: Boolean(res.data.aiUsed) };
}

/** GET …/test — vista PÚBLICA del test (sin correctIndex). */
export async function getTest(token: string, reqId: string): Promise<PublicTest> {
  const res = await request<Envelope<{ test: PublicTest }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/test`,
    token,
  );
  return res.data.test;
}

/** GET …/test/my-attempt — mi intento (o null). Nunca incluye correctIndex. */
export async function getMyTestAttempt(
  token: string,
  reqId: string,
): Promise<TestAttemptView | null> {
  const res = await request<Envelope<{ attempt: TestAttemptView | null }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/test/my-attempt`,
    token,
  );
  return res.data.attempt ?? null;
}

/** POST …/test/start — crea el intento (1 oportunidad). Devuelve test público +
 *  attempt (con deadlineAt server-authoritative). El envelope `data` es plano. */
export async function startTestAttempt(
  token: string,
  reqId: string,
): Promise<PublicTest & { attempt: TestAttemptView }> {
  const res = await request<Envelope<PublicTest & { attempt: TestAttemptView }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/test/start`,
    token,
    { method: "POST", body: JSON.stringify({}) },
  );
  return res.data;
}

/** POST …/test/submit — califica EN SERVIDOR. Devuelve score/passed/timedOut,
 *  NUNCA las respuestas correctas. answers = 12 índices (0..3 | null). */
export async function submitTestAttempt(
  token: string,
  reqId: string,
  answers: Array<number | null>,
): Promise<TestSubmitResult> {
  const res = await request<Envelope<{ result: TestSubmitResult }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/test/submit`,
    token,
    { method: "POST", body: JSON.stringify({ answers }) },
  );
  return res.data.result;
}
