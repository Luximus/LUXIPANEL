// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Ask-protocol skill: lets the assistant stop and ask the user a key decision
 * (via the lxp_ask tool + question protocol) instead of guessing.
 */

import type { AssistantSkill } from "./skill.types.js";

export const askProtocolSkill: AssistantSkill = {
  id: "ask-protocol",
  name: "Preguntar antes de decidir",
  description:
    "Permite al asistente detenerse y preguntarte una decisión clave en vez de asumir (herramienta lxp_ask + protocolo de preguntas).",
  category: "methods",
  kind: "behavior",
  defaultEnabled: true,
};
