// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/**
 * Reducción PURA de eventos del stream SSE del asistente → lista de mensajes.
 * Extraída 1:1 del handler inline de `ServerAssistantPane.tsx` (fase A2): sin
 * imports de React/React Native; el pane la invoca dentro de su
 * `setMessages((prev) => applyAssistantEvent(prev, ev).msgs)`.
 *
 * Semántica (idéntica al inline original, no cambiar sin test):
 * - Solo actúa sobre el ÚLTIMO mensaje si está `pending`; si no, devuelve la
 *   MISMA referencia `msgs` (así React no re-renderiza).
 * - Cuando aplica un cambio devuelve un array NUEVO pero muta el turno vivo en
 *   sitio (mismo contrato que el código original del pane).
 */
import type { AssistantEvent } from "../../api/client";
import { hasMcpSessionError } from "./mcp-recovery";
import type { ChatMsg } from "./types";

/** Efectos laterales señalados por el evento (los aplica el pane fuera del
 *  updater de estado). */
export type AssistantStreamEffects = {
  /** El agente emitió el marcador `MCP_SESSION_EXPIRED` (en texto, salida de
   *  tool o error) → el composer muestra la alerta ámbar (mismo marcador que la web). */
  mcpExpired?: boolean;
};

/** ¿El evento trae el marcador de sesión MCP expirada? (texto/tool/error). */
export function eventSignalsMcpExpired(ev: AssistantEvent): boolean {
  return hasMcpSessionError(ev);
}

/** Id sintético para un `tool_use` SIN id: `Date.now()` colisionaba entre dos
 *  tools abiertos en el mismo milisegundo (el segundo se descartaba por
 *  "duplicado" y su salida caía en el bloque del primero). */
let toolSeq = 0;
function syntheticToolId(): string {
  toolSeq += 1;
  return `tool-${Date.now().toString(36)}-${toolSeq}`;
}

/** El `output` del stream viene del agente: NO es necesariamente string (un
 *  objeto reventaba con TypeError dentro del `onprogress` del XHR y el evento se
 *  perdía entero). */
function outputText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

/**
 * Aplica un evento del stream sobre la lista de mensajes del chat.
 * Firma pura: `(msgs, event) => { msgs, effects? }`.
 */
export function applyAssistantEvent(
  msgs: ChatMsg[],
  ev: AssistantEvent,
): { msgs: ChatMsg[]; effects?: AssistantStreamEffects } {
  const effects = eventSignalsMcpExpired(ev) ? { mcpExpired: true } : undefined;
  const next = [...msgs];
  const last = next[next.length - 1];
  // Sin turno vivo no hay nada que reducir: devuelve la MISMA referencia.
  if (!last?.pending) return { msgs, effects };
  // Igual que LUXIPANEL: con proveedor CLI (tool ".cli") los `text` son la
  // salida CRUDA del terminal → van al bloque del tool; la respuesta
  // limpia llega en el `tool_result` del tool ".cli".
  const cliTool = [...(last.tools ?? [])].reverse().find((x) => x.name.endsWith(".cli"));
  if (ev.type === "text" && ev.delta) {
    if (cliTool) cliTool.output += ev.delta;
    else last.content += ev.delta;
  } else if (ev.type === "tool_use" && ev.name) {
    // Idempotente por id: el tool_use se re-emite al reanudar un run. Sin id no
    // hay idempotencia posible → id sintético único (nunca choca con otro tool).
    if (!ev.id || !(last.tools ?? []).some((x) => x.id === ev.id)) {
      (last.tools ??= []).push({ id: ev.id ?? syntheticToolId(), name: ev.name, output: "", input: ev.input });
    }
  } else if (ev.type === "tool_result") {
    const tools = last.tools ?? [];
    // Con id: casa ESTRICTO (si no existe ese tool, el evento no es de este turno
    // → ignorar). Sin id: cae en el último tool NO terminado. Antes caía siempre
    // en el ÚLTIMO tool a secas: con dos tools en paralelo la salida entraba en el
    // bloque equivocado y el otro se quedaba "en ejecución" para siempre.
    const tool = ev.id
      ? tools.find((x) => x.id === ev.id)
      : [...tools].reverse().find((x) => !x.done);
    if (tool) {
      tool.success = ev.success;
      tool.done = true;
      const output = outputText(ev.output);
      if (tool.name.endsWith(".cli")) {
        // CLI: el output es la respuesta limpia → burbuja (ignora placeholders "[…]").
        if (output && !output.startsWith("[")) last.content = output;
      } else {
        tool.output = output;
      }
    }
  } else if (ev.type === "usage") {
    // Eventos {"type":"usage",...} del stream: acumula tokens del turno.
    const u = ev as { inputTokens?: number; outputTokens?: number; estimated?: boolean };
    const inTok = typeof u.inputTokens === "number" ? u.inputTokens : 0;
    const outTok = typeof u.outputTokens === "number" ? u.outputTokens : 0;
    const prevTok = last.tokens ?? { input: 0, output: 0, total: 0 };
    last.tokens = {
      input: prevTok.input + inTok,
      output: prevTok.output + outTok,
      total: prevTok.total + inTok + outTok,
      estimated: prevTok.estimated || u.estimated === true,
    };
  } else if (ev.type === "ask" && ev.questions) {
    // El agente se detuvo a preguntar: guarda las preguntas en el turno.
    last.ask = ev.questions;
    if (ev.kind === "plan-approval") last.askKind = ev.kind;
    last.status = undefined;
  } else if (ev.type === "permission_request" && ev.id) {
    // Gate de permisos: pinta los botones en el turno vivo.
    last.permission = { id: ev.id, tool: ev.tool ?? "", title: ev.title ?? "", detail: ev.detail };
  } else if (ev.type === "permission_resolved") {
    // Limpia el gate si coincide el id (clic / timeout en otro cliente).
    if (last.permission && (!ev.id || last.permission.id === ev.id)) last.permission = null;
  } else if (ev.type === "status") {
    const st = (ev as { state?: string }).state;
    last.status = st === "translating" ? "translating" : st === "working" ? "working" : last.status;
  } else if (ev.type === "translation_error" && ev.message) {
    last.translationError = ev.message;
  } else if (ev.type === "done") {
    last.displaySummary = ev.pending ? undefined : ev.displaySummary;
  } else if (ev.type === "error" && ev.message) {
    // Error duro del turno → caja roja con Reintentar / Nuevo chat.
    last.error = ev.message;
  }
  return { msgs: next, effects };
}
