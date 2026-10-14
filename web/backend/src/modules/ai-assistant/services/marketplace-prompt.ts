/**
 * System prompt del flujo "módulo del marketplace" — se inyecta en
 * `agentService.run` cuando el proyecto activo está vinculado a un módulo
 * (shared/marketplace-link). Contiene:
 *
 *   - el contexto del módulo (slug, path, provider),
 *   - las reglas del manifest/SDK que la IA debe respetar (campos AUTO,
 *     capabilities de mínimo privilegio, prefijo de tools),
 *   - el GUION DEL ALTA: qué preguntar al dev vía el ask protocol existente
 *     (bloque centinela <<<LXP_ASK>>>, CLI-mode — ask-protocol.ts) antes de
 *     rellenar el manifest borrador,
 *   - el ciclo `/mod` y las tools `module-dev.*` (con la EXCEPCIÓN MCP en
 *     CLI: sí están disponibles vía el server MCP `luxipanel`).
 *
 * Pendiente documentado (fuera de v1): ask protocol en modo API — la decisión
 * registrada es que el flujo marketplace v1 corre en CLI-mode
 * (MODULE-DEV-AI-FLOW.md §3.2); en API el agente pregunta en texto plano.
 */

import type { MarketplaceLink } from "../../../shared/marketplace-link/index.js";

/** Tools del módulo module-dev expuestas al agente (contrato compartido §7). */
const MODULE_DEV_TOOLS = [
  "module-dev.validate_manifest — valida un manifest (objeto o el del proyecto) contra el contrato",
  "module-dev.run_checks — chequeos del proyecto (manifest presente/válido, entry existe)",
  "module-dev.run_tests — ejecuta la suite de tests del módulo del proyecto",
  "module-dev.list_modules — lista los módulos del dev con su estado de revisión",
  "module-dev.module_status — estado + eventos de revisión de un módulo",
  "module-dev.submit_module — envía el módulo a revisión (moduleId + prUrl)",
  "module-dev.resubmit_module — reenvía tras una corrección (moduleId + prUrl)",
  "module-dev.unpublish_module — despublica un módulo publicado (→ inactivo)",
  "module-dev.republish_module — reactiva un módulo inactivo (→ publico)",
  "module-dev.preview_install — instala la preview privada del módulo (projectId)",
  "module-dev.preview_uninstall — desinstala la preview (moduleId)",
  "module-dev.link_project — vincula proyecto ↔ módulo (equivale a /mod vincular)",
] as const;

/**
 * Bloque de system prompt para un proyecto vinculado a un módulo del
 * marketplace. SIEMPRE se añade antes del LANGUAGE OVERRIDE de traducción.
 */
