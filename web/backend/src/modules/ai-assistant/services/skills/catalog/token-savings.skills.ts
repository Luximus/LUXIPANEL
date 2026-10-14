// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantSkill } from "../skill.types.js";
import { catalogSkill } from "./factory.js";

export const tokenSavingsSkills: AssistantSkill[] = [
  catalogSkill({
    id: "openai-prompt-caching",
    name: "OpenAI Prompt Caching",
    category: "token-savings",
    source: "https://developers.openai.com/api/docs/guides/prompt-caching",
    description: "Reduce costo automático reutilizando el prefijo cacheado de prompts en OpenAI.",
    block:
      "El caché es AUTOMÁTICO sobre ≥1024 tokens y casa por prefijo exacto (hash de los primeros ~256 tokens). Pon lo estático (system/developer, instrucciones, ejemplos, tools) al INICIO y lo variable al final; cualquier byte distinto antes rompe el match. Cached tokens cuestan ~90% menos. Usa prompt_cache_key para agrupar y mantén el mismo prefijo en ráfaga (vivo ~5-10min). Confirma en usage.prompt_tokens_details.cached_tokens.",
  }),
  catalogSkill({
    id: "openai-prompt-engineering",
    name: "OpenAI Prompt Engineering",
    category: "token-savings",
    source: "https://developers.openai.com/api/docs/guides/prompt-engineering",
    description: "Escribe prompts precisos para menos iteraciones y menos tokens.",
    block:
      "Pon las reglas de alta prioridad en el mensaje developer, estructuradas en secciones (identidad, instrucciones, ejemplos, contexto) con headers Markdown o tags. Sé específico para evitar reintentos caros. Pide formato exacto (JSON, lista) y limita longitud (max_tokens, '≤N palabras'). Da pocos ejemplos diversos, no diez. Coloca lo estático primero para aprovechar el caché. Usa el modelo más barato que cumpla y elimina relleno.",
  }),
  catalogSkill({
    id: "gemini-context-caching",
    name: "Gemini Context Caching",
    category: "token-savings",
    source: "https://ai.google.dev/gemini-api/docs/caching",
    description: "Cachea contexto grande repetido en Gemini (explícito o implícito) para abaratar input.",
    block:
      "En Gemini 2.5+ el caché implícito ya descuenta hits automáticos. Para ahorro GARANTIZADO usa caché explícito: crea cachedContent (system largo, docs, tools) y pásalo por config cachedContent: name. Requiere superar el mínimo del modelo (~2048 tok Flash/Pro, 4096 en 3.5 Flash). Facturas tokens cacheados a tarifa reducida + almacenamiento por TTL (default 1h): ajusta ttl al reuso real. Mantén lo cacheado inmutable, manda solo el delta. Verifica usageMetadata.cachedContentTokenCount.",
  }),
  catalogSkill({
    id: "gemini-caching-api",
    name: "Gemini Caching API",
    category: "token-savings",
    source: "https://ai.google.dev/api/caching",
    description: "API cachedContents de Gemini: crear, reusar, actualizar TTL y borrar cachés.",
    block:
      "cachedContents.create define model (obligatorio) + contents, systemInstruction, tools y ttl o expireTime; pásalo en generateContent con cachedContent: name. patch SOLO cambia la expiración (ttl/expireTime); usa get/list para inspeccionar y delete para liberar lo que ya no reuses (evita pagar almacenamiento). El model del caché DEBE coincidir con el de la generación. Verifica el ahorro en usageMetadata (cachedContentTokenCount).",
  }),
  catalogSkill({
    id: "litellm-cost-tracking",
    name: "LiteLLM Cost Tracking",
    category: "token-savings",
    source: "https://docs.litellm.ai/docs/proxy/cost_tracking",
    description: "Mide y atribuye costo por clave/usuario/equipo con el proxy LiteLLM.",
    block:
      "El proxy registra cada request en LiteLLM_SpendLogs (hash de clave, user/team, tokens y costo) y devuelve el header x-litellm-response-cost; requiere BD (in-memory pierde historial). Atribuye con user_id en la clave (no confíes en el param user del cliente) y metadata.tags. Frena gasto con max_budget + budget_duration y rpm_limit/tpm_limit por clave. Audita en /spend/logs y /global/spend/report para mover lo caro a un modelo más barato.",
  }),
  catalogSkill({
    id: "litellm",
    name: "LiteLLM",
    category: "token-savings",
    source: "https://docs.litellm.ai/docs/",
    description: "Gateway unificado a 100+ LLMs (formato OpenAI) con caché, fallbacks y routing.",
    block:
      "Llama 100+ proveedores con el formato OpenAI: cambia 'model' sin tocar código (respuestas y errores normalizados al esquema OpenAI). Activa caching (Redis) para respuestas idénticas → 0 tokens en repetidos. Usa router con fallbacks, retry y load-balancing: manda lo simple al modelo barato y escala solo cuando haga falta. Despliega el proxy para centralizar virtual keys, budgets por team/user y cost-tracking. Soporta streaming, MCP, guardrails y observabilidad (Langfuse).",
  }),
];
