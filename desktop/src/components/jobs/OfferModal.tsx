// Modal "Ofertar a profesional" (Fase 6, IMPL-B).
// Espejo de `openOfferModal`/`loadRankedProfessionals`/`searchProfessional`/
// `sendOffer`/`professionalCardHtml`/`renderOfferCta` del web. Carga el ranking
// del requerimiento, permite filtrar por disponibles, buscar por email exacto y
// seleccionar varios profesionales; el CTA muestra el nº y envía a todos.
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  listRankedProfessionals, searchProfessionalByEmail, sendOffers, jobsErrorKey,
  type PublicProfessional, type RankedProfessional,
} from "../../api/jobs";
import type { JobsMessages } from "./i18n";
import { formatMessage } from "../../i18n";

function ProfessionalCard({
  p, score, selected, j, testPassed, onToggle,
}: {
  p: PublicProfessional;
  score?: number;
  selected: boolean;
  j: JobsMessages;
  /** Fase 11: si el requerimiento exige test, ¿este profesional lo aprobó?
   *  `undefined` ⇒ el requerimiento no exige test (sin chip). */
  testPassed?: boolean;
  onToggle: () => void;
}) {
  const name = p.displayName || p.customerId;
  const availLabel = (j.profile.avail as Record<string, string>)[p.availability] ?? p.availability;
  const availCls = p.availability === "available" ? "badge-success" : "badge-warning";
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${selected ? "border-primary bg-primary/5" : "border-base-300"}`}
    >
      <input type="checkbox" className="checkbox checkbox-sm mt-1" checked={selected} onChange={onToggle} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <strong className="truncate">{name}</strong>
          <span className={`badge ${availCls} badge-sm`}>{availLabel}</span>
        </div>
        {p.headline ? <p className="truncate text-sm opacity-80">{p.headline}</p> : null}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          {p.country ? <span className="badge badge-ghost badge-sm">{p.country}</span> : null}
          {(p.spokenLanguages || []).map((l, i) => <span key={i} className="badge badge-ghost badge-sm">{l}</span>)}
          {p.ratingCount > 0 ? (
            <span className="badge badge-ghost badge-sm">★ {p.ratingAvg.toFixed(1)} ({p.ratingCount})</span>
          ) : null}
          <span className="badge badge-ghost badge-sm">{formatMessage(j.prof.busyCount, { n: p.activeJobsCount })}</span>
          {typeof score === "number" ? (
            <span className="badge badge-primary badge-sm">{j.prof.score}: {Math.round(score)}</span>
          ) : null}
          {typeof testPassed === "boolean" ? (
            <span className={`badge badge-sm ${testPassed ? "badge-success" : "badge-ghost"}`}>
              {testPassed ? j.test.passedBadge : j.test.noTestBadge}
            </span>
          ) : null}
        </div>
        {(p.skills || []).length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {(p.skills || []).slice(0, 6).map((s, i) => <span key={i} className="badge badge-outline badge-sm">{s}</span>)}
          </div>
        ) : null}
      </div>
    </label>
  );
}

export function OfferModal({
  open, token, requirementId, j, cancelLabel, onClose, onSent,
}: {
  open: boolean;
  token: string;
  requirementId: string | null;
  j: JobsMessages;
  cancelLabel: string;
  onClose: () => void;
  /** Notifica el resumen `{sent, skipped}` para que el padre muestre el toast. */
  onSent: (summary: { sent: number; skipped: number }) => void;
}) {
  const [ranked, setRanked] = useState<RankedProfessional[]>([]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState<PublicProfessional | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const errKey = useCallback((err: unknown): string => {
    const path = jobsErrorKey(err).split(".");
    let node: unknown = j;
    for (const p of path) node = (node as Record<string, unknown>)?.[p];
    return typeof node === "string" ? node : (err instanceof Error ? err.message : j.error.generic);
  }, [j]);

  const loadRanked = useCallback(async () => {
    if (!requirementId) return;
    setLoading(true);
    setError("");
    try {
      setRanked(await listRankedProfessionals(token, requirementId, onlyAvailable));
    } catch (err) {
      setRanked([]);
      setError(errKey(err));
    } finally {
      setLoading(false);
    }
  }, [requirementId, token, onlyAvailable, errKey]);

  // Reinicia el estado y recarga el ranking al abrir / cambiar de requerimiento.
  useEffect(() => {
    if (!open || !requirementId) return;
    setSearch("");
    setSearchResult(null);
    setSelected(new Set());
    setMessage("");
    setError("");
    void loadRanked();
  }, [open, requirementId, loadRanked]);

  if (!open || !requirementId) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function doSearch() {
    const email = search.trim();
    if (!email) { setSearchResult(null); return; }
    setError("");
    try {
      const p = await searchProfessionalByEmail(token, email);
      setSearchResult(p);
      if (!p) setError(j.prof.search.empty);
    } catch (err) {
      setError(errKey(err));
    }
  }

  async function submit() {
    const professionalIds = [...selected];
    if (!professionalIds.length) { setError(j.offer.none.selected); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await sendOffers(token, requirementId!, {
        professionalIds,
        message: message.trim() || undefined,
      });
      onSent({ sent: (res.offers ?? []).length, skipped: (res.skipped ?? []).length });
      onClose();
    } catch (err) {
      setError(errKey(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <button type="button" className="btn btn-sm btn-circle btn-ghost absolute end-3 top-3" onClick={onClose} aria-label="x">
          <X size={16} />
        </button>
        <h3 className="text-lg font-bold">{j.action.offer}</h3>

        {/* Búsqueda por email exacto */}
        <div className="mt-4 flex gap-2">
          <input
            className="input input-bordered flex-1"
            placeholder={j.offer.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void doSearch(); }}
          />
          <label className="label cursor-pointer gap-2">
            <input type="checkbox" className="checkbox checkbox-sm" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
            <span className="label-text">{j.offer.onlyAvailable}</span>
          </label>
        </div>

        {searchResult ? (
          <div className="mt-3">
            <ProfessionalCard
              p={searchResult}
              selected={selected.has(searchResult.customerId)}
              j={j}
              onToggle={() => toggle(searchResult.customerId)}
            />
          </div>
        ) : null}

        {/* Ranking */}
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {loading ? (
            [0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-base-200" />)
          ) : ranked.length ? (
            ranked.map((p) => (
              <ProfessionalCard
                key={p.customerId}
                p={p}
                score={p.score?.total}
                selected={selected.has(p.customerId)}
                j={j}
                testPassed={p.testPassed}
                onToggle={() => toggle(p.customerId)}
              />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-base-300 p-6 text-center text-sm opacity-70">
              {j.prof.search.empty}
            </div>
          )}
        </div>

        <label className="form-control mt-3">
          <span className="label-text mb-1">{j.offer.message}</span>
          <textarea className="textarea textarea-bordered" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>

        {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{cancelLabel}</button>
          <button type="button" className="btn btn-primary gap-2" onClick={() => void submit()} disabled={submitting || selected.size === 0}>
            {submitting ? <span className="loading loading-spinner loading-xs" /> : null}
            {formatMessage(j.offer.sendMany, { n: selected.size })}
          </button>
        </div>
      </div>
    </div>
  );
}
