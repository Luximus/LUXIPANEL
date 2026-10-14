// Modal de detalle avanzado (Fase 5) (Fase 6, IMPL-B).
// Espejo de `openDetailModal`/`refreshDetail`/`renderDetail`/`onDetailAction`
// y las secciones `detailProgressHtml`/`detailMilestoneHtml`/`detailEditHtml`/
// `detailDisputeHtml`/`detailRatingHtml` del web. Pinta los controles según
// rol + estado; el backend re-valida cada gate. `aiUsed === false` ⇒ aviso
// `ai.unavailable` al revisar avance.
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  getRequirementDetail, aiReviewProgress, jobsErrorKey,
  requestMilestone, approveMilestone, editRequirement, proposeEdit,
  acceptEditProposal, rejectEditProposal, requestDispute, resolveDispute, submitRating,
  reprovisionServer, execServerCommand,
  type Requirement, type RequirementDetail,
} from "../../api/jobs";
import { useToast } from "../ToastProvider";
import { fmtTokens, toDateInput, disputeEligible } from "./utils";
import type { JobsMessages, JobsServerMessages } from "./i18n";
import { formatMessage } from "../../i18n";

export type DetailRole = "buyer" | "professional";

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1 text-2xl">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          className={(hover || value) >= n ? "text-warning" : "opacity-30"}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange?.(n)}
          aria-label={String(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function RequirementDetailModal({
  open, token, requirementId, role, j, onClose, onChanged,
}: {
  open: boolean;
  token: string;
  requirementId: string | null;
  role: DetailRole;
  j: JobsMessages & { server: JobsServerMessages };
  onClose: () => void;
  /** Notifica al padre que el detalle cambió de estado (re-cargar la lista). */
  onChanged: () => void;
}) {
  const toast = useToast();
  const [detail, setDetail] = useState<RequirementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Campos de formulario de las secciones.
  const [msNote, setMsNote] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editTopup, setEditTopup] = useState("0");
  const [disputeReason, setDisputeReason] = useState("");
  const [refundPct, setRefundPct] = useState("50");
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  // Modalidad "servidor": consola job-scoped.
  const [serverCmd, setServerCmd] = useState("");
  const [serverOut, setServerOut] = useState("");

  const errKey = useCallback((err: unknown): string => {
    const path = jobsErrorKey(err).split(".");
    let node: unknown = j;
    for (const p of path) node = (node as Record<string, unknown>)?.[p];
    return typeof node === "string" ? node : (err instanceof Error ? err.message : j.error.generic);
  }, [j]);

  const refresh = useCallback(async () => {
    if (!requirementId) return;
    setLoading(true);
    setError("");
    try {
      const d = await getRequirementDetail(token, requirementId);
      setDetail(d);
      // Siembra los campos editables con los valores actuales.
      setEditTitle(d.requirement.title);
      setEditDesc(d.requirement.description || "");
      setEditDeadline(toDateInput(d.requirement.deadlineAt));
      setEditPrice(String(d.requirement.acceptedPrice));
      setEditTopup("0");
    } catch (err) {
      setError(errKey(err));
    } finally {
      setLoading(false);
    }
  }, [token, requirementId, errKey]);

  useEffect(() => {
    if (!open || !requirementId) return;
    setDetail(null);
    setMsNote("");
    setDisputeReason("");
    setRefundPct("50");
    setRatingValue(0);
    setRatingComment("");
    void refresh();
  }, [open, requirementId, refresh]);

  if (!open || !requirementId) return null;

  // Construye el patch de edición a partir de los campos cambiados.
  function readEditPatch(r: Requirement): { patch: Record<string, unknown>; topup: number; price?: number } {
    const patch: Record<string, unknown> = {};
    const ttl = editTitle.trim();
    const desc = editDesc.trim();
    if (ttl && ttl !== r.title) patch.title = ttl;
    if (desc && desc !== (r.description || "")) patch.description = desc;
    if (editDeadline.trim()) {
      const iso = new Date(editDeadline.trim()).toISOString();
      if (iso !== (r.deadlineAt ? new Date(r.deadlineAt).toISOString() : null)) patch.deadlineAt = iso;
    }
    const topup = parseInt(editTopup, 10);
    const price = parseInt(editPrice, 10);
    return {
      patch,
      topup: Number.isFinite(topup) && topup > 0 ? topup : 0,
      price: Number.isFinite(price) && price > 0 ? price : undefined,
    };
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
      onChanged();
    } catch (err) {
      setError(errKey(err));
    } finally {
      setBusy(false);
    }
  }

  // Consola job-scoped: ejecuta el comando sobre el servidor del cliente (gateway).
  // No usa `run` (no debe refrescar el detalle ni cerrar nada): maneja su salida.
  async function runServerConsole() {
    const cmd = serverCmd.trim();
    if (!cmd || !requirementId) return;
    setServerOut("…");
    try {
      const out = await execServerCommand(token, requirementId, cmd);
      const body = (out.stdout || "") + (out.stderr ? `\n${out.stderr}` : "");
      setServerOut(`$ ${cmd}\n${body}\n[exit ${out.exitCode}]`);
      setServerCmd("");
    } catch (err) {
      setServerOut(errKey(err));
    }
  }

  const r = detail?.requirement ?? null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <button type="button" className="btn btn-sm btn-circle btn-ghost absolute end-3 top-3" onClick={onClose} aria-label="x">
          <X size={16} />
        </button>
        <h3 className="text-lg font-bold">{j.action.detail}</h3>

        {loading || !detail || !r ? (
          <div className="mt-4 h-40 animate-pulse rounded-xl bg-base-200" />
        ) : (
          <div className="mt-4 space-y-4">
            {/* Cabecera */}
            <div className="rounded-xl border border-base-300 p-3">
              <div className="flex items-center justify-between">
                <span className="badge badge-neutral badge-sm">{(j.status as Record<string, string>)[r.status] ?? r.status}</span>
                <span className="text-sm font-semibold">{fmtTokens(r.acceptedPrice)} <small className="opacity-60">{j.field.price}</small></span>
              </div>
              <h4 className="mt-1 font-semibold">{r.title}</h4>
              <p className="text-sm opacity-80">{(r.description || "").slice(0, 400)}</p>
            </div>

            {/* Modalidad "Servidor": estado de acceso + consola job-scoped */}
            {r.executionMode === "server" ? (() => {
              const sess = detail.serverSession ?? null;
              const status = sess?.status ?? "none";
              const statusLabel = (j.server as unknown as Record<string, string>)[
                "status" + status.charAt(0).toUpperCase() + status.slice(1)
              ] ?? status;
              const isWorker = role === "professional" && r.status === "in_progress";
              return (
                <section className="rounded-xl border border-base-300 p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{j.server.panelTitle}</h4>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-sm badge-neutral">{statusLabel}</span>
                      {sess?.provider ? <span className="badge badge-sm">{sess.provider}</span> : null}
                    </div>
                  </div>
                  {sess?.error && status === "error" ? <p className="mt-1 text-sm text-error">{sess.error}</p> : null}
                  {isWorker && (status === "error" || status === "none" || status === "revoked") ? (
                    <button
                      type="button"
                      className="btn btn-sm mt-2"
                      disabled={busy}
                      onClick={() => void run(async () => {
                        await reprovisionServer(token, requirementId!);
                        toast.success(j.server.toastReprovisioned);
                      })}
                    >
                      {j.server.reprovision}
                    </button>
                  ) : null}
                  {isWorker && status === "active" ? (
                    <div className="mt-3">
                      <span className="label-text mb-1 block">{j.server.console}</span>
                      <div className="flex gap-2">
                        <input
                          className="input input-bordered input-sm flex-1 font-mono"
                          placeholder={j.server.consolePlaceholder}
                          value={serverCmd}
                          onChange={(e) => setServerCmd(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") void runServerConsole(); }}
                        />
                        <button type="button" className="btn btn-sm btn-primary" disabled={busy || !serverCmd.trim()} onClick={() => void runServerConsole()}>
                          {j.server.consoleRun}
                        </button>
                      </div>
                      <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-base-300/40 p-2 text-xs">
                        {serverOut || j.server.consoleEmpty}
                      </pre>
                    </div>
                  ) : null}
                </section>
              );
            })() : null}

            {/* Avance del trabajo (ambos roles) */}
            <section className="rounded-xl border border-base-300 p-3">
              <h4 className="mb-2 font-semibold">{j.progress.title}</h4>
              {typeof r.progressPct === "number" ? (
                <>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-semibold">{Math.max(0, Math.min(100, r.progressPct))}%</span>
                    <span className={`badge badge-sm ${r.progressMeets100 ? "badge-success" : "badge-warning"}`}>
                      {r.progressMeets100 ? j.progress.meets100 : j.progress.inProgress}
                    </span>
                  </div>
                  <progress className="progress progress-primary w-full" value={Math.max(0, Math.min(100, r.progressPct))} max={100} />
                </>
              ) : null}
              {r.progressReport ? (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer opacity-80">{j.progress.report}</summary>
                  <p className="mt-1 whitespace-pre-wrap opacity-80">{r.progressReport}</p>
                </details>
              ) : null}
              <div className="mt-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => void run(async () => {
                    const res = await aiReviewProgress(token, requirementId!);
                    if (res.aiUsed === false) toast.error(j.ai.unavailable);
                    else toast.success(j.progress.toast.done);
                  })}
                >
                  {j.progress.review}
                </button>
              </div>
            </section>

            {/* Hito 50% — funciones de render (no componentes) para no remontar
                los inputs controlados en cada tecla. */}
            {r.status === "in_progress" ? renderMilestoneSection({
              detail,
              role,
              j,
              busy,
              msNote,
              setMsNote,
              onRequest: () => void run(async () => {
                await requestMilestone(token, requirementId!, msNote.trim() || undefined);
                toast.success(j.milestone.toast.requested);
              }),
              onApprove: () => void run(async () => {
                const ms = await approveMilestone(token, requirementId!);
                toast.success(`${j.milestone.toast.approved} · ${formatMessage(j.milestone.split, { dev: fmtTokens(ms.devShare), fee: fmtTokens(ms.feeShare) })}`);
              }),
            }) : null}

            {/* Editar / proponer cambios */}
            {renderEditSection({
              detail,
              role,
              j,
              busy,
              editTitle, setEditTitle,
              editDesc, setEditDesc,
              editDeadline, setEditDeadline,
              editPrice, setEditPrice,
              editTopup, setEditTopup,
              onSave: () => void run(async () => {
                const { patch, price } = readEditPatch(r);
                if (typeof price === "number" && price !== r.acceptedPrice) patch.acceptedPrice = price;
                if (!Object.keys(patch).length) { setError(j.error.generic); return; }
                await editRequirement(token, requirementId!, patch);
                toast.success(j.edit.toast.saved);
              }),
              onPropose: () => void run(async () => {
                const { patch, topup } = readEditPatch(r);
                if (!Object.keys(patch).length) { setError(j.error.generic); return; }
                await proposeEdit(token, requirementId!, patch, topup || undefined);
                toast.success(j.edit.toast.proposed);
              }),
              onAcceptProposal: (pid: string) => void run(async () => {
                await acceptEditProposal(token, pid);
                toast.success(j.edit.toast.accepted);
              }),
              onRejectProposal: (pid: string) => void run(async () => {
                await rejectEditProposal(token, pid);
                toast.success(j.edit.toast.rejected);
              }),
            })}

            {/* Disputa / reembolso */}
            {renderDisputeSection({
              detail,
              role,
              j,
              busy,
              reason: disputeReason, setReason: setDisputeReason,
              refundPct, setRefundPct,
              onRequest: () => void run(async () => {
                if (!disputeReason.trim()) { setError(j.dispute.reason); return; }
                await requestDispute(token, requirementId!, disputeReason.trim());
                toast.success(j.dispute.toast.requested);
              }),
              onResolveContinue: () => void run(async () => {
                await resolveDispute(token, requirementId!, "continue");
                toast.success(j.dispute.toast.resolved);
              }),
              onResolveFull: () => void run(async () => {
                await resolveDispute(token, requirementId!, "refund_full");
                toast.success(j.dispute.toast.resolved);
              }),
              onResolvePartial: () => void run(async () => {
                const pct = parseInt(refundPct, 10);
                if (!Number.isFinite(pct) || pct < 1 || pct > 99) { setError(j.dispute.refundPct); return; }
                await resolveDispute(token, requirementId!, "refund_partial", Math.round(pct * 100));
                toast.success(j.dispute.toast.resolved);
              }),
            })}

            {/* Calificación */}
            {renderRatingSection({
              detail,
              role,
              j,
              busy,
              value: ratingValue, setValue: setRatingValue,
              comment: ratingComment, setComment: setRatingComment,
              onSubmit: () => void run(async () => {
                if (!ratingValue || ratingValue < 1 || ratingValue > 5) { setError(j.rating.title); return; }
                await submitRating(token, requirementId!, ratingValue, ratingComment.trim() || undefined);
                toast.success(j.rating.toast.done);
              }),
            })}
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
      </div>
    </div>
  );

  // ── Subsecciones: funciones de render (NO componentes) para no perder el foco
  //    de los inputs controlados en cada render del modal. ──
  function renderMilestoneSection(p: {
    detail: RequirementDetail; role: DetailRole; j: JobsMessages; busy: boolean;
    msNote: string; setMsNote: (v: string) => void;
    onRequest: () => void; onApprove: () => void;
  }) {
    const ms = p.detail.requirement.milestoneStatus;
    return (
      <section className="rounded-xl border border-base-300 p-3">
        <h4 className="mb-2 font-semibold">{p.j.milestone.title}</h4>
        {ms === "approved" ? (
          <span className="badge badge-success badge-sm">{p.j.milestone.approved}</span>
        ) : ms === "requested" ? (
          <div className="flex items-center gap-2">
            <span className="badge badge-warning badge-sm">{p.j.milestone.requested}</span>
            {p.role === "buyer" ? (
              <button type="button" className="btn btn-primary btn-sm" disabled={p.busy} onClick={p.onApprove}>{p.j.milestone.approve}</button>
            ) : null}
          </div>
        ) : p.role === "professional" ? (
          <div className="space-y-2">
            <label className="form-control">
              <span className="label-text mb-1">{p.j.milestone.note}</span>
              <input className="input input-bordered input-sm" maxLength={2000} value={p.msNote} onChange={(e) => p.setMsNote(e.target.value)} />
            </label>
            <button type="button" className="btn btn-primary btn-sm" disabled={p.busy} onClick={p.onRequest}>{p.j.milestone.request}</button>
          </div>
        ) : (
          <p className="text-sm opacity-60">—</p>
        )}
      </section>
    );
  }

  function renderEditSection(p: {
    detail: RequirementDetail; role: DetailRole; j: JobsMessages; busy: boolean;
    editTitle: string; setEditTitle: (v: string) => void;
    editDesc: string; setEditDesc: (v: string) => void;
    editDeadline: string; setEditDeadline: (v: string) => void;
    editPrice: string; setEditPrice: (v: string) => void;
    editTopup: string; setEditTopup: (v: string) => void;
    onSave: () => void; onPropose: () => void;
    onAcceptProposal: (pid: string) => void; onRejectProposal: (pid: string) => void;
  }) {
    const req = p.detail.requirement;
    const prop = p.detail.editProposal;
    // Propuesta viva: el profesional la acepta/rechaza (con aviso de costo).
    if (prop && prop.status === "pending" && p.role === "professional") {
      const topup = prop.topupAmount || 0;
      return (
        <section className="rounded-xl border border-base-300 p-3">
          <h4 className="mb-2 font-semibold">{p.j.edit.pending}</h4>
          <ul className="list-disc pl-5 text-sm">
            {prop.patch.title ? <li><strong>{p.j.field.title}:</strong> {prop.patch.title}</li> : null}
            {prop.patch.description ? <li><strong>{p.j.field.description}:</strong> {String(prop.patch.description).slice(0, 400)}</li> : null}
            {prop.patch.deadlineAt ? <li><strong>{p.j.field.deadline}:</strong> {toDateInput(prop.patch.deadlineAt)}</li> : null}
          </ul>
          {topup > 0 ? <p className="mt-1 text-sm text-warning">⚠ {formatMessage(p.j.edit.topupWarn, { n: fmtTokens(topup) })}</p> : null}
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={p.busy} onClick={() => p.onAcceptProposal(prop.id)}>{p.j.edit.accept}</button>
            <button type="button" className="btn btn-ghost btn-sm text-error" disabled={p.busy} onClick={() => p.onRejectProposal(prop.id)}>{p.j.edit.reject}</button>
          </div>
        </section>
      );
    }
    if (p.role !== "buyer") return null;
    const editable = req.status === "draft" || req.status === "published";
    const inProgress = req.status === "in_progress";
    if (!editable && !inProgress) return null;
    return (
      <section className="rounded-xl border border-base-300 p-3">
        <h4 className="mb-2 font-semibold">{inProgress ? p.j.edit.propose : p.j.edit.title}</h4>
        {prop && prop.status === "pending" ? <p className="mb-2 text-sm opacity-70">{p.j.edit.pending}…</p> : null}
        <div className="grid gap-2">
          <label className="form-control">
            <span className="label-text mb-1">{p.j.field.title}</span>
            <input className="input input-bordered input-sm" maxLength={200} value={p.editTitle} onChange={(e) => p.setEditTitle(e.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1">{p.j.field.description}</span>
            <textarea className="textarea textarea-bordered" rows={3} maxLength={20000} value={p.editDesc} onChange={(e) => p.setEditDesc(e.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1">{p.j.field.deadline}</span>
            <input className="input input-bordered input-sm" type="date" value={p.editDeadline} onChange={(e) => p.setEditDeadline(e.target.value)} />
          </label>
          {inProgress ? (
            <label className="form-control">
              <span className="label-text mb-1">{p.j.edit.topup}</span>
              <input className="input input-bordered input-sm" type="number" min={0} step={1} value={p.editTopup} onChange={(e) => p.setEditTopup(e.target.value)} />
            </label>
          ) : (
            <label className="form-control">
              <span className="label-text mb-1">{p.j.field.price}</span>
              <input className="input input-bordered input-sm" type="number" min={1} step={1} value={p.editPrice} onChange={(e) => p.setEditPrice(e.target.value)} />
            </label>
          )}
        </div>
        <p className="mt-2 text-sm text-warning">⚠ {p.j.edit.remoderate}</p>
        <div className="mt-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={p.busy} onClick={inProgress ? p.onPropose : p.onSave}>
            {inProgress ? p.j.edit.propose : p.j.edit.save}
          </button>
        </div>
      </section>
    );
  }

  function renderDisputeSection(p: {
    detail: RequirementDetail; role: DetailRole; j: JobsMessages; busy: boolean;
    reason: string; setReason: (v: string) => void;
    refundPct: string; setRefundPct: (v: string) => void;
    onRequest: () => void; onResolveContinue: () => void;
    onResolveFull: () => void; onResolvePartial: () => void;
  }) {
    const req = p.detail.requirement;
    if (req.status === "disputed") {
      const reason = p.detail.dispute?.reason;
      if (p.role !== "buyer") {
        return (
          <section className="rounded-xl border border-base-300 p-3">
            <h4 className="mb-2 font-semibold">{p.j.dispute.title}</h4>
            <span className="badge badge-warning badge-sm">{p.j.dispute.open}</span>
            {reason ? <p className="mt-1 text-sm opacity-70">{reason}</p> : null}
          </section>
        );
      }
      return (
        <section className="rounded-xl border border-base-300 p-3">
          <h4 className="mb-2 font-semibold"><span className="badge badge-warning badge-sm">{p.j.dispute.badge}</span></h4>
          {reason ? <p className="mb-2 text-sm opacity-70">{reason}</p> : null}
          <label className="form-control">
            <span className="label-text mb-1">{p.j.dispute.refundPct}</span>
            <input className="input input-bordered input-sm" type="number" min={1} max={99} step={1} value={p.refundPct} onChange={(e) => p.setRefundPct(e.target.value)} />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={p.busy} onClick={p.onResolveContinue}>{p.j.dispute.continue}</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={p.busy} onClick={p.onResolvePartial}>{p.j.dispute.refundPartial}</button>
            <button type="button" className="btn btn-ghost btn-sm text-error" disabled={p.busy} onClick={p.onResolveFull}>{p.j.dispute.refundFull}</button>
          </div>
        </section>
      );
    }
    if (p.role === "professional" && req.status === "in_progress") {
      const eligible = disputeEligible(req);
      return (
        <section className="rounded-xl border border-base-300 p-3">
          <h4 className="mb-2 font-semibold">{p.j.dispute.title}</h4>
          <label className="form-control">
            <span className="label-text mb-1">{p.j.dispute.reason}</span>
            <textarea className="textarea textarea-bordered" rows={2} maxLength={2000} value={p.reason} onChange={(e) => p.setReason(e.target.value)} />
          </label>
          {!eligible ? <p className="mt-1 text-sm opacity-70">{p.j.dispute.notEligible}</p> : null}
          <div className="mt-2">
            <button type="button" className="btn btn-ghost btn-sm text-error" disabled={p.busy || !eligible} title={eligible ? undefined : p.j.dispute.notEligible} onClick={p.onRequest}>
              {p.j.dispute.request}
            </button>
          </div>
        </section>
      );
    }
    return null;
  }

  function renderRatingSection(p: {
    detail: RequirementDetail; role: DetailRole; j: JobsMessages; busy: boolean;
    value: number; setValue: (n: number) => void;
    comment: string; setComment: (v: string) => void;
    onSubmit: () => void;
  }) {
    const req = p.detail.requirement;
    if (req.status !== "released") return null;
    if (p.detail.review) {
      return (
        <section className="rounded-xl border border-base-300 p-3">
          <h4 className="mb-2 font-semibold">{p.j.rating.title}</h4>
          <Stars value={p.detail.review.rating} />
          {p.detail.review.comment ? <p className="mt-1 text-sm opacity-70">{p.detail.review.comment}</p> : null}
          <p className="mt-1 text-sm opacity-60">{p.j.rating.done}</p>
        </section>
      );
    }
    if (p.role !== "buyer") return null;
    return (
      <section className="rounded-xl border border-base-300 p-3">
        <h4 className="mb-2 font-semibold">{p.j.rating.title}</h4>
        <Stars value={p.value} onChange={p.setValue} />
        <label className="form-control mt-2">
          <span className="label-text mb-1">{p.j.rating.comment}</span>
          <textarea className="textarea textarea-bordered" rows={2} maxLength={2000} value={p.comment} onChange={(e) => p.setComment(e.target.value)} />
        </label>
        <div className="mt-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={p.busy} onClick={p.onSubmit}>{p.j.rating.submit}</button>
        </div>
      </section>
    );
  }
}
