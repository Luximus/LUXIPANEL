// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Obsidian event listeners — mint a context container whenever the assistant
 * creates a project or a loose chat. The ai-assistant module emits the events
 * (with the request's executor in the payload) and obsidian reacts here, so
 * the dependency stays one-way (assistant never imports obsidian).
 *
 * Best-effort and detached: a container failure must never affect the chat /
 * project that triggered it.
 */

import { eventBus, Events } from "../../shared/events/index.js";
import type { Executor } from "../../shared/executor/index.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { contextContainerService } from "./services/context-container.service.js";
import { projectsRepository } from "../ai-assistant/repositories/projects.repository.js";
import { conversationsRepository } from "../ai-assistant/repositories/conversations.repository.js";

const log = createModuleLogger("obsidian-listeners");

let wired = false;

interface ProjectEvent {
  executor?: Executor;
  project?: { id?: string; title?: string; path?: string };
}

interface ConversationEvent {
  executor?: Executor;
  conversation?: { id?: string; title?: string; projectId?: string | null };
}

interface ConversationCompletedEvent {
  executor?: Executor;
  conversationId?: string;
  projectId?: string;
  assistantText?: string;
  ts?: string;
}

export function registerObsidianListeners(): void {
  if (wired) return;
  wired = true;

  eventBus.on(Events.AI_PROJECT_CREATED, (payload: ProjectEvent) => {
    const executor = payload?.executor;
    const project = payload?.project;
    if (!executor || !project?.id) return;
    void contextContainerService
      .ensureProjectContainer(executor, project)
      .catch((err) => log.warn({ err: (err as Error).message }, "auto project container failed"));
  });

  eventBus.on(Events.AI_CONVERSATION_CREATED, (payload: ConversationEvent) => {
    const executor = payload?.executor;
    const conversation = payload?.conversation;
    if (!executor || !conversation?.id) return;
    void contextContainerService
      .ensureChatContainer(executor, conversation)
      .catch((err) => log.warn({ err: (err as Error).message }, "auto chat container failed"));
  });

  // B2 — auto-captura opt-in. Tras un turno OK con proyecto, si el proyecto
  // tiene `autoCapture` habilitado, anexamos un excerpt conciso a Decisiones.md
  // del vault del proyecto. Detached + best-effort: nunca afecta al chat.
  eventBus.on(Events.AI_CONVERSATION_COMPLETED, (payload: ConversationCompletedEvent) => {
    const executor = payload?.executor;
    const projectId = payload?.projectId;
    const assistantText = payload?.assistantText;
    if (!executor || !projectId || !assistantText?.trim()) return;
    void (async () => {
      // Gate: solo proyectos con auto-captura activada (default OFF).
      const project = await projectsRepository.get(executor, projectId).catch(() => null);
      if (!project?.autoCapture) return;
      // Título del bloque = título de la conversación (o genérico).
      let title = "Conversación";
      if (payload.conversationId) {
        const meta = await conversationsRepository
          .getMeta(executor, payload.conversationId)
          .catch(() => null);
        if (meta?.title?.trim()) title = meta.title.trim();
      }
      await contextContainerService.captureProjectTurn(executor, projectId, {
        title,
        excerpt: assistantText,
        ...(payload.ts ? { ts: payload.ts } : {}),
      });
    })().catch((err) => log.warn({ err: (err as Error).message }, "auto-capture listener failed"));
  });

  log.info("Obsidian context-container listeners wired");
}
