// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantSkill } from "../skill.types.js";
import { catalogSkill } from "./factory.js";

export const aiProdSkills: AssistantSkill[] = [
  catalogSkill({
    id: "openai-agents-sdk",
    name: "OpenAI Agents SDK",
    category: "ai-prod",
    source: "https://developers.openai.com/api/docs/guides/agents",
    description: "Agentes OpenAI con tools, handoffs, guardrails, sessions y tracing.",
    block:
      "Un Agent une instrucciones + tools + modelo. Define tools con descripción y schema precisos; usa handoffs para delegar a especialistas en vez de un prompt gigante. Pon guardrails de entrada/salida que bloqueen o pausen antes de operaciones de riesgo. El run loop itera tool-calls hasta completar o llegar a max turns (acótalo para evitar loops caros); sessions guardan estado resumible para aprobaciones humanas. Activa tracing para inspeccionar cada paso.",
  }),
  catalogSkill({
    id: "openai-agents-python",
    name: "OpenAI Agents Python SDK",
    category: "ai-prod",
    source: "https://openai.github.io/openai-agents-python/agents/",
    description: "SDK Python para agentes: Agent, Runner, @function_tool, handoffs y tracing.",
    block:
      "Crea Agent(name, instructions, tools=[...], model=...) y ejecútalo con Runner.run (async) o run_sync, que gestiona turnos, tools, guardrails y estado. Decora funciones con @function_tool: el SDK infiere el schema del type hint y docstring, así que tipa y documenta bien. handoffs=[...] delega a especialistas; output_type (Pydantic) fuerza salidas estructuradas validadas. Inyecta dependencias por context, observa con RunHooks/AgentHooks y activa tracing. Instrucciones cortas, tools mínimas.",
  }),
  catalogSkill({
    id: "openai-agents-js",
    name: "OpenAI Agents JS SDK",
    category: "ai-prod",
    source: "https://github.com/openai/openai-agents-js",
    description: "SDK TypeScript/JS para agentes OpenAI: Agent, run, tools (Zod), handoffs.",
    block:
      "Define new Agent({ name, instructions, tools }) y ejecuta con run(agent, input). Declara tools con tool({ parameters: zodSchema, execute }) — Zod valida y tipa los argumentos; también integra tools MCP. Compón con handoffs y outputType para salidas tipadas. Sessions manejan el historial; usa streaming para UX responsiva, guardrails y tracing. Limita turnos y captura errores de tool. Requiere Node 22+/Deno/Bun. System breve y estable para aprovechar caché.",
  }),
  catalogSkill({
    id: "mcp-docs",
    name: "Model Context Protocol",
    category: "ai-prod",
    source: "https://modelcontextprotocol.io/docs/getting-started/intro",
    description: "Estándar abierto (el 'USB-C de la IA') para conectar LLMs a tools, resources y prompts.",
    block:
      "MCP estandariza cómo una app de IA (host) descubre y llama servidores que exponen tools, resources y prompts vía JSON-RPC, con negociación de capabilities en el handshake. Implementa un servidor por dominio (tu API, DB, archivos) con nombres y schemas claros; el modelo elige por la descripción, así que sé estricto y útil. Usa transport stdio (local) o streamable HTTP (remoto). No expongas operaciones peligrosas sin confirmación.",
  }),
  catalogSkill({
    id: "mcp-github",
    name: "MCP (GitHub)",
    category: "ai-prod",
    source: "https://github.com/modelcontextprotocol",
    description: "Org GitHub de MCP: SDKs oficiales (10 lenguajes), servers de referencia e inspector.",
    block:
      "Parte de un SDK oficial (typescript-sdk, python-sdk; también Go/C#/Java/Rust…) en vez de implementar JSON-RPC a mano. Usa el repo 'servers' como plantilla y el 'inspector' para probar tu servidor antes de conectarlo a un host. Declara capabilities en el handshake. Reusa servidores existentes (filesystem, git, fetch, GitHub, Postgres) cuando cubran el caso en lugar de reescribirlos. Proyecto bajo la Linux Foundation.",
  }),
  catalogSkill({
    id: "anthropic-mcp-intro",
    name: "Anthropic MCP Intro",
    category: "ai-prod",
    source: "https://www.anthropic.com/news/model-context-protocol",
    description: "Anuncio de Anthropic: MCP como estándar abierto que resuelve las integraciones N×M.",
    block:
      "MCP nació en Anthropic para reemplazar conectores N×M ad-hoc por un protocolo común y bidireccional: una vez tu sistema habla MCP, cualquier host compatible lo usa. Prefiere exponer tu plataforma como servidor MCP reutilizable (hay refs para Drive, Slack, GitHub, Postgres) antes que pegar tools sueltas a un modelo. Soporte nativo en Claude Desktop. Mantén límites de seguridad claros (permisos, confirmaciones): el servidor da capacidades reales al modelo.",
  }),
];
