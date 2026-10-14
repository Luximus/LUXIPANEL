// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantSkill } from "../skill.types.js";
import { catalogSkill } from "./factory.js";

export const automationSkills: AssistantSkill[] = [
  catalogSkill({
    id: "n8n",
    name: "n8n",
    category: "automation",
    source: "https://docs.n8n.io/",
    description:
      "Automatización de flujos fair-code, self-hostable.",
    block:
      "Guarda credenciales en el gestor de n8n, nunca en nodos. Webhook: URL de test al desarrollar, activa el workflow para usar la de production. Maneja errores con Error Trigger y ramas If/Switch. Moldea datos con Edit Fields (Set) en vez de Code cuando puedas; Loop Over Items (Split in Batches) para volúmenes y rate limits. Expresiones para referenciar nodos previos. Versiona exportando JSON. Idempotencia en reintentos. Variables de entorno para secretos del host.",
  }),
  catalogSkill({
    id: "make",
    name: "Make",
    category: "automation",
    source: "https://www.make.com/en/help",
    description:
      "Automatización visual no-code por escenarios (ex-Integromat).",
    block:
      "Diseña escenarios con módulos; routers para ramificar y filtros para condicionar. Iterator + Array Aggregator para arrays. Vigila el consumo de operations: filtra/agrupa temprano. Manejo de errores con handlers (Resume/Rollback/Commit/Break/Ignore) y backoff. Data stores para estado entre ejecuciones. Mapea con funciones integradas. Webhooks como instant triggers para tiempo real. Programa el scheduling según necesidad, no en exceso.",
  }),
  catalogSkill({
    id: "zapier",
    name: "Zapier",
    category: "automation",
    source: "https://help.zapier.com/",
    description:
      "Automatización SaaS por triggers y acciones (Zaps).",
    block:
      "Trigger + una o más acciones; mapea campos entre pasos. Filter by Zapier frena ejecuciones que no aplican y ahorra tasks. Formatter transforma datos; Paths ramifica lógica; Delay para esperas. Webhooks by Zapier (Catch Hook) para fuentes sin app nativa. Code (Python/JS) solo para lo que ningún paso cubre. Prueba con Test antes de publicar (el Zap solo procesa datos creados tras publicarlo). Vigila el consumo de tasks.",
  }),
  catalogSkill({
    id: "temporal",
    name: "Temporal",
    category: "automation",
    source: "https://docs.temporal.io/",
    description:
      "Orquestación de workflows duraderos y tolerantes a fallos.",
    block:
      "Workflow DETERMINISTA: nada de I/O, random, reloj ni llamadas externas directas (el tiempo se lee del contexto); eso va en Activities, donde el replay reusa el resultado registrado. Versiona cambios con workflow.GetVersion/Patched (o Worker Versioning por Build ID) para no romper ejecuciones en curso. Activities idempotentes con retries y timeouts. Signals/Queries/Updates para interacción externa. Task queues por tipo de worker. No bloquees el hilo del workflow.",
  }),
  catalogSkill({
    id: "bullmq",
    name: "BullMQ",
    category: "automation",
    source: "https://docs.bullmq.io/",
    description:
      "Colas de trabajos en Redis para Node.js.",
    block:
      "Queue para encolar, Worker para procesar. jobId determinista para deduplicar. attempts + backoff (exponential) y removeOnComplete/removeOnFail para no llenar Redis. Procesadores idempotentes (un job puede reintentarse). concurrency por worker según carga. QueueEvents para observar estado; no sondees. Repeatable/cron jobs para periódicos. FlowProducer (Flows) para dependencias padre-hijo. Stalled jobs vía lockDuration. Conexión Redis dedicada con maxRetriesPerRequest: null.",
  }),
  catalogSkill({
    id: "langgraph",
    name: "LangGraph",
    category: "automation",
    source: "https://langchain-ai.github.io/langgraph/",
    description:
      "Orquestación de agentes LLM como grafos con estado.",
    block:
      "Modela el flujo con StateGraph: add_node = pasos, add_conditional_edges = decisiones; START/END delimitan; compile() al final. Define un State tipado con reducers (Annotated, add_messages) para fusionar actualizaciones. Checkpointer (p.ej. MemorySaver) para persistencia e interrupt (human-in-the-loop). recursion_limit para evitar loops infinitos. stream para feedback por pasos. Aísla herramientas en nodos; valida salidas del LLM antes de actuar. Nodos pequeños y testeables.",
  }),
];
