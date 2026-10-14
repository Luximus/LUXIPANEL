/**
 * Jobs Marketplace — perfil profesional (enrolar/editar/buscar/ranking) y
 * asistente IA (§ ai/collect + requirements/:id/ai/*). Ver la fachada
 * `../jobs.ts` para la convención general.
 */
import { request } from "../client";
import type {
  AiCollectFields,
  AiCollectResult,
  AiCostEstimateResult,
  AiModeration,
  AiPlanResult,
  AiTranslateResult,
  Availability,
  MyProfessionalProfile,
  ProfileLink,
  ProgressReview,
  PublicProfessional,
  RankedProfessional,
} from "./types";

// ── Envelope canónico del backend ─────────────────────────────────────────────
type Envelope<T> = { ok: boolean; data: T };

// ── Profesionales (§ professionals) ───────────────────────────────────────────

// Nombre y país NO se envían: viven en el perfil de usuario (cuenta). Solo
// datos EXTRA de profesional.
export interface ProfessionalProfileInput {
  headline: string | null;
  bio: string | null;
  cvUrl: string | null;
  availability: Availability;
  skills: string[];
  spokenLanguages: string[];
  profileLinks: ProfileLink[];
}

/** GET /portal/jobs/professionals/me → mi perfil (null si no enrolado). */
export async function getMyProfessionalProfile(token: string): Promise<MyProfessionalProfile | null> {
  const res = await request<Envelope<{ profile: MyProfessionalProfile | null }>>(
    "/portal/jobs/professionals/me",
    token,
  );
  return res.data.profile ?? null;
}

/** POST /portal/jobs/professionals/enroll → activa el perfil profesional. */
export async function enrollProfessional(
  token: string,
  input: ProfessionalProfileInput,
): Promise<MyProfessionalProfile> {
  const res = await request<Envelope<{ profile: MyProfessionalProfile }>>(
    "/portal/jobs/professionals/enroll",
    token,
    { method: "POST", body: JSON.stringify(input) },
  );
  return res.data.profile;
}

/** PATCH /portal/jobs/professionals/me → actualiza el perfil profesional. */
export async function updateProfessionalProfile(
  token: string,
  input: ProfessionalProfileInput,
): Promise<MyProfessionalProfile> {
  const res = await request<Envelope<{ profile: MyProfessionalProfile }>>(
    "/portal/jobs/professionals/me",
    token,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return res.data.profile;
}

/** GET /portal/jobs/professionals/search?email= → un profesional por email exacto. */
export async function searchProfessionalByEmail(
  token: string,
  email: string,
): Promise<PublicProfessional | null> {
  const res = await request<Envelope<{ professional: PublicProfessional | null }>>(
    `/portal/jobs/professionals/search?email=${encodeURIComponent(email)}`,
    token,
  );
  return res.data.professional ?? null;
}

/** GET /portal/jobs/professionals/ranked?requirementId=&onlyAvailable= → ranking. */
export async function listRankedProfessionals(
  token: string,
  requirementId: string,
  onlyAvailable: boolean,
): Promise<RankedProfessional[]> {
  const qs = `requirementId=${encodeURIComponent(requirementId)}${onlyAvailable ? "&onlyAvailable=true" : ""}`;
  const res = await request<Envelope<{ professionals: RankedProfessional[] }>>(
    `/portal/jobs/professionals/ranked?${qs}`,
    token,
  );
  return res.data.professionals ?? [];
}

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
