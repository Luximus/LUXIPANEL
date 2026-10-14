// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantSkill } from "../skill.types.js";
import { catalogSkill } from "./factory.js";

export const uiUxSkills: AssistantSkill[] = [
  catalogSkill({
    id: "figma-ai",
    name: "Figma AI",
    category: "ui-ux",
    source: "https://www.figma.com/ai/",
    description: "IA de Figma: agente de canvas, generación de imágenes y design-to-code.",
    block: [
      "Usa la IA de Figma para automatizar lo mecánico: agente de canvas (aplicar design system, edición en lote), generar/editar imágenes (Gemini, GPT Image), quitar fondo y renombrar capas.",
      "Aprovecha Figma Make (prompt→prototipo) y el Figma MCP Server para llevar contexto de diseño a tu editor de código.",
      "Da prompts concretos (propósito, tono, plataforma); la IA libera tiempo, las decisiones de diseño siguen siendo tuyas. Revisa accesibilidad y consistencia.",
    ].join(" "),
  }),
  catalogSkill({
    id: "figma-make",
    name: "Figma Make",
    category: "ui-ux",
    source: "https://www.figma.com/make/",
    description: "Figma Make: de prompt o frame a prototipo/app funcional con código real.",
    block: [
      "Usa Make para convertir un prompt o un frame en prototipo interactivo con código real; itera en lenguaje natural o editando directo (texto, imágenes, espaciado).",
      "Conecta librerías de Figma Design para respetar el design system y Supabase para auth/datos/APIs. Exporta como capas a Figma Design o publica como web app.",
      "Bueno para POCs, demos y apps data-driven; revisa el código por calidad, accesibilidad y seguridad antes de llevar a producción.",
    ].join(" "),
  }),
  catalogSkill({
    id: "figma-ai-tools",
    name: "Figma AI Tools",
    category: "ui-ux",
    source: "https://help.figma.com/hc/en-us/articles/23870272542231-Use-AI-tools-in-Figma-Design",
    description: "Herramientas IA en Figma Design: First Draft, renombrar capas, imágenes, texto.",
    block: [
      "Aprovecha las acciones IA integradas: First Draft (concepto→diseño editable), renombrar capas, reemplazar contenido por texto realista, reescribir/traducir/acortar texto y añadir interacciones.",
      "Para imágenes: generar/editar por prompt, quitar fondo, mejorar resolución, expandir, aislar/borrar objetos y vectorizar. Búsqueda visual de assets del equipo o Community.",
      "Requiere plan de pago y asiento Full. Revisa cada sugerencia: la IA acelera lo mecánico, el diseño es tuyo.",
    ].join(" "),
  }),
  catalogSkill({
    id: "framer",
    name: "Framer",
    category: "ui-ux",
    source: "https://www.framer.com/",
    description: "Framer: sitios sin código con canvas visual, agentes IA, CMS y publicación.",
    block: [
      "Usa Framer para landing/sitios marketing publicables sin código: diseña en canvas visual con agentes IA (diseño, CMS, código) que generan y refinan en sitio, con todo editable y bajo tu control.",
      "Aprovecha breakpoints responsive, CMS sincronizado al canvas, SEO integrado, A/B testing, analítica y localización; optimiza antes de publicar.",
      "Para apps con lógica compleja o backend propio, Framer no sustituye un frontend a medida; úsalo en su sweet spot.",
    ].join(" "),
  }),
  catalogSkill({
    id: "relume",
    name: "Relume",
    category: "ui-ux",
    source: "https://www.relume.io/",
    description: "Relume: de brief a sitemap, wireframes y style guide con IA + librería.",
    block: [
      "Usa Relume para pasar de brief a sitemap, wireframes (componentes sin estilo + copy en un clic) y style guide con IA en minutos; ensambla desde su librería de 1000+ componentes.",
      "Describe negocio y objetivo con precisión; edita el sitemap antes de wireframear. Exporta a Figma, Webflow (Client-First), React (Tailwind/Shadcn) o Claude Design.",
      "Trata los wireframes como estructura de baja fidelidad: la IA es aliada, no reemplazo; aplica branding y contenido real después.",
    ].join(" "),
  }),
  catalogSkill({
    id: "design-md-tokens",
    name: "DESIGN.md (sistema por tokens)",
    category: "ui-ux",
    source: "https://github.com/voltagent/awesome-design-md",
    description:
      "Genera UI fiel a una marca con un DESIGN.md estructurado: tokens de color/tipografía/espaciado, specs de componentes y reglas do/don't (voltagent, MIT).",
    block:
      "Define el sistema como tokens, no como CSS suelto. Estructura: Overview (tesis visual), Colores (marca, superficies en escalera, texto, semánticos — todo hex con nombre), Tipografía (familias display/body/mono + tabla tamaño/peso/tracking; tracking negativo, nunca engordar el display), Espaciado (base 4/8px, escala xxs→96px), Radios (4px→pill 9999px), Componentes (botones/cards/inputs/nav/footer con tokens), Do/Don't. Reserva el acento solo para CTAs y focus. Sombra rara: jerarquía por superficie. Responsive: 4 breakpoints, touch ≥40px; itera un componente a la vez.",
  }),
];
