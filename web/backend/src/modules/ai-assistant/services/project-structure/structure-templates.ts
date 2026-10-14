// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Recommended on-disk project structures per AI provider.
 *
 * Each provider ships a tree of nodes (files + directories) that the panel can
 * scaffold into a project's working directory on the connected target. These
 * are the real files the provider CLIs read (Claude reads CLAUDE.md/.claude,
 * Codex reads AGENTS.md/.codex, Gemini reads GEMINI.md/.gemini), so scaffolding
 * here = configuring the actual project on the server.
 *
 * Templates are intentionally minimal, commented starters — enough to be useful
 * and self-documenting, never overwriting an existing file (the service skips
 * nodes already present).
 */

import type { StructureProviderId } from "../../repositories/projects.repository.js";
import { MODULE_ID_RE } from "../../../../shared/marketplace-link/index.js";
import { SDK_VERSION } from "../../../../shared/module-sdk/index.js";

export interface StructureNode {
  /** Path relative to the project working directory (POSIX, no leading slash). */
  rel: string;
  type: "file" | "dir";
  /** Short human label shown in the panel tree. */
  description: string;
  /**
   * Core nodes are pre-checked in the scaffold UI; non-core (examples) are
   * offered but unchecked by default.
   */
  core?: boolean;
  /** Default content for a file node when scaffolded (ignored for dirs). */
  template?: (ctx: TemplateContext) => string;
}

export interface TemplateContext {
  /** Project display title. */
  title: string;
  /** Project working directory on the target. */
  path: string;
  /** Slug del módulo del marketplace vinculado (solo proyectos marketplace). */
  moduleSlug?: string;
  /** Nombre comercial del módulo (default: título del proyecto). */
  moduleName?: string;
  /** Versión instalada del SDK (`SDK_VERSION` de shared/module-sdk). */
  sdkVersion?: string;
}

/** Opciones del architecture pack marketplace (proyecto vinculado a un módulo). */
export interface StructureOptions {
  marketplace?: { moduleSlug: string };
}

export interface ProviderStructure {
  provider: StructureProviderId;
  label: string;
  /** Primary instruction file at the project root (e.g. "CLAUDE.md"). */
  rootDoc: string;
  /** Docs/links explaining the structure (shown as a hint in the UI). */
  hint: string;
  nodes: StructureNode[];
}

const h = (s: string) => s.replace(/^\n/, "");

