import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { ScopedNativeModal as RNModal } from "../../screens/main/native-module-context";;
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../../i18n";
import { Button } from "../ui/Button";
import {
  jobsErrorKey,
  startTestAttempt,
  submitTestAttempt,
  type PublicTestQuestion,
  type TestSubmitResult,
} from "../../api/jobs";
import { jt, type JobsDict } from "./jobs-i18n";
import { makeStyles } from "./TestRunner.styles";

// ── Runner del test técnico previo (Fase 11, IMPL-D) ──────────────────────────
// Espejo RN de `TestModal.tsx` (desktop) y de portal-jobs.ts §test. UI idéntica:
// el PROFESIONAL presenta el test UNA sola vez, con temporizador 10 s por
// pregunta (auto-avance), 120 s total, sin volver atrás, y el RESULTADO lo decide
// el SERVIDOR. SEGURIDAD (anti-trampa, §E): el cliente NUNCA recibe ni muestra
// `correctIndex` ni qué preguntas fallaron; solo el agregado (passed/score).
//
// Fases: intro (confirmación de 1 intento) → pregunta → resultado del servidor.
// Al cerrar tras finalizar, invoca `onFinished(result)` para que el padre
// refresque la lista y el gate de "Aceptar".

const QUESTION_COUNT_FALLBACK = 12;

type Phase = "loading" | "intro" | "running" | "result" | "error";

