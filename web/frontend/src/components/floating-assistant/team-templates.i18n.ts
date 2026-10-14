// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Team templates i18n — the "Grupos rápidos de agentes" wizard.
 *
 * Single source of truth for the namespace: `teamTemplatesMessagesFallback`
 * is the Spanish default. The deep-merge in `./i18n.tsx` falls back to it
 * for any locale that doesn't override (locale files have the same shape
 * with translated strings, using `{name}` placeholders for variables).
 *
 * The type uses simple `string`s with `{count}`-style placeholders (parsed
 * by `formatMessage`) instead of closures, so it round-trips cleanly through
 * the JSON i18n pipeline at /i18n/<version>/<locale>/assistant.json.
 */
import type { TeamTemplateCategory } from "./assistant-api";

export type TeamTemplateCategoryId = TeamTemplateCategory;

export interface TeamTemplatesMessages {
  openBtn: string;
  openBtnTitle: string;
  modalTitle: string;
  modalSubtitle: string;
  backBtn: string;
  nextBtn: string;
  cancelBtn: string;
  createBtn: string;
  creating: string;
  /** Escape-to-close confirmation shown when the wizard has progress to lose. */
  discardConfirm: string;
  steps: {
    category: string;
    tags: string;
    preview: string;
    customize: string;
    confirm: string;
  };
  /** Wizard step 1 — category picker. */
  categoryHeading: string;
  categoryHint: string;
  /** Wizard step 2 — tag filter. */
  tagsHeading: string;
  tagsHint: string;
  searchTagsPlaceholder: string;
  noTagsForCategory: string;
  noTemplatesForTags: string;
  /** "{count} template(s) available". */
  templatesAvailable: string;
  /** Wizard step 3 — template preview. */
  previewHeading: string;
  previewDescription: string;
  /** "{count} agents" */
  slotsLabel: string;
  /** "{count} peer link(s)" */
  connectionsLabel: string;
  multiAgentHint: string;
  applyDirectBtn: string;
  customizeBtn: string;
  /** Wizard step 4 — customisation per slot. */
  customizeHeading: string;
  customizeHint: string;
  overrideName: string;
  overrideDescription: string;
  overrideDescriptionPlaceholder: string;
  overrideSystemPrompt: string;
  overrideSystemPromptPlaceholder: string;
  overrideSystemPromptHint: string;
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
  browsePathBtn: string;
  realtimeLabel: string;
  multiAgentModeLabel: string;
  multiAgentCopiesLabel: string;
  resetToDefaultsBtn: string;
  /** Wizard step 5 — confirm. */
  confirmHeading: string;
  confirmHint: string;
  /** "Will create {count} agent(s)" */
  willCreate: string;
  rootCanSpawnHint: string;
  namePrefixLabel: string;
  namePrefixPlaceholder: string;
  namePrefixHint: string;
  noNamePrefix: string;
  /** "CEO" badge label shown on the root slot of a team template (the slot
   *  without a parent — the top of the hierarchy). */
  ceo: string;
  /** Placeholder of the multi-agent copies number input ("3"). */
  copiesPlaceholder: string;
  /** Placeholder of the project path text input ("/var/www/..."). */
  pathPlaceholder: string;
  /** title (tooltip) for the "browse" folder picker button. */
  browseTitle: string;
  /** Visible text of the "Browse" button (also used as fallback label). */
  browseButton: string;
  /** Errors. */
  errors: {
    loadFailed: string;
    applyFailed: string;
    /** "{count} agents were created before the operation failed." */
    partialFailure: string;
    cycleDetected: string;
    networkError: string;
  };
  /** Empty state for category picker. */
  pickCategory: string;
  /** Aggregated feedback chip: "{pct}% valoraciones positivas ({count} tareas)". */
  feedbackChip: string;
}

