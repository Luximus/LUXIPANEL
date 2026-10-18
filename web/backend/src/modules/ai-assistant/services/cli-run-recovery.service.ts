// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { resolveConversationBinding } from "./agent-context.service.js";
import { teamTasksRepository } from "../repositories/team-tasks.repository.js";
import { teamIsolationService } from "./team-isolation.service.js";
import { workerRunStarted, workerRunEnded } from "./team-tasks/worker-quota.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import { guardTurnFinalization, hasUncollectedTeamTasks } from "./turn-finalization.js";
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
import { contributionCliBinding, recoverOwnerContribution, finishOwnerContribution, type ContributionJob } from "../../../shared/github/owner-contributions.js";
import { localExecutor } from "../../../shared/executor/local-executor.js";
import { runWithExecutor } from "../../../shared/executor/context.js";
const log = createModuleLogger("ai-cli-recovery");

/** Recover contribution tracking only for the exact signed CLI job. */
export async function canRecoverOwnerContribution(job:ContributionJob):Promise<boolean>{
 return runWithExecutor(localExecutor,async()=>{
  const desc=await cliJobsRepository.get(localExecutor,job.conversationId);
  if(!desc || contributionCliBinding(desc)!==job.cliBinding || !readModuleRunRecovery(localExecutor,desc,job.user))return false;
  const artifacts=await localExecutor.exec(`test -e ${quoteArg(desc.logFile)} && echo Y || echo N`,{timeoutMs:8000});
  if(artifacts.stdout.trim()!=="Y")return false;
  const exited=await localExecutor.exec(`test -e ${quoteArg(desc.exitFile)} && echo Y || echo N`,{timeoutMs:8000});
  return exited.stdout.trim()==="Y" || await moduleRecoveryJobIsAlive(localExecutor,desc);
 },job.user.userId,job.user);
}
export async function resumeOwnerContribution(job:ContributionJob):Promise<void>{
 await runWithExecutor(localExecutor,async()=>{
  if(agentRunRegistry.has(job.conversationId,"local"))return;
  const desc=await cliJobsRepository.get(localExecutor,job.conversationId);
  if(!desc || contributionCliBinding(desc)!==job.cliBinding)return;
  let bindingValid = false;
  try { await resolveConversationBinding(localExecutor, { conversationId: job.conversationId }, job.user); bindingValid = true; }
  catch { /* Preserve history recovery; never restore a removed assignment's tools. */ }
  const recoverTools=bindingValid && !!readModuleRunRecovery(localExecutor,desc,job.user) && await moduleRecoveryJobIsAlive(localExecutor,desc);
  if(!agentRunRegistry.has(job.conversationId,"local"))resumeCliRun(localExecutor,job.conversationId,desc,job.user,recoverTools);
 },job.user.userId,job.user);
}

function resumeCliRun(
  executor: Executor,
  conversationId: string,
  desc: CliJobDescriptor,
  user?: SessionUser,
  recoverTools = false,
): void {
  let contribution:Awaited<ReturnType<typeof recoverOwnerContribution>>=null;
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
    messageId: `cli:${desc.jobId}`,
    provider: desc.provider,
    // A second restart can happen while the generator is still restoring its
    // scope. Protect the live CLI and descriptor before any replayed event.
    cli: true,
    executor,
    user,
    makeGen: async function* () {
      const release = recoverTools && user ? restoreModuleRunRecovery(executor, desc, user) : () => {};
      const task = await teamTasksRepository.findByWorkerConversation(executor, conversationId).catch(() => null);
      if (task) {
        workerRunStarted(task.userId, conversationId);
        if (task.isolation?.leasePath && task.id) teamIsolationService.tryAcquireLease(task.isolation.leasePath, task.id, executor.target.id);
      }
      try {
        contribution=await recoverOwnerContribution(user,desc,executor.target.id);
        yield* guardTurnFinalization(makeRecoveredCliGen(executor, conversationId, desc), () => hasUncollectedTeamTasks(executor, conversationId));
      }
      finally { release(); if (task) workerRunEnded(task.userId, conversationId); }
    },
    onEvent: recordUsage,
    onComplete: async (assistantText, errored, ask, _translation, durationMs, cliLog, askKind, outcome, apiActivity, messageId) => {
      await finishOwnerContribution(contribution,!errored && !ask?.length && !outcome?.interrupted && !outcome?.error);
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
      await persistAssistantMessage(executor, conversationId, assistantText, desc.provider, true, ask, undefined, tokens, durationMs, cliLog, askKind, outcome, apiActivity, messageId);
      await cliJobsRepository.delete(executor, conversationId).catch(() => undefined);
      if (!outcome?.interrupted) await drainConversationQueue(executor, conversationId);
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
    const observed = r.stdout.trim();
    if (r.exitCode !== 0 || (observed !== "Y" && observed !== "N")) return false;
    artifactsExist = observed === "Y";
  } catch {
    // A timeout or rejected connection does not prove that the CLI artifacts
    // disappeared. Keep the signed descriptor and retry observation later.
    return false;
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

  // Reattach logs even when a binding was withdrawn; never restore its tool authority.
  const bindingValid = await resolveConversationBinding(executor, { conversationId }, user).then(() => true, () => false);
  const recoverTools = bindingValid && !!user && !!readModuleRunRecovery(executor, desc, user) && await moduleRecoveryJobIsAlive(executor, desc);
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
  if (!await resolveConversationBinding(executor, { conversationId }, user).then(() => true, () => false)) return false;
  const context = agentRunRegistry.runContext(conversationId, executor.target.id);
  if (context && context.ownerUserId !== user.userId) return false;
  if (!await moduleRecoveryJobIsAlive(executor, desc)) return false;
  if (context) restoreModuleRunRecovery(executor, desc, user);
  else await recoverConversation(executor, conversationId, user);
  return matches();
}