export function buildMarketplacePromptBlock(
  link: MarketplaceLink,
  opts: { cliMode: boolean },
): string {
  const slug = link.moduleId;
  const lines: string[] = [];

  lines.push(`## Proyecto de módulo del marketplace \`${slug}\``);
  lines.push("");
  lines.push(
    `Este proyecto del asistente está vinculado al módulo del marketplace LUXIPANEL ` +
      `\`${slug}\` (projectId ${link.projectId}; directorio de trabajo ${link.projectPath || "(sin definir)"}; ` +
      `provider ${link.provider}). El módulo vive en \`modules/${slug}/\` dentro del proyecto. ` +
      `El dev NO escribe código a mano: TÚ generas y modificas el módulo; el dev describe, decide, ` +
      `testea y cambia estados.`,
  );
  lines.push("");

  // ── Reglas duras del manifest y del SDK ─────────────────────────────────
  lines.push("### Reglas del módulo (no negociables)");
  lines.push(
    [
      `- \`modules/${slug}/module.manifest.json\`: JSON puro, sin campos extra. Los campos AUTO ` +
        "(`version`, `os_compat`, `arch`, `path`, `commit`) los fija la PLATAFORMA en el pipeline — " +
        "NUNCA los inventes ni los escribas; un valor manual se ignora/sobreescribe.",
      "- `capabilities` = conjunto cerrado y de MÍNIMO privilegio: `server.exec`, `server.sudo`, " +
        "`server.fs.read`, `server.fs.write`, `storage`, `http`. Declara solo lo que el código usa. " +
        "`http` exige `http_allowlist` no vacío; `server.sudo` exige también `server.exec` o " +
        "`server.fs.write`; `pricing.model:\"free\"` exige `tokensPerMonth: 0`; `surface.sidebar|views` " +
        "exige `entry.frontend`.",
      `- Backend: \`export default defineModule((m) => …)\` del SDK \`@luxipanel/module-sdk\`. Los nombres ` +
        `de tools/dataPanels van SIN prefijo — el SDK antepone \`${slug}.\` automáticamente. \`ctx\` es el ` +
        "ÚNICO puente con efectos (cada `ctx.*` exige su capability). PROHIBIDO: Express/routers propios, " +
        "`child_process`/`fs`/`net`, `process.env`, `eval`, `fetch` global, `require`/`import` dinámico.",
      "- Frontend (opcional): patrón canónico de scripts extraídos (`astro:page-load` + `astro:after-swap` " +
        `+ \`AbortController\`); cliente \`lxp.module("${slug}").call/panel\`; sin \`fetch\` libre.`,
      "- `chat.version: 1` y `chat.operations` son obligatorios; cada operación declara id, tool, kind y permission y coincide con una tool del SDK. Todas las acciones de surface.actions tienen una tool. Una actualización incompleta se rechaza.",
      "- El dev no edita archivos a mano: todo cambio pasa por ti (el asistente).",
    ].join("\n"),
  );
  lines.push("");

  // ── Guion del alta (ask protocol) ───────────────────────────────────────
  lines.push("### Guion del alta — pregunta, no adivinas");
  if (opts.cliMode) {
    lines.push(
      "Cuando falten metadatos del módulo (alta o cambios de manifest), usa el PROTOCOLO ASK " +
        "(bloque `<<<LXP_ASK>>>{json}<<<LXP_ASK_END>>>`, máximo 4 preguntas por bloque y 12 opciones " +
        "por pregunta; emite el bloque y DETÉN tu turno). Hazlo en este orden:",
    );
  } else {
    lines.push(
      "Cuando falten metadatos del módulo (alta o cambios de manifest), pregunta al dev en texto " +
        "plano y espera su respuesta antes de continuar (el bloque ASK interactivo es solo de modo CLI " +
        "en v1). Hazlo en este orden:",
    );
  }
  lines.push(
    [
      "1. **Bloque 1** (máx. 4): nombre comercial del módulo (text) · descripción en 1 frase ≤160 (text) · " +
        "categoría (single: `communication`, `infrastructure`, `security`, `developer`) · capabilities " +
        "estrictamente necesarias (multi: `server.exec`, `server.sudo`, `server.fs.read`, " +
        "`server.fs.write`, `storage`, `http`).",
      "2. **Bloque 2** (máx. 4): ¿página propia en el panel? (single sí/no → `surface` + `entry.frontend`) · " +
        "pricing (single: `free`, `subscription`) · si `subscription`: `tokensPerMonth` (text, entero ≥1) · " +
        "si pidió `http`: hosts del `http_allowlist` (text, separados por coma).",
      "3. **Al enviar a revisión** (`/mod enviar` sin URL o submit sin prUrl): pide la URL del Pull Request " +
        "contra el repo canónico (rama `modules`).",
      "Con las respuestas, actualiza el manifest borrador y el código TÚ mismo — el dev nunca abre el JSON.",
    ].join("\n"),
  );
  lines.push("");

  // ── Ciclo /mod + tools module-dev.* ─────────────────────────────────────
  lines.push("### Ciclo del módulo — verbos `/mod` y tools `module-dev.*`");
  lines.push(
    "El dev maneja el ciclo con el slash command `/mod` (vincular · estado · probar · preview · " +
      "enviar <prUrl> · reenviar <prUrl> · despublicar · republicar · ayuda). Esos verbos te llegan como " +
      "instrucciones para invocar las tools del módulo `module-dev`:",
  );
  lines.push(MODULE_DEV_TOOLS.map((t) => `- ${t}`).join("\n"));
  lines.push("");
  if (opts.cliMode) {
    lines.push(
      "**EXCEPCIÓN al bloque MODO CLI:** a diferencia del resto de tools del panel, las tools " +
        "`module-dev.*` SÍ están disponibles en esta sesión a través del servidor MCP `luxipanel` " +
        "(tools/list · tools/call). Para los cambios de estado, tests, checks y preview del módulo " +
        "ÚSALAS vía MCP — no las reimplementes por shell ni llames a la API del panel a mano.",
    );
  } else {
    lines.push(
      "Las tools `module-dev.*` se invocan como cualquier otra tool del agente (modo API). " +
        "Las acciones sensibles (submit/unpublish/republish/preview_install) pueden requerir " +
        "confirmación del usuario — explica qué vas a hacer antes de invocarlas.",
    );
  }

  return lines.join("\n");
}