// Spanish fallback (authoritative; used by `mergeAssistantMessages` as the base).
export const teamTemplatesMessagesFallback: TeamTemplatesMessages = {
  openBtn: "Equipo rápido",
  openBtnTitle: "Crear una jerarquía completa de agentes con un clic",
  modalTitle: "Grupo rápido de agentes",
  modalSubtitle: "Elige el tipo de proyecto y obtén un equipo pre-armado (CEO + especialistas). Después editas los detalles.",
  backBtn: "Atrás",
  nextBtn: "Siguiente",
  cancelBtn: "Cancelar",
  createBtn: "Crear equipo",
  creating: "Creando…",
  discardConfirm: "¿Descartar este asistente? Se perderá el progreso.",
  steps: {
    category: "Categoría",
    tags: "Tipo",
    preview: "Plantilla",
    customize: "Personalizar",
    confirm: "Confirmar",
  },
  categoryHeading: "1. ¿Qué tipo de proyecto es?",
  categoryHint: "Elige la categoría principal. Luego podrás acotar el tipo de proyecto.",
  tagsHeading: "2. Tipo de proyecto",
  tagsHint: "Toca uno o varios tipos. Te mostraremos las plantillas de equipo que coincidan.",
  searchTagsPlaceholder: "Filtrar tipos…",
  noTagsForCategory: "Aún no hay tipos definidos para esta categoría.",
  noTemplatesForTags: "Ninguna plantilla coincide con esos tipos. Reduce los filtros.",
  templatesAvailable: "Plantillas disponibles",
  previewHeading: "3. Elige una plantilla",
  previewDescription: "Cada plantilla es una jerarquía completa de agentes (CEO + especialistas). Puedes personalizar cada slot antes de crear.",
  slotsLabel: "agentes",
  connectionsLabel: "enlaces entre pares",
  multiAgentHint: "Modo multi-agente recomendado",
  applyDirectBtn: "Aplicar directamente",
  customizeBtn: "Personalizar…",
  customizeHeading: "4. Personaliza el equipo",
  customizeHint: "Sobrescribe nombres, proveedores, rutas de trabajo, etc. Deja un campo como está para mantener el valor por defecto de la plantilla.",
  overrideName: "Nombre",
  overrideDescription: "Descripción",
  overrideDescriptionPlaceholder: "Resumen corto del rol de este agente (≤500 caracteres)",
  overrideSystemPrompt: "Prompt del sistema",
  overrideSystemPromptPlaceholder: "Instrucciones detalladas que verá este agente en cada conversación (≤20 000 caracteres)",
  overrideSystemPromptHint: "Por defecto cada slot ya trae un prompt; sobreescríbelo solo si quieres un comportamiento distinto.",
  overrideProvider: "Proveedor",
  overrideModel: "Modelo",
  overrideModelPlaceholder: "Modelo por defecto del proveedor",
  overrideModelNoProvider: "Elige un proveedor primero",
  overrideAvatar: "Avatar",
  overrideAvatarClear: "Restablecer avatar de la plantilla",
  overrideAvatarRandom: "Avatar aleatorio",
  overrideProjectPaths: "Rutas de trabajo",
  addPathBtn: "Añadir ruta",
  removePathBtn: "Quitar",
  browsePathBtn: "Explorar",
  realtimeLabel: "Activar sesión en tiempo real",
  multiAgentModeLabel: "Modo multi-agente",
  multiAgentCopiesLabel: "Número de copias",
  resetToDefaultsBtn: "Restablecer valores por defecto",
  confirmHeading: "5. Confirmar",
  confirmHint: "Revisa el resumen y crea el equipo. Después podrás editar cada agente desde Settings > Agentes.",
  willCreate: "Se crearán agentes",
  rootCanSpawnHint: "El CEO podrá abrir chats para sus subordinados.",
  namePrefixLabel: "Prefijo de nombre (opcional)",
  namePrefixPlaceholder: "p. ej. Acme",
  namePrefixHint: "Se antepone a cada nombre de agente para distinguir varias instancias.",
  noNamePrefix: "Ninguno",
  ceo: "CEO",
  copiesPlaceholder: "3",
  pathPlaceholder: "/var/www/...",
  browseTitle: "Examinar",
  browseButton: "Examinar",
  errors: {
    loadFailed: "No se pudieron cargar las plantillas de equipo. Inténtalo de nuevo.",
    applyFailed: "No se pudo crear el equipo. Puede que algunos agentes ya se hayan creado — revisa Settings > Agentes.",
    partialFailure: "Se crearon algunos agentes antes de fallar. Puedes borrarlos desde Settings > Agentes.",
    cycleDetected: "Error de integridad: se detectó un ciclo en la jerarquía.",
    networkError: "Error de red. Comprueba la conexión e inténtalo de nuevo.",
  },
  pickCategory: "Elige una categoría para ver sus plantillas.",
  feedbackChip: "{pct}% valoraciones positivas ({count} tareas)",
};

// Convenience fallback: Spanish strings indexed by category/tag so the wizard
// can render fallback labels even before the network resolves the categories
// endpoint. The backend is the source of truth; this is just so the FIRST
// paint isn't empty while the API loads.
export const teamTemplateCategoryLabelsFallback: Record<TeamTemplateCategoryId, string> = {
  web: "Web",
  app: "Apps móviles",
  desktop: "Desktop",
  backend: "Backend/APIs",
  automatizaciones: "Automatizaciones",
  "bots-ia": "Bots/IA",
  devops: "DevOps/Servidor",
  librerias: "Librerías/SDKs",
  iot: "IoT/Embebidos",
  videojuegos: "Videojuegos",
};
