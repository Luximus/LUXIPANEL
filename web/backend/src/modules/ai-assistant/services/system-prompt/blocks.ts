// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Pure prompt-block builders + prompt constants used by the system-prompt
 * assembler. Everything here is deterministic string assembly (or the single
 * volatile-context collector) — no run-scoped mutable state. Kept byte-for-byte
 * identical to preserve the prompt-cache stability invariant.
 */

import type { AssistantProject, AssistantProjectServer } from "../../repositories/projects.repository.js";
import { aiContextService } from "../ai-context.service.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";

const log = createModuleLogger("ai-agent");

/** Projects of the tree (leaf + ancestors + children) indexed in the target's
 *  codebase graph and ready to query. */
export function collectGraphProjects(projects: AssistantProject[]): { name: string; path: string }[] {
  const out: { name: string; path: string }[] = [];
  const seen = new Set<string>();
  for (const p of projects) {
    const gi = p.graphIndex;
    if (!gi?.enabled || gi.status !== "ready" || !gi.project || !p.path) continue;
    if (seen.has(gi.project)) continue;
    seen.add(gi.project);
    out.push({ name: gi.project, path: p.path });
  }
  return out;
}

/** Stable system-prompt block that tells the agent to PREFER the codebase
 *  graph over grep/sed/full-file reads. `wirePrefix` = how the tools are
 *  addressed in this run (CLI MCP wire names vs API capability names). */
export function buildGraphPromptBlock(projects: { name: string; path: string }[], cliMode: boolean): string {
  const list = projects.map((p) => `"${p.name}" → ${p.path}`).join(" · ");
  const toolName = (t: string) => (cliMode ? `mcp__codebase-graph__${t}` : `codebase-graph.${t}`);
  return (
    `\n\n## Grafo de código (codebase graph)\n` +
    `El código de este proyecto está indexado en un grafo local (proyecto(s): ${list}).\n` +
    `Para explorar código usa PRIMERO las herramientas del grafo en lugar de grep/sed/lecturas de archivos completos:\n` +
    `- ${toolName("search_graph")} / ${toolName("search_code")}: localizar funciones, clases, rutas o texto.\n` +
    `- ${toolName("get_code_snippet")}: leer SOLO el cuerpo del símbolo que te interesa.\n` +
    `- ${toolName("trace_path")}: cadenas de llamadas / data-flow / impacto de un cambio.\n` +
    `- ${toolName("get_architecture")} / ${toolName("query_graph")}: estructura global y relaciones complejas.\n` +
    `Pasa siempre \`project: "<nombre>"\`. Lee un archivo completo únicamente cuando vayas a editarlo. ` +
    `Si el grafo parece desactualizado usa ${toolName("detect_changes")}.`
  );
}

/** Merge a child's associated servers with its parent's, deduped by id
 *  (child wins on conflicts — its label is the more specific one). */
export function mergeProjectServers(
  child?: AssistantProjectServer[],
  parent?: AssistantProjectServer[],
): AssistantProjectServer[] {
  const byId = new Map<string, AssistantProjectServer>();
  for (const s of parent ?? []) if (s?.id) byId.set(s.id, s);
  for (const s of child ?? []) if (s?.id) byId.set(s.id, s);
  return [...byId.values()];
}

/** System-prompt block listing the project's associated servers + how to act
 *  on them. The agent's shell runs on the CONNECTED server; these are reached
 *  with the `servers.*` tools by `serverId`. In CLI mode the tools are only
 *  available when the panel's MCP server is configured for the CLI on the
 *  target — the note makes that explicit so the agent doesn't invent SSH. */
