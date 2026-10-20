// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantConfig, AssistantProviderId } from "../models/assistant-config.types.js";
import { buildProvider } from "./providers/provider-factory.js";
import type { AgentEvent, AgentMessage, ProviderRunOptions } from "./providers/provider.types.js";
import {
  fallbackModelIds,
  isExplicitModelUnavailable,
  providerModelCatalog,
  type ProviderModelCatalog,
} from "./provider-model-catalog.service.js";
import type { Executor } from "../../../shared/executor/index.js";

function configWithModel(config: AssistantConfig, providerId: AssistantProviderId, model: string): AssistantConfig {
  const slot = config.providers[providerId];
  return {
    ...config,
    providers: {
      ...config.providers,
      [providerId]: slot.mode === "api"
        ? { ...slot, api: { ...(slot.api ?? { apiKey: "", model: "" }), model } }
        : { ...slot, cli: { ...(slot.cli ?? { installed: false, loggedIn: false }), model } },
    } as AssistantConfig["providers"],
  };
}

function fallbackMessage(previous: string, next: string, english: boolean): string {
  return english
    ? `ℹ️ ${previous} is unavailable for this provider; this run is using ${next}. Your saved preference is unchanged.\n\n`
    : `ℹ️ ${previous} no está disponible en este proveedor; este chat usará ${next}. La preferencia guardada no cambia.\n\n`;
}

export async function* runWithProviderModelFallback(input: {
  config: AssistantConfig;
  executor: Executor;
  providerId: AssistantProviderId;
  model: string;
  catalog: ProviderModelCatalog;
  messages: AgentMessage[];
  options: ProviderRunOptions;
  english: boolean;
}): AsyncGenerator<AgentEvent> {
  let catalog = input.catalog;
  let currentModel = input.model;
  const attempted = new Set<string>();
  let fallbackShown = false;

  for (let attempt = 0; attempt < 3; attempt++) {
    attempted.add(currentModel);
    const provider = buildProvider(configWithModel(input.config, input.providerId, currentModel), input.providerId);
    let safeToRetry = true;
    let rejected = false;

    try {
      for await (const event of provider.run(input.messages, input.options)) {
        if (event.type === "error" && safeToRetry && isExplicitModelUnavailable(event.message)) {
          rejected = true;
          break;
        }
        if (event.type !== "status") safeToRetry = false;
        yield event;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (safeToRetry && isExplicitModelUnavailable(message)) {
        rejected = true;
      } else {
        throw error;
      }
    }

    if (!rejected) return;

    catalog = await providerModelCatalog(input.executor, input.config, input.providerId, { refresh: true });
    const nextModel = fallbackModelIds(catalog, input.providerId, [...attempted])[0];
    if (attempt === 2) {
      yield { type: "error", message: `El proveedor rechazó ${currentModel}; no hay otro intento seguro disponible para completar este turno.` };
      return;
    }
    if (!nextModel) {
      yield { type: "error", message: `El modelo ${currentModel} fue rechazado y no hay otro modelo compatible disponible para ${input.providerId}.` };
      return;
    }

    if (!fallbackShown) {
      yield { type: "text", delta: fallbackMessage(currentModel, nextModel, input.english) };
      fallbackShown = true;
    }
    currentModel = nextModel;
  }
}
