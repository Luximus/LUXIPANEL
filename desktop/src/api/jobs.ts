/**
 * Jobs Marketplace (Empleos) — capa API del cliente DESKTOP (Fase 6).
 *
 * FACHADA de re-export: la implementación vive dividida por dominios en
 * `src/api/jobs/` (types, requirements, offers, server, professionals, ai,
 * milestones, channel, test, errors). Este archivo conserva la superficie
 * pública EXACTA del antiguo monolito para que los importadores existentes
 * (`import ... from "../api/jobs"`) no cambien.
 *
 * NOTA resolución de módulos: `./jobs` resuelve a ESTE archivo (jobs.ts) antes
 * que al directorio `jobs/` (igual que `client.ts` vs `client/`). No crear
 * `src/api/jobs/index.ts`.
 *
 * Espejo de `frontend/src/lib/portal-jobs.ts` sobre los MISMOS endpoints
 * `/portal/jobs/*` (Fases 1–5 del contrato). NO toca backend ni web: la Fase 6
 * SOLO consume los endpoints existentes.
 *
 * Convención (igual que blog.ts / payouts.ts):
 *  - `token` SIEMPRE primero; cada función usa `request<{ ok; data }>(...)` de
 *    `./client` (Authorization Bearer, 403 step-up, 401 refresh, 429) y
 *    DESEMPAQUETA el envelope devolviendo `res.data.<campo>` (como `getTickets`
 *    desenvuelve `data.tickets`).
 *  - Respuesta canónica `{ ok:true, data }` / `{ ok:false, error, code? }`;
 *    `request` aplana el error a `Error(message)` (sin status).
 *  - Cada id se interpola con `encodeURIComponent`.
 *  - POST sin cuerpo → `{ method:"POST" }` (el web envía `{}`; ambos válidos).
 *
 * NUNCA exponer/loguear secretos: los grants de acceso son por REFERENCIA
 * (`resourceType`/`resourceRef`/`label`), JAMÁS material de llave (el backend
 * rechaza con KEY_MATERIAL → `jobs.grants.keyForbidden`).
 */

// ── Tipos + gate de moderación ────────────────────────────────────────────────
export type {
  JobStatus,
  OfferStatus,
  ModerationStatus,
  Requirement,
  JobServer,
  ServerSessionView,
  Offer,
  MilestoneStatus,
  MilestoneRequest,
  EditProposal,
  Dispute,
  ProgressReview,
  ProfessionalReviewView,
  MilestoneReleaseResult,
  RequirementDetail,
  PublicTestQuestion,
  PublicTest,
  TestAttemptView,
  TestSubmitResult,
  Availability,
  ProfileLink,
  MyProfessionalProfile,
  PublicProfessional,
  RankedProfessional,
  AiCollectFields,
  AiCollectResult,
  AiModeration,
  AiPlanMilestone,
  AiPlan,
  AiPlanResult,
  AiCostEstimate,
  AiCostEstimateResult,
  AiTranslatedRequirement,
  AiTranslateResult,
  ChannelMessageKind,
  ChannelAttachment,
  ChannelMessage,
  ChannelParticipant,
  GrantResourceType,
  AccessGrant,
} from "./jobs/types";
export { MODERATION_OK, isModerated } from "./jobs/types";

// ── Requerimientos (CRUD + publish/release/delete) ────────────────────────────
export type { CreateRequirementPayload } from "./jobs/requirements";
export {
  listRequirements,
  getRequirement,
  getRequirementDetail,
  createRequirement,
  editRequirement,
  publishRequirement,
  releaseRequirement,
  deleteRequirement,
} from "./jobs/requirements";

// ── Ofertas ───────────────────────────────────────────────────────────────────
export { sendOffers, acceptOffer, rejectOffer } from "./jobs/offers";

// ── Modalidad "Servidor" (AI Dev Marketplace) ─────────────────────────────────
export {
  listMyServers,
  listServerProviders,
  getServerSession,
  reprovisionServer,
  execServerCommand,
} from "./jobs/server";

// ── Profesionales ─────────────────────────────────────────────────────────────
export type { ProfessionalProfileInput } from "./jobs/professionals";
export {
  getMyProfessionalProfile,
  enrollProfessional,
  updateProfessionalProfile,
  searchProfessionalByEmail,
  listRankedProfessionals,
} from "./jobs/professionals";

// ── Asistente IA ──────────────────────────────────────────────────────────────
export {
  aiCollect,
  aiModerate,
  aiEvaluatePlan,
  aiEstimate,
  aiTranslate,
  aiReviewProgress,
} from "./jobs/ai";

// ── Fase 5 avanzado (hito / edición / disputa / rating) ───────────────────────
export {
  requestMilestone,
  approveMilestone,
  proposeEdit,
  acceptEditProposal,
  rejectEditProposal,
  requestDispute,
  resolveDispute,
  submitRating,
} from "./jobs/milestones";

// ── Canal / bitácora + grants + SSE ───────────────────────────────────────────
export {
  getChannelMessages,
  postChannelMessage,
  uploadChannelFile,
  getGrants,
  shareAccess,
  revokeGrant,
  jobsChannelStreamUrl,
} from "./jobs/channel";

// ── Fase 11: test técnico previo ──────────────────────────────────────────────
export {
  setRequiresTest,
  generateTest,
  getTest,
  getMyTestAttempt,
  startTestAttempt,
  submitTestAttempt,
} from "./jobs/test";

// ── Errores → clave i18n `jobs.*` ─────────────────────────────────────────────
export { jobsErrorKey } from "./jobs/errors";
