// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * StatsTab — usage/cost analytics surface. Thin orchestrator: the provider
 * strip + storage header wired to the per-provider stats panel. All the pieces
 * (StorageManager, ProviderStats and their charts/deltas/tables) were extracted
 * VERBATIM to `./stats-tab/*`, each keeping its own hook order untouched. The
 * public `StatsTab` export + its props are unchanged.
 */
import { useState } from "react";
import { PROVIDER_ORDER, type AssistantProviderId } from "./assistant-api";
import { type DataTableI18n } from "@/components/ui/DataTable";
import { ProviderIcon } from "./ProviderIcon";
import { useRegisterScreenProvider } from "./screen-provider";
import { StorageManager } from "./stats-tab/StorageManager";
import { ProviderStats } from "./stats-tab/ProviderStats";

export function StatsTab({ dataTableI18n }: { dataTableI18n?: DataTableI18n | null } = {}) {
  const [provider, setProvider] = useState<AssistantProviderId>("claude");
  // Mobile: drive this screen's provider via the shared bottom strip.
  useRegisterScreenProvider(
    {
      options: PROVIDER_ORDER.map((id) => ({ id })),
      selected: provider,
      onSelect: (id) => setProvider(id as AssistantProviderId),
    },
  );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border p-3">
        <StorageManager />
      </div>
      {/* Top provider strip — hidden on phones (driven by the bottom strip). */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-muted/20 px-2 py-1.5 max-sm:hidden">
        {PROVIDER_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setProvider(id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
              provider === id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:bg-card/50"
            }`}
          >
            <ProviderIcon id={id} className="text-sm" />
            <span className="capitalize">{id}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ProviderStats key={provider} provider={provider} dataTableI18n={dataTableI18n} />
      </div>
    </div>
  );
}