// ── Claude Code ─────────────────────────────────────────────────────────────
const CLAUDE: ProviderStructure = {
  provider: "claude",
  label: "Claude Code",
  rootDoc: "CLAUDE.md",
  hint: "Instrucciones, configuración, reglas, comandos, skills, agentes y hooks que Claude Code lee desde el directorio del proyecto.",
  nodes: [
    {
      rel: "CLAUDE.md",
      type: "file",
      description: "Instrucciones del proyecto (contexto, comandos, convenciones)",
      core: true,
      template: (c) =>
        h(`
# CLAUDE.md — ${c.title}

Instrucciones de proyecto para Claude Code. Este archivo se carga en cada sesión.

## Qué es este proyecto

> Describe brevemente el proyecto, su stack y su objetivo.

## Comandos

- Build: \`...\`
- Test: \`...\`
- Lint: \`...\`

## Convenciones

- Reglas de estilo, naming y arquitectura que Claude debe respetar.

## No hacer

- Acciones destructivas sin confirmación, etc.
`),
    },
    {
      rel: "CLAUDE.local.md",
      type: "file",
      description: "Instrucciones locales (no versionar; preferencias personales)",
      template: (c) =>
        h(`
# CLAUDE.local.md — ${c.title}

Notas/instrucciones locales que NO van al control de versiones.
Añade este archivo a tu .gitignore.
`),
    },
    {
      rel: ".mcp.json",
      type: "file",
      description: "Servidores MCP del proyecto",
      template: () =>
        h(`{
  "mcpServers": {}
}
`),
    },
    {
      rel: ".claude/settings.json",
      type: "file",
      description: "Configuración del proyecto (versionable)",
      core: true,
      template: () =>
        h(`{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [],
    "deny": []
  }
}
`),
    },
    {
      rel: ".claude/settings.local.json",
      type: "file",
      description: "Configuración local (no versionar)",
      template: () =>
        h(`{
  "permissions": {
    "allow": []
  }
}
`),
    },
    { rel: ".claude/rules", type: "dir", description: "Reglas reutilizables", core: true },
    {
      rel: ".claude/rules/code-style.md",
      type: "file",
      description: "Regla: estilo de código",
      template: () => h(`# Estilo de código\n\n- ...\n`),
    },
    {
      rel: ".claude/rules/testing.md",
      type: "file",
      description: "Regla: testing",
      template: () => h(`# Testing\n\n- ...\n`),
    },
    {
      rel: ".claude/rules/api-conventions.md",
      type: "file",
      description: "Regla: convenciones de API",
      template: () => h(`# Convenciones de API\n\n- ...\n`),
    },
    { rel: ".claude/commands", type: "dir", description: "Comandos slash personalizados", core: true },
    {
      rel: ".claude/commands/review.md",
      type: "file",
      description: "Comando /review",
      template: () =>
        h(`---
description: Revisa el código en busca de bugs
---

Revisa los cambios del branch actual y reporta bugs de corrección.
`),
    },
    {
      rel: ".claude/commands/fix-issue.md",
      type: "file",
      description: "Comando /fix-issue",
      template: () =>
        h(`---
description: Arregla un issue dado su número
argument-hint: <número de issue>
---

Arregla el issue #$ARGUMENTS siguiendo las convenciones del proyecto.
`),
    },
    { rel: ".claude/skills", type: "dir", description: "Skills del proyecto" },
    { rel: ".claude/skills/deploy", type: "dir", description: "Skill: deploy" },
    {
      rel: ".claude/skills/deploy/SKILL.md",
      type: "file",
      description: "Definición de la skill deploy",
      template: () =>
        h(`---
name: deploy
description: Despliega el proyecto al entorno indicado
---

# Deploy

Pasos para desplegar este proyecto. Consulta deploy-config.md para la config.
`),
    },
    {
      rel: ".claude/skills/deploy/deploy-config.md",
      type: "file",
      description: "Configuración de la skill deploy",
      template: () => h(`# Config de deploy\n\n- entorno: ...\n- destino: ...\n`),
    },
    { rel: ".claude/agents", type: "dir", description: "Subagentes especializados", core: true },
    {
      rel: ".claude/agents/code-reviewer.md",
      type: "file",
      description: "Agente: revisor de código",
      template: () =>
        h(`---
name: code-reviewer
description: Revisa código en busca de bugs y problemas de estilo
---

Eres un revisor de código experto. Analiza el diff y reporta problemas.
`),
    },
    {
      rel: ".claude/agents/security-auditor.md",
      type: "file",
      description: "Agente: auditor de seguridad",
      template: () =>
        h(`---
name: security-auditor
description: Audita el código en busca de vulnerabilidades
---

Eres un auditor de seguridad. Busca vulnerabilidades y malas prácticas.
`),
    },
    { rel: ".claude/hooks", type: "dir", description: "Hooks (scripts de ciclo de vida)" },
    {
      rel: ".claude/hooks/validate-bash.sh",
      type: "file",
      description: "Hook: valida comandos bash",
      template: () =>
        h(`#!/usr/bin/env bash
# Hook PreToolUse para validar comandos Bash.
# Recibe el payload JSON por stdin. Sal con código !=0 para bloquear.
set -euo pipefail
exit 0
`),
    },
  ],
};

