// Pantalla "Empleos" del cliente desktop (Fase 6, IMPL-B).
// Orquesta el ciclo completo de requerimientos con escrow de tokens, espejando
// `frontend/src/lib/portal-jobs.ts` sobre los mismos endpoints `/portal/jobs/*`
// (vía `api/jobs.ts`, IMPL-A) y la i18n `t.jobs.*` (IMPL-C, leída con
// `getJobsMessages`).
//
// Tabs: "Mis requerimientos" (comprador) · "Asignados a mí" (profesional) ·
// "Mi perfil profesional". Cada acción de tarjeta abre el modal/drawer
// correspondiente o llama el endpoint con confirmación. Loading/errores por
// panel; nunca se muestran secretos (los grants van por referencia).
import { useCallback, useEffect, useState } from "react";
import { Briefcase, Plus, RefreshCw } from "lucide-react";
import { NavActions } from "../components/NavActions";
import { useToast } from "../components/ToastProvider";
import { useDialog } from "../hooks/useDialog";
import { getMessages, formatMessage } from "../i18n";
import type { NavAction } from "../features/app/types";
import {
  listRequirements, getRequirement, publishRequirement, releaseRequirement,
  deleteRequirement, acceptOffer, rejectOffer,
  aiModerate, aiEvaluatePlan, aiEstimate, aiTranslate, jobsErrorKey, isModerated,
  MODERATION_OK, setRequiresTest, generateTest, getMyTestAttempt,
  type Requirement, type TestAttemptView, type TestSubmitResult,
} from "../api/jobs";
import { JobsList, type CardAction, type JobRole } from "../components/jobs/JobsList";
import type { AiSlot } from "../components/jobs/aiPanel";
import { CreateRequirementModal } from "../components/jobs/CreateRequirementModal";
import { OfferModal } from "../components/jobs/OfferModal";
import { ProfessionalProfileTab } from "../components/jobs/ProfessionalProfileTab";
import { ChannelDrawer } from "../components/jobs/ChannelDrawer";
import { RequirementDetailModal, type DetailRole } from "../components/jobs/RequirementDetailModal";
import { ServerAcceptModal } from "../components/jobs/ServerAcceptModal";
import { TestModal } from "../components/jobs/TestModal";
import { getJobsMessages } from "../components/jobs/i18n";

type Tab = "buyer" | "professional" | "profile";

