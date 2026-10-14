// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Registry of all assistant skills/methods + helpers to resolve defaults.
 */

import type { AssistantSkill } from "./skill.types.js";
import type { AssistantSkillsMap } from "../../models/assistant-skills.types.js";
import { ponytailSkill } from "./ponytail.skill.js";
import { uiUxProMaxSkill } from "./ui-ux-pro-max.skill.js";
import { askProtocolSkill } from "./ask-protocol.skill.js";
import { projectVaultSkill } from "./project-vault.skill.js";
// Catalog (large opt-in set, one file per category — see ./catalog/*).
import { webQualitySkills } from "./catalog/web-quality.skills.js";
import { uiUxSkills } from "./catalog/ui-ux.skills.js";
import { webFullstackSkills } from "./catalog/web-fullstack.skills.js";
import { mobileSkills } from "./catalog/mobile.skills.js";
import { codeAgentsSkills } from "./catalog/code-agents.skills.js";
import { reusableSkills } from "./catalog/reusable-skills.skills.js";
import { securitySkills } from "./catalog/security.skills.js";
import { tokenSavingsSkills } from "./catalog/token-savings.skills.js";
import { aiProdSkills } from "./catalog/ai-prod.skills.js";
import { devopsSkills } from "./catalog/devops.skills.js";
import { testingSkills } from "./catalog/testing.skills.js";
import { dataRagSkills } from "./catalog/data-rag.skills.js";
import { automationSkills } from "./catalog/automation.skills.js";

// Ordered to match SKILL_CATEGORIES (categories.ts) so the UI groups follow
// first-appearance order: methods → code-quality → ui-ux → dev catalog.
export const assistantSkills: AssistantSkill[] = [
  // Métodos del asistente (behavior, default ON)
  askProtocolSkill,
  projectVaultSkill,
  // Calidad de código
  ponytailSkill,
  // Calidad web (Lighthouse / Core Web Vitals)
  ...webQualitySkills,
  // UI / UX / diseño (core + catalog)
  uiUxProMaxSkill,
  ...uiUxSkills,
  // Catálogo de desarrollo (todo opt-in, default OFF)
  ...webFullstackSkills,
  ...mobileSkills,
  ...codeAgentsSkills,
  ...reusableSkills,
  ...securitySkills,
  ...tokenSavingsSkills,
  ...aiProdSkills,
  ...devopsSkills,
  ...testingSkills,
  ...dataRagSkills,
  ...automationSkills,
];

export function getSkill(id: string): AssistantSkill | undefined {
  return assistantSkills.find((s) => s.id === id);
}

export function defaultAssistantSkillsMap(): AssistantSkillsMap {
  const map: AssistantSkillsMap = {};
  for (const skill of assistantSkills) {
    const options: Record<string, string> = {};
    for (const opt of skill.options ?? []) {
      options[opt.key] = opt.default;
    }
    map[skill.id] = { enabled: skill.defaultEnabled, options };
  }
  return map;
}
