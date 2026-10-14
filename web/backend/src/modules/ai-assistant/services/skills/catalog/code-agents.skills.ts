// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantSkill } from "../skill.types.js";
import { catalogSkill } from "./factory.js";

export const codeAgentsSkills: AssistantSkill[] = [
  catalogSkill({
    id: "codex-cli",
    name: "OpenAI Codex CLI",
    category: "code-agents",
    source: "https://github.com/openai/codex",
    description:
      "Guía al agente a usar el Codex CLI de OpenAI (agente de código en terminal).",
    block:
      "Ejecuta codex en la raíz del repo; trabaja en ramas, no en main. Ajusta el modo de aprobación con /permissions (Auto por defecto, Read-only o Full Access según riesgo) y revisa diffs antes de aceptar. Da contexto en AGENTS.md. Usa codex exec para no interactivo y codex resume para retomar sesión. Conecta tools por MCP (codex mcp). No amplíes red/sandbox sin necesidad.",
  }),
  catalogSkill({
    id: "codex-cli-features",
    name: "Codex CLI Features",
    category: "code-agents",
    source: "https://developers.openai.com/codex/cli/features",
    description:
      "Detalla al agente las capacidades del Codex CLI (sandbox, aprobaciones, MCP, config).",
    block:
      "Configura modelo, aprobaciones y sandbox en ~/.codex/config.toml ($CODEX_HOME) o por flags. Cambia modo con /permissions, modelo con /model. Usa --add-dir para abrir raíces escribibles y --cd para el directorio de trabajo. Define perfiles. Conecta servidores MCP (STDIO o HTTP) en config y gestiónalos con codex mcp. Retoma con codex resume --last. Empieza restrictivo y amplía solo si la tarea lo exige.",
  }),
  catalogSkill({
    id: "codex-cloud",
    name: "Codex Cloud",
    category: "code-agents",
    source: "https://developers.openai.com/codex/cloud",
    description:
      "Orienta al agente a delegar tareas a Codex Cloud (entornos remotos, ejecución en paralelo, PRs).",
    block:
      "Conecta el repo de GitHub y delega tareas a entornos cloud aislados; define el repo, los pasos de setup y las tools del entorno. Lanza varias en paralelo en segundo plano. Dispara desde la extensión IDE, web (chatgpt.com/codex) o mencionando @codex en issues/PRs. Codex abre un PR con su trabajo: revisa el diff y aplica el resultado localmente, no fusiones a ciegas. Habilita acceso a internet solo cuando haga falta.",
  }),
  catalogSkill({
    id: "claude-code-skills",
    name: "Claude Code Skills",
    category: "code-agents",
    source: "https://code.claude.com/docs/en/skills",
    description:
      "Guía al agente a crear y usar Skills de Claude Code (carpeta con SKILL.md, estándar Agent Skills).",
    block:
      "Crea cada skill como carpeta con SKILL.md (frontmatter description; el nombre del directorio define el /comando). La description dice qué hace y cuándo usarla: guía el auto-trigger (se trunca a 1536 chars). Mantén el cuerpo conciso y mete detalle en archivos enlazados (carga progresiva). Usa allowed-tools para acotar permisos y disable-model-invocation para skills manuales. Inyecta contexto dinámico con !`cmd`. Ubícalas en .claude/skills (proyecto) o ~/.claude/skills (global). Sin secretos.",
  }),
  catalogSkill({
    id: "copilot-cloud-agent",
    name: "GitHub Copilot Cloud Agent",
    category: "code-agents",
    source:
      "https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent",
    description:
      "Orienta al agente a delegar issues a GitHub Copilot coding agent, que trabaja en la nube y abre PRs.",
    block:
      "Asigna a Copilot issues bien definidos (selecciónalo como assignee) o mencionalo con @copilot en comentarios de PR. Trabaja en un entorno efímero sobre GitHub Actions y abre UN PR en draft por tarea (máx ~59 min, un solo repo). Da contexto en el issue y en .github/copilot-instructions.md. Revisa diff y checks de CI; pide cambios por comentarios. Bueno para bugs, tests y deuda acotada; no para cambios arquitectónicos amplios sin supervisión.",
  }),
  catalogSkill({
    id: "cursor",
    name: "Cursor",
    category: "code-agents",
    source: "https://cursor.com/",
    description:
      "Guía al agente a trabajar en el editor Cursor (Agent, contexto del repo, reglas).",
    block:
      "Usa el modo Agent para tareas multi-archivo y revisa siempre los diffs antes de aceptar. Aporta contexto con @archivos/@símbolos en vez de pegar texto. Define convenciones en .cursor/rules (reglas por proyecto) para que respete tu estilo. Indexa el codebase para mejor recuperación. Aprovecha Tab para autocompletado. Aprueba comandos de terminal con criterio y cuida secretos. Mantén tareas acotadas y verifica con tests/lint.",
  }),
  catalogSkill({
    id: "agents-md",
    name: "AGENTS.md",
    category: "code-agents",
    source: "https://agents.md/",
    description:
      "Orienta al agente a redactar y respetar AGENTS.md, el archivo de instrucciones estándar para agentes de código.",
    block:
      "Coloca un AGENTS.md en la raíz con lo que un agente necesita: comandos de build/test/lint, estilo de código, estructura del repo, tips de entorno y reglas de PR/seguridad. Markdown estándar, sin campos obligatorios; sé conciso y accionable. Usa archivos anidados por subdirectorio (gana el más cercano). Estándar abierto soportado por 60k+ proyectos y muchas tools (Codex, Cursor, Copilot, Jules…). El prompt del usuario tiene prioridad. Mantenlo vivo, sin secretos.",
  }),
  catalogSkill({
    id: "open-design-contribute",
    name: "Open Design — contribuir (no-code)",
    category: "code-agents",
    source: "https://github.com/nexu-io/open-design",
    description:
      "Flujo guiado sin código para contribuir a Open Design (nexu-io): aporta un Skill o Design System, traduce docs, corrige textos o reporta un bug, y abre el PR/issue por ti.",
    block:
      "Guía contribuciones a Open Design sin escribir código. Elige una de cuatro vías: enviar un Skill/Design System/plantilla que hiciste, traducir docs (README/QUICKSTART/CONTRIBUTING), arreglar textos o escribir blog, o reportar un bug. Valida estructura y formato según el tipo, muestra vista previa y abre el PR (o issue, con deduplicación) vía GitHub CLI (`gh`). PRs/commits/ramas en inglés; los prompts al usuario en su idioma. Tono breve: di qué cambió, sin jerga ni disculpas; cierra saludando como primera contribución.",
  }),
];
