import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleRowDirection, getLocaleTextAlign } from "../../i18n";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import {
  acceptEditProposal,
  aiReviewProgress,
  approveMilestone,
  editRequirement,
  getRequirementDetail,
  jobsErrorKey,
  proposeEdit,
  rejectEditProposal,
  requestDispute,
  requestMilestone,
  resolveDispute,
  submitRating,
  reprovisionServer,
  execServerCommand,
  type RequirementDetail,
} from "../../api/jobs";
import { fmtTokens, jt, toDateInput, type JobsDict } from "./jobs-i18n";
import type { JobsRole } from "./RequirementCard";
import { makeStyles } from "./RequirementDetailDrawer.styles";

// Detalle avanzado F5 (espejo de renderDetail + detail*Html + onDetailAction):
// avance IA, hito 50%, edición directa / propuesta, disputa, rating. Se monta
// como sub-vista full-screen de JobsScreen. Tras cada acción re-trae el detalle.
export function RequirementDetailDrawer({
  token,
  requirementId,
  role,
  dict,
  language,
  onClose,
  onChanged,
  notify,
}: {
  token: string;
  requirementId: string;
  role: JobsRole;
  dict: JobsDict;
  language: string;
  onClose: () => void;
  onChanged: () => void;
  notify: (msg: string, variant?: "success" | "error") => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const textAlign = getLocaleTextAlign(language);
  const rowDir = getLocaleRowDirection(language);

  const [detail, setDetail] = useState<RequirementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Campos de formularios (edición / disputa / rating / hito).
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editTopup, setEditTopup] = useState("0");
  const [msNote, setMsNote] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [refundPct, setRefundPct] = useState("50");
  const [stars, setStars] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  // Modalidad "servidor": consola job-scoped.
  const [serverCmd, setServerCmd] = useState("");
  const [serverOut, setServerOut] = useState("");

  const hydrate = useCallback((d: RequirementDetail) => {
    const r = d.requirement;
    setEditTitle(r.title);
    setEditDesc(r.description || "");
    setEditDeadline(toDateInput(r.deadlineAt));
    setEditPrice(String(r.acceptedPrice));
    setEditTopup("0");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await getRequirementDetail(token, requirementId);
      setDetail(d);
      hydrate(d);
    } catch (e) {
      setError(jt(dict, jobsErrorKey(e)));
    } finally {
      setLoading(false);
    }
  }, [token, requirementId, dict, hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  const refetch = useCallback(async () => {
    try {
      const d = await getRequirementDetail(token, requirementId);
      setDetail(d);
      hydrate(d);
    } catch {
      /* keep prior state */
    }
    onChanged();
  }, [token, requirementId, hydrate, onChanged]);

  // Error centinela de validación local: el `fn` ya fijó el mensaje específico
  // vía `setError`, así que `run` NO debe sobrescribirlo con "error.generic" ni
  // hacer refetch.
  const run = useCallback(async (key: string, fn: () => Promise<void>) => {
    setError("");
    setBusy(key);
    try {
      await fn();
      await refetch();
    } catch (e) {
      if (e instanceof Error && e.message === "__jobs_validation__") {
        // mensaje ya mostrado por el fn
      } else {
        setError(jt(dict, jobsErrorKey(e)));
      }
    } finally {
      setBusy(null);
    }
  }, [dict, refetch]);

  const abort = (msg: string): never => {
    setError(msg);
    throw new Error("__jobs_validation__");
  };

  // Consola job-scoped: ejecuta el comando sobre el servidor del cliente (gateway).
  const runServerConsole = useCallback(async () => {
    const cmd = serverCmd.trim();
    if (!cmd || !requirementId) return;
    setServerOut("…");
    try {
      const out = await execServerCommand(token, requirementId, cmd);
      const body = (out.stdout || "") + (out.stderr ? `\n${out.stderr}` : "");
      setServerOut(`$ ${cmd}\n${body}\n[exit ${out.exitCode}]`);
      setServerCmd("");
    } catch (e) {
      setServerOut(jt(dict, jobsErrorKey(e)));
    }
  }, [serverCmd, requirementId, token, dict]);

  const buildPatch = (): Record<string, unknown> => {
    if (!detail) return {};
    const r = detail.requirement;
    const patch: Record<string, unknown> = {};
    if (editTitle.trim() && editTitle.trim() !== r.title) patch.title = editTitle.trim();
    if (editDesc.trim() !== (r.description || "")) patch.description = editDesc.trim();
    if (editDeadline.trim()) {
      const iso = new Date(editDeadline.trim()).toISOString();
      if (iso !== (r.deadlineAt ? new Date(r.deadlineAt).toISOString() : null)) patch.deadlineAt = iso;
    }
    return patch;
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <Header tokens={tokens} styles={styles} rowDir={rowDir} title={jt(dict, "action.detail")} onClose={onClose} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={tokens.brand} />
        </View>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.root}>
        <Header tokens={tokens} styles={styles} rowDir={rowDir} title={jt(dict, "action.detail")} onClose={onClose} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
          <Text style={[styles.error, { color: tokens.danger, textAlign }]}>{error || jt(dict, "loadError")}</Text>
        </View>
      </View>
    );
  }

  const r = detail.requirement;
  const isBuyer = role === "buyer";
  const statusColor = r.status === "released" ? tokens.success : r.status === "disputed" ? tokens.danger : tokens.brand;
  const pct = typeof r.progressPct === "number" ? Math.max(0, Math.min(100, r.progressPct)) : null;

  // Disputa elegible (>30% del tiempo) — espejo de disputeEligible.
  const disputeEligible = (() => {
    if (!r.publishedAt || !r.deadlineAt) return false;
    const start = new Date(r.publishedAt).getTime();
    const end = new Date(r.deadlineAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
    return Date.now() >= start + 0.3 * (end - start);
  })();

  const ms = r.milestoneStatus;
  const editable = r.status === "draft" || r.status === "published";
  const inProgress = r.status === "in_progress";
  const prop = detail.editProposal;

  return (
    <View style={styles.root}>
      <Header tokens={tokens} styles={styles} rowDir={rowDir} title={jt(dict, "action.detail")} onClose={onClose} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Cabecera del requerimiento */}
        <View style={styles.sec}>
          <View style={[styles.headRow, { flexDirection: rowDir }]}>
            <View style={[styles.badge, { borderColor: statusColor, backgroundColor: tokens.bgSecondary }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{jt(dict, `status.${r.status}`)}</Text>
            </View>
            <Text style={[styles.price, { color: tokens.brand }]}>{fmtTokens(r.acceptedPrice)} {jt(dict, "field.price")}</Text>
          </View>
          <Text style={[styles.title, { color: tokens.textPrimary, textAlign }]}>{r.title}</Text>
          {r.description ? <Text style={[styles.desc, { color: tokens.textMuted, textAlign }]} numberOfLines={6}>{r.description}</Text> : null}
        </View>

        {/* Modalidad "Servidor": estado de acceso + consola job-scoped */}
        {r.executionMode === "server" ? (() => {
          const sess = detail.serverSession ?? null;
          const status = sess?.status ?? "none";
          const isWorker = role === "professional" && r.status === "in_progress";
          return (
            <View style={styles.sec}>
              <View style={[styles.headRow, { flexDirection: rowDir }]}>
                <Text style={[styles.secTitle, { color: tokens.textPrimary, textAlign }]}>{jt(dict, "server.panel.title")}</Text>
                <Text style={[styles.badgeText, { color: status === "active" ? tokens.success : status === "error" ? tokens.danger : tokens.textMuted }]}>
                  {jt(dict, `server.status.${status}`)}{sess?.provider ? ` · ${sess.provider}` : ""}
                </Text>
              </View>
              {sess?.error && status === "error" ? <Text style={[styles.hint, { color: tokens.danger, textAlign }]}>{sess.error}</Text> : null}
              {isWorker && (status === "error" || status === "none" || status === "revoked") ? (
                <Button
                  label={jt(dict, "server.reprovision")}
                  variant="secondary"
                  size="sm"
                  loading={busy === "server-reprovision"}
                  onPress={() => void run("server-reprovision", async () => {
                    await reprovisionServer(token, requirementId!);
                    notify(jt(dict, "server.toast.reprovisioned"), "success");
                  })}
                />
              ) : null}
              {isWorker && status === "active" ? (
                <View>
                  <Text style={[styles.secTitle, { color: tokens.textPrimary, textAlign, marginTop: 6 }]}>{jt(dict, "server.console")}</Text>
                  <Input value={serverCmd} onChangeText={setServerCmd} placeholder={jt(dict, "server.console.placeholder")} />
                  <Button label={jt(dict, "server.console.run")} variant="primary" size="sm" disabled={!serverCmd.trim()} onPress={() => void runServerConsole()} />
                  <Text style={[styles.hint, { color: tokens.textSecondary, marginTop: 6, fontFamily: "monospace" }]}>{serverOut || jt(dict, "server.console.empty")}</Text>
                </View>
              ) : null}
            </View>
          );
        })() : null}

        {/* Avance del trabajo (ambos roles) */}
        <View style={styles.sec}>
          <Text style={[styles.secTitle, { color: tokens.textPrimary, textAlign }]}>{jt(dict, "progress.title")}</Text>
          {pct !== null ? (
            <>
              <View style={[styles.headRow, { flexDirection: rowDir }]}>
                <Text style={[styles.progressPct, { color: tokens.textPrimary }]}>{pct}%</Text>
                <Text style={[styles.badgeText, { color: r.progressMeets100 ? tokens.success : tokens.warning }]}>
                  {r.progressMeets100 ? jt(dict, "progress.meets100") : jt(dict, "progress.inProgress")}
                </Text>
              </View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${pct}%` }]} /></View>
            </>
          ) : null}
          {r.progressReport ? <Text style={[styles.hint, { color: tokens.textSecondary, textAlign }]}>{r.progressReport}</Text> : null}
          <View style={[styles.row, { flexDirection: rowDir }]}>
            <Button
              label={jt(dict, "progress.review")}
              variant="ghost"
              size="sm"
              loading={busy === "review"}
              onPress={() => run("review", async () => {
                const res = await aiReviewProgress(token, requirementId);
                notify(res.aiUsed === false ? jt(dict, "ai.unavailable") : jt(dict, "progress.title"), res.aiUsed === false ? "error" : "success");
              })}
            />
          </View>
        </View>

        {/* Hito 50% (solo in_progress) */}
        {inProgress ? (
          <View style={styles.sec}>
            <Text style={[styles.secTitle, { color: tokens.textPrimary, textAlign }]}>{jt(dict, "milestone.title")}</Text>
            {ms === "approved" ? (
              <Text style={[styles.badgeText, { color: tokens.success }]}>{jt(dict, "milestone.approved")}</Text>
            ) : ms === "requested" ? (
              <>
                <Text style={[styles.badgeText, { color: tokens.warning }]}>{jt(dict, "milestone.requested")}</Text>
                {isBuyer ? (
                  <Button label={jt(dict, "milestone.approve")} variant="primary" size="sm" loading={busy === "ms-approve"}
                    onPress={() => run("ms-approve", async () => { await approveMilestone(token, requirementId); notify(jt(dict, "milestone.approved"), "success"); })} />
                ) : null}
              </>
            ) : !isBuyer ? (
              <>
                <Input label={jt(dict, "milestone.note")} value={msNote} onChangeText={setMsNote} maxLength={2000} />
                <Button label={jt(dict, "milestone.request")} variant="primary" size="sm" loading={busy === "ms-request"}
                  onPress={() => run("ms-request", async () => { await requestMilestone(token, requirementId, msNote.trim() || undefined); notify(jt(dict, "milestone.requested"), "success"); })} />
              </>
            ) : null}
          </View>
        ) : null}

        {/* Propuesta de edición viva (la ve el profesional) */}
        {prop && prop.status === "pending" && !isBuyer ? (
          <View style={styles.sec}>
            <Text style={[styles.secTitle, { color: tokens.textPrimary, textAlign }]}>{jt(dict, "edit.pending")}</Text>
            {prop.patch.title ? <Text style={[styles.hint, { color: tokens.textSecondary, textAlign }]}>{jt(dict, "field.title")}: {prop.patch.title}</Text> : null}
            {prop.patch.description ? <Text style={[styles.hint, { color: tokens.textSecondary, textAlign }]}>{jt(dict, "field.description")}: {String(prop.patch.description).slice(0, 400)}</Text> : null}
            {prop.topupAmount > 0 ? <Text style={[styles.warn, { color: tokens.warning, textAlign }]}>⚠ {jt(dict, "edit.topupWarn", { n: fmtTokens(prop.topupAmount) })}</Text> : null}
            <View style={[styles.row, { flexDirection: rowDir }]}>
              <Button label={jt(dict, "edit.accept")} variant="primary" size="sm" loading={busy === "edit-accept"} style={styles.flexBtn}
                onPress={() => run("edit-accept", async () => { await acceptEditProposal(token, prop.id); notify(jt(dict, "edit.accept"), "success"); })} />
              <Button label={jt(dict, "edit.reject")} variant="danger" size="sm" loading={busy === "edit-reject"} style={styles.flexBtn}
                onPress={() => run("edit-reject", async () => { await rejectEditProposal(token, prop.id); notify(jt(dict, "edit.reject"), "success"); })} />
            </View>
          </View>
        ) : null}

        {/* Editar / proponer (comprador) */}
        {isBuyer && (editable || inProgress) ? (
          <View style={styles.sec}>
            <Text style={[styles.secTitle, { color: tokens.textPrimary, textAlign }]}>{inProgress ? jt(dict, "edit.propose") : jt(dict, "edit.title")}</Text>
            <Input label={jt(dict, "field.title")} value={editTitle} onChangeText={setEditTitle} maxLength={200} />
            <Input label={jt(dict, "field.description")} value={editDesc} onChangeText={setEditDesc} multiline maxLength={20000} />
            <Input label={jt(dict, "field.deadline")} value={editDeadline} onChangeText={setEditDeadline} placeholder="YYYY-MM-DD" />
            {inProgress ? (
              <Input label={jt(dict, "edit.topup")} value={editTopup} onChangeText={setEditTopup} keyboardType="number-pad" />
            ) : (
              <Input label={jt(dict, "field.price")} value={editPrice} onChangeText={setEditPrice} keyboardType="number-pad" />
            )}
            <Text style={[styles.warn, { color: tokens.warning, textAlign }]}>⚠ {jt(dict, "edit.remoderate")}</Text>
            <Button
              label={inProgress ? jt(dict, "edit.propose") : jt(dict, "edit.save")}
              variant="primary"
              size="sm"
              loading={busy === "edit-submit"}
              onPress={() => run("edit-submit", async () => {
                const patch = buildPatch();
                if (inProgress) {
                  if (!Object.keys(patch).length) abort(jt(dict, "error.generic"));
                  const topup = parseInt(editTopup, 10);
                  await proposeEdit(token, requirementId, patch, Number.isFinite(topup) && topup > 0 ? topup : undefined);
                  notify(jt(dict, "edit.propose"), "success");
                } else {
                  const price = parseInt(editPrice, 10);
                  if (Number.isFinite(price) && price > 0 && price !== r.acceptedPrice) patch.acceptedPrice = price;
                  if (!Object.keys(patch).length) abort(jt(dict, "error.generic"));
                  await editRequirement(token, requirementId, patch);
                  notify(jt(dict, "edit.save"), "success");
                }
              })}
            />
          </View>
        ) : null}

        {/* Disputa */}
        {r.status === "disputed" ? (
          <View style={styles.sec}>
            <Text style={[styles.secTitle, { color: tokens.warning, textAlign }]}>{isBuyer ? jt(dict, "dispute.badge") : jt(dict, "dispute.title")}</Text>
            {detail.dispute?.reason ? <Text style={[styles.hint, { color: tokens.textSecondary, textAlign }]}>{detail.dispute.reason}</Text> : null}
            {isBuyer ? (
              <>
                <Input label={jt(dict, "dispute.refundPct")} value={refundPct} onChangeText={setRefundPct} keyboardType="number-pad" />
                <View style={[styles.row, { flexDirection: rowDir }]}>
                  <Button label={jt(dict, "dispute.continue")} variant="primary" size="sm" loading={busy === "d-continue"} style={styles.flexBtn}
                    onPress={() => run("d-continue", async () => { await resolveDispute(token, requirementId, "continue"); notify(jt(dict, "dispute.continue"), "success"); })} />
                  <Button label={jt(dict, "dispute.refundPartial")} variant="ghost" size="sm" loading={busy === "d-partial"} style={styles.flexBtn}
                    onPress={() => run("d-partial", async () => {
                      const p = parseInt(refundPct, 10);
                      if (!Number.isFinite(p) || p < 1 || p > 99) abort(jt(dict, "dispute.refundPct"));
                      await resolveDispute(token, requirementId, "refund_partial", Math.round(p * 100));
                      notify(jt(dict, "dispute.refundPartial"), "success");
                    })} />
                  <Button label={jt(dict, "dispute.refundFull")} variant="danger" size="sm" loading={busy === "d-full"} style={styles.flexBtn}
                    onPress={() => run("d-full", async () => { await resolveDispute(token, requirementId, "refund_full"); notify(jt(dict, "dispute.refundFull"), "success"); })} />
                </View>
              </>
            ) : (
              <Text style={[styles.badgeText, { color: tokens.warning }]}>{jt(dict, "dispute.open")}</Text>
            )}
          </View>
        ) : !isBuyer && inProgress ? (
          <View style={styles.sec}>
            <Text style={[styles.secTitle, { color: tokens.textPrimary, textAlign }]}>{jt(dict, "dispute.title")}</Text>
            <Input label={jt(dict, "dispute.reason")} value={disputeReason} onChangeText={setDisputeReason} multiline maxLength={2000} />
            {!disputeEligible ? <Text style={[styles.hint, { color: tokens.textMuted, textAlign }]}>{jt(dict, "dispute.notEligible")}</Text> : null}
            <Button label={jt(dict, "dispute.request")} variant="danger" size="sm" disabled={!disputeEligible} loading={busy === "d-request"}
              onPress={() => run("d-request", async () => {
                if (!disputeReason.trim()) abort(jt(dict, "dispute.reason"));
                await requestDispute(token, requirementId, disputeReason.trim());
                notify(jt(dict, "dispute.request"), "success");
              })} />
          </View>
        ) : null}

        {/* Rating (comprador, released, sin review) */}
        {r.status === "released" ? (
          <View style={styles.sec}>
            <Text style={[styles.secTitle, { color: tokens.textPrimary, textAlign }]}>{jt(dict, "rating.title")}</Text>
            {detail.review ? (
              <>
                <StarsReadonly value={detail.review.rating} styles={styles} tokens={tokens} />
                {detail.review.comment ? <Text style={[styles.hint, { color: tokens.textSecondary, textAlign }]}>{detail.review.comment}</Text> : null}
                <Text style={[styles.hint, { color: tokens.textMuted, textAlign }]}>{jt(dict, "rating.done")}</Text>
              </>
            ) : isBuyer ? (
              <>
                <View style={[styles.stars, { flexDirection: rowDir }]}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setStars(n)}>
                      <Text style={[styles.star, { color: n <= stars ? tokens.warning : tokens.textMuted }]}>★</Text>
                    </Pressable>
                  ))}
                </View>
                <Input label={jt(dict, "rating.comment")} value={ratingComment} onChangeText={setRatingComment} multiline maxLength={2000} />
                <Button label={jt(dict, "rating.submit")} variant="primary" size="sm" loading={busy === "rating"}
                  onPress={() => run("rating", async () => {
                    if (stars < 1 || stars > 5) abort(jt(dict, "rating.title"));
                    await submitRating(token, requirementId, stars, ratingComment.trim() || undefined);
                    notify(jt(dict, "rating.done"), "success");
                  })} />
              </>
            ) : null}
          </View>
        ) : null}

        {error ? <Text style={[styles.error, { color: tokens.danger, textAlign }]}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

function Header({
  tokens,
  styles,
  rowDir,
  title,
  onClose,
}: {
  tokens: ReturnType<typeof getThemeTokens>;
  styles: ReturnType<typeof makeStyles>;
  rowDir: "row" | "row-reverse";
  title: string;
  onClose: () => void;
}) {
  return (
    <View style={[styles.header, { flexDirection: rowDir }]}>
      <Pressable onPress={onClose} style={styles.headerIconBtn}>
        <ArrowLeft size={16} color={tokens.textSecondary} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: tokens.textPrimary }]} numberOfLines={1}>{title}</Text>
    </View>
  );
}

function StarsReadonly({
  value,
  styles,
  tokens,
}: {
  value: number;
  styles: ReturnType<typeof makeStyles>;
  tokens: ReturnType<typeof getThemeTokens>;
}) {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={[styles.star, { color: i <= n ? tokens.warning : tokens.textMuted }]}>★</Text>
      ))}
    </View>
  );
}