export function JobsScreen({
  token,
  language,
}: {
  token: string;
  language: string;
  /** Navegar a Servidores (reservado para enlaces del asistente). */
  onGoServers?: () => void;
  isAdmin?: boolean;
}) {
  const t = getMessages(language);
  const j = getJobsMessages(language);
  const toast = useToast();
  const dialog = useDialog(language);

  const [tab, setTab] = useState<Tab>("buyer");
  const [asBuyer, setAsBuyer] = useState<Requirement[]>([]);
  const [asProfessional, setAsProfessional] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [busy, setBusy] = useState(false);
  // Estado IA por requirement (moderación/plan/estimación/traducción + expandido).
  const [aiSlots, setAiSlots] = useState<Record<string, AiSlot | undefined>>({});

  // Modales / drawer.
  const [createOpen, setCreateOpen] = useState(false);
  const [offerReqId, setOfferReqId] = useState<string | null>(null);
  const [channelReqId, setChannelReqId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ id: string; role: DetailRole } | null>(null);
  // Modalidad "servidor": aceptar con selección de server + proveedor.
  const [serverAcceptReqId, setServerAcceptReqId] = useState<string | null>(null);
  // Fase 11: runner del test + intentos del profesional por requirementId.
  const [testReqId, setTestReqId] = useState<string | null>(null);
  const [myAttempts, setMyAttempts] = useState<Record<string, TestAttemptView | null | undefined>>({});

  const errKey = useCallback((err: unknown): string => {
    const path = jobsErrorKey(err).split(".");
    let node: unknown = j;
    for (const p of path) node = (node as Record<string, unknown>)?.[p];
    return typeof node === "string" ? node : (err instanceof Error ? err.message : j.error.generic);
  }, [j]);

  const reload = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const data = await listRequirements(token);
      setAsBuyer(data.asBuyer ?? []);
      setAsProfessional(data.asProfessional ?? []);
    } catch (err) {
      setListError(errKey(err));
    } finally {
      setLoading(false);
    }
  }, [token, errKey]);

  useEffect(() => { void reload(); }, [reload]);

  const updateSlot = useCallback((id: string, patch: Partial<AiSlot>) => {
    setAiSlots((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));
  }, []);

  // Refleja moderationStatus fresco en la fila del comprador (gate de publicar).
  const patchBuyerRow = useCallback((id: string, patch: Partial<Requirement>) => {
    setAsBuyer((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  // "Moderar y planear": moderate → (si apto) evaluate-plan → estimate.
  const moderateAndPlan = useCallback(async (reqId: string) => {
    setBusy(true);
    try {
      const moderation = await aiModerate(token, reqId);
      updateSlot(reqId, { moderation, expanded: true });
      patchBuyerRow(reqId, { moderationStatus: moderation.status, moderationReason: moderation.reason });
      toast.success(j.ai.toast.moderated);
      if (MODERATION_OK.has(moderation.status)) {
        const planRes = await aiEvaluatePlan(token, reqId);
        updateSlot(reqId, { plan: planRes.plan });
        toast.success(j.ai.toast.planned);
        const estRes = await aiEstimate(token, reqId);
        updateSlot(reqId, { estimate: estRes.estimate });
      }
    } catch (err) {
      toast.error(errKey(err));
    } finally {
      setBusy(false);
    }
  }, [token, updateSlot, patchBuyerRow, toast, j, errKey]);

  // Traduce el requerimiento al idioma actual del profesional.
  const translate = useCallback(async (reqId: string) => {
    setBusy(true);
    try {
      const res = await aiTranslate(token, reqId, [language || "es"]);
      const tr = res.translations?.[language || "es"];
      if (tr) updateSlot(reqId, { translation: tr, expanded: true });
      if (res.aiUsed === false) toast.error(j.ai.unavailable);
      else toast.success(j.ai.toast.translated);
    } catch (err) {
      toast.error(errKey(err));
    } finally {
      setBusy(false);
    }
  }, [token, language, updateSlot, toast, j, errKey]);

  // Aceptar/rechazar: resuelve el offerId de la oferta `sent` dirigida a mí.
  const resolveActiveOfferId = useCallback(async (reqId: string): Promise<string | null> => {
    try {
      const d = await getRequirement(token, reqId);
      return d.offers.find((o) => o.status === "sent")?.id ?? null;
    } catch {
      return null;
    }
  }, [token]);

  const doAccept = useCallback(async (reqId: string) => {
    // Modalidad "servidor": el profesional elige su server + proveedor → modal.
    const r = asProfessional.find((x) => x.id === reqId) ?? asBuyer.find((x) => x.id === reqId);
    if (r?.executionMode === "server") { setServerAcceptReqId(reqId); return; }
    setBusy(true);
    try {
      const offerId = await resolveActiveOfferId(reqId);
      if (!offerId) { toast.error(j.error.generic); return; }
      await acceptOffer(token, offerId);
      toast.success(j.toast.accepted);
      await reload();
    } catch (err) {
      toast.error(errKey(err));
    } finally {
      setBusy(false);
    }
  }, [token, resolveActiveOfferId, toast, j, reload, errKey, asProfessional, asBuyer]);

  // Confirmación del modal de aceptar en modalidad servidor.
  const doAcceptServer = useCallback(async (reqId: string, professionalServerId: string, provider: string | null) => {
    setBusy(true);
    try {
      const offerId = await resolveActiveOfferId(reqId);
      if (!offerId) { toast.error(j.error.generic); return; }
      await acceptOffer(token, offerId, { professionalServerId, provider });
      toast.success(j.server.toastProvisioned);
      setServerAcceptReqId(null);
      await reload();
    } catch (err) {
      toast.error(errKey(err));
    } finally {
      setBusy(false);
    }
  }, [token, resolveActiveOfferId, toast, j, reload, errKey]);

  const doReject = useCallback(async (reqId: string) => {
    setBusy(true);
    try {
      const offerId = await resolveActiveOfferId(reqId);
      if (!offerId) { toast.error(j.error.generic); return; }
      await rejectOffer(token, offerId);
      toast.success(j.toast.rejected);
      await reload();
    } catch (err) {
      toast.error(errKey(err));
    } finally {
      setBusy(false);
    }
  }, [token, resolveActiveOfferId, toast, j, reload, errKey]);

  const doPublish = useCallback(async (r: Requirement) => {
    if (!isModerated(r)) { toast.error(j.ai.mustModerate); return; }
    const ok = await dialog.confirm({
      title: j.action.publish,
      message: formatMessage(j.confirm.publish, { price: r.acceptedPrice }),
      confirmLabel: j.action.publish,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await publishRequirement(token, r.id);
      toast.success(j.toast.published);
      await reload();
    } catch (err) {
      toast.error(errKey(err));
    } finally {
      setBusy(false);
    }
  }, [token, dialog, toast, j, reload, errKey]);

  const doRelease = useCallback(async (r: Requirement) => {
    const ok = await dialog.confirm({ title: j.action.release, message: j.confirm.release, confirmLabel: j.action.release });
    if (!ok) return;
    setBusy(true);
    try {
      await releaseRequirement(token, r.id);
      toast.success(j.toast.released);
      await reload();
    } catch (err) {
      toast.error(errKey(err));
    } finally {
      setBusy(false);
    }
  }, [token, dialog, toast, j, reload, errKey]);

  const doDelete = useCallback(async (r: Requirement) => {
    const ok = await dialog.confirm({ title: j.action.delete, message: j.confirm.delete, tone: "danger", confirmLabel: j.action.delete });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteRequirement(token, r.id);
      toast.success(j.toast.deleted);
      await reload();
    } catch (err) {
      toast.error(errKey(err));
    } finally {
      setBusy(false);
    }
  }, [token, dialog, toast, j, reload, errKey]);

  // ── Fase 11: comprador exige/quita el test del requerimiento. ──
  const doToggleRequireTest = useCallback(async (r: Requirement) => {
    setBusy(true);
    try {
      await setRequiresTest(token, r.id, !r.requiresTest);
      patchBuyerRow(r.id, { requiresTest: !r.requiresTest });
      toast.success(j.test.toast.required);
    } catch (err) {
      toast.error(errKey(err));
    } finally {
      setBusy(false);
    }
  }, [token, patchBuyerRow, toast, j, errKey]);

  // ── Fase 11: comprador genera/regenera el test (eje MB). ──
  const doGenerateTest = useCallback(async (r: Requirement) => {
    setBusy(true);
    try {
      const res = await generateTest(token, r.id);
      if (res.aiUsed === false) {
        toast.error(j.test.aiUnavailable);
      } else {
        toast.success(`${j.test.toast.generated} · ${formatMessage(j.test.ready, { n: res.questionCount })}`);
      }
    } catch (err) {
      toast.error(errKey(err));
    } finally {
      setBusy(false);
    }
  }, [token, toast, j, errKey]);

  // ── Fase 11: hidrata mi intento para las filas profesionales que exigen test
  //    (gate del CTA "Presentar test" / "Aceptar"). Espejo de `hydrateMyAttempt`. ──
  useEffect(() => {
    let cancelled = false;
    const targets = asProfessional.filter(
      (r) => r.status === "published" && r.requiresTest && !(r.id in myAttempts),
    );
    if (!targets.length) return;
    void (async () => {
      const entries = await Promise.all(targets.map(async (r) => {
        try {
          return [r.id, await getMyTestAttempt(token, r.id)] as const;
        } catch {
          return [r.id, null] as const;
        }
      }));
      if (cancelled) return;
      setMyAttempts((prev) => {
        const next = { ...prev };
        for (const [id, att] of entries) next[id] = att;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [asProfessional, myAttempts, token]);

  // Despacho central de acciones de tarjeta (espejo de la delegación del web).
  const onCardAction = useCallback((action: CardAction, r: Requirement) => {
    switch (action) {
      case "toggle-ai":
        updateSlot(r.id, { expanded: !(aiSlots[r.id]?.expanded ?? false) });
        break;
      case "moderate-plan": void moderateAndPlan(r.id); break;
      case "publish": void doPublish(r); break;
      case "delete": void doDelete(r); break;
      case "release": void doRelease(r); break;
      case "offer": setOfferReqId(r.id); break;
      case "channel": setChannelReqId(r.id); break;
      case "accept": void doAccept(r.id); break;
      case "reject": void doReject(r.id); break;
      case "translate": void translate(r.id); break;
      case "detail":
        setDetail({ id: r.id, role: tab === "professional" ? "professional" : "buyer" });
        break;
      // ── Fase 11 ──
      case "test-require": void doToggleRequireTest(r); break;
      case "test-generate": void doGenerateTest(r); break;
      case "start-test": setTestReqId(r.id); break;
    }
  }, [aiSlots, updateSlot, moderateAndPlan, doPublish, doDelete, doRelease, doAccept, doReject, translate, tab, doToggleRequireTest, doGenerateTest]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "buyer", label: j.tab.buyer },
    { id: "professional", label: j.tab.professional },
    { id: "profile", label: j.tab.profile },
  ];

  const actions: NavAction[] = [
    { id: "refresh", label: t.common.refresh, icon: <RefreshCw size={16} />, onClick: () => void reload(), disabled: loading, busy: loading },
  ];
  if (tab === "buyer") {
    actions.push({ id: "new", label: j.title, icon: <Plus size={16} />, variant: "primary", onClick: () => setCreateOpen(true) });
  }

  const role: JobRole = tab === "professional" ? "professional" : "buyer";

  return (
    <main className="h-full w-full overflow-y-auto p-3 sm:p-4 md:p-6">
      <div className="panel-wrapper">
        <section className="panel-hero">
          <div className="panel-hero__grid">
            <div className="panel-hero__content">
              <span className="panel-hero__eyebrow inline-flex items-center gap-1"><Briefcase size={14} /> {j.section}</span>
              <h1 className="panel-hero__title">{j.title}</h1>
              <p className="panel-hero__subtitle">{j.subtitle}</p>
            </div>
          </div>
        </section>

        <section className="panel-section">
          <div className="support-section">
            <div className="support-section__header flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tb) => (
                  <button
                    key={tb.id}
                    type="button"
                    className={`btn btn-sm lp-seg-tab ${tab === tb.id ? "is-active" : "btn-outline"}`}
                    onClick={() => setTab(tb.id)}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>
              <NavActions actions={actions} />
            </div>

            {listError && tab !== "profile" ? (
              <div className="mt-3 flex items-center gap-3">
                <p className="text-sm text-error">{listError}</p>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => void reload()}>{t.common.refresh}</button>
              </div>
            ) : null}

            <div className="mt-4">
              {tab === "profile" ? (
                <ProfessionalProfileTab token={token} j={j} saveLabel={(enrolled) => (enrolled ? j.profile.save : j.profile.enroll)} />
              ) : (
                <JobsList
                  rows={role === "buyer" ? asBuyer : asProfessional}
                  role={role}
                  j={j}
                  loading={loading}
                  busy={busy}
                  aiSlots={aiSlots}
                  myAttempts={myAttempts}
                  onAction={onCardAction}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Modales / drawer */}
      <CreateRequirementModal
        open={createOpen}
        token={token}
        locale={language}
        j={j}
        cancelLabel={t.common.cancel}
        createLabel={t.common.create}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setTab("buyer"); void reload(); toast.success(j.toast.created); }}
      />
      <OfferModal
        open={offerReqId !== null}
        token={token}
        requirementId={offerReqId}
        j={j}
        cancelLabel={t.common.cancel}
        onClose={() => setOfferReqId(null)}
        onSent={(summary) => {
          toast.success(formatMessage(j.offer.sent.summary, summary));
          void reload();
        }}
      />
      <ChannelDrawer
        open={channelReqId !== null}
        token={token}
        requirementId={channelReqId}
        j={j}
        onClose={() => setChannelReqId(null)}
      />
      <ServerAcceptModal
        open={serverAcceptReqId !== null}
        token={token}
        s={j.server}
        cancelLabel={t.common.cancel}
        onClose={() => setServerAcceptReqId(null)}
        onConfirm={(serverId, provider) => {
          if (serverAcceptReqId) void doAcceptServer(serverAcceptReqId, serverId, provider);
        }}
      />
      <RequirementDetailModal
        open={detail !== null}
        token={token}
        requirementId={detail?.id ?? null}
        role={detail?.role ?? "buyer"}
        j={j}
        onClose={() => setDetail(null)}
        onChanged={() => void reload()}
      />
      <TestModal
        open={testReqId !== null}
        token={token}
        requirementId={testReqId}
        j={j}
        onClose={() => setTestReqId(null)}
        onFinished={(res: TestSubmitResult) => {
          const id = testReqId;
          if (id) {
            // Refleja el resultado del SERVIDOR en el gate (1 intento ya usado).
            setMyAttempts((m) => ({
              ...m,
              [id]: {
                id: m[id]?.id ?? "",
                requirementId: id,
                status: res.passed ? "passed" : "failed",
                score: res.score,
                startedAt: m[id]?.startedAt ?? new Date().toISOString(),
                deadlineAt: m[id]?.deadlineAt ?? new Date().toISOString(),
                finishedAt: new Date().toISOString(),
              },
            }));
          }
          void reload();
        }}
      />
    </main>
  );
}
