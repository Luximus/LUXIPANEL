// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * "Ask" protocol — lets a headless CLI agent (claude/codex/gemini) hand a
 * decision back to the user instead of guessing.
 *
 * The CLI runs non-interactively (`-p` / `exec` / `--yolo`, stdin closed), so it
 * can never pause for a TTY menu. Instead we instruct it (ASK_PROTOCOL_PROMPT)
 * to emit a sentinel block when it genuinely needs input, then STOP. We parse
 * that block from the finished output into an `AskRequest`, stream an `ask`
 * event, and the chat renders buttons / checkboxes / a text input. The user's
 * answer becomes the next turn, which RESUMES the upstream session — so the
 * agent continues with the chosen value, no real stdin required.
 */

import type { AskQuestion, AskRequest } from "../models/ask.types.js";

const ASK_OPEN = "<<<LXP_ASK>>>";
const ASK_CLOSE = "<<<LXP_ASK_END>>>";

// Captures the JSON payload between the markers (non-greedy, multiline).
const ASK_BLOCK_RE = new RegExp(`${ASK_OPEN}([\\s\\S]*?)${ASK_CLOSE}`);
// Global variant for stripping every block from displayed/persisted text.
const ASK_BLOCK_RE_G = new RegExp(`${ASK_OPEN}[\\s\\S]*?${ASK_CLOSE}`, "g");

const MAX_QUESTIONS = 4;
const MAX_OPTIONS = 12;

/** System-prompt directive appended in CLI mode. Teaches the ask protocol. */
export const ASK_PROTOCOL_PROMPT =
  "PREGUNTAR AL USUARIO (no adivinar): Si para continuar necesitas una decisión del usuario " +
  "porque hay ambigüedad REAL o varias opciones válidas, NO elijas por tu cuenta ni asumas. " +
  `En su lugar emite EXACTAMENTE este bloque y DETÉN tu turno (no ejecutes nada más después):\n` +
  `${ASK_OPEN}\n` +
  `{"questions":[{"id":"q1","type":"single","text":"¿Qué motor web?","options":["nginx","apache"]},` +
  `{"id":"q2","type":"multi","text":"¿Qué módulos activar?","options":["ssl","cache","php"]},` +
  `{"id":"q3","type":"text","text":"Nombre del dominio"}]}\n` +
  `${ASK_CLOSE}\n` +
  "Reglas: JSON válido entre los marcadores; `type` ∈ single|multi|text; `options` SOLO para single/multi; " +
  "máximo 4 preguntas; escribe en el idioma del usuario. Antes del bloque puedes poner una frase breve de contexto. " +
  "Tras emitir el bloque, termina: la respuesta del usuario llegará como el siguiente mensaje y reanudará tu sesión. " +
  "Úsalo SOLO ante duda real — para tareas claras actúa directamente sin preguntar.\n" +
  "IMPORTANTE — sesión headless: en esta sesión NO existen las herramientas nativas `AskUserQuestion`, " +
  "`ExitPlanMode` ni `EnterPlanMode` (Claude Code las deshabilita en modo `-p`). NUNCA intentes llamarlas: " +
  "fallarán con «No such tool available». El ÚNICO mecanismo para preguntar al usuario o pedirle una " +
  `aprobación es el bloque ${ASK_OPEN} descrito arriba.`;

/**
 * System-prompt directive appended in API mode. A diferencia del modo CLI (que
 * usa el bloque centinela `ASK_PROTOCOL_PROMPT`), en modo API el agente dispone
 * de la herramienta `lxp_ask` y la LLAMA para detenerse y preguntar. No se debe
 * emitir el bloque centinela en modo API — los deltas se streamean palabra a
 * palabra y el centinela se fragmentaría. El handler de la tool valida las
 * preguntas y señaliza al provider para que emita el evento `ask` y termine.
 */
