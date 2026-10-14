import { useConfirmation } from "../components/ui/useConfirmation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { Plus } from "lucide-react-native";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { getLocaleTextAlign, getMessages } from "../i18n";
import { usePullRefresh } from "../hooks/usePullRefresh";
import { ListPanelSkeleton } from "../components/skeletons";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { Button } from "../components/ui/Button";
import { Toast, type ToastVariant } from "../components/ui/Toast";
import {
  acceptOffer,
  aiEstimate,
  aiEvaluatePlan,
  aiModerate,
  aiTranslate,
  deleteRequirement,
  generateTest,
  getMyTestAttempt,
  getRequirementDetail,
  jobsErrorKey,
  listRequirements,
  MODERATION_OK,
  publishRequirement,
  rejectOffer,
  releaseRequirement,
  setRequiresTest,
  type Requirement,
  type TestAttemptView,
  type TestSubmitResult,
} from "../api/jobs";
import { RequirementCard, type CardAction, type JobsRole } from "../components/jobs/RequirementCard";
import { CreateRequirementModal } from "../components/jobs/CreateRequirementModal";
import { OfferModal } from "../components/jobs/OfferModal";
import { ServerAcceptModal } from "../components/jobs/ServerAcceptModal";
import { ProfessionalProfileForm } from "../components/jobs/ProfessionalProfileForm";
import { RequirementDetailDrawer } from "../components/jobs/RequirementDetailDrawer";
import { ChannelDrawer } from "../components/jobs/ChannelDrawer";
import { TestRunner } from "../components/jobs/TestRunner";
import { fmtTokens, jt, jobsDict } from "../components/jobs/jobs-i18n";
import { makeStyles } from "./JobsScreen.styles";

type JobsTab = "buyer" | "professional" | "profile";
type SubView =
  | { kind: "detail"; reqId: string; role: JobsRole }
  | { kind: "channel"; reqId: string }
  | null;

