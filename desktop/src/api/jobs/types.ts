/**
 * Jobs Marketplace — tipos compartidos (espejo literal del contrato backend).
 * Extraído de `src/api/jobs.ts` (fachada); NO importar este módulo directo
 * desde fuera: los consumidores siguen usando `../api/jobs`.
 */

// ── Estados (espejo literal del backend §A.1/§A.2) ────────────────────────────
export type JobStatus =
  | "draft" | "published" | "assigned" | "in_progress" | "disputed" | "released" | "cancelled";
export type OfferStatus = "sent" | "accepted" | "rejected" | "cancelled";

/** Veredicto de moderación IA (§A.2 del contrato Fase 2). */
export type ModerationStatus = "apto" | "spam" | "malicioso" | "adulto" | "no-software";

/** Solo estos valores permiten publicar/fondear (gate §C; "approved" por compat). */
export const MODERATION_OK = new Set<string>(["apto", "approved"]);

export interface Requirement {
  id: string;
  title: string;
  description: string;
  country: string;
  language: string;
  workType: string;
  deliverables: unknown[];
  deadlineAt: string | null;
  acceptedPrice: number;
  status: JobStatus;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  releasedAt: string | null;
  cancelledAt: string | null;
  // ── Ganchos del asistente IA (Fase 2 §B). El detalle (#9) devuelve el row
  //    completo, así que estos campos llegan poblados tras moderar/planear. ──
  moderationStatus?: string | null;
  moderationReason?: string | null;
  aiSummary?: string | null;
  aiPlan?: AiPlan | null;
  costEstimate?: AiCostEstimate | null;
  translatedFields?: Record<string, AiTranslatedRequirement> | null;
  // ── Fase 5 (avanzada): avance IA, hito 50%, ediciones, disputas (§A.1). ──
  progressPct?: number | null;
  progressReport?: string | null;
  progressMeets100?: boolean | null;
  milestoneStatus?: string | null;     // null | requested | approved
  editCount?: number;
  disputedAt?: string | null;
  disputeResolution?: string | null;
  // ── Fase 11: el test viaja en el row del listado y del detalle. ──
  requiresTest?: boolean;
  // ── Modalidad "Servidor" (AI Dev Marketplace). ──
  executionMode?: "standard" | "server";
  clientServerId?: string | null;
}

/** Servidor registrado del usuario (proyección mínima para selectores). */
export interface JobServer {
  id: string;
  name: string;
  hostname: string;
  username: string;
  panelId: string;
  customDomain?: string | null;
  serverPort?: number | null;
  enabled?: boolean;
}

/** Estado sanitizado de la sesión de acceso efímero (sin credenciales). */
export interface ServerSessionView {
  status: string;                 // none | pending | active | revoked | error
  provider: string | null;
  fingerprint: string | null;
  error: string | null;
}

export interface Offer {
  id: string;
  requirementId: string;
  professionalId: string;
  status: OfferStatus;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
}

// ── Fase 5 (avanzada): hito, ediciones, disputas, avance IA, rating ───────────
export type MilestoneStatus = "requested" | "approved";

export interface MilestoneRequest {
  id: string;
  requirementId: string;
  professionalId: string;
  pct: number;
  status: "requested" | "approved" | "rejected";
  note: string | null;
  requestedAt: string;
  decidedAt: string | null;
}

export interface EditProposal {
  id: string;
  requirementId: string;
  proposedBy: string;
  professionalId: string | null;
  patch: { title?: string; description?: string; deliverables?: unknown[]; deadlineAt?: string | null };
  topupAmount: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  decidedAt: string | null;
}

export interface Dispute {
  id: string;
  requirementId: string;
  requestedBy: string;
  reason: string;
  status: "open" | "resolved";
  resolution: "continue" | "refund_full" | "refund_partial" | null;
  refundBps: number | null;
  resolvedBy: string | null;
  requestedAt: string;
  resolvedAt: string | null;
}

export interface ProgressReview {
  progressPct: number;
  meets100: boolean;
  report: string | null;
  aiUsed: boolean;
}

