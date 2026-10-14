// Listado de requerimientos en tarjetas (Fase 6, IMPL-B).
// Espejo de `renderList`/`requirementCardHtml`/`buyerActions`/
// `professionalActions`/`detailAction`/`channelAction`/`statusBadge` del web.
// Las acciones se emiten como callbacks tipados; el padre (JobsScreen) decide
// qué modal abrir o qué endpoint llamar. El panel IA por tarjeta es solo lectura
// (componente `AiPanel`); su despliegue se controla por `aiSlots`.
import type { JobStatus, Requirement, TestAttemptView } from "../../api/jobs";
import { isModerated } from "../../api/jobs";
import { fmtDate, fmtTokens } from "./utils";
import { AiPanel, ModerationBadge, type AiSlot } from "./aiPanel";
import type { JobsMessages } from "./i18n";

export type JobRole = "buyer" | "professional";

/** Acción de tarjeta que la lista delega al padre. */
export type CardAction =
  | "moderate-plan" | "publish" | "delete" | "offer" | "release"
  | "channel" | "accept" | "reject" | "translate" | "detail" | "toggle-ai"
  // ── Fase 11: test técnico previo ──
  | "test-require" | "test-generate" | "start-test";

function statusBadgeClass(s: JobStatus): string {
  switch (s) {
    case "released": return "badge-success";
    case "disputed": return "badge-error";
    case "in_progress":
    case "assigned": return "badge-warning";
    case "cancelled": return "badge-ghost";
    default: return "badge-neutral";
  }
}

function StatusBadge({ s, j }: { s: JobStatus; j: JobsMessages }) {
  const label = (j.status as Record<string, string>)[s] ?? s;
  return <span className={`badge ${statusBadgeClass(s)} badge-sm`}>{label}</span>;
}

