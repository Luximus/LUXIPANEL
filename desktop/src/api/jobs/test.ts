/**
 * Jobs Marketplace — Fase 11: test técnico previo (fetchers, §A del contrato F11).
 * Extraído de `src/api/jobs.ts` (fachada); los consumidores importan `../api/jobs`.
 *
 * Token primero; desempaquetan `res.data.<campo>` del Envelope canónico y usan
 * `encodeURIComponent` para el id. SEGURIDAD: ningún endpoint devuelve
 * `correctIndex`; el cliente jamás conoce la respuesta correcta. La calificación
 * y el tiempo (`deadlineAt`) son server-authoritative.
 */

import { request } from "../client";
import type { Envelope, PublicTest, TestAttemptView, TestSubmitResult } from "./types";

/** PUT …/test/require — el COMPRADOR exige/quita el test del requerimiento. */
export async function setRequiresTest(
  token: string,
  reqId: string,
  requiresTest: boolean,
): Promise<{ requiresTest: boolean }> {
  const res = await request<Envelope<{ requiresTest: boolean }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/test/require`,
    token,
    { method: "PUT", body: JSON.stringify({ requiresTest }) },
  );
  return { requiresTest: Boolean(res.data.requiresTest) };
}

/** POST …/test/generate — genera/regenera el test (eje MB). Solo conteo + aiUsed. */
export async function generateTest(
  token: string,
  reqId: string,
): Promise<{ questionCount: number; aiUsed: boolean }> {
  const res = await request<Envelope<{ questionCount: number; aiUsed: boolean }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/test/generate`,
    token,
    { method: "POST", body: JSON.stringify({}) },
  );
  return { questionCount: Number(res.data.questionCount ?? 0), aiUsed: Boolean(res.data.aiUsed) };
}

/** GET …/test — vista PÚBLICA del test (sin correctIndex). */
export async function getTest(token: string, reqId: string): Promise<PublicTest> {
  const res = await request<Envelope<{ test: PublicTest }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/test`,
    token,
  );
  return res.data.test;
}

/** GET …/test/my-attempt — mi intento (o null). Nunca incluye correctIndex. */
export async function getMyTestAttempt(
  token: string,
  reqId: string,
): Promise<TestAttemptView | null> {
  const res = await request<Envelope<{ attempt: TestAttemptView | null }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/test/my-attempt`,
    token,
  );
  return res.data.attempt ?? null;
}

/** POST …/test/start — crea el intento (1 oportunidad). Devuelve test público +
 *  attempt (con deadlineAt server-authoritative). El envelope `data` es plano. */
export async function startTestAttempt(
  token: string,
  reqId: string,
): Promise<PublicTest & { attempt: TestAttemptView }> {
  const res = await request<Envelope<PublicTest & { attempt: TestAttemptView }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/test/start`,
    token,
    { method: "POST", body: JSON.stringify({}) },
  );
  return res.data;
}

/** POST …/test/submit — califica EN SERVIDOR. Devuelve score/passed/timedOut,
 *  NUNCA las respuestas correctas. answers = 12 índices (0..3 | null). */
export async function submitTestAttempt(
  token: string,
  reqId: string,
  answers: Array<number | null>,
): Promise<TestSubmitResult> {
  const res = await request<Envelope<{ result: TestSubmitResult }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/test/submit`,
    token,
    { method: "POST", body: JSON.stringify({ answers }) },
  );
  return res.data.result;
}
