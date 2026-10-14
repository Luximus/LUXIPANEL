// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Project-context-vault skill: injects project context notes (Contexto.md /
 * Errores.md) and lets the assistant search for more via obsidian.search_notes.
 */

import type { AssistantSkill } from "./skill.types.js";

export const projectVaultSkill: AssistantSkill = {
  id: "project-context-vault",
  name: "Contexto del proyecto (Obsidian)",
  description:
    "Inyecta notas de contexto del proyecto (Contexto.md / Errores.md) y permite buscar más con obsidian.search_notes.",
  category: "methods",
  kind: "behavior",
  defaultEnabled: true,
};
