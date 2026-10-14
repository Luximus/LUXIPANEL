// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-target persisted state for assistant "skills/methods".
 *
 * Layout on the target:
 *   ${LUXIPANEL_CONFIG_DIR}/assistant/skills.json
 *
 * A skill entry stores whether the skill is enabled on this target and the
 * resolved value of each of its options. Missing fields fall back to the
 * skill's registry defaults.
 */

export interface AssistantSkillState {
  enabled?: boolean;
  options?: Record<string, string>;
}

export type AssistantSkillsMap = Record<string, AssistantSkillState>;