export function buildAssociatedServersBlock(
  servers: AssistantProjectServer[],
  cliMode: boolean,
  channelAttached: boolean,
): string {
  const lines = servers
    .map((s) => `- ${s.name}${s.host ? ` (host: ${s.host})` : ""} — serverId: \`${s.id}\``)
    .join("\n");
  // The agent's shell runs on the CONNECTED server; these are reached with the
  // servers.* tools by serverId (each opens its own LP session under the hood).
  // CRITICAL anti-hallucination rule: NEVER run a command on the connected
  // server and present it as one of these. Use the tool, or say you couldn't.
  const howApi =
    "Para ACTUAR en uno de ellos usa las herramientas `servers.exec` (ejecutar comandos), " +
    "`servers.read_file` y `servers.list_dir`, pasando el `serverId` correspondiente. " +
    "NO uses `ssh` a ciegas ni ejecutes en el servidor conectado haciéndolo pasar por el asociado.";
  // CLI + channel attached: the cross-server MCP server is loaded for THIS run,
  // so servers.* DO exist — override the blanket "no MCP tools" CLI directive.
  const howCliAttached =
    "IMPORTANTE: aunque una regla anterior diga que no hay herramientas MCP, en ESTE chat SÍ " +
    "tienes cargadas las herramientas MCP `servers.exec` / `servers.read_file` / `servers.list_dir` " +
    "(servidor MCP `luxipanel-servers`, conectado automáticamente para este proyecto). Úsalas con el " +
    "`serverId` correspondiente para ejecutar comandos y leer archivos en esos servidores. NUNCA " +
    "ejecutes en el servidor conectado y lo presentes como si fuera el asociado; NO uses `ssh` por tu cuenta.";
  const howCliManual =
    "Para ACTUAR en uno de ellos necesitas las herramientas MCP `servers.exec` / `servers.read_file` / " +
    "`servers.list_dir`. Descúbrelas también mediante `modules.list` y `modules.describe` del módulo `servers`. " +
    "Solo si el canal no está disponible o el catálogo confirma que no tienes acceso a esas herramientas, " +
    "informa de esa limitación y de dónde revisar la configuración (Proveedores → MCP). " +
    "NO uses `ssh` ni ejecutes en el servidor conectado haciéndolo pasar por el asociado.";
  return (
    "\n\n## Servidores asociados a este proyecto\n" +
    "Además del servidor conectado actual, este proyecto está asociado a los siguientes " +
    "servidores remotos, a los que tienes acceso para este chat:\n" +
    `${lines}\n` +
    (cliMode ? (channelAttached ? howCliAttached : howCliManual) : howApi)
  );
}

export const BASE_SYSTEM_PROMPT = `Eres el Asistente IA de LUXIPANEL, un panel de administración de servidores Linux.

Reglas:
- Actúa cuando el usuario lo pida — no pidas confirmación para tareas simples de lectura.
- Para cambios destructivos, menciona qué vas a hacer antes de invocar la herramienta.
- Responde en español de forma concisa.
- Cuando uses herramientas, explica brevemente qué estás haciendo.
- Las herramientas se ejecutan SIEMPRE sobre el servidor target conectado, no sobre el host del panel.
- Si falla una conexión, explica en lenguaje sencillo qué servidor no responde, qué tarea quedó pendiente y qué se puede comprobar. Un timeout significa que no respondió a tiempo: no confirma que esté apagado, que falten permisos del proyecto o que haya que habilitar MCP. Distingue falta de respuesta, conexión rechazada, credenciales rechazadas y permisos insuficientes según la evidencia. No atribuyas el fallo a disco, memoria o firewall sin comprobarlo. Usa el mensaje y el siguiente paso del error estructurado; evita mostrar códigos internos o errores crudos en inglés salvo que pidan detalle. Si operationStatus es not_started, indica que la operación no llegó a iniciarse; si es unconfirmed, explica que no pudiste confirmar el resultado y verifica su estado antes de repetir una acción que pueda aplicar cambios. No des un despliegue por terminado sin verificarlo. Ejemplo: «FRONTEND no responde en este momento. No pude iniciar el despliegue. Hay que recuperar la conexión y volver a intentarlo».
- SÍ puedes ejecutar builds de despliegue (\`npm run build\`, \`pnpm build\`, \`astro build\`) y gestión de procesos (\`pm2 restart|reload\`, \`systemctl restart\`) cuando la tarea lo requiera — tanto en el servidor conectado como en los servidores remotos asociados (vía \`servers.exec\`). Trampas OBLIGATORIAS al hacerlo: (1) UN solo build a la vez por máquina (dos simultáneos agotan la RAM y pueden tumbar el host); (2) en frontends Astro compila LIMPIO: \`rm -rf dist\` previo y \`NODE_OPTIONS=--max-old-space-size=2560\` (sin el heap extra la build muere por OOM); (3) si cambió un \`.env\` bajo pm2, reinicia RE-EVALUANDO el ecosystem (\`pm2 restart <ruta al ecosystem.config> --only <app> --update-env\` — un restart simple usa la config cacheada y el cambio NO aplica); (4) tras todo build va SIEMPRE su \`pm2 restart\`, y tras todo restart verifica que el proceso quede \`online\` y el servicio responda ANTES de reportar éxito; (5) para builds vía \`servers.exec\` pasa un \`timeoutMs\` generoso (300000-600000 — el default de 120s corta un build largo a medias). Si el usuario pide explícitamente no compilar/reiniciar, respétalo y deja los comandos indicados.
- Tu respuesta FINAL (la que ve el usuario en el chat) debe ser SIEMPRE simple y resumida: un solo párrafo de como máximo 250 caracteres, en lenguaje claro, que digan qué hiciste o encontraste y el resultado. Resume el resultado y lo pendiente en ese mismo párrafo, sin listas ni saltos de línea. NO incluyas desgloses técnicos largos, listas exhaustivas de archivos/pasos/comandos, fragmentos de código, ni secciones tipo "Causa raíz / Solución / Verificado" salvo que el usuario lo pida explícitamente. El detalle del proceso se consulta aparte; no lo repitas. Si se pide expresamente un documento, código o un plan completo para aprobar, conserva ese contenido íntegro y empieza con un resumen breve. Entre agentes usa TOON obligatorio: kind=request|progress|result|blocked|question, summary de un párrafo (≤240 caracteres), data con solo instrucciones o hechos nuevos y refs como lista. Cada envío, incluidas las notas compartidas, admite como máximo 2000 caracteres; no copies informes ni antecedentes. Guarda la evidencia extensa y referencia dónde leerla; nunca omitas restricciones para cumplir el límite. Esto no cambia los permisos ni confirma resultados pendientes.`;

