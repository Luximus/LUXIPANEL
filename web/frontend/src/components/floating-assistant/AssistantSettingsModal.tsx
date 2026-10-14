// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { lazy, Suspense, useMemo, useState } from "react";
import type { DataTableI18n } from "@/components/ui/DataTable";
import { ModalShell } from "@/components/ui/ModalShell";
import { DrawerSectionNav } from "@/components/ui/DrawerSectionNav";
import { ViewTransition, useViewDirection } from "@/components/ui/ViewTransition";
import { cn } from "@/lib/utils";
import { type AssistantAgent, type AssistantConfigState } from "./assistant-api";
import { useAssistantI18n } from "./i18n";
import { SettingsFooterContext, SettingsHeaderContext, type SettingsFooterAction, type SettingsHeaderOverride } from "./settings-footer";
const AgentsTab = lazy(() => import("./AgentsTab").then(module => ({ default: module.AgentsTab })));
const GeneralTab = lazy(() => import("./GeneralTab").then(module => ({ default: module.GeneralTab })));
const ProvidersTab = lazy(() => import("./ProvidersTab").then(module => ({ default: module.ProvidersTab })));
const ModulesTab = lazy(() => import("./ModulesTab").then(module => ({ default: module.ModulesTab })));
const StatsTab = lazy(() => import("./StatsTab").then(module => ({ default: module.StatsTab })));
const AccessTab = lazy(() => import("./AccessTab").then(module => ({ default: module.AccessTab })));
import type { AssistantTab } from "./AssistantPanel";

// "general" is settings-only (not a real panel tab), so it's added on top of the
// AssistantTab-derived sections rather than widening AssistantTab itself — the
// least invasive change (no deep-link / requestedTab plumbing needs it).
export type AssistantSettingsSection =
  | Extract<AssistantTab, "agentes" | "providers" | "modules" | "stats" | "access">
  | "general";

const SECTION_ICONS: Record<AssistantSettingsSection, string> = {
  general: "ti-adjustments-horizontal",
  agentes: "ti-robot",
  providers: "ti-plug",
  modules: "ti-puzzle",
  stats: "ti-chart-bar",
  access: "ti-shield-lock",
};

const SECTION_ORDER: AssistantSettingsSection[] = [
  "general",
  "agentes",
  "providers",
  "modules",
  "stats",
  "access",
];

function isSettingsSection(value: string | null | undefined): value is AssistantSettingsSection {
  return value === "general" || value === "agentes" || value === "providers" || value === "modules" || value === "stats" || value === "access";
}

interface AssistantSettingsModalProps {
  open: boolean;
  section: AssistantSettingsSection | null;
  locale: string;
  config: AssistantConfigState | null;
  dataTableI18n: DataTableI18n | null;
  /** Deep-link: open the Agents section directly in this agent's editor. */
  editAgentId?: string | null;
  onClose(): void;
  onSectionChange(section: AssistantSettingsSection | null): void;
  onConfigChange(next: AssistantConfigState): void;
  onLaunchAgent(agent: AssistantAgent): void;
}

export function AssistantSettingsModal({
  open,
  section,
  locale,
  config,
  dataTableI18n,
  editAgentId,
  onClose,
  onSectionChange,
  onConfigChange,
  onLaunchAgent,
}: AssistantSettingsModalProps) {
  const t = useAssistantI18n();
  // Primary action published by the active section (e.g. "Save changes") and
  // rendered in the drawer's bottom bar. The header owns the close control.
  const [footerAction, setFooterAction] = useState<SettingsFooterAction | null>(null);
  // Header override published by a sub-view (e.g. the agent editor): swaps the
  // header title/description and re-routes the back arrow to cancel the sub-view.
  const [headerOverride, setHeaderOverride] = useState<SettingsHeaderOverride | null>(null);

  const sections = useMemo(() => {
    const labels = t.drawer.tabs as Record<string, string>;
    return SECTION_ORDER.map((id) => ({
      id,
      label: labels[id] ?? id,
      description: (t.settingsModal.cards as Record<string, string>)[id],
      icon: SECTION_ICONS[id],
    }));
  }, [t]);

  // There is no landing "hub": Settings opens directly on a section. Default to
  // the requested section, the agent editor's section when deep-linking an
  // agent, or "general" otherwise.
  const activeSectionId: AssistantSettingsSection =
    section && isSettingsSection(section) ? section : editAgentId ? "agentes" : "general";
  const activeSection = sections.find((item) => item.id === activeSectionId) ?? sections[0];
  // Dirección de la transición de sección según el orden del menú lateral.
  const sectionDirection = useViewDirection(activeSectionId, SECTION_ORDER);

  if (!open) return null;

  return (
    <SettingsFooterContext.Provider value={setFooterAction}>
    <SettingsHeaderContext.Provider value={setHeaderOverride}>
      <ModalShell
        onClose={onClose}
        cardClassName="w-[min(96vw,68rem)] max-lg:w-[85vw] max-sm:w-full"
        title={headerOverride?.title ?? activeSection?.label ?? t.settingsModal.title}
        description={headerOverride?.description ?? activeSection?.description ?? t.settingsModal.description}
        onBack={headerOverride ? headerOverride.onBack : undefined}
        backLabel={headerOverride?.backLabel ?? t.settingsModal.backToMenu}
        closeLabel={t.drawer.close}
        bodyClassName="overflow-hidden p-0"
        footer={footerAction ? (
          <button
            type="button"
            onClick={footerAction.onClick}
            disabled={footerAction.disabled}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            {footerAction.label}
          </button>
        ) : undefined}
      >
        <div className="flex h-full min-h-0">
          {/* Menú lateral compartido con el drawer de Proyecto (DrawerSectionNav). */}
          <DrawerSectionNav
            items={sections}
            activeId={activeSectionId}
            onSelect={(id) => onSectionChange(id as AssistantSettingsSection)}
          />

          <div className="min-w-0 flex-1 overflow-y-auto px-0 py-5 @xl:px-6 @container">
            {/* Cambio de sección con el preset de vista (motion.css): el
                wrapper se remonta por sección y entra desde el lado según el
                orden del menú. Las secciones ya se montan/desmontan por tab. */}
            <ViewTransition viewKey={activeSectionId ?? "none"} direction={sectionDirection}>
              <Suspense fallback={<div role="status" aria-busy="true" className="p-4 text-sm text-muted-foreground">{activeSection?.label}</div>}>
              {activeSectionId === "general" && <GeneralTab config={config} onConfigChange={onConfigChange} />}
              {activeSectionId === "agentes" && <AgentsTab onLaunchAgent={onLaunchAgent} locale={locale} initialEditAgentId={editAgentId} />}
              {activeSectionId === "providers" && <ProvidersTab config={config} onChange={onConfigChange} locale={locale} />}
              {activeSectionId === "modules" && <ModulesTab />}
              {activeSectionId === "stats" && <StatsTab dataTableI18n={dataTableI18n} />}
              {activeSectionId === "access" && <AccessTab />}
              </Suspense>
            </ViewTransition>
          </div>
        </div>
      </ModalShell>
    </SettingsHeaderContext.Provider>
    </SettingsFooterContext.Provider>
  );
}
