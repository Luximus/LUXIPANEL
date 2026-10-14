// Helpers puros del tab Snippets/Historial (sin estado React).
// Extraído de `ServerSnippetsTab.tsx` (refactor conservador: código movido tal cual).
import type { ServerConversation, ConversationSource } from "../../api/client";

export function formatConvDate(ts: number): string {
  if (!ts) return "";
  const ms = ts < 1e12 ? ts * 1000 : ts; // tolera epoch en segundos o ms
  try { return new Date(ms).toLocaleString(); } catch { return ""; }
}

// Comilla simple POSIX (igual que `shellQuote` del terminal de LUXIPANEL).
export function shellQuote(value: string): string {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

// Comando para reanudar una conversación: `codex resume <id>` / `claude --resume <id>`
// (espejo de `buildConversationResumeCommand` de LUXIPANEL), con `cd <proyecto> &&`
// si la conversación tiene proyecto asociado.
export function buildResumeCommand(c: ServerConversation): string {
  const base = c.source === "codex"
    ? `codex resume ${shellQuote(c.sessionId)}`
    : `claude --resume ${shellQuote(c.sessionId)}`;
  return c.project ? `cd ${shellQuote(c.project)} && ${base}` : base;
}

// JS que inyecta un comando en la consola con auto-run (mismo contrato que el
// `runSnippet`): el terminal nativo y la WebView de LUXIPANEL lo entienden.
export function runCommandJs(command: string): string {
  return `(function(){try{window.dispatchEvent(new CustomEvent('lxp-terminal:inject-command',{detail:{command:${JSON.stringify(command)},run:true}}));}catch(e){}})(); true;`;
}

// Mapea el proveedor IA activo (clave del módulo asistente) a la fuente de
// conversaciones. Solo codex/claude tienen historial de conversaciones.
export function activeConversationSource(activeProvider: string | null): ConversationSource | null {
  const p = (activeProvider ?? "").toLowerCase();
  if (p.includes("codex")) return "codex";
  if (p.includes("claude")) return "claude";
  return null;
}