// ── Codex / OpenAI ────────────────────────────────────────────────────────────
const CODEX: ProviderStructure = {
  provider: "codex",
  label: "Codex (OpenAI)",
  rootDoc: "AGENTS.md",
  hint: "Codex CLI lee AGENTS.md como guía del proyecto y .codex/ para configuración y prompts.",
  nodes: [
    {
      rel: "AGENTS.md",
      type: "file",
      description: "Guía del proyecto para Codex/agentes",
      core: true,
      template: (c) =>
        h(`
# AGENTS.md — ${c.title}

Guía para agentes de código (Codex y compatibles).

## Setup

\`\`\`bash
# instalar dependencias, etc.
\`\`\`

## Comandos

- Build / Test / Lint.

## Convenciones

- Estilo, estructura y reglas a respetar.
`),
    },
    { rel: ".codex", type: "dir", description: "Configuración de Codex", core: true },
    {
      rel: ".codex/config.toml",
      type: "file",
      description: "Configuración del proyecto Codex",
      template: () =>
        h(`# Configuración de Codex para este proyecto
# https://github.com/openai/codex

# model = "gpt-5-codex"
# approval_policy = "on-request"
`),
    },
    { rel: ".codex/prompts", type: "dir", description: "Prompts/plantillas reutilizables" },
    {
      rel: ".codex/prompts/review.md",
      type: "file",
      description: "Prompt: revisión de código",
      template: () => h(`Revisa los cambios actuales y reporta bugs y mejoras.\n`),
    },
  ],
};

// ── Gemini ───────────────────────────────────────────────────────────────────
const GEMINI: ProviderStructure = {
  provider: "gemini",
  label: "Gemini CLI",
  rootDoc: "GEMINI.md",
  hint: "Gemini CLI lee GEMINI.md como contexto del proyecto y .gemini/ para configuración y comandos.",
  nodes: [
    {
      rel: "GEMINI.md",
      type: "file",
      description: "Contexto del proyecto para Gemini",
      core: true,
      template: (c) =>
        h(`
# GEMINI.md — ${c.title}

Contexto e instrucciones del proyecto para Gemini CLI.

## Proyecto

> Stack, objetivo y módulos principales.

## Comandos

- Build / Test / Lint.

## Convenciones

- Reglas a respetar.
`),
    },
    { rel: ".gemini", type: "dir", description: "Configuración de Gemini", core: true },
    {
      rel: ".gemini/settings.json",
      type: "file",
      description: "Configuración del proyecto Gemini",
      core: true,
      template: () =>
        h(`{
  "contextFileName": "GEMINI.md"
}
`),
    },
    { rel: ".gemini/commands", type: "dir", description: "Comandos personalizados" },
    {
      rel: ".gemini/commands/review.toml",
      type: "file",
      description: "Comando: review",
      template: () =>
        h(`description = "Revisa el código en busca de bugs"
prompt = "Revisa los cambios actuales y reporta bugs de corrección."
`),
    },
  ],
};

const STRUCTURES: Record<StructureProviderId, ProviderStructure> = {
  claude: CLAUDE,
  codex: CODEX,
  gemini: GEMINI,
};

// ── Architecture pack marketplace ────────────────────────────────────────────
//
// Nodos adicionales que se materializan cuando el proyecto del asistente está
// vinculado a un módulo del marketplace (shared/marketplace-link). Se generan
// en runtime con el slug en el `rel`, sobre el MISMO mecanismo declarativo —
// scaffold idempotente y never-overwrite incluidos. Contenido = el contrato de
// MODULE-SDK-SPEC.md (§1 manifest, §2 SDK, §3 capabilities, §5.7 frontend).

/** `"1.2.3"` → rango npm `"^1.2"` para el campo `sdk` del manifest. */
function sdkRange(version?: string): string {
  const m = /^(\d+)\.(\d+)/.exec(version ?? "");
  return m ? `^${m[1]}.${m[2]}` : "^1.0";
}

/**
 * Borrador del `module.manifest.json`. JSON puro y válido (sin comentarios):
 * los campos AUTO (`version`/`os_compat`/`arch`/`path`/`commit`) NO se
 * incluyen — los fija la plataforma (pipeline LP); el README y las reglas de
 * arquitectura lo explican. `scope:"local"` = preview privada hasta publicar.
 */
