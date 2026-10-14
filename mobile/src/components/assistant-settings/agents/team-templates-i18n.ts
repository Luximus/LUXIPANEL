// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Strings locales + helpers de traducción del asistente de plantillas de
 * equipo (extraídos de `TeamTemplatesModal.tsx`). Subconjunto de
 * `TeamTemplatesMessages` del web con es/en y fallback es — el subárbol grande
 * de `AgentsStrings` NO los incluye.
 */
import type {
  ApplySlotOverrides,
  TeamTemplate,
  TeamTemplateSlot,
  TeamTemplateSlotSummary,
  TeamTemplateSummary,
  TeamTemplateLocale,
} from "../types";

// ── Strings locales del asistente (subconjunto de TeamTemplatesMessages) ──────

export interface TemplatesStrings {
  modalTitle: string;
  modalSubtitle: string;
  backBtn: string;
  nextBtn: string;
  cancelBtn: string;
  createBtn: string;
  creating: string;
  stepCategory: string;
  stepTags: string;
  stepPreview: string;
  stepCustomize: string;
  stepConfirm: string;
  categoryHeading: string;
  categoryHint: string;
  tagsHeading: string;
  tagsHint: string;
  searchTagsPlaceholder: string;
  noTagsForCategory: string;
  noTemplatesForTags: string;
  templatesAvailable: string; // {count}
  previewHeading: string;
  previewDescription: string;
  slotsLabel: string; // {count}
  multiAgentHint: string;
  customizeHeading: string;
  customizeHint: string;
  overrideName: string;
  overrideDescription: string;
  overrideSystemPrompt: string;
  overrideProvider: string;
  overrideModel: string;
  overrideModelPlaceholder: string;
  overrideModelNoProvider: string;
  overrideAvatar: string;
  overrideAvatarClear: string;
  overrideAvatarRandom: string;
  overrideProjectPaths: string;
  addPathBtn: string;
  removePathBtn: string;
  pathPlaceholder: string;
  multiAgentCopiesLabel: string;
  resetToDefaultsBtn: string;
  confirmHeading: string;
  confirmHint: string;
  willCreate: string; // {count}
  rootCanSpawnHint: string;
  namePrefixLabel: string;
  namePrefixPlaceholder: string;
  namePrefixHint: string;
  loadFailed: string;
  applyFailed: string;
  feedbackChip: string; // {pct} {count}
  ceoBadge: string;
  providerNone: string;
}

const TPL_ES: TemplatesStrings = {
  modalTitle: "Grupo rápido de agentes",
  modalSubtitle: "Elige el tipo de proyecto y obtén un equipo pre-armado (CEO + especialistas). Después editas los detalles.",
  backBtn: "Atrás",
  nextBtn: "Siguiente",
  cancelBtn: "Cancelar",
  createBtn: "Crear equipo",
  creating: "Creando…",
  stepCategory: "Categoría",
  stepTags: "Tipo",
  stepPreview: "Plantilla",
  stepCustomize: "Personalizar",
  stepConfirm: "Confirmar",
  categoryHeading: "1. ¿Qué tipo de proyecto es?",
  categoryHint: "Elige la categoría principal. Luego podrás acotar el tipo de proyecto.",
  tagsHeading: "2. Tipo de proyecto",
  tagsHint: "Toca uno o varios tipos. Te mostraremos las plantillas de equipo que coincidan.",
  searchTagsPlaceholder: "Filtrar tipos…",
  noTagsForCategory: "Aún no hay tipos definidos para esta categoría.",
  noTemplatesForTags: "Ninguna plantilla coincide con esos tipos. Reduce los filtros.",
  templatesAvailable: "{count} plantillas disponibles",
  previewHeading: "3. Elige una plantilla",
  previewDescription: "Cada plantilla es una jerarquía completa de agentes (CEO + especialistas). Puedes personalizar cada slot antes de crear.",
  slotsLabel: "{count} agentes",
  multiAgentHint: "Multi-agente recomendado",
  customizeHeading: "4. Personaliza el equipo",
  customizeHint: "Sobrescribe nombres, proveedores, rutas de trabajo, etc. Deja un campo como está para mantener el valor por defecto de la plantilla.",
  overrideName: "Nombre",
  overrideDescription: "Descripción",
  overrideSystemPrompt: "Prompt del sistema",
  overrideProvider: "Proveedor",
  overrideModel: "Modelo",
  overrideModelPlaceholder: "Modelo por defecto del proveedor",
  overrideModelNoProvider: "Elige un proveedor primero",
  overrideAvatar: "Avatar",
  overrideAvatarClear: "Restablecer",
  overrideAvatarRandom: "Aleatorio",
  overrideProjectPaths: "Rutas de trabajo",
  addPathBtn: "Añadir",
  removePathBtn: "Quitar",
  pathPlaceholder: "/var/www/…",
  multiAgentCopiesLabel: "Copias (2–8)",
  resetToDefaultsBtn: "Restablecer valores por defecto",
  confirmHeading: "5. Confirmar",
  confirmHint: "Revisa el resumen y crea el equipo. Después podrás editar cada agente.",
  willCreate: "Se crearán {count} agentes",
  rootCanSpawnHint: "El CEO podrá abrir chats para sus subordinados.",
  namePrefixLabel: "Prefijo de nombre (opcional)",
  namePrefixPlaceholder: "p. ej. Acme",
  namePrefixHint: "Se antepone a cada nombre para distinguir varias instancias.",
  loadFailed: "No se pudieron cargar las plantillas de equipo. Inténtalo de nuevo.",
  applyFailed: "No se pudo crear el equipo. Puede que algunos agentes ya se hayan creado — revisa la lista de agentes.",
  feedbackChip: "{pct}% valoraciones positivas ({count} tareas)",
  ceoBadge: "CEO",
  providerNone: "—",
};

