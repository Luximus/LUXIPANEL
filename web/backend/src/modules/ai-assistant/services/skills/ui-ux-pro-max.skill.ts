// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * UI/UX Pro Max — professional interface quality standards.
 *
 * Faithfully distilled (Spanish) from the ui-ux-pro-max skill:
 *   ui-ux-pro-max · MIT · github.com/nextlevelbuilder/ui-ux-pro-max-skill
 */

import type { AssistantSkill, SkillPromptContext } from "./skill.types.js";

const UI_UX_BREVE = `## Calidad UI/UX (nivel breve)
Al construir interfaz aplica estándares profesionales: contraste de texto ≥4.5:1 en claro Y oscuro; foco siempre visible; objetivos táctiles ≥44×44px; iconos SVG (nunca emoji como UI); tokens semánticos (sin hex hardcodeado); animación 150–300ms con propósito; define los estados hover/focus/active/disabled/loading/error/empty. Pide detalle por dominio (con obsidian.search_notes o preguntando) si lo necesitas.
Estas reglas de accesibilidad/contraste/táctil/foco son un PISO de correctitud, no adorno; por encima de ese piso, aplica el minimalismo si está activo (no añadas estados/temas/pulido sin un requisito real).`;

const UI_UX_COMPLETO = `## Calidad UI/UX (directrices)
- Accesibilidad: contraste de texto ≥4.5:1 en claro Y oscuro; foco siempre visible (nunca \`outline:none\` sin reemplazo); \`<label>\` real, no solo placeholder; navegable por teclado; etiqueta a11y en iconos/botones sin texto; respeta reduced-motion y dynamic type.
- Táctil: objetivos ≥44×44px, ≥8px de separación; feedback al tocar en <150ms.
- Iconos: SVG/vectoriales, jamás emoji como UI; familia/grosor/tamaño consistentes.
- Layout: mobile-first; escala de z-index (10/20/30/50), nunca \`z-[9999]\`; sin scroll horizontal; viewport meta; respeta safe-areas; ritmo de espaciado 4/8.
- Tipografía/Color: tokens semánticos, nada de hex hardcodeado; line-height 1.5–1.75.
- Animación: 150–300ms, solo transform/opacity, 1–2 elementos por vista, con propósito.
- Estados: define hover/focus/active/disabled/loading/error/empty.
- Forms: label visible, validación inline, errores claros.
Antes de entregar, verifica lo anterior en ambos temas.
Estas reglas de accesibilidad/contraste/táctil/foco son un PISO de correctitud, no adorno; por encima de ese piso, aplica el minimalismo si está activo (no añadas estados/temas/pulido sin un requisito real).`;

export const uiUxProMaxSkill: AssistantSkill = {
  id: "ui-ux-pro-max",
  name: "UI/UX Pro Max (calidad de interfaz)",
  description:
    "Estándares profesionales de UI/UX (accesibilidad, táctil, tipografía, estados) inyectados al prompt; nivel breve o completo.",
  source: "ui-ux-pro-max · MIT · github.com/nextlevelbuilder/ui-ux-pro-max-skill",
  category: "ui-ux",
  kind: "prompt-block",
  defaultEnabled: false,
  options: [
    {
      key: "detalle",
      label: "Detalle",
      default: "breve",
      choices: [
        { value: "breve", label: "Breve (mínimos tokens)" },
        { value: "completo", label: "Completo (más detalle)" },
      ],
    },
  ],
  systemPromptBlock(state, _ctx: SkillPromptContext): string {
    const detalle = state.options?.["detalle"] ?? "breve";
    return detalle === "breve" ? UI_UX_BREVE : UI_UX_COMPLETO;
  },
};