// Pantalla "Empleos" (Jobs marketplace). Espejo RN de portal-jobs.ts: tabs
// Comprador / Profesional / Mi perfil; lista de requerimientos con acciones
// contextuales; crear+IA, ofertas a varios, detalle F5 y canal/bitácora. Solo
// consume /portal/jobs/* (F1–5) vía api/jobs.ts.
// `compact`: embebido en el drawer derecho (Comunidad → Empleo). Oculta la cabecera
// de título propia, porque el tab-bar del drawer ya rotula "Empleo" (igual que
// BlogReaderScreen `compact`). Las pestañas internas (Comprador/Profesional/Perfil)
// se mantienen.
export function JobsScreen({ language, token, compact = false }: { language: string; token: string; compact?: boolean }) {
  const { askConfirmation, confirmation } = useConfirmation(language);
  const t = getMessages(language).jobs;
  const tCommon = getMessages(language).common;
  const dict = useMemo(() => jobsDict(language), [language]);
  const textAlign = getLocaleTextAlign(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [tab, setTab] = useState<JobsTab>("buyer");
  const [asBuyer, setAsBuyer] = useState<Requirement[]>([]);
  const [asProfessional, setAsProfessional] = useState<Requirement[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [busyCard, setBusyCard] = useState<{ id: string; action: CardAction } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [offerReqId, setOfferReqId] = useState<string | null>(null);
  const [serverAcceptReqId, setServerAcceptReqId] = useState<string | null>(null);
  const [sub, setSub] = useState<SubView>(null);
  // Fase 11: runner del test + caché de mi intento por requerimiento (profesional).
  const [testReqId, setTestReqId] = useState<string | null>(null);
  const [myAttempts, setMyAttempts] = useState<Record<string, TestAttemptView | null | undefined>>({});

  // Toast (acciones). La app no tiene hook compartido: estado local + nonce.
  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string; nonce: number }>(
    { visible: false, variant: "success", message: "", nonce: 0 },
  );
  const notify = useCallback((message: string, variant: ToastVariant = "success") => {
    setToast((prev) => ({ visible: true, variant, message, nonce: prev.nonce + 1 }));
  }, []);

  const loadedRef = useRef(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setBusy(true);
    setError("");
    try {
      const res = await listRequirements(token);
      setAsBuyer(res.asBuyer);
      setAsProfessional(res.asProfessional);
    } catch (e) {
      setError(jt(dict, jobsErrorKey(e)));
    } finally {
      setBusy(false);
    }
  }, [token, dict]);

  useEffect(() => {
    if (!token || loadedRef.current) return;
    loadedRef.current = true;
    void load();
  }, [token, load]);

  const { refreshing, onRefresh } = usePullRefresh(() => load({ silent: true }));

  // Fase 11: hidrata mi intento del test para las filas profesionales que
  // exigen test y aún no tengo en caché (espejo de hydrateMyAttempt). Sin esto el
  // gate del profesional (badge + "Presentar" deshabilitado) no se pinta.
  useEffect(() => {
    if (!token) return;
    const pending = asProfessional.filter(
      (r) => r.requiresTest && r.status === "published" && !(r.id in myAttempts),
    );
    if (!pending.length) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        pending.map(async (r) => {
          try {
            return [r.id, await getMyTestAttempt(token, r.id)] as const;
          } catch {
            return [r.id, null] as const;
          }
        }),
      );
      if (cancelled) return;
      setMyAttempts((prev) => {
        const next = { ...prev };
        for (const [id, att] of entries) next[id] = att;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [token, asProfessional, myAttempts]);

  // Confirmación de la app sobre la vista actual. Resuelve true/false.
  const confirm = useCallback((message: string): Promise<boolean> =>
    new Promise((resolve) => {
      askConfirmation("", message, [
        { text: tCommon.cancel, style: "cancel", onPress: () => resolve(false) },
        { text: tCommon.accept, onPress: () => resolve(true) },
      ]);
    }), [askConfirmation, tCommon]);

  const withCardBusy = useCallback(async (id: string, action: CardAction, fn: () => Promise<void>) => {
    setBusyCard({ id, action });
    try {
      await fn();
    } catch (e) {
      notify(jt(dict, jobsErrorKey(e)), "error");
    } finally {
      setBusyCard(null);
    }
  }, [dict, notify]);

  // Resuelve el offerId de la oferta `sent` dirigida a mí (espejo de
  // resolveActiveOfferId): el detalle devuelve las ofertas visibles para el actor.
  const resolveActiveOfferId = useCallback(async (reqId: string): Promise<string | null> => {
    try {
      const d = await getRequirementDetail(token, reqId);
      return d.offers.find((o) => o.status === "sent")?.id ?? null;
    } catch {
      return null;
    }
  }, [token]);

  const handleAction = useCallback((action: CardAction, r: Requirement) => {
    switch (action) {
      case "detail":
        setSub({ kind: "detail", reqId: r.id, role: tab === "professional" ? "professional" : "buyer" });
        return;
      case "channel":
        setSub({ kind: "channel", reqId: r.id });
        return;
      case "offer":
        setOfferReqId(r.id);
        return;
      case "publish":
        void confirm(jt(dict, "confirm.publish", { price: fmtTokens(r.acceptedPrice) })).then((ok) => {
          if (!ok) return;
          void withCardBusy(r.id, action, async () => {
            await publishRequirement(token, r.id);
            notify(jt(dict, "toast.published"), "success");
            await load({ silent: true });
          });
        });
        return;
      case "release":
        void confirm(jt(dict, "confirm.release")).then((ok) => {
          if (!ok) return;
          void withCardBusy(r.id, action, async () => {
            await releaseRequirement(token, r.id);
            notify(jt(dict, "toast.released"), "success");
            await load({ silent: true });
          });
        });
        return;
      case "delete":
        void confirm(jt(dict, "confirm.delete")).then((ok) => {
          if (!ok) return;
          void withCardBusy(r.id, action, async () => {
            await deleteRequirement(token, r.id);
            notify(jt(dict, "toast.deleted"), "success");
            await load({ silent: true });
          });
        });
        return;
      case "accept":
        // Modalidad "servidor": elegir server + proveedor del profesional → modal.
        if (r.executionMode === "server") { setServerAcceptReqId(r.id); return; }
        void withCardBusy(r.id, action, async () => {
          const offerId = await resolveActiveOfferId(r.id);
          if (!offerId) { notify(jt(dict, "error.generic"), "error"); return; }
          await acceptOffer(token, offerId);
          notify(jt(dict, "toast.accepted"), "success");
          await load({ silent: true });
        });
        return;
      case "reject":
        void withCardBusy(r.id, action, async () => {
          const offerId = await resolveActiveOfferId(r.id);
          if (!offerId) { notify(jt(dict, "error.generic"), "error"); return; }
          await rejectOffer(token, offerId);
          notify(jt(dict, "toast.rejected"), "success");
          await load({ silent: true });
        });
        return;
      case "moderate-plan":
        void withCardBusy(r.id, action, async () => {
          const moderation = await aiModerate(token, r.id);
          notify(jt(dict, "ai.toast.moderated"), "success");
          if (MODERATION_OK.has(moderation.status)) {
            await aiEvaluatePlan(token, r.id);
            notify(jt(dict, "ai.toast.planned"), "success");
            await aiEstimate(token, r.id);
          }
          await load({ silent: true });
        });
        return;
      case "translate":
        void withCardBusy(r.id, action, async () => {
          const res = await aiTranslate(token, r.id, [language || "es"]);
          notify(res.aiUsed === false ? jt(dict, "ai.unavailable") : jt(dict, "ai.toast.translated"), res.aiUsed === false ? "error" : "success");
          await load({ silent: true });
        });
        return;
      // ── Fase 11: gestión del test técnico previo ──
      case "test-require":
        void withCardBusy(r.id, action, async () => {
          await setRequiresTest(token, r.id, !r.requiresTest);
          notify(jt(dict, "test.toast.required"), "success");
          await load({ silent: true });
        });
        return;
      case "test-generate":
        void withCardBusy(r.id, action, async () => {
          const res = await generateTest(token, r.id);
          if (res.aiUsed === false) {
            notify(jt(dict, "test.aiUnavailable"), "error");
          } else {
            notify(jt(dict, "test.ready", { n: res.questionCount }), "success");
          }
          await load({ silent: true });
        });
        return;
      case "start-test":
        setTestReqId(r.id);
        return;
    }
  }, [tab, dict, token, language, confirm, withCardBusy, notify, load, resolveActiveOfferId]);

  // ── Sub-vistas full-screen (detalle / canal) ────────────────────────────────
  if (sub?.kind === "detail") {
    return <>
      {confirmation}
      <RequirementDetailDrawer
        token={token}
        requirementId={sub.reqId}
        role={sub.role}
        dict={dict}
        language={language}
        onClose={() => setSub(null)}
        onChanged={() => { void load({ silent: true }); }}
        notify={notify}
      />
    </>;
  }
  if (sub?.kind === "channel") {
    return <>
      {confirmation}
      <ChannelDrawer
        token={token}
        requirementId={sub.reqId}
        dict={dict}
        language={language}
        onClose={() => setSub(null)}
        notify={notify}
      />
    </>;
  }

  const rows = tab === "buyer" ? asBuyer : asProfessional;
  const role: JobsRole = tab === "buyer" ? "buyer" : "professional";

  const tabItems = [
    { key: "buyer", label: jt(dict, "tabBuyer") },
    { key: "professional", label: jt(dict, "tabProfessional") },
    { key: "profile", label: jt(dict, "tabProfile") },
  ];

  return <>
      {confirmation}
    <View style={[styles.root, { backgroundColor: tokens.bgPrimary }]}>
      {!compact ? (
        <View style={[styles.header, { borderBottomColor: tokens.border, backgroundColor: tokens.bgPrimary }]}>
          <Text style={[styles.headerTitle, { color: tokens.textPrimary, textAlign }]} numberOfLines={1}>
            {t.tabTitle}
          </Text>
        </View>
      ) : null}

      <View style={styles.tabsBar}>
        <SegmentedControl items={tabItems} value={tab} onChange={(k) => setTab(k as JobsTab)} fill />
      </View>

      {tab === "profile" ? (
        <View style={{ flex: 1 }}>
          <ProfessionalProfileForm token={token} dict={dict} language={language} notify={notify} />
        </View>
      ) : (
        <>
          <View style={{ flex: 1 }}>
            {busy && rows.length === 0 ? (
              <ListPanelSkeleton rows={4} gap={14} />
            ) : error ? (
              <View style={styles.centered}>
                <Text style={[styles.stateText, { color: tokens.danger, textAlign, marginBottom: 10 }]}>{error}</Text>
                <Button label={jt(dict, "retry")} variant="ghost" size="sm" onPress={() => void load()} />
              </View>
            ) : (
              <FlatList
                style={{ flex: 1 }}
                data={rows}
                keyExtractor={(r) => r.id}
                renderItem={({ item }) => (
                  <RequirementCard
                    requirement={item}
                    role={role}
                    dict={dict}
                    language={language}
                    busyAction={busyCard?.id === item.id ? busyCard.action : null}
                    onAction={handleAction}
                    myAttempt={role === "professional" ? myAttempts[item.id] : undefined}
                  />
                )}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand} colors={[tokens.brand]} />}
                ListEmptyComponent={
                  <Text style={[styles.empty, { color: tokens.textMuted, textAlign }]}>
                    {jt(dict, tab === "buyer" ? "empty.buyer" : "empty.professional")}
                  </Text>
                }
              />
            )}
          </View>

          {/* Acciones en el FOOTER (anclado abajo, borde superior) — igual que el
              tab de conexión (`PanelEditorPanel`). En Comprador: botón "Crear". */}
          {tab === "buyer" ? (
            <View style={styles.footer}>
              <Button label={tCommon.create} variant="primary" icon={<Plus size={16} />} onPress={() => setCreateOpen(true)} style={{ flex: 1 }} />
            </View>
          ) : null}
        </>
      )}

      <CreateRequirementModal
        visible={createOpen}
        token={token}
        dict={dict}
        language={language}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); setTab("buyer"); void load({ silent: true }); }}
        notify={notify}
      />
      <OfferModal
        visible={offerReqId !== null}
        token={token}
        requirementId={offerReqId}
        dict={dict}
        language={language}
        onClose={() => setOfferReqId(null)}
        onSent={() => { setOfferReqId(null); void load({ silent: true }); }}
        notify={notify}
      />
      <ServerAcceptModal
        visible={serverAcceptReqId !== null}
        token={token}
        dict={dict}
        language={language}
        onClose={() => setServerAcceptReqId(null)}
        onConfirm={(professionalServerId, provider) => {
          const reqId = serverAcceptReqId;
          if (!reqId) return;
          void withCardBusy(reqId, "accept", async () => {
            const offerId = await resolveActiveOfferId(reqId);
            if (!offerId) { notify(jt(dict, "error.generic"), "error"); return; }
            await acceptOffer(token, offerId, { professionalServerId, provider });
            notify(jt(dict, "server.toast.provisioned"), "success");
            setServerAcceptReqId(null);
            await load({ silent: true });
          });
        }}
      />
      <TestRunner
        visible={testReqId !== null}
        token={token}
        requirementId={testReqId}
        dict={dict}
        language={language}
        onClose={() => setTestReqId(null)}
        onFinished={(res: TestSubmitResult) => {
          const id = testReqId;
          if (id) {
            // Refleja el intento en caché para repintar el gate sin re-fetch.
            setMyAttempts((m) => ({
              ...m,
              [id]: {
                id: "",
                requirementId: id,
                status: res.passed ? "passed" : "failed",
                score: res.score,
                startedAt: "",
                deadlineAt: "",
                finishedAt: null,
              },
            }));
          }
          void load({ silent: true });
        }}
      />

      <Toast
        visible={toast.visible}
        variant={toast.variant}
        message={toast.message}
        nonce={toast.nonce}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  </>;
}