function ActionButton({
  label, onClick, variant = "ghost", disabled, title,
}: {
  label: string;
  onClick: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  const cls =
    variant === "primary" ? "btn-primary text-white"
    : variant === "danger" ? "btn-ghost text-error"
    : "btn-ghost";
  return (
    <button
      type="button"
      className={`btn btn-xs ${cls} normal-case`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {label}
    </button>
  );
}

function CardActions({
  r, role, j, busy, myAttempt, onAction,
}: {
  r: Requirement;
  role: JobRole;
  j: JobsMessages;
  busy: boolean;
  /** Fase 11: intento del profesional logueado en este requerimiento (o null). */
  myAttempt: TestAttemptView | null | undefined;
  onAction: (action: CardAction, r: Requirement) => void;
}) {
  const buttons: React.ReactNode[] = [];
  const channelBtn = r.assigneeId ? (
    <ActionButton key="channel" label={j.channel.title} onClick={() => onAction("channel", r)} disabled={busy} />
  ) : null;

  // ── Fase 11: controles del COMPRADOR (toggle exigir-test + generar). ──
  const buyerTestControls = (r.status === "draft" || r.status === "published") ? (
    <div key="buyer-test" className="flex flex-wrap items-center gap-2">
      <label className="label cursor-pointer gap-2 p-0">
        <input
          type="checkbox"
          className="toggle toggle-sm toggle-primary"
          checked={Boolean(r.requiresTest)}
          disabled={busy}
          onChange={() => onAction("test-require", r)}
        />
        <span className="label-text text-xs">{j.test.require}</span>
      </label>
      {r.requiresTest ? (
        <ActionButton key="gen" label={j.test.generate} onClick={() => onAction("test-generate", r)} disabled={busy} />
      ) : null}
    </div>
  ) : null;

  if (role === "buyer") {
    if (r.status === "draft") {
      const canPublish = isModerated(r);
      buttons.push(
        <ActionButton key="mp" label={j.ai.moderatePlan} onClick={() => onAction("moderate-plan", r)} disabled={busy} />,
        <ActionButton
          key="pub"
          label={j.action.publish}
          variant="primary"
          onClick={() => onAction("publish", r)}
          disabled={busy || !canPublish}
          title={canPublish ? undefined : j.ai.mustModerate}
        />,
        <ActionButton key="del" label={j.action.delete} variant="danger" onClick={() => onAction("delete", r)} disabled={busy} />,
      );
      if (buyerTestControls) buttons.push(buyerTestControls);
    } else if (r.status === "published") {
      buttons.push(
        <ActionButton key="offer" label={j.action.offer} variant="primary" onClick={() => onAction("offer", r)} disabled={busy} />,
        <ActionButton key="del" label={j.action.delete} variant="danger" onClick={() => onAction("delete", r)} disabled={busy} />,
      );
      if (buyerTestControls) buttons.push(buyerTestControls);
    } else if (r.status === "in_progress" || r.status === "assigned") {
      buttons.push(
        <ActionButton key="rel" label={j.action.release} variant="primary" onClick={() => onAction("release", r)} disabled={busy} />,
      );
      if (channelBtn) buttons.push(channelBtn);
      buttons.push(
        <ActionButton key="del" label={j.action.delete} onClick={() => undefined} disabled title={j.error.notCancellable} />,
      );
    } else if (channelBtn) {
      buttons.push(channelBtn);
    }
  } else {
    // Profesional
    const translateBtn = (
      <ActionButton key="tr" label={j.ai.translate} onClick={() => onAction("translate", r)} disabled={busy} />
    );
    if (r.status === "published") {
      if (r.requiresTest) {
        // ── Fase 11: gate del test. Aceptar requiere aprobar; "Presentar test"
        //    se deshabilita si ya hay intento (1 oportunidad). ──
        const passed = myAttempt?.status === "passed";
        const hasAttempt = Boolean(myAttempt);
        buttons.push(
          <span key="req-badge" className="badge badge-warning badge-sm">{j.test.required}</span>,
        );
        if (passed) {
          buttons.push(
            <span key="passed-badge" className="badge badge-success badge-sm">{j.test.passedBadge}</span>,
            <ActionButton key="acc" label={j.action.accept} variant="primary" onClick={() => onAction("accept", r)} disabled={busy} />,
          );
        } else {
          buttons.push(
            <ActionButton
              key="present"
              label={j.test.present}
              variant="primary"
              onClick={() => onAction("start-test", r)}
              disabled={busy || hasAttempt}
              title={hasAttempt ? j.test.attemptExists : undefined}
            />,
            <ActionButton key="acc" label={j.action.accept} onClick={() => undefined} disabled title={j.test.acceptLocked} />,
          );
          if (hasAttempt) {
            buttons.push(<span key="done-badge" className="badge badge-ghost badge-sm">{j.test.failed}</span>);
          }
        }
        buttons.push(
          <ActionButton key="rej" label={j.action.reject} variant="danger" onClick={() => onAction("reject", r)} disabled={busy} />,
          translateBtn,
        );
      } else {
        buttons.push(
          <ActionButton key="acc" label={j.action.accept} variant="primary" onClick={() => onAction("accept", r)} disabled={busy} />,
          <ActionButton key="rej" label={j.action.reject} variant="danger" onClick={() => onAction("reject", r)} disabled={busy} />,
          translateBtn,
        );
      }
    } else if (r.status === "assigned" || r.status === "in_progress") {
      buttons.push(translateBtn);
      if (channelBtn) buttons.push(channelBtn);
    } else if (channelBtn) {
      buttons.push(channelBtn);
    }
  }

  // Detalle (Fase 5) para ambos roles en no-borrador.
  if (r.status !== "draft") {
    buttons.push(
      <ActionButton key="det" label={j.action.detail} onClick={() => onAction("detail", r)} disabled={busy} />,
    );
  }
  return <div className="flex flex-wrap gap-1.5">{buttons}</div>;
}

function RequirementCard({
  r, role, j, busy, aiSlot, myAttempt, onAction,
}: {
  r: Requirement;
  role: JobRole;
  j: JobsMessages;
  busy: boolean;
  aiSlot: AiSlot | undefined;
  /** Fase 11: intento de test del profesional en este requerimiento. */
  myAttempt: TestAttemptView | null | undefined;
  onAction: (action: CardAction, r: Requirement) => void;
}) {
  const workTypeLabel = (j.workType as Record<string, string>)[r.workType] ?? r.workType;
  const modStatus = aiSlot?.moderation?.status ?? r.moderationStatus ?? null;
  const hasPanel = Boolean(
    modStatus || aiSlot?.plan || aiSlot?.estimate || aiSlot?.translation || r.aiPlan || r.costEstimate,
  );
  const expanded = aiSlot?.expanded ?? false;

  return (
    <article className="rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge s={r.status} j={j} />
          {modStatus ? <ModerationBadge status={modStatus} j={j} /> : null}
        </div>
        <span className="whitespace-nowrap text-sm font-semibold">
          {fmtTokens(r.acceptedPrice)} <small className="opacity-60">{j.field.price}</small>
        </span>
      </div>
      <h3 className="text-base font-semibold">{r.title}</h3>
      <p className="mt-1 line-clamp-3 text-sm opacity-80">{(r.description || "").slice(0, 220)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="badge badge-ghost badge-sm">{workTypeLabel}</span>
        <span className="badge badge-ghost badge-sm">{r.country}</span>
        <span className="badge badge-ghost badge-sm">{r.language}</span>
        {r.deadlineAt ? (
          <span className="opacity-60">{j.field.deadline}: {fmtDate(r.deadlineAt)}</span>
        ) : null}
        <span className="opacity-50">{fmtDate(r.createdAt)}</span>
      </div>
      <div className="mt-3">
        <CardActions r={r} role={role} j={j} busy={busy} myAttempt={myAttempt} onAction={onAction} />
      </div>
      {hasPanel ? (
        <div className="mt-2">
          <button
            type="button"
            className="btn btn-ghost btn-xs normal-case"
            onClick={() => onAction("toggle-ai", r)}
          >
            {j.ai.plan} {expanded ? "▴" : "▾"}
          </button>
          {expanded ? <AiPanel requirement={r} slot={aiSlot} j={j} /> : null}
        </div>
      ) : null}
    </article>
  );
}

export function JobsList({
  rows, role, j, loading, busy, aiSlots, myAttempts, onAction,
}: {
  rows: Requirement[];
  role: JobRole;
  j: JobsMessages;
  loading: boolean;
  busy: boolean;
  aiSlots: Record<string, AiSlot | undefined>;
  /** Fase 11: intentos de test del profesional por requirementId (gate del CTA). */
  myAttempts?: Record<string, TestAttemptView | null | undefined>;
  onAction: (action: CardAction, r: Requirement) => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-base-200" />
        ))}
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-base-300 p-8 text-center text-sm opacity-70">
        {role === "buyer" ? j.empty.buyer : j.empty.professional}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((r) => (
        <RequirementCard
          key={r.id}
          r={r}
          role={role}
          j={j}
          busy={busy}
          aiSlot={aiSlots[r.id]}
          myAttempt={myAttempts?.[r.id]}
          onAction={onAction}
        />
      ))}
    </div>
  );
}
