// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assistantApi,
  PROVIDER_ORDER,
  type AssistantConfigState,
  type AssistantProviderId,
  type AssistantProviderState,
  type ProviderModelCatalog,
} from "./assistant-api";

/** A provider is usable only when its selected transport can actually run it. */
export function isProviderOperational(
  provider: AssistantProviderState | undefined,
  catalog: ProviderModelCatalog | undefined,
): boolean {
  if (!provider || !catalog || provider.mode !== catalog.mode || !catalog.models.some((model) => model.available)) return false;
  if (provider.mode === "cli") return Boolean(provider.cli.installed && provider.cli.loggedIn && catalog.status === "verified");
  return Boolean(provider.api?.hasApiKey && catalog.status === "verified");
}

export interface ProviderAvailability {
  checking: boolean;
  catalogs: Partial<Record<AssistantProviderId, ProviderModelCatalog>>;
  /** Providers enabled for Chatbox and proven usable. */
  activeProviders: AssistantProviderId[];
  /** Usable providers that can be activated from the existing provider picker. */
  selectableProviders: AssistantProviderId[];
  retry(): void;
}

function candidateProviders(config: AssistantConfigState): AssistantProviderId[] {
  return PROVIDER_ORDER.filter((id) => {
    const provider = config.providers[id];
    return Boolean(
      provider?.active
      || provider?.api?.hasApiKey
      || provider?.cli?.installed,
    );
  });
}

/**
 * Resolves all plausible provider transports once per assistant instance. This
 * keeps the chat tabs, model selector and external handoffs on one availability
 * decision instead of each falling back to its own static model list.
 */
export function useProviderAvailability(config: AssistantConfigState | null): ProviderAvailability {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    config: AssistantConfigState | null;
    checking: boolean;
    catalogs: Partial<Record<AssistantProviderId, ProviderModelCatalog>>;
  }>(() => ({ config, checking: Boolean(config?.enabled), catalogs: {} }));

  useEffect(() => {
    let current = true;
    if (!config?.enabled) {
      setState({ config, checking: false, catalogs: {} });
      return () => { current = false; };
    }
    const ids = candidateProviders(config);
    if (ids.length === 0) {
      setState({ config, checking: false, catalogs: {} });
      return () => { current = false; };
    }
    setState({ config, checking: true, catalogs: {} });
    void Promise.all(ids.map(async (id) => {
      try {
        return [id, await assistantApi.getProviderModelCatalog(id, attempt > 0)] as const;
      } catch {
        // A transport failure must never resurrect the hard-coded model list.
        return [id, undefined] as const;
      }
    })).then((rows) => {
      if (!current) return;
      const catalogs: Partial<Record<AssistantProviderId, ProviderModelCatalog>> = {};
      for (const [id, catalog] of rows) if (catalog) catalogs[id] = catalog;
      setState({ config, checking: false, catalogs });
    });
    return () => { current = false; };
  }, [config, attempt]);

  const activeProviders = useMemo(() => {
    if (!config || state.config !== config) return [];
    return PROVIDER_ORDER.filter((id) => Boolean(config.providers[id]?.active) && isProviderOperational(config.providers[id], state.catalogs[id]));
  }, [config, state.catalogs, state.config]);
  const selectableProviders = useMemo(() => {
    if (!config || state.config !== config) return [];
    return PROVIDER_ORDER.filter((id) => isProviderOperational(config.providers[id], state.catalogs[id]));
  }, [config, state.catalogs, state.config]);
  const retry = useCallback(() => {
    // Reflect the retry in the same frame; effects otherwise run after paint
    // and would leave the fallback button momentarily enabled.
    setState({ config, checking: Boolean(config?.enabled), catalogs: {} });
    setAttempt((value) => value + 1);
  }, [config]);

  // Effects run after paint. Until the snapshot belongs to this exact config,
  // keep Chatbox in its loading state instead of flashing the no-provider UI.
  const checking = state.checking || Boolean(config?.enabled && state.config !== config);
  return { checking, catalogs: state.catalogs, activeProviders, selectableProviders, retry };
}
