// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../../config/env.js";
import { getContextUser, setContextFileJail } from "../../../shared/executor/context.js";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import type { CliJobDescriptor } from "../repositories/cli-jobs.repository.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import { bindModuleToolRun, moduleToolRunScope } from "./module-tools.service.js";
import { CROSS_MCP_TOKEN_TTL_MS } from "./mcp-run-tokens.js";

interface Recovery {
  version: 1; owner: number; targetId: string; descriptor: string; tokenHash: string; expiresAt: number;
  allowlists: (readonly string[] | null | undefined)[]; jail: string[] | null; agentId?: string;
  approval: { mode: "auto" | "manual" | "plan"; autoApproveTools: string[] };
}
export const moduleTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const binding = (d: CliJobDescriptor) => JSON.stringify([d.conversationId, d.jobId, d.logFile, d.exitFile, d.pid, d.provider, d.startedAt]);
const signature = (body: string) => createHmac("sha256", env.JWT_SECRET).update("luxipanel-module-recovery-v1\0" + body).digest();

/** Persist authority, never a reusable bearer token. The signature prevents
 * an agent editing a target-side job file from widening its original scope. */
export function captureModuleRunRecovery(executor: Executor, desc: CliJobDescriptor, token?: string): string | undefined {
  const user = getContextUser();
  if (!user || !token) return undefined;
  const scope = moduleToolRunScope(desc.conversationId, executor, user);
  if (!scope) return undefined;
  const approval = agentRunRegistry.getApproval(desc.conversationId, executor.target.id);
  const state: Recovery = { version: 1, owner: user.userId, targetId: executor.target.id,
    descriptor: binding(desc), tokenHash: moduleTokenHash(token), expiresAt: Date.now() + CROSS_MCP_TOKEN_TTL_MS,
    allowlists: [...(scope.allowlists ?? [])], jail: scope.jail, agentId: scope.agentId,
    approval: { mode: approval?.mode ?? "manual", autoApproveTools: [...(approval?.autoApprove ?? [])] } };
  scope.tokenHash = state.tokenHash;
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${body}.${signature(body).toString("base64url")}`;
}

export function readModuleRunRecovery(executor: Executor, desc: CliJobDescriptor, user: SessionUser, token?: string): Recovery | null {
  try {
    if (!desc.moduleRecovery || desc.moduleRecovery.length > 65536) return null;
    const parts = desc.moduleRecovery.split(".");
    if (parts.length !== 2) return null;
    const [body, mac] = parts as [string, string], expected = signature(body), actual = Buffer.from(mac, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const state = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Recovery;
    if (state.version !== 1 || state.owner !== user.userId || state.targetId !== executor.target.id
      || state.descriptor !== binding(desc) || state.expiresAt <= Date.now()
      || (token !== undefined && state.tokenHash !== moduleTokenHash(token))) return null;
    return state;
  } catch { return null; }
}

/** A log left on disk or a reused PID must not resurrect completed authority. */
export async function moduleRecoveryJobIsAlive(executor: Executor, desc: CliJobDescriptor): Promise<boolean> {
  if (!desc.pid || !/^[1-9]\d*$/.test(desc.pid) || !/^lxp-cli-\d+-[a-zA-Z0-9-]+$/.test(desc.jobId)) return false;
  try {
    const r = await executor.exec(`test -f ${quoteArg(desc.logFile)} && test ! -e ${quoteArg(desc.exitFile)} && ps -p ${desc.pid} -o args=`, { timeoutMs: 8000 });
    return r.exitCode === 0 && r.stdout.includes(desc.jobId);
  } catch { return false; }
}

/** Called inside the recovered run, with its authenticated owner and target. */
export function restoreModuleRunRecovery(executor: Executor, desc: CliJobDescriptor, user: SessionUser): () => void {
  const state = readModuleRunRecovery(executor, desc, user);
  const context = agentRunRegistry.runContext(desc.conversationId, executor.target.id);
  if (!state || !context || context.ownerUserId !== user.userId) return () => {};
  // An unrelated/newer run already owns this conversation: never replace it.
  if (moduleToolRunScope(desc.conversationId, executor, user)) return () => {};
  setContextFileJail(state.jail ?? []);
  const release = bindModuleToolRun(desc.conversationId, executor, user, state.allowlists, state.agentId, context.signal);
  const scope = moduleToolRunScope(desc.conversationId, executor, user)!;
  scope.tokenHash = state.tokenHash;
  scope.alive = () => agentRunRegistry.runContext(desc.conversationId, executor.target.id)?.signal === context.signal;
  if (!agentRunRegistry.getApproval(desc.conversationId, executor.target.id))
    agentRunRegistry.setApproval(desc.conversationId, state.approval, executor.target.id);
  return release;
}
