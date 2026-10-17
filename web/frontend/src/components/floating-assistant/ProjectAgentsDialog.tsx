// SPDX-License-Identifier: AGPL-3.0-only
import { ModalShell } from "@/components/ui/ModalShell";
import { AgentMarket } from "./AgentMarket";
import type { AssistantAgent } from "./assistant-api";
import { useAssistantI18n } from "./i18n";
import { AgentProfileDialog } from "./AgentProfileDialog";

/** Agent chips edit the reusable profile; project tabs configure assignments. */
export function ProjectAgentsDialog({ projectId, agentId, locale, onClose }: {
  projectId?: string;
  agentId?: string;
  locale: string;
  onClose(): void;
  onLaunchAgent(agent: AssistantAgent, projectId?: string): void;
}) {
  const t = useAssistantI18n();
  if (agentId) return <AgentProfileDialog agentId={agentId} locale={locale} onClose={onClose} />;
  return <ModalShell onClose={onClose} title={t.agentMarket.title} closeLabel={t.drawer.close}>
    <AgentMarket projectId={projectId} initialEditAgentId={agentId} locale={locale} />
  </ModalShell>;
}
