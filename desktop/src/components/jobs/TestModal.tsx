// Runner del TEST TÉCNICO PREVIO del profesional (Fase 11, IMPL-B).
//
// Espejo del flujo de test de `frontend/src/lib/portal-jobs.ts` (§test, F10/F11):
// confirmación (1 intento) → arranque del intento → preguntas con temporizador
// (10 s/pregunta auto-avance + 120 s totales, SIN volver atrás) → envío y
// resultado del SERVIDOR (passed/score).
//
// INVARIANTE DE SEGURIDAD (§E del contrato): el cliente NUNCA recibe
// `correctIndex`. `PublicTestQuestion` solo trae `{ q, options }`. La
// calificación y el tiempo son autoridad del servidor; los temporizadores de
// cliente son únicamente UX. NUNCA se muestran las respuestas correctas ni qué
// preguntas se fallaron, solo el agregado `passed`/`score`.
import { useCallback, useEffect, useRef, useState } from "react";
import { X, CheckCircle2, XCircle } from "lucide-react";
import {
  startTestAttempt, submitTestAttempt, jobsErrorKey,
  type PublicTestQuestion, type TestSubmitResult,
} from "../../api/jobs";
import type { JobsMessages } from "./i18n";
import { formatMessage } from "../../i18n";

type Phase = "loading" | "running" | "finished" | "error";