export const ASK_TOOL_PROMPT =
  "PREGUNTAR AL USUARIO (no adivinar): Si para continuar necesitas una decisión del usuario " +
  "porque hay ambigüedad REAL o varias opciones válidas, NO elijas por tu cuenta ni asumas. " +
  "En su lugar LLAMA a la herramienta `lxp_ask` con las preguntas y DETENTE: el turno termina al invocarla. " +
  "La respuesta del usuario llegará como el siguiente mensaje y reanudará la conversación con su elección.\n" +
  "Esquema de entrada de `lxp_ask`: " +
  `{"questions":[{"id":"q1","type":"single","text":"¿Qué motor web?","options":["nginx","apache"]},` +
  `{"id":"q2","type":"multi","text":"¿Qué módulos activar?","options":["ssl","cache"]},` +
  `{"id":"q3","type":"text","text":"Nombre del dominio"}]}\n` +
  "Reglas: `type` ∈ single|multi|text; `options` SOLO para single/multi (obligatorio para esos tipos); " +
  "máximo 4 preguntas y 12 opciones por pregunta; escribe en el idioma del usuario. " +
  "Antes de llamar la tool puedes escribir una frase breve de contexto. " +
  "NO emitas ningún bloque de texto con marcadores `<<<...>>>`: en modo API la forma correcta de preguntar es " +
  "ÚNICAMENTE la herramienta `lxp_ask`. Úsala SOLO ante duda real — para tareas claras actúa directamente sin preguntar.";

/**
 * Bloque "MODO PLAN ACTIVO" del system prompt, parametrizado por el modo del
 * proveedor: el QUÉ (plan primero, no ejecutar sin aprobación) es común, pero
 * el CÓMO pedir la aprobación difiere — CLI = bloque centinela LXP_ASK (las
 * tools nativas ExitPlanMode/AskUserQuestion no existen en headless `-p`);
 * API = la herramienta `lxp_ask`. Sin este "cómo", el modelo busca
 * ExitPlanMode, falla con «No such tool available» y degrada a texto plano.
 * Función pura para poder testearla sin montar buildSystemPrompt entero.
 */
export function buildPlanModeBlock(mode: "cli" | "api"): string {
  const how =
    mode === "cli"
      ? " Cuando el plan esté listo, pide la aprobación emitiendo el bloque del protocolo PREGUNTAR AL USUARIO " +
        `con UNA sola pregunta \`type\` "single" cuya PRIMERA opción sea aprobar, marcado con \`"kind":"plan-approval"\`:\n` +
        `${ASK_OPEN}\n` +
        `{"kind":"plan-approval","questions":[{"id":"plan","type":"single","text":"¿Apruebas este plan?","options":["Aprobar plan","Pedir cambios"]}]}\n` +
        `${ASK_CLOSE}\n` +
        "y DETÉN tu turno. NO llames a `ExitPlanMode` ni a `AskUserQuestion`: no existen en esta sesión. " +
        "Emite el bloque SIEMPRE en el MISMO turno en que el plan quede listo — NUNCA pidas la aprobación en " +
        "texto plano ni digas «avísame cuando quieras» o «listo para aprobación»: sin el bloque, el panel no " +
        "muestra los botones de aprobación y el usuario queda bloqueado."
      : " Cuando el plan esté listo, pide la aprobación LLAMANDO a la herramienta `lxp_ask` con " +
        `\`"kind":"plan-approval"\` y UNA sola pregunta \`type\` "single" cuya PRIMERA opción sea aprobar ` +
        "(p. ej. «Aprobar plan» / «Pedir cambios») y DETENTE. Llama a la tool SIEMPRE en el MISMO turno en " +
        "que el plan quede listo — nunca pidas la aprobación en texto plano.";
  return (
    "MODO PLAN ACTIVO: Antes de ejecutar CUALQUIER acción que modifique el servidor " +
    "(comandos que escriben, edición o creación de archivos, instalaciones, reinicios de servicios, etc.) " +
    "primero investiga lo necesario y presenta un plan completo que permita decidir si aprobar la tarea. " +
    "Este plan es una excepción a cualquier regla de respuesta final breve: no lo reduzcas a una lista de títulos. " +
    "Usa este formato: una primera línea `Resumen: ...` de una o dos frases; una línea en blanco; " +
    "después `Plan completo:` con pasos numerados. En cada paso explica qué cambiarías, dónde o en qué componente, " +
    "cómo lo comprobarías y qué resultado se espera. Incluye alcance, dependencias, riesgos o límites reales cuando " +
    "apliquen. Adapta la extensión a la complejidad; no inventes archivos, decisiones ni verificaciones. " +
    "El resumen y todos los detalles deben estar en la misma respuesta, antes de solicitar aprobación." +
    how +
    " No ejecutes ningún paso hasta recibir la aprobación explícita del usuario. Las lecturas " +
    "(inspeccionar archivos, estado, logs) sí puedes hacerlas para construir el plan."
  );
}

