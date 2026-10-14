// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Skill categories — ordered groups for the Access-tab UI. `defaultOpen`
 * controls whether the group starts expanded (the always-on "methods" and the
 * curated quality skills) or collapsed (the large opt-in catalog).
 */

export interface SkillCategory {
  id: string;
  label: string; // Spanish, user-facing group header
  defaultOpen: boolean;
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  { id: "methods", label: "Métodos del asistente", defaultOpen: true },
  { id: "code-quality", label: "Calidad de código", defaultOpen: true },
  { id: "web-quality", label: "Calidad web (Lighthouse / CWV)", defaultOpen: false },
  { id: "ui-ux", label: "UI / UX / diseño", defaultOpen: false },
  { id: "web-fullstack", label: "Desarrollo web / full-stack IA", defaultOpen: false },
  { id: "mobile", label: "Apps móviles", defaultOpen: false },
  { id: "code-agents", label: "Agentes de código", defaultOpen: false },
  { id: "reusable-skills", label: "Skills reutilizables para IA", defaultOpen: false },
  { id: "security", label: "Seguridad IA / web / apps", defaultOpen: false },
  { id: "token-savings", label: "Ahorro de tokens / costos IA", defaultOpen: false },
  { id: "ai-prod", label: "Agentes IA en producción", defaultOpen: false },
  { id: "devops", label: "DevOps / despliegue", defaultOpen: false },
  { id: "testing", label: "Testing / calidad de código", defaultOpen: false },
  { id: "data-rag", label: "Bases de datos / RAG / búsqueda", defaultOpen: false },
  { id: "automation", label: "Automatización / workflows", defaultOpen: false },
];

/** Fallback bucket for any skill whose category id isn't in the list above. */
export const FALLBACK_CATEGORY: SkillCategory = { id: "other", label: "Otros", defaultOpen: false };

export function categoryLabel(id: string): string {
  return SKILL_CATEGORIES.find((c) => c.id === id)?.label ?? FALLBACK_CATEGORY.label;
}