export function TestModal({
  open, token, requirementId, j, onClose, onFinished,
}: {
  open: boolean;
  token: string;
  requirementId: string | null;
  j: JobsMessages;
  onClose: () => void;
  /** Notifica al padre el resultado del SERVIDOR para refrescar la lista. */
  onFinished: (result: TestSubmitResult) => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<PublicTestQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [perQLeft, setPerQLeft] = useState(0);   // segundos restantes (UX)
  const [totalLeft, setTotalLeft] = useState(0); // segundos restantes (UX)
  const [result, setResult] = useState<TestSubmitResult | null>(null);

  // Refs server-authoritative / control de timers (no provocan re-render).
  const deadlineAtRef = useRef(0);          // epoch ms total (servidor)
  const perQEndsAtRef = useRef(0);          // epoch ms límite de la pregunta
  const perQSecondsRef = useRef(10);
  const currentRef = useRef(0);
  const answersRef = useRef<Array<number | null>>([]);
  const submittingRef = useRef(false);
  const finishedRef = useRef(false);
  const totalTimerRef = useRef<number | null>(null);
  const perQTimerRef = useRef<number | null>(null);
  const totalSecondsRef = useRef(120); // duración total para escalar la barra (UX)

  const errKey = useCallback((err: unknown): string => {
    const path = jobsErrorKey(err).split(".");
    let node: unknown = j;
    for (const p of path) node = (node as Record<string, unknown>)?.[p];
    return typeof node === "string" ? node : (err instanceof Error ? err.message : j.error.generic);
  }, [j]);

  const clearTimers = useCallback(() => {
    if (totalTimerRef.current !== null) { window.clearInterval(totalTimerRef.current); totalTimerRef.current = null; }
    if (perQTimerRef.current !== null) { window.clearInterval(perQTimerRef.current); perQTimerRef.current = null; }
  }, []);

  // Envío: limpia timers, califica EN SERVIDOR y muestra el resultado recibido.
  const submit = useCallback(async () => {
    if (submittingRef.current || finishedRef.current) return;
    submittingRef.current = true;
    clearTimers();
    try {
      const res = await submitTestAttempt(token, requirementId!, answersRef.current);
      finishedRef.current = true;
      setResult(res);
      setPhase("finished");
      onFinished(res);
    } catch (err) {
      submittingRef.current = false;
      setError(errKey(err));
      setPhase("error");
    }
  }, [token, requirementId, clearTimers, onFinished, errKey]);

  // Auto-avance: o pasa a la siguiente o, si era la última, envía.
  const advanceQuestion = useCallback(() => {
    const total = questions.length || answersRef.current.length;
    if (currentRef.current >= total - 1) {
      void submit();
      return;
    }
    currentRef.current += 1;
    perQEndsAtRef.current = Date.now() + perQSecondsRef.current * 1000;
    setCurrent(currentRef.current);
    setPerQLeft(perQSecondsRef.current);
  }, [questions.length, submit]);

  // Arranque del intento (consume el único intento; confirmado en el padre).
  const start = useCallback(async () => {
    setPhase("loading");
    setError("");
    setResult(null);
    finishedRef.current = false;
    submittingRef.current = false;
    try {
      const data = await startTestAttempt(token, requirementId!);
      const qs = data.questions ?? [];
      const perQ = data.perQuestionSeconds || 10;
      const totalSecs = data.totalSeconds || 120;
      const now = Date.now();
      // Defensa de reloj: deadline server-authoritative; si es inválido o pasado,
      // se reconstruye localmente con totalSeconds (espejo portal-jobs §2665-2668).
      let deadlineAt = Date.parse(data.attempt?.deadlineAt ?? "");
      if (!Number.isFinite(deadlineAt) || deadlineAt <= now) deadlineAt = now + totalSecs * 1000;

      deadlineAtRef.current = deadlineAt;
      totalSecondsRef.current = Math.max(1, totalSecs);
      perQSecondsRef.current = perQ;
      perQEndsAtRef.current = now + perQ * 1000;
      currentRef.current = 0;
      answersRef.current = new Array(qs.length || data.questionCount || 12).fill(null);

      setQuestions(qs);
      setAnswers(answersRef.current.slice());
      setCurrent(0);
      setPerQLeft(perQ);
      setTotalLeft(Math.max(0, Math.ceil((deadlineAt - now) / 1000)));
      setPhase("running");
    } catch (err) {
      setError(errKey(err));
      setPhase("error");
    }
  }, [token, requirementId, errKey]);

  // Al abrir: confirma 1-intento y arranca; al cerrar: limpia estado y timers.
  useEffect(() => {
    if (!open || !requirementId) return;
    const ok = window.confirm(j.test.oneAttempt);
    if (!ok) { onClose(); return; }
    void start();
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requirementId]);

  // Temporizadores: total (1 s, barra 120 s) + por pregunta (250 ms, contador 10 s).
  useEffect(() => {
    if (phase !== "running") return;
    totalTimerRef.current = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineAtRef.current - Date.now()) / 1000));
      setTotalLeft(left);
      if (Date.now() >= deadlineAtRef.current) void submit();
    }, 1000);
    perQTimerRef.current = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((perQEndsAtRef.current - Date.now()) / 1000));
      setPerQLeft(left);
      if (Date.now() >= perQEndsAtRef.current) advanceQuestion();
    }, 250);
    return () => clearTimers();
  }, [phase, submit, advanceQuestion, clearTimers]);

  if (!open || !requirementId) return null;

  // Selección de opción: registra la respuesta de la pregunta actual.
  const selectOption = (optionIndex: number) => {
    answersRef.current[currentRef.current] = optionIndex;
    setAnswers(answersRef.current.slice());
  };

  const total = questions.length || 12;
  const totalSecondsForBar = totalSecondsRef.current;
  const q = questions[current];

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-xl">
        <button type="button" className="btn btn-sm btn-circle btn-ghost absolute end-3 top-3" onClick={onClose} aria-label="x">
          <X size={16} />
        </button>
        <h3 className="text-lg font-bold">{j.test.required}</h3>

        {phase === "loading" ? (
          <div className="mt-6 flex items-center justify-center gap-2 py-8">
            <span className="loading loading-spinner" />
          </div>
        ) : phase === "error" ? (
          <div className="mt-6 py-6">
            <p className="text-sm text-error">{error || j.error.generic}</p>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={onClose}>{j.test.failed}</button>
            </div>
          </div>
        ) : phase === "finished" && result ? (
          <div className="mt-6 flex flex-col items-center gap-3 py-6 text-center">
            {result.passed ? (
              <CheckCircle2 size={56} className="text-success" />
            ) : (
              <XCircle size={56} className="text-error" />
            )}
            <h4 className="text-base font-semibold">{result.passed ? j.test.passed : j.test.failed}</h4>
            <p className="text-sm opacity-80">
              {result.passed
                ? j.test.result.passed
                : result.timedOut
                  ? j.test.result.timedOut
                  : formatMessage(j.test.result.failed, { score: result.score })}
            </p>
            <div className="modal-action w-full justify-center">
              <button type="button" className="btn btn-primary" onClick={onClose}>OK</button>
            </div>
          </div>
        ) : phase === "running" && q ? (
          <div className="mt-4 space-y-4">
            {/* Barra total (120 s) */}
            <div>
              <div className="mb-1 flex items-center justify-between text-xs opacity-70">
                <span>{formatMessage(j.test.questionOf, { n: current + 1 })}</span>
                <span>{totalLeft}s</span>
              </div>
              <progress
                className="progress progress-primary w-full"
                value={totalLeft}
                max={totalSecondsForBar}
              />
            </div>

            {/* Aviso de mecánica + contador por pregunta (10 s) */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs opacity-60">{j.test.autoAdvance}</p>
              <span className={`badge ${perQLeft <= 3 ? "badge-error" : "badge-neutral"} badge-sm`}>{perQLeft}s</span>
            </div>

            {/* Enunciado */}
            <p className="text-sm font-medium">{q.q}</p>

            {/* Opciones (4) — sin marca de acierto/error: solo selección */}
            <div className="grid gap-2">
              {(q.options ?? []).map((opt, i) => {
                const chosen = answers[current] === i;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`btn justify-start normal-case ${chosen ? "btn-primary text-white" : "btn-outline"}`}
                    onClick={() => selectOption(i)}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {/* Sin "anterior": solo se avanza (auto-avance + botón) */}
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-primary"
                disabled={submittingRef.current}
                onClick={() => (current >= total - 1 ? void submit() : advanceQuestion())}
              >
                {current >= total - 1 ? j.test.submit : j.test.next}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 py-8 text-center text-sm opacity-60">—</div>
        )}
      </div>
    </div>
  );
}
