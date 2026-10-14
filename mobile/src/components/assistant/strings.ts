// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Adaptador de compatibilidad sobre los message files del asistente.
 *
 * @deprecated Usa `getMessages(locale).assistantChat` /
 * `getMessages(locale).assistantDrawer` directamente. Vivía en
 * `ServerAssistantPane.tsx` (muerto en la fase A5); se conserva mientras los
 * consumidores (`ChatScreen`, `ServerCoverPane`, `ServerChatTab`,
 * `ProjectsModal`, `AssistantSettingsTab`) migran al sistema i18n.
 */
import { getMessages, isLocaleCode, type LocaleCode } from "../../i18n";
import type { AssistantStrings } from "./types";

export function strings(lang?: string): AssistantStrings {
  // Misma semántica que el STR antiguo: 2 primeras letras y fallback a español
  // (OJO: no usar `normalizeLocale`, cuyo fallback es inglés).
  const two = (lang ?? "es").slice(0, 2);
  const code: LocaleCode = isLocaleCode(two) ? two : two === "de" || two === "bn" ? "en" : "es";
  const m = getMessages(code);
  return { ...m.assistantChat, ...m.assistantDrawer };
}