/**
 * Bloque para clientes antiguos que reanudan un plan con modo persistido
 * "plan" y override "manual". El flujo actual cambia el modo a "auto".
 */
export const PLAN_APPROVED_PROMPT =
  "PLAN APROBADO: el usuario acaba de aprobar tu plan. Ejecútalo ahora paso a paso sin volver a pedir " +
  "aprobación del plan (cada acción sensible pasará por el gate de permisos normal).";

/**
 * Validate + normalize an arbitrary `{questions:[...]}` shape into an
 * `AskRequest`. This is the single source of truth for the ask rules (used by
 * BOTH the CLI sentinel path `extractAskRequest` and the API tool `lxp_ask`):
 *
 * - máximo 4 preguntas, 12 opciones por pregunta;
 * - `type` ∈ single|multi|text (cualquier otro → "single");
 * - `options` solo string no vacíos; single/multi sin opciones se descartan;
 * - ids auto `q1..qn` cuando faltan.
 *
 * Returns null when the input is not an object, lacks a `questions` array, or
 * no question survives validation.
 */
export function normalizeAskRequest(input: unknown): AskRequest | null {
  if (!input || typeof input !== "object") return null;
  const rawQuestions = (input as { questions?: unknown }).questions;
  if (!Array.isArray(rawQuestions)) return null;
  const kind = (input as { kind?: unknown }).kind === "plan-approval" ? ("plan-approval" as const) : undefined;

  const questions: AskQuestion[] = [];
  for (const raw of rawQuestions.slice(0, MAX_QUESTIONS)) {
    if (!raw || typeof raw !== "object") continue;
    const q = raw as Record<string, unknown>;
    if (typeof q.text !== "string" || !q.text.trim()) continue;
    const type = q.type === "multi" || q.type === "text" ? q.type : "single";
    const options = Array.isArray(q.options)
      ? q.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0).slice(0, MAX_OPTIONS)
      : undefined;
    // single/multi without options would render an empty control — skip those.
    if ((type === "single" || type === "multi") && (!options || options.length === 0)) continue;
    questions.push({
      id: typeof q.id === "string" && q.id.trim() ? q.id : `q${questions.length + 1}`,
      text: q.text.trim(),
      type,
      ...(options && options.length ? { options } : {}),
    });
  }

  if (questions.length === 0) return null;
  if (kind === "plan-approval") {
    // Plan approval is deterministic by convention: exactly ONE `single`
    // question whose FIRST option is the affirmative. Drop extra questions and
    // reject non-single shapes so the frontend can map "option 0 = approve".
    const first = questions[0]!;
    if (first.type !== "single" || !first.options || first.options.length === 0) return { questions };
    return { questions: [first], kind };
  }
  return { questions };
}

/**
 * Parse the first `<<<LXP_ASK>>> … <<<LXP_ASK_END>>>` block out of `text` into a
 * validated `AskRequest`. Returns null when no (valid) block is present, so a
 * normal answer is unaffected. Tolerant of code fences the model may wrap the
 * JSON in. Validation is delegated to `normalizeAskRequest`.
 */
export function extractAskRequest(text: string): AskRequest | null {
  if (!text || !text.includes(ASK_OPEN)) return null;
  const m = ASK_BLOCK_RE.exec(text);
  if (!m || !m[1]) return null;

  let parsed: unknown;
  const tryParse = (s: string): boolean => {
    try { parsed = JSON.parse(s); return true; } catch { return false; }
  };
  const inner = m[1].trim();
  if (!tryParse(inner)) {
    const unfenced = inner.replace(/```[a-z]*\s*/gi, "").replace(/```/g, "").trim();
    if (!tryParse(unfenced)) return null;
  }

  return normalizeAskRequest(parsed);
}

/** Remove every ask block from text (for clean display / persistence). */
export function stripAskBlock(text: string): string {
  if (!text || !text.includes(ASK_OPEN)) return text;
  return text.replace(ASK_BLOCK_RE_G, "").trim();
}
