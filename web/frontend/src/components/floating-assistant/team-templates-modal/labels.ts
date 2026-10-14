// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** TeamTemplatesModal translation-picking + category label helpers — extracted verbatim. */
import {
  type TeamTemplate,
  type TeamTemplateCategory,
  type TeamTemplateCategoryDef,
  type TeamTemplateSlot,
  type TeamTemplateSlotSummary,
  type TeamTemplateSummary,
} from "../assistant-api";
import { teamTemplateCategoryLabelsFallback } from "../team-templates.i18n";

/**
 * Pick the best-available translation for a template-level string.
 * Returns the locale-specific value if present, otherwise the Spanish seed.
 */
export function pickTemplateLabel(
  tmpl: TeamTemplateSummary | TeamTemplate,
  locale: string | undefined,
  field: "name" | "description",
): string {
  const tx = (tmpl as TeamTemplateSummary).translations?.[locale as never];
  const localized = (tx as Record<string, string> | undefined)?.[field];
  return localized && localized.length > 0 ? localized : tmpl[field];
}

/**
 * Pick the best-available translation for a single slot. The full TeamTemplate
 * (returned by `get(id)`) carries both the seed Spanish AND the locale entry;
 * when the per-slot or per-field entry is missing we degrade to the seed.
 */
export function pickSlotLabel(
  slot: TeamTemplateSlotSummary | TeamTemplateSlot,
  tmpl: TeamTemplateSummary | TeamTemplate | null,
  locale: string | undefined,
  field: "name" | "description" | "systemPrompt",
): string {
  if (!tmpl) return (slot as unknown as Record<string, string>)[field] ?? "";
  const tx = (tmpl as TeamTemplateSummary).translations?.[locale as never];
  const slotTx = (tx as { slots?: Record<string, Record<string, string>> } | undefined)?.slots?.[
    (slot as TeamTemplateSlotSummary).slotId
  ];
  const localized = slotTx?.[field];
  if (localized && localized.length > 0) return localized;
  // Fallback: Spanish seed (slot itself), then en translation if exists.
  if (field === "systemPrompt" && !(slot as TeamTemplateSlot).systemPrompt) return "";
  return (slot as unknown as Record<string, string>)[field] ?? "";
}


export function categoryLabel(
  categories: TeamTemplateCategoryDef[],
  id: TeamTemplateCategory | null,
): string {
  if (!id) return "";
  return categories.find((c) => c.id === id)?.label ?? teamTemplateCategoryLabelsFallback[id];
}
