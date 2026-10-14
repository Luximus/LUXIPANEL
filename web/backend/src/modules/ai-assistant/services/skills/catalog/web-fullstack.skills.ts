// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantSkill } from "../skill.types.js";
import { catalogSkill } from "./factory.js";

export const webFullstackSkills: AssistantSkill[] = [
  catalogSkill({
    id: "nextjs-app-router",
    name: "Next.js App Router",
    category: "web-fullstack",
    source: "https://nextjs.org/docs/app",
    description:
      "Guía al agente a construir apps Next.js con el App Router (Server Components, route handlers, layouts).",
    block:
      "Layouts/pages son Server Components por defecto; \"use client\" (arriba del archivo) marca el límite y arrastra todo su grafo de imports al bundle. Obtén datos con async/await + fetch en el servidor; fetch NO se cachea por defecto, usa la directiva \"use cache\" o envuelve en <Suspense> para stream. loading.js streamea la ruta; layout.tsx para shell. Solo NEXT_PUBLIC_* llega al cliente; aísla secretos con server-only. Pasa datos por props serializables.",
  }),
  catalogSkill({
    id: "vercel-ai-sdk",
    name: "Vercel AI SDK",
    category: "web-fullstack",
    source: "https://ai-sdk.dev/docs/introduction",
    description:
      "Ayuda al agente a integrar LLMs con el AI SDK (generateText, streamText, tools, structured output).",
    block:
      "Usa generateText/streamText con un provider (@ai-sdk/openai, etc.); streamText + useChat para UI en tiempo real. Salida tipada con generateObject + esquema Zod en vez de parsear strings. Tools = parámetros Zod + execute; multi-step con stopWhen/maxSteps. Mantén las API keys en el servidor (route handler), nunca en el cliente. Aprovecha la abstracción de providers para no acoplarte a uno.",
  }),
  catalogSkill({
    id: "vercel-ai-gateway",
    name: "Vercel AI Gateway",
    category: "web-fullstack",
    source: "https://vercel.com/docs/ai-gateway",
    description:
      "Orienta al agente a enrutar peticiones a múltiples modelos vía AI Gateway (un endpoint, fallback, observabilidad).",
    block:
      "Apunta el AI SDK (v5/v6) al gateway: una sola key, cientos de modelos identificados como \"creador/modelo\". Si un provider falla, reintenta a otro automáticamente; ajusta orden con provider-options. Compat con OpenAI Chat Completions, OpenAI Responses y Anthropic Messages. Sin markup sobre tokens (incluso con BYOK). Soporta embeddings. Monitorea gasto/latencia en observability; cambia de modelo sin redeploy. No pegues keys de cada provider en el código.",
  }),
  catalogSkill({
    id: "openai-sdk-cli",
    name: "OpenAI SDKs y CLI",
    category: "web-fullstack",
    source: "https://developers.openai.com/api/docs/libraries",
    description:
      "Guía al agente a usar los SDKs oficiales de OpenAI (Python/Node) y la API de forma idiomática.",
    block:
      "Usa el SDK oficial (openai en pip/npm) en vez de fetch crudo. Prefiere la Responses API para nuevos desarrollos; instancia el cliente una vez y lee la key de OPENAI_API_KEY (nunca hardcodeada). Streaming con stream=true; salida estructurada con response_format/JSON Schema. Maneja rate limits con reintentos+backoff. Llama herramientas con tool calling tipado.",
  }),
  catalogSkill({
    id: "v0-vercel",
    name: "v0 by Vercel",
    category: "web-fullstack",
    source: "https://v0.app/",
    description:
      "Ayuda al agente a generar y refinar UI React/Tailwind/shadcn con v0 a partir de prompts.",
    block:
      "v0 de Vercel genera apps full-stack con React + Tailwind + shadcn/ui desde prompts en lenguaje natural. Describe la UI con precisión (layout, estados, datos) e itera por prompts cortos; usa Design Mode para ajustar con controles visuales y vista previa. Empuja a tu repo con GitHub sync y publica en Vercel. Revisa accesibilidad, responsive y placeholders de datos antes de integrar. Úsalo para arrancar/prototipar, no para lógica de negocio crítica.",
  }),
];
