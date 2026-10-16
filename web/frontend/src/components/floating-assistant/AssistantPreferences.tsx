// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useState, useSyncExternalStore } from "react";
import { assistantApi, PROVIDER_META, PROVIDER_ORDER, type AssistantConfigState, type AssistantProviderId, type ComplexityTier } from "./assistant-api";
import { bubblePrefs, type BubblePrefs } from "./bubble-prefs";
import { CollapsibleSection } from "./CollapsibleSection";
import { ChatProjectSettings } from "./ChatProjectSettings";
import { ProviderIcon } from "./ProviderIcon";
import { VoiceSettings } from "./VoiceSettings";
import { NotifySettings } from "./NotifySettings";
import { SkillsSettings } from "./SkillsSettings";
import { useAssistantI18n } from "./i18n";

function BubbleToggle({ provider, field, label, title }: {
  provider: string;
  field: keyof BubblePrefs;
  label: string;
  title?: string;
}) {
  useSyncExternalStore(bubblePrefs.subscribe, () => JSON.stringify(bubblePrefs.get(provider)), () => "{}");
  const checked = bubblePrefs.get(provider)[field];
  return (
    <label title={title} className="flex cursor-pointer items-center gap-1.5 text-[11px]">
      <span className="relative inline-flex">
        <input type="checkbox" className="peer sr-only" checked={checked}
          onChange={(e) => bubblePrefs.set(provider, { [field]: e.currentTarget.checked })} />
        <span className="h-3.5 w-6 rounded-full bg-muted transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-2.5 after:w-2.5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-2.5" />
      </span>
      <span className="text-muted-foreground">{label}</span>
    </label>
  );
}

function AutoRoutingSettings({ config, onChange }: {
  config: AssistantConfigState;
  onChange(next: AssistantConfigState): void;
}) {
  const t = useAssistantI18n().providersTab;
  const routing = config.autoRouting ?? { enabled: true, maxTier: "max" as ComplexityTier };
  const [busy, setBusy] = useState(false);

  async function patch(p: { enabled?: boolean; maxTier?: ComplexityTier }) {
    setBusy(true);
    try {
      onChange(await assistantApi.setAutoRouting(p));
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  const tierLabels: Record<ComplexityTier, string> = {
    low: t.tierLow,
    medium: t.tierMedium,
    high: t.tierHigh,
    max: t.tierMax,
  };

  return (
    <CollapsibleSection icon={<i className="ti ti-wand text-lg" aria-hidden />}
      title={t.autoRoutingTitle} description={t.autoRoutingDesc}>
      <label className="flex cursor-pointer items-center gap-2">
        <span className="relative inline-flex">
          <input type="checkbox" className="peer sr-only" checked={routing.enabled} disabled={busy}
            onChange={(e) => void patch({ enabled: e.currentTarget.checked })} />
          <span className="h-4 w-7 rounded-full bg-muted transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-3" />
        </span>
        <span className="text-xs">{t.autoRoutingEnable}</span>
      </label>
      <label className={`mt-3 block text-xs ${routing.enabled ? "" : "opacity-50"}`}>
        <span className="text-muted-foreground">{t.autoRoutingMaxTier}</span>
        <select value={routing.maxTier} disabled={busy || !routing.enabled}
          onChange={(e) => void patch({ maxTier: e.currentTarget.value as ComplexityTier })}
          className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none">
          {(["low", "medium", "high", "max"] as ComplexityTier[]).map((tier) => (
            <option key={tier} value={tier}>{tierLabels[tier]}</option>
          ))}
        </select>
      </label>
    </CollapsibleSection>
  );
}

function ChatDisplaySettings({ config }: { config: AssistantConfigState }) {
  const messages = useAssistantI18n();
  const t = messages.providersTab;
  const activeProviders = PROVIDER_ORDER.filter((id) => config.providers[id]?.active);
  return (
    <CollapsibleSection icon={<i className="ti ti-message text-lg" aria-hidden />}
      title={messages.drawer.tabs.chat}>
      {activeProviders.length === 0 ? (
        <p className="text-xs text-muted-foreground">{messages.chatTab.noProvidersDescription}</p>
      ) : activeProviders.map((id: AssistantProviderId) => (
        <div key={id} className="border-b border-border py-2 last:border-b-0">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium">
            <ProviderIcon id={id} className="text-base" />{PROVIDER_META[id].label}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <BubbleToggle provider={id} field="input" label={t.showInputBubble} />
            <BubbleToggle provider={id} field="modifiedFiles" label={t.showModifiedFiles} title={t.showModifiedFilesHint} />
            <BubbleToggle provider={id} field="terminalLive" label={t.terminalLive} title={t.terminalLiveHint} />
          </div>
        </div>
      ))}
    </CollapsibleSection>
  );
}

export function AssistantPreferences({ config, onChange }: {
  config: AssistantConfigState;
  onChange(next: AssistantConfigState): void;
}) {
  return (
    <div className="space-y-4">
      <ChatProjectSettings />
      <AutoRoutingSettings config={config} onChange={onChange} />
      <VoiceSettings config={config} onChange={onChange} />
      <ChatDisplaySettings config={config} />
      <NotifySettings />
      <SkillsSettings />
    </div>
  );
}
