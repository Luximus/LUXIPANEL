import type { AssistantEvent } from "../../api/client";
import type { ChatAction } from "../SupportChatWidget";
import type { ChatMsg } from "./types";

/**
 * Aplica un evento del stream del asistente al último turno (pendiente) del
 * historial y devuelve el nuevo array de mensajes. Réplica exacta del reductor
 * que vivía inline en `ServerAssistantPane.send`: mismo trato de CLI (los `text`
 * crudos van al mini-terminal del tool ".cli"; la respuesta limpia llega en su
 * `tool_result`), acumulación de `usage`, tarjetas `client_action` y errores.
 * Si el último turno ya no está pendiente devuelve el array original.
 */
export function reduceAssistantEvent(prev: ChatMsg[], ev: AssistantEvent): ChatMsg[] {
  const next = [...prev];
  const last = next[next.length - 1];
  if (!last?.pending) return prev;
  const cliTool = [...(last.tools ?? [])].reverse().find((x) => x.name.endsWith(".cli"));
  if (ev.type === "text" && ev.delta) {
    if (cliTool && !cliTool.done) cliTool.output += ev.delta;
    else last.content += ev.delta;
  } else if (ev.type === "tool_use" && ev.name) {
    // Idempotente por id: el tool_use se re-emite al reanudar/adoptar un run.
    if (!(last.tools ?? []).some((x) => x.id === ev.id)) {
      (last.tools ??= []).push({ id: ev.id ?? `${Date.now()}`, name: ev.name, output: "" });
    }
  } else if (ev.type === "tool_result") {
    const tool = (last.tools ?? []).find((x) => x.id === ev.id) ?? (last.tools ?? [])[(last.tools ?? []).length - 1];
    if (tool) {
      tool.success = ev.success;
      tool.done = true;
      if (tool.name.endsWith(".cli")) {
        // CLI: el output es la respuesta limpia → burbuja (ignora placeholders "[…]").
        if (ev.output && !ev.output.startsWith("[")) last.content = ev.output;
      } else {
        tool.output = ev.output ?? "";
      }
    }
  } else if (ev.type === "usage") {
    // Acumula TODOS los `usage` del run (agente + sub-agentes) para que la
    // meta del turno muestre el total de la consulta (como LUXIPANEL).
    const prevTok = last.tokens ?? { input: 0, output: 0, total: 0 };
    const inTok = prevTok.input + (ev.inputTokens ?? 0);
    const outTok = prevTok.output + (ev.outputTokens ?? 0);
    last.tokens = { input: inTok, output: outTok, total: inTok + outTok, estimated: prevTok.estimated || ev.estimated };
  } else if (ev.type === "client_action" && ev.action) {
    (last.actions ??= []).push(ev.action as ChatAction);
  } else if (ev.type === "error" && ev.message) {
    last.content += `${last.content ? "\n" : ""}${ev.message}`;
  }
  // `status` (working/translating) es transitorio → no toca la burbuja.
  return next;
}