export function TestRunner({
  visible,
  token,
  requirementId,
  dict,
  language,
  onClose,
  onFinished,
}: {
  visible: boolean;
  token: string;
  requirementId: string | null;
  dict: JobsDict;
  language: string;
  onClose: () => void;
  onFinished: (result: TestSubmitResult) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const textAlign = getLocaleTextAlign(language);
  const rowDir = getLocaleRowDirection(language);
  const tCommon = getMessages(language).common;

  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Estado de la sesión del test (servidor = autoridad; los contadores son UX).
  const [questions, setQuestions] = useState<PublicTestQuestion[]>([]);
  const [totalSeconds, setTotalSeconds] = useState(120);
  const [perQuestionSeconds, setPerQuestionSeconds] = useState(10);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [now, setNow] = useState(Date.now()); // tick para repintar contadores
  const [finished, setFinished] = useState<TestSubmitResult | null>(null);

  // Refs server-authoritative (deadline) + UX (límite por pregunta) + guards.
  const deadlineAtRef = useRef(0);
  const perQEndsAtRef = useRef(0);
  // Segundos por pregunta en un ref (no en el closure de los timers): begin() lo
  // fija con el valor del servidor antes de armar los intervalos, evitando capturar
  // el estado stale (default) en el primer auto-avance (espejo del desktop).
  const perQSecondsRef = useRef(0);
  const answersRef = useRef<Array<number | null>>([]);
  const currentRef = useRef(0);
  const submittingRef = useRef(false);
  const finishedRef = useRef(false);
  const totalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const perQTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (totalTimerRef.current) { clearInterval(totalTimerRef.current); totalTimerRef.current = null; }
    if (perQTimerRef.current) { clearInterval(perQTimerRef.current); perQTimerRef.current = null; }
  }, []);

  // Reinicia el estado interno cada vez que se abre con un requerimiento nuevo.
  useEffect(() => {
    if (visible) {
      setPhase("intro");
      setError("");
      setSubmitting(false);
      submittingRef.current = false;
      finishedRef.current = false;
      setFinished(null);
      setQuestions([]);
      setCurrent(0);
      currentRef.current = 0;
      setAnswers([]);
      answersRef.current = [];
    } else {
      clearTimers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, requirementId]);

  // Limpieza al desmontar.
  useEffect(() => () => clearTimers(), [clearTimers]);

  // ── Envío (califica EN SERVIDOR; nunca decide passed el cliente) ────────────
  const submit = useCallback(async () => {
    if (submittingRef.current || finishedRef.current) return;
    if (!requirementId) return;
    submittingRef.current = true;
    setSubmitting(true);
    clearTimers();
    try {
      const result = await submitTestAttempt(token, requirementId, answersRef.current);
      finishedRef.current = true;
      setFinished(result);
      setPhase("result");
      onFinished(result);
    } catch (e) {
      // Si ya existe intento o falla la red, mostramos el error en pantalla;
      // el padre revalidará al refrescar.
      setError(jt(dict, jobsErrorKey(e)));
      setPhase("error");
      submittingRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [token, requirementId, dict, onFinished, clearTimers]);

  // ── Auto-avance de pregunta (sin volver atrás) ──────────────────────────────
  const advanceQuestion = useCallback(() => {
    if (currentRef.current >= answersRef.current.length - 1) {
      void submit();
      return;
    }
    const next = currentRef.current + 1;
    currentRef.current = next;
    setCurrent(next);
    perQEndsAtRef.current = Date.now() + perQSecondsRef.current * 1000;
    setNow(Date.now());
  }, [submit]);

  // ── Arranque del intento (consume el único intento) ─────────────────────────
  const startTimers = useCallback(() => {
    clearTimers();
    // Total (1 s): repinta la barra y auto-envía al agotar el deadline del SERVIDOR.
    totalTimerRef.current = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= deadlineAtRef.current) {
        void submit();
      }
    }, 1000);
    // Por pregunta (~250 ms): repinta el contador y auto-avanza al agotar 10 s.
    perQTimerRef.current = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= perQEndsAtRef.current) {
        advanceQuestion();
      }
    }, 250);
  }, [clearTimers, submit, advanceQuestion]);

  const begin = useCallback(async () => {
    if (!requirementId) return;
    setPhase("loading");
    setError("");
    try {
      const data = await startTestAttempt(token, requirementId);
      const qs = data.questions ?? [];
      const total = data.totalSeconds || 120;
      const perQ = data.perQuestionSeconds || 10;
      const count = qs.length || QUESTION_COUNT_FALLBACK;

      // Defensa de reloj: el servidor manda deadlineAt; si es inválido o ya
      // pasó, lo derivamos del total (espejo de la defensa del desktop).
      const nowMs = Date.now();
      let deadline = Date.parse(data.attempt?.deadlineAt ?? "");
      if (!Number.isFinite(deadline) || deadline <= nowMs) deadline = nowMs + total * 1000;
      deadlineAtRef.current = deadline;
      perQSecondsRef.current = perQ;
      perQEndsAtRef.current = nowMs + perQ * 1000;

      const initAnswers = new Array<number | null>(count).fill(null);
      answersRef.current = initAnswers;
      currentRef.current = 0;

      setQuestions(qs);
      setTotalSeconds(total);
      setPerQuestionSeconds(perQ);
      setAnswers(initAnswers);
      setCurrent(0);
      setNow(nowMs);
      setPhase("running");
      startTimers();
    } catch (e) {
      setError(jt(dict, jobsErrorKey(e)));
      setPhase("error");
    }
  }, [token, requirementId, dict, startTimers]);

  // Confirmación previa (consume el único intento; espejo de window.confirm).
  const confirmAndBegin = useCallback(() => {
    Alert.alert("", jt(dict, "test.oneAttempt"), [
      { text: tCommon.cancel, style: "cancel" },
      { text: tCommon.accept, onPress: () => { void begin(); } },
    ]);
  }, [dict, tCommon, begin]);

  const selectOption = useCallback((optionIndex: number) => {
    const next = [...answersRef.current];
    next[currentRef.current] = optionIndex;
    answersRef.current = next;
    setAnswers(next);
  }, []);

  // Contadores derivados (UX).
  const totalRemaining = Math.max(0, Math.ceil((deadlineAtRef.current - now) / 1000));
  const perQRemaining = Math.max(0, Math.ceil((perQEndsAtRef.current - now) / 1000));
  const totalPct = totalSeconds > 0 ? Math.max(0, Math.min(100, (totalRemaining / totalSeconds) * 100)) : 0;
  const perQColor = perQRemaining <= 3 ? tokens.danger : perQRemaining <= 6 ? tokens.warning : tokens.brand;

  const isLast = current >= (questions.length || answers.length) - 1;
  const q = questions[current];

  const handleClose = useCallback(() => {
    if (submitting) return;
    clearTimers();
    onClose();
  }, [submitting, clearTimers, onClose]);

  return (
    <RNModal visible={visible} animationType="slide" onRequestClose={() => {}}>
      <View style={styles.root}>
        <View style={[styles.header, { flexDirection: rowDir }]}>
          <Pressable onPress={handleClose} style={styles.headerIconBtn} disabled={submitting}>
            <ArrowLeft size={16} color={tokens.textSecondary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: tokens.textPrimary }]} numberOfLines={1}>
            {jt(dict, "test.present")}
          </Text>
        </View>

        {phase === "loading" ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={tokens.brand} />
          </View>
        ) : phase === "error" ? (
          <View style={styles.centered}>
            <Text style={[styles.error, { color: tokens.danger, textAlign }]}>{error || jt(dict, "loadError")}</Text>
            <View style={{ height: 14 }} />
            <Button label={jt(dict, "back")} variant="ghost" size="sm" onPress={handleClose} />
          </View>
        ) : phase === "result" && finished ? (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.resultIcon, { color: finished.passed ? tokens.success : tokens.danger }]}>
              {finished.passed ? "✓" : "✕"}
            </Text>
            <Text style={[styles.resultTitle, { color: finished.passed ? tokens.success : tokens.danger }]}>
              {jt(dict, finished.passed ? "test.passed" : "test.failed")}
            </Text>
            <Text style={[styles.resultMsg, { color: tokens.textSecondary }]}>
              {finished.passed
                ? jt(dict, "test.result.passed")
                : finished.timedOut
                  ? jt(dict, "test.result.timedOut")
                  : jt(dict, "test.result.failed", { score: finished.score })}
            </Text>
          </ScrollView>
        ) : phase === "running" && q ? (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.timersRow}>
              <Text style={[styles.counterLabel, { color: tokens.textMuted }]}>
                {totalRemaining}s
              </Text>
              <View style={[styles.perQBadge, { borderColor: perQColor }]}>
                <Text style={[styles.perQBadgeText, { color: perQColor }]}>{perQRemaining}</Text>
              </View>
            </View>
            <View style={styles.totalTrack}>
              <View style={[styles.totalFill, { width: `${totalPct}%` }]} />
            </View>

            <Text style={[styles.counterLabel, { color: tokens.textSecondary, textAlign }]}>
              {jt(dict, "test.questionOf", { n: current + 1 })}
            </Text>
            <Text style={[styles.question, { color: tokens.textPrimary, textAlign }]}>{q.q}</Text>
            <Text style={[styles.autoHint, { color: tokens.textMuted, textAlign }]}>
              {jt(dict, "test.autoAdvance")}
            </Text>

            <View style={styles.options}>
              {(q.options ?? []).map((opt, i) => {
                const sel = answers[current] === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => selectOption(i)}
                    style={[
                      styles.option,
                      {
                        flexDirection: rowDir,
                        borderColor: sel ? tokens.brand : tokens.border,
                        backgroundColor: sel ? tokens.brandDim : tokens.bgCard,
                      },
                    ]}
                  >
                    <View style={[styles.optionMarker, { borderColor: sel ? tokens.brand : tokens.textMuted }]}>
                      {sel ? <View style={[styles.optionDot, { backgroundColor: tokens.brand }]} /> : null}
                    </View>
                    <Text style={[styles.optionText, { color: tokens.textPrimary, textAlign }]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={[styles.error, { color: tokens.danger, textAlign }]}>{error}</Text> : null}
          </ScrollView>
        ) : (
          // intro
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.introTitle, { color: tokens.textPrimary, textAlign }]}>
              {jt(dict, "test.required")}
            </Text>
            <Text style={[styles.introText, { color: tokens.textSecondary, textAlign }]}>
              {jt(dict, "test.gateRequired")}
            </Text>
            <Text style={[styles.bullet, { color: tokens.textMuted, textAlign }]}>
              • {jt(dict, "test.autoAdvance")}
            </Text>
            <Text style={[styles.bullet, { color: tokens.textMuted, textAlign }]}>
              • {jt(dict, "test.oneAttempt")}
            </Text>
          </ScrollView>
        )}

        {/* Footer contextual: intro = "Presentar", running = "Siguiente/Enviar". */}
        {phase === "intro" ? (
          <View style={styles.footer}>
            <Button label={jt(dict, "test.present")} variant="primary" onPress={confirmAndBegin} />
            <Button label={jt(dict, "back")} variant="ghost" size="sm" onPress={handleClose} />
          </View>
        ) : phase === "running" ? (
          <View style={styles.footer}>
            <Button
              label={jt(dict, isLast ? "test.submit" : "test.next")}
              variant="primary"
              loading={submitting}
              onPress={() => (isLast ? void submit() : advanceQuestion())}
            />
          </View>
        ) : phase === "result" ? (
          <View style={styles.footer}>
            <Button label={tCommon.accept} variant="primary" onPress={handleClose} />
          </View>
        ) : null}
      </View>
    </RNModal>
  );
}
