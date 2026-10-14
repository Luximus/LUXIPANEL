import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleRowDirection, getLocaleTextAlign } from "../../i18n";
import { Button } from "../ui/Button";
import {
  MODERATION_OK,
  isModerated,
  type Requirement,
  type TestAttemptView,
} from "../../api/jobs";
import { fmtJobDate, fmtTokens, jt, type JobsDict } from "./jobs-i18n";
import { makeStyles } from "./RequirementCard.styles";

export type JobsRole = "buyer" | "professional";

/** Acciones contextuales emitidas por la tarjeta hacia la pantalla padre. */
export type CardAction =
  | "moderate-plan"
  | "publish"
  | "delete"
  | "offer"
  | "release"
  | "accept"
  | "reject"
  | "translate"
  | "channel"
  | "detail"
  // ── Fase 11: gestión del test técnico previo ──
  | "test-require"
  | "test-generate"
  | "start-test";

// Tarjeta de un requerimiento. Espejo RN de `requirementCardHtml` +
// `buyerActions`/`professionalActions`/`detailAction` (portal-jobs.ts). Las
// acciones se delegan al padre vía `onAction(action, requirement)`; la tarjeta no
// llama a la API directamente (la pantalla orquesta refetch + toasts).
export function RequirementCard({
  requirement,
  role,
  dict,
  language,
  busyAction,
  onAction,
  myAttempt,
}: {
  requirement: Requirement;
  role: JobsRole;
  dict: JobsDict;
  language: string;
  /** Acción en curso (deshabilita su botón con spinner). */
  busyAction?: CardAction | null;
  onAction: (action: CardAction, requirement: Requirement) => void;
  /** Fase 11: mi intento del test (rol profesional). `undefined` = sin hidratar,
   *  `null` = aún no presento. Cualquier intento existente bloquea "Presentar". */
  myAttempt?: TestAttemptView | null;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const textAlign = getLocaleTextAlign(language);
  const rowDir = getLocaleRowDirection(language);
  const [aiOpen, setAiOpen] = useState(false);

  const r = requirement;
  const modStatus = r.moderationStatus ?? null;
  const modOk = modStatus ? MODERATION_OK.has(modStatus) : false;
  const hasAi = Boolean(modStatus || r.aiPlan || r.costEstimate || r.aiSummary);

  const statusColor = (() => {
    switch (r.status) {
      case "released":
        return tokens.success;
      case "disputed":
        return tokens.danger;
      case "cancelled":
        return tokens.textMuted;
      case "in_progress":
      case "assigned":
        return tokens.brand;
      default:
        return tokens.warning;
    }
  })();

  const workTypeLabel = jt(dict, `workType.${r.workType}`);
  const workType = workTypeLabel === `workType.${r.workType}` ? r.workType : workTypeLabel;

  // Botones por rol/estado (espejo del web). Cada uno es una `CardAction`.
  const actions: { action: CardAction; label: string; variant: "primary" | "ghost" | "danger" | "secondary"; disabled?: boolean; disabledHint?: string }[] = [];
  if (role === "buyer") {
    if (r.status === "draft") {
      actions.push({ action: "moderate-plan", label: jt(dict, "ai.moderatePlan"), variant: "ghost" });
      // Fase 11: exigir/quitar test (toggle) y, si está exigido, generarlo.
      actions.push({
        action: "test-require",
        label: r.requiresTest ? `✓ ${jt(dict, "test.require")}` : jt(dict, "test.require"),
        variant: r.requiresTest ? "secondary" : "ghost",
      });
      if (r.requiresTest) {
        actions.push({ action: "test-generate", label: jt(dict, "test.generate"), variant: "ghost" });
      }
      actions.push({
        action: "publish",
        label: jt(dict, "action.publish"),
        variant: "primary",
        disabled: !isModerated(r),
        disabledHint: jt(dict, "ai.mustModerate"),
      });
      actions.push({ action: "delete", label: jt(dict, "action.delete"), variant: "danger" });
    } else if (r.status === "published") {
      // Fase 11: el comprador aún puede exigir/quitar y regenerar el test.
      actions.push({
        action: "test-require",
        label: r.requiresTest ? `✓ ${jt(dict, "test.require")}` : jt(dict, "test.require"),
        variant: r.requiresTest ? "secondary" : "ghost",
      });
      if (r.requiresTest) {
        actions.push({ action: "test-generate", label: jt(dict, "test.generate"), variant: "ghost" });
      }
      actions.push({ action: "offer", label: jt(dict, "action.offer"), variant: "primary" });
      actions.push({ action: "delete", label: jt(dict, "action.delete"), variant: "danger" });
    } else if (r.status === "in_progress" || r.status === "assigned") {
      actions.push({ action: "release", label: jt(dict, "action.release"), variant: "primary" });
      if (r.assigneeId) actions.push({ action: "channel", label: jt(dict, "channel.title"), variant: "ghost" });
      actions.push({ action: "delete", label: jt(dict, "action.delete"), variant: "ghost", disabled: true, disabledHint: jt(dict, "error.notCancellable") });
    } else if (r.assigneeId) {
      actions.push({ action: "channel", label: jt(dict, "channel.title"), variant: "ghost" });
    }
  } else {
    if (r.status === "published") {
      // Fase 11: si el requerimiento exige test, el profesional pasa por el gate:
      // debe presentar (1 vez) y aprobar antes de poder aceptar. El estado del
      // intento llega del padre (`myAttempt`); el backend revalida igualmente.
      if (r.requiresTest) {
        const passed = myAttempt?.status === "passed";
        const tried = Boolean(myAttempt);
        actions.push({
          action: "start-test",
          label: jt(dict, "test.present"),
          variant: "primary",
          disabled: tried,
          disabledHint: jt(dict, "test.attemptExists"),
        });
        actions.push({
          action: "accept",
          label: jt(dict, "action.accept"),
          variant: passed ? "primary" : "secondary",
          disabled: !passed,
          disabledHint: jt(dict, "test.acceptLocked"),
        });
      } else {
        actions.push({ action: "accept", label: jt(dict, "action.accept"), variant: "primary" });
      }
      actions.push({ action: "reject", label: jt(dict, "action.reject"), variant: "danger" });
      actions.push({ action: "translate", label: jt(dict, "ai.translate"), variant: "ghost" });
    } else if (r.status === "assigned" || r.status === "in_progress") {
      actions.push({ action: "translate", label: jt(dict, "ai.translate"), variant: "ghost" });
      if (r.assigneeId) actions.push({ action: "channel", label: jt(dict, "channel.title"), variant: "ghost" });
    } else if (r.assigneeId) {
      actions.push({ action: "channel", label: jt(dict, "channel.title"), variant: "ghost" });
    }
  }
  // "Detalle" (Fase 5) en cualquier estado salvo borrador.
  if (r.status !== "draft") {
    actions.push({ action: "detail", label: jt(dict, "action.detail"), variant: "secondary" });
  }

  return (
    <View style={styles.card}>
      <View style={[styles.headRow, { flexDirection: rowDir }]}>
        <View style={[{ backgroundColor: tokens.bgSecondary, borderColor: statusColor }, styles.badge]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{jt(dict, `status.${r.status}`)}</Text>
        </View>
        {modStatus ? (
          <View style={[{ backgroundColor: tokens.bgSecondary, borderColor: modOk ? tokens.success : tokens.warning }, styles.badge]}>
            <Text style={[styles.badgeText, { color: modOk ? tokens.success : tokens.warning }]}>
              {jt(dict, `ai.moderation.${modStatus}`)}
            </Text>
          </View>
        ) : null}
        {r.requiresTest ? (() => {
          // Fase 11: badge del test. Para el profesional refleja su intento
          // (aprobado/no superado/requerido); para el comprador solo "requerido".
          const passed = role === "professional" && myAttempt?.status === "passed";
          const failed = role === "professional" && (myAttempt?.status === "failed" || myAttempt?.status === "in_progress");
          const color = passed ? tokens.success : failed ? tokens.danger : tokens.warning;
          const label = passed ? jt(dict, "test.passed") : failed ? jt(dict, "test.failed") : jt(dict, "test.required");
          return (
            <View style={[{ backgroundColor: tokens.bgSecondary, borderColor: color }, styles.badge]}>
              <Text style={[styles.badgeText, { color }]}>{label}</Text>
            </View>
          );
        })() : null}
        <Text style={[styles.price, { color: tokens.brand }]}>
          {fmtTokens(r.acceptedPrice)} <Text style={[styles.metaText, { color: tokens.textMuted }]}>{jt(dict, "field.price")}</Text>
        </Text>
      </View>

      <Text style={[styles.title, { color: tokens.textPrimary, textAlign }]} numberOfLines={2}>{r.title}</Text>
      {r.description ? (
        <Text style={[styles.desc, { color: tokens.textMuted, textAlign }]} numberOfLines={3}>{r.description}</Text>
      ) : null}

      <View style={styles.chipsRow}>
        <Chip text={workType} tokens={tokens} styles={styles} />
        {r.country ? <Chip text={r.country} tokens={tokens} styles={styles} /> : null}
        {r.language ? <Chip text={r.language} tokens={tokens} styles={styles} /> : null}
        {r.deadlineAt ? (
          <Chip text={`${jt(dict, "field.deadline")}: ${fmtJobDate(r.deadlineAt, language)}`} tokens={tokens} styles={styles} />
        ) : null}
      </View>

      {hasAi ? (
        <>
          <Pressable style={[styles.aiToggle, { flexDirection: rowDir }]} onPress={() => setAiOpen((v) => !v)}>
            <Text style={[styles.aiToggleText, { color: tokens.brand }]}>{jt(dict, "ai.plan")}</Text>
            {aiOpen ? <ChevronUp size={14} color={tokens.brand} /> : <ChevronDown size={14} color={tokens.brand} />}
          </Pressable>
          {aiOpen ? (
            <View style={styles.aiBox}>
              {r.aiSummary ? <Text style={[styles.aiLine, { color: tokens.textSecondary, textAlign }]}>{r.aiSummary}</Text> : null}
              {r.aiPlan?.summary ? <Text style={[styles.aiLine, { color: tokens.textSecondary, textAlign }]}>{r.aiPlan.summary}</Text> : null}
              {r.aiPlan?.milestones?.length ? (
                <>
                  <Text style={[styles.aiHeading, { color: tokens.textMuted, textAlign }]}>{jt(dict, "ai.milestones")}</Text>
                  {r.aiPlan.milestones.map((m, i) => (
                    <Text key={i} style={[styles.aiLine, { color: tokens.textSecondary, textAlign }]}>• {m.title}</Text>
                  ))}
                </>
              ) : null}
              {r.aiPlan?.risks?.length ? (
                <>
                  <Text style={[styles.aiHeading, { color: tokens.textMuted, textAlign }]}>{jt(dict, "ai.risks")}</Text>
                  {r.aiPlan.risks.map((rk, i) => (
                    <Text key={i} style={[styles.aiLine, { color: tokens.textSecondary, textAlign }]}>• {rk}</Text>
                  ))}
                </>
              ) : null}
              {r.costEstimate ? (
                <>
                  <Text style={[styles.aiHeading, { color: tokens.textMuted, textAlign }]}>{jt(dict, "ai.estimate")}</Text>
                  <Text style={[styles.aiLine, { color: tokens.textSecondary, textAlign }]}>
                    {fmtTokens(r.costEstimate.estimateTokens)} · {jt(dict, "ai.professionalShare")}: {fmtTokens(r.costEstimate.professionalShare)} · {jt(dict, "ai.platformShare")}: {fmtTokens(r.costEstimate.platformShare)}
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      <View style={[styles.actionsRow, { flexDirection: rowDir }]}>
        {actions.map((a) => (
          <Button
            key={a.action}
            label={a.label}
            size="sm"
            variant={a.variant}
            disabled={a.disabled}
            loading={busyAction === a.action}
            onPress={() => onAction(a.action, r)}
            style={styles.actionBtn}
          />
        ))}
      </View>
    </View>
  );
}

function Chip({
  text,
  tokens,
  styles,
}: {
  text: string;
  tokens: ReturnType<typeof getThemeTokens>;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipText, { color: tokens.textSecondary }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}
