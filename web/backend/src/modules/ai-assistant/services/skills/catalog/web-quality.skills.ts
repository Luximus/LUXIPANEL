// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Web Quality skills — distilled (Spanish) from Addy Osmani's collection:
 *   web-quality-skills · MIT · github.com/addyosmani/web-quality-skills
 *
 * A cohesive set of Agent Skills around Lighthouse / Core Web Vitals quality:
 * an umbrella audit + performance, core-web-vitals, accessibility, seo and
 * best-practices (security). All opt-in, terse blocks (cached-prefix friendly).
 */

import type { AssistantSkill } from "../skill.types.js";
import { catalogSkill } from "./factory.js";

const REPO = "https://github.com/addyosmani/web-quality-skills/tree/main/skills";

export const webQualitySkills: AssistantSkill[] = [
  catalogSkill({
    id: "web-quality-audit",
    name: "Auditoría de calidad web",
    category: "web-quality",
    source: `${REPO}/web-quality-audit`,
    description:
      "Auditoría integral de calidad web (rendimiento, accesibilidad, SEO, seguridad) con clasificación por severidad.",
    block:
      "Audita 4 ejes con metodología Lighthouse y reporta por severidad (Crítico/Alto/Medio/Bajo). Rendimiento: LCP<2.5s, INP<200ms, CLS<0.1, WebP/AVIF, elimina JS sin usar, CSS crítico, preconnect/preload, lazy-load, cache largo. A11y: alt, contraste 4.5:1, teclado, foco visible, skip links, `lang`, labels. SEO: title 50-60, meta 150-160, un H1, canonical, HTTPS, JSON-LD. Seguridad: HTTPS sin mixed content, CSP, deps al día, sin source maps en prod, consola limpia.",
  }),
  catalogSkill({
    id: "web-performance",
    name: "Rendimiento web",
    category: "web-quality",
    source: `${REPO}/performance`,
    description:
      "Optimiza velocidad de carga y eficiencia en runtime (presupuesto de recursos + Lighthouse).",
    block:
      "Presupuesto: total<1.5MB, JS<300KB, CSS<100KB, imágenes above-fold<500KB, fuentes<100KB, terceros<200KB. TTFB<800ms con CDN+Brotli+HTTP/2-3. Preconnect a orígenes, preload del LCP con `fetchpriority=high`, CSS crítico inline. JS: `defer`/`async`, code-splitting (import dinámico), tree-shaking. Imágenes: `<picture>` AVIF/WebP+srcset, width/height, below-fold `loading=lazy`. Fuentes: `font-display:swap`, subset, preload. Cache inmutable hasheado `max-age=31536000`. Runtime: agrupa lecturas/escrituras, debounce, rAF, virtualiza listas. Terceros: async o carga al interactuar (facade).",
  }),
  catalogSkill({
    id: "core-web-vitals",
    name: "Core Web Vitals (LCP/INP/CLS)",
    category: "web-quality",
    source: `${REPO}/core-web-vitals`,
    description: "Mejora LCP, INP y CLS (umbrales al percentil 75).",
    block:
      "LCP≤2.5s: TTFB<800ms, CSS crítico<14KB inline, preload imagen LCP `fetchpriority=high`, render en HTML inicial (SSR/SSG), `font-display:swap`. INP≤200ms: tareas<50ms, fracciona con `scheduler.yield()`, feedback visual inmediato y luego cede, `requestIdleCallback`, memoiza, Web Workers. CLS≤0.1: `width/height` o `aspect-ratio` en imágenes/embeds, `min-height` en anuncios, fuentes `optional` o metrics match (`size-adjust`), inyecta contenido bajo el viewport, anima solo `transform`/`opacity`.",
  }),
  catalogSkill({
    id: "web-accessibility",
    name: "Accesibilidad web (WCAG 2.2)",
    category: "web-quality",
    source: `${REPO}/accessibility`,
    description: "Audita y mejora accesibilidad según WCAG 2.2 (objetivo AA).",
    block:
      "POUR, nivel AA. Imágenes con `alt` descriptivo (`alt=\"\"` si decorativa); botones-icono con `aria-label`. Contraste 4.5:1 normal / 3:1 grande; nunca solo color. Todo accesible por teclado, prefiere `<button>/<a>` nativos, sin trampas; foco visible con `:focus-visible`. Targets ≥24×24px, skip links. `lang` en `<html>`; cada input con `<label>`, errores con `role=alert`+`aria-invalid`. WCAG2.2: permite pegar/autofill/passkeys en login. Prefiere HTML nativo sobre ARIA; `aria-live` para updates. Prueba con teclado, lector y axe.",
  }),
  catalogSkill({
    id: "web-seo",
    name: "SEO (técnico + on-page)",
    category: "web-quality",
    source: `${REPO}/seo`,
    description:
      "Optimiza visibilidad en buscadores: SEO técnico, on-page y datos estructurados.",
    block:
      "Técnico: robots.txt (bloquea privado, permite recursos), canonicals auto-referenciadas, sitemap XML (≤50k URLs, solo canónicas, lastmod, envía a GSC), URLs con guiones, minúsculas, <75ch, HTTPS+HSTS. On-page: title 50-60ch keyword al inicio, meta desc 150-160ch+CTA, un solo H1 sin saltar niveles, alt e internal links descriptivos. JSON-LD: Organization/Article/Product/FAQ/Breadcrumbs. Móvil: viewport, tap 48px, fuente ≥16px; hreflang multi-idioma. IA: no bloquees crawlers IA, schema FAQ/Article, respuesta auto-contenida en las primeras frases.",
  }),
  catalogSkill({
    id: "web-best-practices",
    name: "Buenas prácticas web (seguridad)",
    category: "web-quality",
    source: `${REPO}/best-practices`,
    description: "Patrones modernos de seguridad, compatibilidad y calidad de código.",
    block:
      "Seguridad: HTTPS+HSTS preload; CSP por header con nonces y `frame-ancestors/base-uri/form-action 'self'`; Trusted Types+DOMPurify; SRI en terceros; headers `X-Content-Type-Options:nosniff`, `Referrer-Policy`, `Permissions-Policy` restrictivo; `npm audit`; `textContent` sobre `innerHTML`; cookies `Secure;HttpOnly;SameSite=Strict`. Sin source maps en prod. Compatibilidad: doctype HTML5, charset primero, viewport, feature detection, polyfills en build (nunca CDN no confiable). Evita `document.write`, XHR síncrono, listeners no pasivos. Limpia console.log, usa error boundaries y `AbortController`.",
  }),
];
