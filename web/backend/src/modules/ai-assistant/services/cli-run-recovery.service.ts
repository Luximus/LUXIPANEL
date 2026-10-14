// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { agentRunRegistry } from "./agent-run-registry.js";
import { cliJobsRepository, type CliJobDescriptor } from "../repositories/cli-jobs.repository.js";
import { cliSessionsRepository } from "../repositories/cli-sessions.repository.js";
import { makeRecoveredCliGen } from "./providers/cli/recovered-run.js";
import { discoverCodexOrphanJob } from "./providers/cli/cli-session.js";
import { CLI_RECOVERY_INTERRUPTED_TEXT } from "./team-tasks/interruption.js";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { makeUsageRecorder, persistAssistantMessage, drainConversationQueue } from "./turn-queue.service.js";
import { moduleToolRunScope } from "./module-tools.service.js";
import { readModuleRunRecovery, restoreModuleRunRecovery, moduleRecoveryJobIsAlive, moduleTokenHash } from "./module-run-recovery.service.js";
const log = createModuleLogger("ai-cli-recovery");

function resumeCliRun(
  executor: Executor,
  conversationId: string,
  desc: CliJobDescriptor,
  user?: SessionUser,
  recoverTools = false,
): void {
  const cliHolder = { value: false };
  const tokensHolder = { input: 0, output: 0, estimated: false };
  const recordUsage = makeUsageRecorder({
    executor,
    provider: desc.provider,
    conversationId,
    projectId: null,
    userId: user?.userId != null ? String(user.userId) : null,
    cliHolder,
    tokensHolder,
  });

  agentRunRegistry.start({
    key: conversationId,
    provider: desc.provider,
    executor,
    user,
    makeGen: async function* () {
      const release = recoverTools && user ? restoreModuleRunRecovery(executor, desc, user) : () => {};
      try { yield* makeRecoveredCliGen(executor, conversationId, desc); }
      finally { release(); }
    },
    onEvent: recordUsage,
    onComplete: async (assistantText, _errored, ask, _translation, durationMs, cliLog, askKind, outcome) => {
      const tokens =
        tokensHolder.input + tokensHolder.output > 0
          ? {
              input: tokensHolder.input,
              output: tokensHolder.output,
              total: tokensHolder.input + tokensHolder.output,
              ...(tokensHolder.estimated ? { estimated: true } : {}),
            }
          : undefined;
      // A recovered run is always a CLI answer → persist with cli=true; the
      // verbose terminal log rides along as `cliLog` for the console box.
      await persistAssistantMessage(executor, conversationId, assistantText, desc.provider, true, ask, undefined, tokens, durationMs, cliLog, askKind, outcome);
      await cliJobsRepository.delete(executor, conversationId).catch(() => undefined);
      await drainConversationQueue(executor, conversationId);
    },
  });
}

/**
 * If a CLI background job for this conversation survived a panel restart,
 * re-attach to it. Returns true when a run is now live in the registry for the
 * conversation. When the descriptor's artifacts are gone (a clean completion
 * `rm`s them; or they were cleaned up) it's abandoned: drop the descriptor,
 * persist an interrupted note so the thread isn't frozen, and drain the queue.
 */
export async function recoverConversation(
  executor: Executor,
  conversationId: string,
  user?: SessionUser,
): Promise<boolean> {
  if (agentRunRegistry.has(conversationId, executor.target.id)) return true;
  let desc = await cliJobsRepository.get(executor, conversationId).catch(() => null);
  if (!desc || desc.provider === "codex") {
    const session = await cliSessionsRepository.getProvider(executor, conversationId, "codex").catch(() => null);
    const orphan = session?.codex ? await discoverCodexOrphanJob(executor, session.codex) : null;
    if (orphan && desc?.jobId !== orphan.jobId) {
      desc = {
        conversationId,
        jobId: orphan.jobId,
        logFile: `/tmp/${orphan.jobId}.log`,
        exitFile: `/tmp/${orphan.jobId}.exit`,
        provider: "codex",
        serverName: executor.target.name || "Local",
        pid: orphan.pid,
        startedAt: Number(orphan.jobId.match(/^lxp-cli-(\d+)-/)?.[1] ?? Date.now()),
      };
      await cliJobsRepository.set(executor, conversationId, desc).catch(() => undefined);
      log.warn({ conversationId, jobId: orphan.jobId }, "agent: restored orphaned Codex CLI job");
    }
  }
  if (!desc) return false;

  let artifactsExist = false;
  try {
    const r = await executor.exec(`test -e ${quoteArg(desc.logFile)} && echo Y || echo N`, { timeoutMs: 8_000 });
    artifactsExist = r.stdout.trim() === "Y";
  } catch {
    artifactsExist = false;
  }

  // A concurrent recovery may have started the run while we awaited.
  if (agentRunRegistry.has(conversationId, executor.target.id)) return true;

  if (!artifactsExist) {
    await cliJobsRepository.delete(executor, conversationId).catch(() => undefined);
    await persistAssistantMessage(
      executor,
      conversationId,
      CLI_RECOVERY_INTERRUPTED_TEXT,
      desc.provider,
      false,
    ).catch(() => undefined);
    await drainConversationQueue(executor, conversationId).catch(() => undefined);
    return false;
  }

  const recoverTools = !!user && !!readModuleRunRecovery(executor, desc, user) && await moduleRecoveryJobIsAlive(executor, desc);
  // Recheck after probing the target; another callback may have reattached.
  if (agentRunRegistry.has(conversationId, executor.target.id)) return true;
  resumeCliRun(executor, conversationId, desc, user, recoverTools);
  return true;
}


/** Recover only the exact surviving job authenticated by this module token. */
export async function ensureModuleToolRun(executor: Executor, conversationId: string, user: SessionUser, token: string): Promise<boolean> {
  const matches = () => { const scope = moduleToolRunScope(conversationId, executor, user);
    return !!scope && (!scope.tokenHash || scope.tokenHash === moduleTokenHash(token)); };
  if (matches()) return true;
  // Never replace a different run already bound to this conversation.
  if (moduleToolRunScope(conversationId, executor, user)) return false;
  const desc = await cliJobsRepository.get(executor, conversationId).catch(() => null);
  if (!desc || !readModuleRunRecovery(executor, desc, user, token)) return false;
  const context = agentRunRegistry.runContext(conversationId, executor.target.id);
  if (context && context.ownerUserId !== user.userId) return false;
  if (!await moduleRecoveryJobIsAlive(executor, desc)) return false;
  if (context) restoreModuleRunRecovery(executor, desc, user);
  else await recoverConversation(executor, conversationId, user);
  return matches();
}
