// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Factory for catalog skills — the large, opt-in set of tech/best-practice
 * prompt-block skills grouped by category (see ../categories.ts).
 *
 * Every catalog skill is a `prompt-block`, `defaultEnabled: false` (no surprise
 * token cost), and injects a short Spanish guidance block prefixed with a
 * `### <name>` header so the model can tell concurrent skills apart. Keep blocks
 * terse: they ride the prompt-cached prefix, but only enabled ones are sent.
 */

import type { AssistantSkill } from "../skill.types.js";

export interface CatalogSkillSpec {
  id: string;
  name: string;
  category: string;
  /** "<nombre> · <licencia/tipo> · <dominio>" — the doc/source pointer. */
  source: string;
  description: string;
  /** Short Spanish guidance body (the `### name` header is added automatically). */
  block: string;
}

export function catalogSkill(s: CatalogSkillSpec): AssistantSkill {
  const body = s.block.trim();
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    source: s.source,
    category: s.category,
    kind: "prompt-block",
    defaultEnabled: false,
    systemPromptBlock: () => `### ${s.name}\n${body}`,
  };
}
