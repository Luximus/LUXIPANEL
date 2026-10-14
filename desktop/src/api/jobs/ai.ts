/**
 * Jobs Marketplace — asistente IA (§ ai/collect + requirements/:id/ai/*).
 * Extraído de `src/api/jobs.ts` (fachada); los consumidores importan `../api/jobs`.
 */

import { request } from "../client";
import type {
  AiCollectFields, AiCollectResult, AiCostEstimateResult, AiModeration,
  AiPlanResult, AiTranslateResult, Envelope, ProgressReview,
} from "./types";

// ── Asistente IA (§ ai/collect + requirements/:id/ai/*) — todos POST ───────────
// El metering (eje MB) lo aplica el backend; aquí solo se detecta `aiUsed:false`
// (IA off) y los errores 402/409 vía `jobsErrorKey()`.

/** POST /portal/jobs/ai/collect → recolección guiada de campos. */
export async function aiCollect(
  token: string,
  draft: string,
  known: Partial<AiCollectFields> | undefined,
  locale: string,
): Promise<AiCollectResult> {
  const body: Record<string, unknown> = { draft, locale };
  if (known && Object.keys(known).length) body.known = known;
  const res = await request<Envelope<{ collect: AiCollectResult }>>(
    "/portal/jobs/ai/collect",
    token,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data.collect;
}

/** POST /portal/jobs/requirements/:id/ai/moderate → veredicto de moderación. */
export async function aiModerate(token: string, reqId: string): Promise<AiModeration> {
  const res = await request<Envelope<{ moderation: AiModeration }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/ai/moderate`,
    token,
    { method: "POST" },
  );
  return res.data.moderation;
}

/** POST /portal/jobs/requirements/:id/ai/evaluate-plan → plan de hitos. */
export async function aiEvaluatePlan(token: string, reqId: string): Promise<AiPlanResult> {
  const res = await request<Envelope<{ plan: AiPlanResult }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/ai/evaluate-plan`,
    token,
    { method: "POST" },
  );
  return res.data.plan;
}

/** POST /portal/jobs/requirements/:id/ai/estimate → estimación de costo. */
export async function aiEstimate(token: string, reqId: string): Promise<AiCostEstimateResult> {
  const res = await request<Envelope<{ estimate: AiCostEstimateResult }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/ai/estimate`,
    token,
    { method: "POST" },
  );
  return res.data.estimate;
}

/** POST /portal/jobs/requirements/:id/ai/translate → traducción a locales destino. */
export async function aiTranslate(
  token: string,
  reqId: string,
  toLocales: string[],
): Promise<AiTranslateResult> {
  const res = await request<Envelope<{ translation: AiTranslateResult }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/ai/translate`,
    token,
    { method: "POST", body: JSON.stringify({ toLocales }) },
  );
  return res.data.translation;
}

/** POST /portal/jobs/requirements/:id/ai/review-progress → avance IA (participante). */
export async function aiReviewProgress(token: string, reqId: string): Promise<ProgressReview> {
  const res = await request<Envelope<{ review: ProgressReview }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/ai/review-progress`,
    token,
    { method: "POST" },
  );
  return res.data.review;
}
