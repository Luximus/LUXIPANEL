// Panel IA desplegable de una tarjeta de requerimiento (Fase 6, IMPL-B).
// Espejo de `aiPanelHtml`/`planHtml`/`estimateHtml`/`moderationBadge` del web:
// muestra moderación + plan + estimación + traducción ya calculados (solo
// lectura). No dispara red; el disparo de moderar/planear/traducir vive en la
// tarjeta/lista. `aiUsed === false` ⇒ aviso `ai.unavailable`.
import type {
  AiCostEstimate, AiModeration, AiPlan, AiTranslatedRequirement, Requirement,
} from "../../api/jobs";
import { MODERATION_OK } from "../../api/jobs";
import { fmtTokens } from "./utils";
import type { JobsMessages } from "./i18n";

/** Estado IA acumulado por requirement (lo mantiene la lista en memoria). */
export interface AiSlot {
  moderation?: AiModeration;
  plan?: AiPlan;
  estimate?: AiCostEstimate;
  translation?: AiTranslatedRequirement;
  expanded?: boolean;
}

function moderationLabel(j: JobsMessages, status: string): string {
  const map = j.ai.moderation as Record<string, string>;
  return map[status] ?? status;
}

export function ModerationBadge({ status, j }: { status: string | null | undefined; j: JobsMessages }) {
  if (!status) return null;
  const ok = MODERATION_OK.has(status);
  return (
    <span className={`badge ${ok ? "badge-success" : "badge-warning"} badge-sm`}>
      {moderationLabel(j, status)}
    </span>
  );
}

function PlanBlock({ plan, j }: { plan: AiPlan; j: JobsMessages }) {
  return (
    <div className="space-y-2">
      {plan.summary ? <p className="text-sm opacity-90">{plan.summary}</p> : null}
      {plan.milestones?.length ? (
        <div>
          <h5 className="text-xs font-semibold uppercase opacity-70">{j.ai.milestones}</h5>
          <ul className="list-disc pl-5 text-sm">
            {plan.milestones.map((m, i) => (
              <li key={i}>
                <strong>{m.title}</strong>
                {m.description ? `: ${m.description}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {plan.deliverables?.length ? (
        <div>
          <h5 className="text-xs font-semibold uppercase opacity-70">{j.field.deliverables}</h5>
          <ul className="list-disc pl-5 text-sm">
            {plan.deliverables.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>
      ) : null}
      {plan.risks?.length ? (
        <div>
          <h5 className="text-xs font-semibold uppercase opacity-70">{j.ai.risks}</h5>
          <ul className="list-disc pl-5 text-sm">
            {plan.risks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function EstimateBlock({ est, j }: { est: AiCostEstimate; j: JobsMessages }) {
  return (
    <div className="rounded-lg bg-base-200 p-2">
      <div className="text-sm">
        <strong>{j.ai.estimate}:</strong> {fmtTokens(est.estimateTokens)}
      </div>
      <div className="mt-1 flex flex-wrap gap-2">
        <span className="badge badge-ghost badge-sm">
          {j.ai.professionalShare}: {fmtTokens(est.professionalShare)}
        </span>
        <span className="badge badge-ghost badge-sm">
          {j.ai.platformShare}: {fmtTokens(est.platformShare)}
        </span>
      </div>
      {est.rationale ? <p className="mt-1 text-xs opacity-70">{est.rationale}</p> : null}
    </div>
  );
}

/** Panel IA completo de un requirement (moderación + plan + estimación + traducción). */
export function AiPanel({
  requirement,
  slot,
  j,
}: {
  requirement: Requirement;
  slot: AiSlot | undefined;
  j: JobsMessages;
}) {
  const ai = slot ?? {};
  const modStatus = ai.moderation?.status ?? requirement.moderationStatus ?? null;
  const reason = ai.moderation?.reason ?? requirement.moderationReason ?? null;
  const plan = ai.plan ?? requirement.aiPlan ?? null;
  const est = ai.estimate ?? requirement.costEstimate ?? null;
  const tr = ai.translation ?? null;
  if (!modStatus && !plan && !est && !tr) return null;

  const unavailable = ai.moderation && ai.moderation.aiUsed === false;

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-base-300 bg-base-100 p-3">
      {unavailable ? <p className="text-sm text-warning">{j.ai.unavailable}</p> : null}
      {modStatus ? (
        <div className="flex flex-wrap items-center gap-2">
          <ModerationBadge status={modStatus} j={j} />
          {reason ? <span className="text-xs opacity-70">{reason}</span> : null}
        </div>
      ) : null}
      {plan ? (
        <div>
          <h5 className="mb-1 text-xs font-semibold uppercase opacity-70">{j.ai.plan}</h5>
          <PlanBlock plan={plan} j={j} />
        </div>
      ) : null}
      {est ? <EstimateBlock est={est} j={j} /> : null}
      {tr ? (
        <div className="border-t border-base-300 pt-2">
          <h5 className="text-xs font-semibold uppercase opacity-70">{j.ai.translate}</h5>
          <h4 className="font-semibold">{tr.title}</h4>
          <p className="text-sm opacity-90">{tr.description}</p>
          {tr.plan ? <PlanBlock plan={tr.plan} j={j} /> : null}
        </div>
      ) : null}
    </div>
  );
}