export interface ProfessionalReviewView {
  id: string;
  requirementId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

/** Resultado del desembolso de hito (§B.1 MilestoneReleaseResult). */
export interface MilestoneReleaseResult {
  portion: number;
  devShare: number;
  feeShare: number;
  professionalId: string;
  disbursedAmount: number;
}

/** Detalle extendido del requerimiento (§C.7): requirement + ganchos Fase 5. */
export interface RequirementDetail {
  requirement: Requirement;
  offers: Offer[];
  milestoneRequest: MilestoneRequest | null;
  editProposal: EditProposal | null;
  dispute: Dispute | null;
  review: ProfessionalReviewView | null;
  // ── Fase 11: estado del test (sin filtrar respuestas correctas). ──
  test?: {
    required: boolean;
    generated: boolean;
    myAttempt: TestAttemptView | null;
    passed: boolean;
  } | null;
  // ── Modalidad "Servidor": sesión sanitizada (null si no es server mode). ──
  serverSession?: ServerSessionView | null;
}

// ── Fase 11: test técnico previo (espejo de portal-jobs.ts §test, F10) ────────
// SEGURIDAD: el cliente NUNCA recibe correctIndex (ni al servir, ni al iniciar,
// ni tras enviar). PublicTestQuestion solo trae { q, options }. La calificación y
// el tiempo son server-authoritative; el contador por pregunta es UX de cliente.
export interface PublicTestQuestion { q: string; options: string[]; }
export interface PublicTest {
  requirementId: string;
  questions: PublicTestQuestion[];  // 12, sin correctIndex
  totalSeconds: number;             // 120
  perQuestionSeconds: number;       // 10
  questionCount: number;            // 12
}
export interface TestAttemptView {
  id: string;
  requirementId: string;
  status: "in_progress" | "passed" | "failed";
  score: number;                    // 0..12
  startedAt: string;                // ISO
  deadlineAt: string;               // ISO (server-authoritative)
  finishedAt: string | null;
}
export interface TestSubmitResult {
  status: "passed" | "failed";
  score: number;                    // 0..12
  passed: boolean;                  // 12/12 dentro de tiempo
  questionCount: number;            // 12
  timedOut: boolean;                // true si se pasó del total + grace (servidor)
}

// ── Profesionales (Fase 3 §E) ─────────────────────────────────────────────────
export type Availability = "available" | "busy" | "away";
export interface ProfileLink { label: string; url: string; }

/** Mi perfil profesional (privado), que edito en la pestaña "Mi perfil". */
export interface MyProfessionalProfile {
  customerId: string;
  isProfessional: boolean;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  cvUrl: string | null;
  profileLinks: ProfileLink[];
  spokenLanguages: string[];
  availability: Availability;
  skills: string[];
  country: string | null;
  ratingAvg: number;        // 0..5
  ratingCount: number;
  activeJobsCount: number;
}

/** Proyección PÚBLICA NO sensible de un profesional (selector de ofertas). */
export interface PublicProfessional {
  customerId: string;
  displayName: string | null;
  headline: string | null;
  country: string | null;
  spokenLanguages: string[];
  availability: Availability;
  skills: string[];
  activeJobsCount: number;
  ratingAvg: number;        // 0..5
  ratingCount: number;
  hasCv: boolean;
  hasLinks: boolean;
}

/** Fila de ranking: proyección pública + score (el detalle es opcional en UI). */
export interface RankedProfessional extends PublicProfessional {
  score: { total: number } & Record<string, number>;
  /** Fase 11: si el requerimiento exige test, ¿este profesional lo aprobó?
   *  `undefined` si el requerimiento no exige test. */
  testPassed?: boolean;
}

// ── Tipos espejo del asistente IA (§A / §E.1 del contrato Fase 2) ─────────────
// `aiUsed:false` ⇒ la IA no corrió (sin OPENAI_API_KEY); el resultado es el
// neutro por defecto y la UI muestra `jobs.ai.unavailable`.

export interface AiCollectFields {
  title: string | null;
  description: string | null;
  country: string | null;
  language: string | null;
  workType: string | null;
  deliverables: string[];
  deadline: string | null;
}
export interface AiCollectResult {
  fields: AiCollectFields;
  missing: string[];
  questions: string[];
  aiUsed: boolean;
}

export interface AiModeration {
  status: ModerationStatus;
  reason: string | null;
  aiUsed: boolean;
}

export interface AiPlanMilestone { title: string; description: string; weight: number; }
export interface AiPlan {
  summary: string;
  milestones: AiPlanMilestone[];
  deliverables: string[];
  risks: string[];
}
export interface AiPlanResult { plan: AiPlan; aiUsed: boolean; }

export interface AiCostEstimate {
  estimateTokens: number;
  platformShare: number;
  professionalShare: number;
  rationale: string | null;
}
export interface AiCostEstimateResult { estimate: AiCostEstimate; aiUsed: boolean; }

export interface AiTranslatedRequirement {
  title: string;
  description: string;
  plan: AiPlan | null;
}
export interface AiTranslateResult {
  translations: Record<string, AiTranslatedRequirement>;
  aiUsed: boolean;
}

// ── Canal / bitácora del requerimiento (Fase 4 §D) ────────────────────────────
// El canal es solo de participantes (comprador ↔ assigneeId asignado) y NO mueve
// dinero. Compartir acceso es SIEMPRE por REFERENCIA (id / enlace / nota): JAMÁS
// material de llave.
export type ChannelMessageKind = "message" | "access_share" | "system";
export interface ChannelAttachment { url: string; type: string; name?: string; size?: number; }
export interface ChannelMessage {
  id: string; requirementId: string; senderId: string | null;
  kind: ChannelMessageKind; content: string; attachments: ChannelAttachment[];
  grantId: string | null; createdAt: string;
}
export interface ChannelParticipant { id: string; email: string; displayName: string | null; role: "buyer" | "assignee"; }
export type GrantResourceType = "server" | "ssh_key" | "group" | "link" | "note";
export interface AccessGrant {
  id: string; requirementId: string; grantedBy: string; grantedTo: string;
  resourceType: GrantResourceType; resourceRef: string; label: string;
  status: "active" | "revoked"; createdAt: string; revokedAt: string | null;
}

// ── Envelope canónico del backend ─────────────────────────────────────────────
// (Interno a `src/api/jobs/*`; la fachada `../jobs` NO lo re-exporta, igual que
// cuando vivía como `type Envelope` privado del archivo monolítico.)
export type Envelope<T> = { ok: boolean; data: T };

/** ¿El requerimiento está moderado-apto? (gate UI, espejo del §C del backend). */
export function isModerated(r: Requirement): boolean {
  return Boolean(r.moderationStatus && MODERATION_OK.has(r.moderationStatus));
}
