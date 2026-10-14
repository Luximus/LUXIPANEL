// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantSkill } from "../skill.types.js";
import { catalogSkill } from "./factory.js";

export const reusableSkills: AssistantSkill[] = [
  catalogSkill({
    id: "claude-agent-skills",
    name: "Claude Agent Skills",
    category: "reusable-skills",
    source: "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview",
    description: "Empaqueta capacidades reutilizables como Agent Skills (SKILL.md) cargadas bajo demanda.",
    block: [
      "Cada skill = carpeta con SKILL.md y frontmatter name (lowercase-guiones, ≤64) + description (≤1024, qué hace y cuándo usarla); solo eso se precarga (~100 tokens) y guía la activación.",
      "Carga progresiva en 3 niveles: metadata siempre, cuerpo (<5k tokens) al activarse, y recursos/scripts auxiliares vía bash solo si se referencian (su código no entra al contexto).",
      "Una skill = una tarea. Funciona igual en API (skill_id), Claude Code y claude.ai. Usa solo skills de fuentes confiables; sin secretos; no dupliques lógica de tools.",
    ].join(" "),
  }),
  catalogSkill({
    id: "claude-skills-github",
    name: "Claude Skills (GitHub)",
    category: "reusable-skills",
    source: "https://github.com/anthropics/skills",
    description: "Repositorio oficial anthropics/skills: ejemplos, spec y template como base y patrón.",
    block: [
      "Parte de las skills oficiales como plantilla: cada una es carpeta/SKILL.md autocontenida; no reinventes el formato. El repo trae ./template, ./spec y ejemplos por categoría (docx, pdf, pptx, xlsx…).",
      "Arranca desde ./template o clona el ejemplo más cercano antes de escribir desde cero; conserva el frontmatter (name, description) y el estilo conciso.",
      "Son demostrativas: audita y adapta. Mantén dependencias mínimas; contribuye mejoras genéricas upstream y deja lo específico en tu repo.",
    ].join(" "),
  }),
  catalogSkill({
    id: "codex-agents-md-guide",
    name: "Codex AGENTS.md Guide",
    category: "reusable-skills",
    source: "https://developers.openai.com/codex/guides/agents-md",
    description: "Convención AGENTS.md de Codex para dar instrucciones de proyecto a agentes de código.",
    block: [
      "Codex encadena AGENTS.md de global (~/.codex/AGENTS.md, o AGENTS.override.md) a la raíz Git y baja hasta tu directorio; el más cercano gana (aparece último en el prompt).",
      "Pon setup, comandos exactos de build/test/lint a correr antes de entregar, preferencias de tooling y restricciones de seguridad. Codex los aplica a cada tarea de la sesión.",
      "Mantenlo corto y actualizado; no dupliques el README humano. Verifica pidiendo 'resume las instrucciones actuales'.",
    ].join(" "),
  }),
];