function manifestDraft(slug: string, ctx: TemplateContext): string {
  const name = (ctx.moduleName || ctx.title || slug).trim().slice(0, 48) || slug;
  const manifest = {
    id: slug,
    name,
    description: "TODO: describe el módulo en una frase (máx. 160 caracteres).",
    sdk: sdkRange(ctx.sdkVersion ?? SDK_VERSION),
    category: "developer",
    icon: "tabler:package",
    color: "sky",
    scope: "local",
    min_specs: { cpu: 1, ramMb: 128, diskMb: 50 },
    capabilities: [] as string[],
    pricing: { model: "free", tokensPerMonth: 0 },
    entry: { backend: "backend/index.js" },
    chat: { version: 1, operations: [{ id: "status", tool: "status", kind: "read", permission: `${slug}.read` }] },
  };
  return JSON.stringify(manifest, null, 2) + "\n";
}

/** Esqueleto `defineModule()` del SDK real (shared/module-sdk). */
function backendSkeleton(slug: string, ctx: TemplateContext): string {
  // Sin comillas dobles: el nombre se interpola en string literals del JS generado.
  const name = (ctx.moduleName || ctx.title || slug).trim().replace(/"/g, "'") || slug;
  return h(`
/**
 * ${slug} — módulo del marketplace LUXIPANEL.
 *
 * Reglas del SDK (@luxipanel/module-sdk — ver MARKETPLACE/.claude/rules):
 *  - El export por defecto es defineModule((m) => { ... }).
 *  - Los nombres de tools/dataPanels se escriben SIN prefijo: el SDK antepone
 *    "${slug}." automáticamente (aquí "status" → "${slug}.status").
 *  - \`ctx\` es el ÚNICO puente con efectos; cada \`ctx.*\` exige su capability
 *    declarada en module.manifest.json (mínimo privilegio):
 *      ctx.server.exec        → "server.exec" (+ "server.sudo" si {sudo:true})
 *      ctx.server.readFile/…  → "server.fs.read"
 *      ctx.server.writeFile/… → "server.fs.write"
 *      ctx.storage            → "storage" (KV per-server aislado del módulo)
 *      ctx.http.fetch         → "http" (solo hosts del http_allowlist)
 *  - PROHIBIDO (lo rechaza el análisis estático): express propio,
 *    child_process/fs/net, process.env, fetch global, require dinámico.
 */
import { defineModule } from "@luxipanel/module-sdk";

export default defineModule((m) => {
  m.tool("status", {
    title: "Estado de ${name}",
    description: "Returns a basic status snapshot for ${name}.",
    kind: "read", // "read" = solo inspección · "action" = efectos en el servidor
    permission: "${slug}.read",
    input: { type: "object", properties: {}, additionalProperties: false },
    async handler(_input, ctx) {
      // Sin capabilities declaradas todavía: este handler no toca el servidor.
      // Cuando uses ctx.server/ctx.storage/ctx.http, declara la capability en
      // el manifest o el gate de runtime lanzará error.
      return { ok: true, output: { module: "${slug}", at: ctx.now } };
    },
  });
});
`);
}

/** README del módulo — explica los campos AUTO y el ciclo `/mod`. */
function moduleReadme(slug: string, ctx: TemplateContext): string {
  const name = (ctx.moduleName || ctx.title || slug).trim() || slug;
  return h(`
# ${name} (\`${slug}\`)

Módulo del marketplace de LUXIPANEL. Generado por el asistente IA — el dev
**no edita a mano**: pide cambios en el chat y la IA los aplica.

## Estructura

- \`module.manifest.json\` — identidad, capabilities, pricing y entrypoints.
  **Campos AUTO** (\`version\`, \`os_compat\`, \`arch\`, \`path\`, \`commit\`): los fija
  la PLATAFORMA en el pipeline de revisión; no se escriben aquí (un valor
  manual se ignora/sobreescribe).
- \`backend/index.js\` — \`defineModule()\` del SDK. Tools con prefijo
  \`${slug}.\` autogenerado.
- \`frontend/\` — páginas Astro opcionales (patrón canónico de scripts
  extraídos; se sirven bajo \`/panel/community/${slug}/\`).

## Ciclo (slash command \`/mod\` en el chat del asistente)

- \`/mod estado\` — estado de revisión y eventos.
- \`/mod probar\` — corre la suite de tests del módulo.
- \`/mod preview\` — instalación preview privada (solo visible para ti).
- \`/mod enviar <prUrl>\` / \`/mod reenviar <prUrl>\` — enviar a revisión.
- \`/mod despublicar\` / \`/mod republicar\` — ciclo post-publicación.
`);
}

/** Reglas de arquitectura para la IA (claude: .claude/rules/; codex/gemini: raíz). */
function marketplaceRules(slug: string, ctx: TemplateContext): string {
  const sdk = ctx.sdkVersion ?? SDK_VERSION ?? "1.0.0";
  return h(`
# Reglas de arquitectura — módulo del marketplace \`${slug}\`

Este proyecto produce un módulo de comunidad de LUXIPANEL. Contratos canónicos:
\`MODULE-SDK-SPEC.md\` (repo LUXIPANEL) y \`module.manifest.schema.json\`. El dev
NO edita a mano: todo cambio se hace a través del asistente IA.

## Manifest (\`modules/${slug}/module.manifest.json\`)

- JSON puro, \`additionalProperties: false\` — cero campos extra.
- \`chat.version: 1\` y \`chat.operations\` son obligatorios: cada operación declara
  \`id/tool/kind/permission\` y coincide con una tool del SDK con permiso explícito.
  Toda acción de \`surface.actions\` tiene una tool; se rechazan altas o actualizaciones incompletas.
- **Campos AUTO — NUNCA los escribas ni los inventes**: \`version\` (semver
  derivado del diff por el pipeline), \`os_compat\` y \`arch\` (análisis estático
  de la plataforma), \`path\` y \`commit\` (los fija LP al integrar). Un valor
  manual se ignora/sobreescribe.
- \`id\` = \`${slug}\` (== carpeta \`modules/${slug}/\` == prefijo de tools). No se cambia.
- \`capabilities\` = conjunto CERRADO, mínimo privilegio:
  \`server.exec | server.sudo | server.fs.read | server.fs.write | storage | http\`.
  Declara SOLO lo que el código usa; el análisis estático rechaza usos no
  declarados y avisa de declaraciones sin uso.
- Reglas condicionales: \`http\` ⇒ \`http_allowlist\` no vacío (hosts sin esquema,
  wildcard \`*.dominio\` permitido) · \`server.sudo\` ⇒ también \`server.exec\` o
  \`server.fs.write\` · \`pricing.model:"free"\` ⇒ \`tokensPerMonth: 0\` ·
  \`surface.sidebar|views\` ⇒ \`entry.frontend\` presente.
- \`icon\`: solo \`tabler:*\` o \`vscode-icons:*\` (offline, sin CDN).
- \`scope\`: \`local\` (preview privada) hasta que se publique como \`global\`.

## SDK (\`@luxipanel/module-sdk\` ${sdk})

- \`backend/index.js\` exporta por defecto \`defineModule((m) => { ... })\`;
  \`m.tool("sufijo", def)\` y \`m.dataPanel("sufijo", def)\` — el SDK antepone
  \`${slug}.\` a cada nombre (no lo repitas tú).
- \`ctx\` es el ÚNICO puente con efectos y cada \`ctx.*\` exige su capability:
  \`ctx.server.exec/readFile/readdir/stat/writeFile/mkdir/rename/unlink\`,
  \`ctx.storage\` (KV per-server aislado), \`ctx.http.fetch\` (solo allowlist),
  \`ctx.log\`, \`ctx.runId/now/user/target\`.
- Lo que el SDK **NO** expone (prohibido; el análisis estático lo bloquea):
  Express/routers propios (el frontend invoca por el dispatch genérico
  \`POST /api/community/${slug}/tool/<name>\`), \`child_process\`/\`fs\`/\`net\`,
  \`process.env\`, \`eval\`/\`new Function\`, \`require\`/\`import\` dinámico,
  \`fetch\`/\`XMLHttpRequest\` globales, transporte SSH propio o passphrases.

## Frontend (opcional, \`modules/${slug}/frontend/\`)

- Páginas Astro servidas bajo \`/panel/community/${slug}/\` con el patrón
  canónico de scripts extraídos: init en \`astro:page-load\` +
  \`astro:after-swap\` + \`AbortController\` (+ handshake
  \`lxp:data-table:request-ready\` si usa DataTable).
- Cliente inyectado: \`lxp.module("${slug}").call(name, input)\` /
  \`.panel(name)\`; \`lxp.assistant.seed(prompt)\` para sembrar el asistente.
  Sin \`fetch\` libre (CSP estricta).

## Flujo de trabajo

- El dev describe/testea/corrige por el chat; los cambios de estado van por
  \`/mod\` (estado/probar/preview/enviar/reenviar/despublicar/republicar).
- Ante decisiones del dev (nombre, capabilities, surface, pricing, prUrl):
  PREGUNTA con el ask protocol — no adivines ni rellenes por tu cuenta.
`);
}

/** Nodos del architecture pack para un slug (mismo shape que los estáticos). */
function marketplaceNodes(provider: StructureProviderId, slug: string): StructureNode[] {
  const rulesNode: StructureNode =
    provider === "claude"
      ? {
          rel: ".claude/rules/marketplace.md",
          type: "file",
          description: "Regla: arquitectura del marketplace (manifest, SDK, capabilities)",
          core: true,
          template: (c) => marketplaceRules(slug, c),
        }
      : {
          rel: "MARKETPLACE.md",
          type: "file",
          description: "Reglas de arquitectura del marketplace (manifest, SDK, capabilities)",
          core: true,
          template: (c) => marketplaceRules(slug, c),
        };
  return [
    {
      rel: `modules/${slug}`,
      type: "dir",
      description: "Raíz del módulo del marketplace",
      core: true,
    },
    {
      rel: `modules/${slug}/module.manifest.json`,
      type: "file",
      description: "Manifest borrador (los campos AUTO los fija la plataforma)",
      core: true,
      template: (c) => manifestDraft(slug, c),
    },
    {
      rel: `modules/${slug}/backend/index.js`,
      type: "file",
      description: "Backend del módulo — esqueleto defineModule() del SDK",
      core: true,
      template: (c) => backendSkeleton(slug, c),
    },
    {
      rel: `modules/${slug}/frontend`,
      type: "dir",
      description: "Frontend del módulo (Astro, opcional)",
    },
    {
      rel: `modules/${slug}/README.md`,
      type: "file",
      description: "README del módulo",
      core: true,
      template: (c) => moduleReadme(slug, c),
    },
    rulesNode,
  ];
}

export function getProviderStructure(
  provider: StructureProviderId,
  opts?: StructureOptions,
): ProviderStructure {
  const base = STRUCTURES[provider] ?? CLAUDE;
  const slug = opts?.marketplace?.moduleSlug;
  // Slug inválido → estructura base (el rel iría a un path no controlado).
  if (!slug || !MODULE_ID_RE.test(slug)) return base;
  return { ...base, nodes: [...base.nodes, ...marketplaceNodes(base.provider, slug)] };
}

export function findStructureNode(
  provider: StructureProviderId,
  rel: string,
  opts?: StructureOptions,
): StructureNode | undefined {
  return getProviderStructure(provider, opts).nodes.find((n) => n.rel === rel);
}
