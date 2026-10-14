// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
export type {
  AssistantSkill,
  AssistantSkillKind,
  AssistantSkillOption,
  AssistantSkillOptionChoice,
  SkillPromptContext,
} from "./skill.types.js";
export {
  assistantSkills,
  getSkill,
  defaultAssistantSkillsMap,
} from "./registry.js";
export {
  ponytailSkill,
  PONYTAIL_MODES,
  ponytailModeConfirmation,
  buildPonytailReviewInstruction,
  buildPonytailAuditInstruction,
  buildPonytailDebtInstruction,
} from "./ponytail.skill.js";
export { uiUxProMaxSkill } from "./ui-ux-pro-max.skill.js";
export { askProtocolSkill } from "./ask-protocol.skill.js";
export { projectVaultSkill } from "./project-vault.skill.js";
