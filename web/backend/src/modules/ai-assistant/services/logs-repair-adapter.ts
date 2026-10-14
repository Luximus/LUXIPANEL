import { runWithExecutor, localExecutor } from "../../../shared/executor/index.js";
import { repairBridge, REPAIR_TOOLS } from "../../../shared/diagnostics/repair-bridge.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { agentService } from "./agent.service.js";
import { PROVIDER_IDS, isAssistantProviderId } from "../models/assistant-config.types.js";
import { workerRunStarted, workerRunEnded, hasWorkerSlot } from "./team-tasks/worker-quota.js";
import { makeUsageRecorder } from "./usage-recorder.js";
import { agentRolesRepository } from "../repositories/agent-roles.repository.js";
import { normalizeAllowedTools } from "./tool-allowlist.js";
import { resolveLiveAuthorization } from "../../auth/services/live-authorization.service.js";

function permitsRepairs(lists: (readonly string[] | null | undefined)[]): boolean {
  return lists.every((list) => !list || REPAIR_TOOLS.every((tool) => normalizeAllowedTools([...list], { onUnknown: "drop", context: "logs-repair" })?.valid.includes(tool)));
}

export function registerLogsRepairAgent(): void {
  repairBridge.registerAgent({
    authorize: async (user) => {
      if (user.tenantId || user.direct || (user.targetId && user.targetId !== "local")) throw new Error("La reparación requiere un administrador local de esta instalación.");
      const current = await resolveLiveAuthorization(user, localExecutor);
      if (current.kind !== "admin" || current.tenantId) throw new Error("Los permisos del administrador que solicitó el arreglo fueron revocados.");
      return current;
    },
    options: (user) => runWithExecutor(localExecutor, async () => {
      const [agents, roles, config] = await Promise.all([agentsRepository.list(), agentRolesRepository.list(), assistantConfigRepository.load(localExecutor)]);
      return {
        agents: agents.map((a) => ({ id: a.id!, name: a.name, providerId: a.providerId, model: a.model, repairReady: permitsRepairs([a.allowedTools, roles.find((role) => role.id === a.roleId)?.allowedTools]) })),
        providers: PROVIDER_IDS.map((id) => ({ id, model: config.providers[id]?.api?.model || "", mode: config.providers[id]?.mode || "api", ready: config.enabled && config.providers[id]?.mode === "api" && Boolean(config.providers[id]?.api?.apiKey) })),
      };
    }, user.userId, user),
    run: (input) => runWithExecutor(localExecutor, async () => {
      const agent = await agentsRepository.get(input.config.agentId); if (!agent) throw new Error("El agente configurado fue eliminado.");
      const role = agent.roleId ? await agentRolesRepository.get(agent.roleId) : null;
      if (!permitsRepairs([agent.allowedTools, role?.allowedTools])) throw new Error("El agente y su rol deben permitir las herramientas module-dev.logs_* para esta reparación.");
      const providerId = input.config.providerId || agent.providerId;
      if (!isAssistantProviderId(providerId)) throw new Error("Proveedor inválido.");
      if (!hasWorkerSlot(String(input.user.userId))) throw new Error("No hay cupos de agentes en segundo plano disponibles. Reintenta cuando termine una ejecución.");
      let text = ""; let tokens = 0;
      const recordUsage = makeUsageRecorder({ executor: localExecutor, provider: providerId, userId: String(input.user.userId), conversationId: null, cliHolder: { value: false } });
      const runId = `logs-${Date.now()}-${Math.random()}`;
      workerRunStarted(String(input.user.userId), runId);
      try {
        for await (const event of agentService.run([{ role: "user", content: input.prompt }], {
          executor: localExecutor, user: input.user, userId: String(input.user.userId),
          providerId, model: input.config.model || undefined, effort: input.config.effort,
          agentId: agent.id, forcedCwd: input.cwd, withContext: false, signal: input.signal,
          approvalModeOverride: "auto", toolAllowlist: REPAIR_TOOLS, requireApiMode: true,
        })) {
          recordUsage(event);
          await input.onEvent(event);
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "text") text = (text + event.delta).slice(-24000);
          if (event.type === "usage") {
            const usage = event as unknown as { inputTokens?: number; outputTokens?: number; usage?: { inputTokens?: number; outputTokens?: number } };
            tokens += (usage.inputTokens || usage.usage?.inputTokens || 0) + (usage.outputTokens || usage.usage?.outputTokens || 0);
            if (input.config.tokenBudget > 0 && tokens > input.config.tokenBudget) throw new Error("Se agotó el presupuesto de tokens de la reparación.");
          }
        }
        return { text, tokens };
      } finally { workerRunEnded(String(input.user.userId), runId); }
    }, input.user.userId, input.user),
  });
}
