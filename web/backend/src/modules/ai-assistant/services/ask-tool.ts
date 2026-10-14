// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `lxp_ask` — herramienta especial del asistente para el protocolo "ask" en
 * modo API.
 *
 * En modo CLI el agente emite un bloque centinela (`ASK_PROTOCOL_PROMPT`) que
 * se parsea al terminar el job. En modo API los deltas se streamean palabra a
 * palabra, así que el centinela se fragmentaría; en su lugar el agente LLAMA a
 * esta tool para detenerse y preguntar. El handler NO ejecuta nada en el
 * servidor: valida las preguntas con `normalizeAskRequest` y devuelve un
 * `output` con un MARCADOR interno + el JSON de la `AskRequest`. El provider
 * (claude/openai/gemini-api) detecta el marcador en el `tool_result`, emite el
 * evento `{type:"ask", questions}` (idéntico al de CLI) y TERMINA el run sin
 * más tool-calling.
 *
 * Nombre canónico: el agent-capability registry exige el prefijo
 * `<moduleId>.<suffix>` (registry.ts TOOL_NAME_RE), por lo que el nombre real
 * registrado/expuesto es `assistant.ask`. El alias `lxp_ask` se mantiene como
 * nombre amigable en el prompt (`ASK_TOOL_PROMPT`) y los providers reconocen
 * AMBOS por si el modelo usa uno u otro. NO se enruta por el registry de
 * capacidades (allowedTools aplica gating por rol/sidebar): la tool se inyecta
 * directamente en la lista de tools en modo API (agent.service.ts), de modo que
 * está disponible para cualquier rol sin acoplarse a permisos de módulo.
 */

import type { AgentTool } from "../../../shared/agent-capability/index.js";
import { normalizeAskRequest } from "./ask-protocol.js";

/** Nombre canónico (cumple el prefijo `<mod>.<suffix>` del registry). */
export const ASK_TOOL_NAME = "assistant.ask";
/** Alias amigable que el prompt enseña al agente; aceptado por los providers. */
export const ASK_TOOL_ALIAS = "lxp_ask";

/**
 * Marcador interno antepuesto al output del handler. El provider lo detecta en
 * el tool_result para saber que debe emitir `ask` y cortar el bucle. No se
 * muestra al usuario (el provider no lo streamea como texto).
 */
export const ASK_TOOL_RESULT_MARKER = "<<<ASK_EMITTED>>>";

/** True si el nombre (real o alias) corresponde a la tool de ask. */
export function isAskToolName(name: string): boolean {
  return name === ASK_TOOL_NAME || name === ASK_TOOL_ALIAS;
}

/**
 * Si `output` viene de la tool de ask (lleva el marcador), devuelve la
 * `AskRequest` parseada; si no, null. Tolerante a JSON inválido (devuelve null,
 * el provider sigue su flujo normal).
 */
export function parseAskToolResult(output: string): import("../models/ask.types.js").AskRequest | null {
  if (!output || !output.startsWith(ASK_TOOL_RESULT_MARKER)) return null;
  const json = output.slice(ASK_TOOL_RESULT_MARKER.length).trim();
  try {
    const parsed = JSON.parse(json) as unknown;
    return normalizeAskRequest(parsed);
  } catch {
    return null;
  }
}

const ASK_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    kind: {
      type: "string",
      enum: ["plan-approval"],
      description:
        "Solo en modo plan: marca la pregunta como aprobación de plan (una única pregunta single cuya primera opción es aprobar).",
    },
    questions: {
      type: "array",
      description:
        "Lista de preguntas (máx 4) que el usuario debe responder para continuar.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Id estable opcional (q1..qn si se omite)." },
          type: {
            type: "string",
            enum: ["single", "multi", "text"],
            description: "single = una opción · multi = varias · text = texto libre.",
          },
          text: { type: "string", description: "Texto de la pregunta, en el idioma del usuario." },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Opciones (máx 12). Obligatorio para single/multi; ignorado en text.",
          },
        },
        required: ["type", "text"],
      },
    },
  },
  required: ["questions"],
};

/**
 * La `AgentTool` del protocolo ask. El handler NO toca el servidor: valida y
 * señaliza. Devuelve `{ok:false}` con mensaje cuando la entrada es inválida
 * (preguntas vacías / mal formadas) para que el modelo corrija sin detenerse.
 */
export const askTool: AgentTool = {
  name: ASK_TOOL_NAME,
  title: "Preguntar al usuario",
  description:
    "Stop and ask the user a decision when there is REAL ambiguity or multiple valid options, " +
    "instead of guessing. Provide up to 4 questions (single/multi/text). Calling this tool ENDS " +
    "your turn: the user's answer arrives as the next message and resumes the conversation.",
  kind: "read",
  dangerous: false,
  inputSchema: ASK_TOOL_INPUT_SCHEMA,
  async handler(input: unknown) {
    const req = normalizeAskRequest(input);
    if (!req) {
      return {
        ok: false,
        output:
          "Entrada inválida para lxp_ask: se requiere `questions` (1-4) con `type` ∈ single|multi|text " +
          "y `options` no vacías para single/multi. Corrige y vuelve a intentar, o responde directamente.",
      };
    }
    return { ok: true, output: ASK_TOOL_RESULT_MARKER + JSON.stringify(req) };
  },
};