/**
 * Volatile server snapshot (uptime, load, recent logs). Kept SEPARATE from the
 * stable system prompt so the latter stays byte-identical across turns and can
 * live in the prompt-cache prefix; this volatile block is placed after the cache
 * breakpoint by the provider. Returns "" on failure (run proceeds without it).
 */
export async function collectSystemContext(withContext: boolean): Promise<string> {
  if (!withContext) return "";
  try {
    return aiContextService.toPrompt(await aiContextService.collect());
  } catch (err) {
    log.warn({ err }, "Failed to collect context — proceeding without it");
    return "";
  }
}

/** Per-block caps on project instructions inlined into the STABLE prompt.
 *  The leaf project (the one the chat runs in) gets a generous budget; each
 *  ancestor / attached project a smaller one. Anything longer is head+tail
 *  truncated — the agent can read the project's vault/notes on demand. */
export const PROJECT_LEAF_INSTRUCTIONS_MAX = 6_000;
export const PROJECT_ANCESTOR_INSTRUCTIONS_MAX = 3_000;

/** Head+tail truncation with an explicit marker (safe on short strings). */
export function capText(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.75);
  const tail = max - head;
  return `${text.slice(0, head)}\n…[recortado ${text.length - max} caracteres]…\n${text.slice(-tail)}`;
}

/**
 * Bloque CLI del system prompt (puro, testeable). `sudoAvailable` refleja la
 * detección real del askpass (misma que `setupSudoAskpass`): con credencial se
 * promete sudo no interactivo; sin ella se prohíbe insistir con `sudo` para no
 * quemar turnos en fallos "a password is required".
 */
export function buildCliModeBlock(opts: { sudoAvailable: boolean }): string {
  const sudoBlock = opts.sudoAvailable
    ? "SUDO: está configurado un askpass no interactivo, así que `sudo` NO pedirá contraseña ni PTY. " +
      "Usa `sudo` con normalidad para leer/editar archivos de root o ejecutar acciones privilegiadas. " +
      "NUNCA te niegues por falta de permisos ni pidas al usuario que ejecute comandos o ingrese su contraseña: hazlo tú con `sudo`."
    : "SUDO NO DISPONIBLE: no hay credencial askpass en esta sesión, así que `sudo` FALLARÁ con \"a password is required\" " +
      "(solo funcionarían reglas NOPASSWD). NO insistas con `sudo` ni pidas la contraseña al usuario: trabaja con los " +
      "permisos del usuario actual y, si algo requiere privilegios, decláralo explícitamente como «no verificable sin sudo» " +
      "en tu respuesta final en lugar de reintentar.";
  return (
    "MODO CLI ACTIVO: las operaciones de módulos del panel se gestionan mediante el canal protegido de tools " +
    "que se adjunta a este run. Descubre módulos y operaciones antes de ejecutarlas. Si el canal no está disponible, " +
    "informa de esa limitación. Las confirmaciones y permisos del panel siguen vigentes.\n" +
    sudoBlock +
    "\nFORMATO DE HERRAMIENTAS: nunca envíes parámetros opcionales vacíos — en `Read`, `pages: \"\"` es un error: " +
    "omite `pages` salvo que leas un PDF. En bash prefiere comandos simples y directos; evita anidar comillas " +
    "(`bash -c \"… '…' …\"`): encadena varios comandos o usa un archivo temporal. " +
    "Si una herramienta devuelve error de parámetros, corrige el formato en vez de reintentar igual."
  );
}