const TPL_EN: TemplatesStrings = {
  modalTitle: "Quick agent group",
  modalSubtitle: "Pick the project type and get a pre-built team (CEO + specialists). You can edit the details afterwards.",
  backBtn: "Back",
  nextBtn: "Next",
  cancelBtn: "Cancel",
  createBtn: "Create team",
  creating: "Creating…",
  stepCategory: "Category",
  stepTags: "Type",
  stepPreview: "Template",
  stepCustomize: "Customize",
  stepConfirm: "Confirm",
  categoryHeading: "1. What kind of project is it?",
  categoryHint: "Choose the main category. Then you can narrow the project type.",
  tagsHeading: "2. Project type",
  tagsHint: "Tap one or more types. We'll show the team templates that match.",
  searchTagsPlaceholder: "Filter types…",
  noTagsForCategory: "No types defined for this category yet.",
  noTemplatesForTags: "No template matches those types. Reduce the filters.",
  templatesAvailable: "{count} templates available",
  previewHeading: "3. Choose a template",
  previewDescription: "Each template is a full agent hierarchy (CEO + specialists). You can customize each slot before creating.",
  slotsLabel: "{count} agents",
  multiAgentHint: "Multi-agent recommended",
  customizeHeading: "4. Customize the team",
  customizeHint: "Override names, providers, work paths, etc. Leave a field as-is to keep the template default.",
  overrideName: "Name",
  overrideDescription: "Description",
  overrideSystemPrompt: "System prompt",
  overrideProvider: "Provider",
  overrideModel: "Model",
  overrideModelPlaceholder: "Provider default model",
  overrideModelNoProvider: "Pick a provider first",
  overrideAvatar: "Avatar",
  overrideAvatarClear: "Reset",
  overrideAvatarRandom: "Random",
  overrideProjectPaths: "Work paths",
  addPathBtn: "Add",
  removePathBtn: "Remove",
  pathPlaceholder: "/var/www/…",
  multiAgentCopiesLabel: "Copies (2–8)",
  resetToDefaultsBtn: "Reset to defaults",
  confirmHeading: "5. Confirm",
  confirmHint: "Review the summary and create the team. You can edit each agent afterwards.",
  willCreate: "Will create {count} agents",
  rootCanSpawnHint: "The CEO will be able to open chats for its subordinates.",
  namePrefixLabel: "Name prefix (optional)",
  namePrefixPlaceholder: "e.g. Acme",
  namePrefixHint: "Prepended to each agent name to tell several instances apart.",
  loadFailed: "Could not load team templates. Try again.",
  applyFailed: "Could not create the team. Some agents may already have been created — check the agent list.",
  feedbackChip: "{pct}% positive ratings ({count} tasks)",
  ceoBadge: "CEO",
  providerNone: "—",
};

const TPL_STR: Record<string, TemplatesStrings> = { es: TPL_ES, en: TPL_EN };

export function tplStrings(lang?: string): TemplatesStrings {
  const code = (lang ?? "es").toLowerCase().split(/[-_]/)[0] ?? "es";
  return TPL_STR[code] ?? TPL_ES;
}

// ── Helpers de traducción de plantilla (espeja el web) ───────────────────────

export function pickTemplateLabel(
  tmpl: TeamTemplateSummary | TeamTemplate,
  locale: string | undefined,
  field: "name" | "description",
): string {
  const tx = (tmpl as TeamTemplateSummary).translations?.[(locale ?? "") as TeamTemplateLocale];
  const localized = tx?.[field];
  return localized && localized.length > 0 ? localized : tmpl[field];
}

export function pickSlotLabel(
  slot: TeamTemplateSlotSummary | TeamTemplateSlot,
  tmpl: TeamTemplateSummary | TeamTemplate | null,
  locale: string | undefined,
  field: "name" | "description" | "systemPrompt",
): string {
  const seed = (slot as unknown as Record<string, string | undefined>)[field] ?? "";
  if (!tmpl) return seed;
  const tx = (tmpl as TeamTemplateSummary).translations?.[(locale ?? "") as TeamTemplateLocale];
  const slotTx = tx?.slots?.[slot.slotId];
  const localized = slotTx?.[field];
  if (localized && localized.length > 0) return localized;
  return seed;
}

export type SlotOverrides = Record<string, ApplySlotOverrides>;
