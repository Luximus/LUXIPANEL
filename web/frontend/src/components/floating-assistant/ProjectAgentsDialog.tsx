// SPDX-License-Identifier: AGPL-3.0-only
import { ModalShell } from "@/components/ui/ModalShell";
import { AgentMarket } from "./AgentMarket";
import type { AssistantAgent } from "./assistant-api";
import { useAssistantI18n } from "./i18n";
import { AgentProfileDialog } from "./AgentProfileDialog";
import { profileCopy } from "./agent-profiles/copy";

/** Agent chips edit the private adaptation in their originating project. */
export function ProjectAgentsDialog({ projectId, agentId, locale, onClose }: {
  projectId?: string;
  agentId?: string;
  locale: string;
  onClose(): void;
  onLaunchAgent(agent: AssistantAgent, projectId?: string): void;
}) {
  const t = useAssistantI18n();
  if (agentId) return <AgentProfileDialog agentId={agentId} projectId={projectId} locale={locale} onClose={onClose} />;
  return <ModalShell onClose={onClose} title={projectId ? profileCopy(locale).project : profileCopy(locale).bazaar} closeLabel={t.drawer.close}>
    <AgentMarket projectId={projectId} initialEditAgentId={agentId} locale={locale} />
  </ModalShell>;
}
