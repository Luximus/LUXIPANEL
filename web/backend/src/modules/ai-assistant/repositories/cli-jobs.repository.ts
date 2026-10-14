// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * In-flight CLI background-job descriptors — what lets a CLI agent run SURVIVE a
 * panel restart.
 *
 * A CLI-mode turn launches the agent with `nohup` on the connected TARGET, so
 * the process keeps running even if `luxipanel-backend` restarts (frequent on
 * deploy). But the in-memory `cliJobTracker` + `agentRunRegistry` that were
 * polling its log and persisting the answer die with the old process — the
 * `nohup` would finish, write its log/exit, and NOBODY would read them: the
 * answer was never persisted and the thread stayed frozen at the user's turn.
 *
 * This sidecar records the minimal descriptor needed to RE-ATTACH to such a job
 * after a restart (re-register it in the tracker with a fresh executor, re-stream
 * its log, persist the answer, drain the queue). Written when the job launches,
 * deleted when the run completes / is stopped / is recovered.
 *
 * Sidecar: `${LUXIPANEL_CONFIG_DIR}/assistant/cli-jobs-u<uid>.json`, keyed by
 * conversationId (one live CLI job per conversation at a time). Per-target (it
 * lives on the connected server) AND per-user — mirrors cli-sessions so one
 * user's recovery state never binds to another's chats on the same server.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { getContextUserId } from "../../../shared/executor/context.js";
import type { AssistantProviderId } from "../models/assistant-config.types.js";

export interface CliJobDescriptor {
  /** = conversationId (the document key). */
  id?: string;
  conversationId: string;
  /** Tracker job id (NOT derivable from conversationId — must be stored). */
  jobId: string;
  /** Absolute paths on the target the nohup script writes to. */
  logFile: string;
  exitFile: string;
  provider: AssistantProviderId;
  /** Human-readable target name (for the completion notification). */
  serverName: string;
  /** Target PID of the `nohup bash -c` parent (so a stop can kill the tree). */
  pid?: string;
  /** Model passed to the CLI (for the usage event on recovery). */
  model?: string;
  /** Epoch ms the job launched — preserved so a recovered run keeps the right
   *  max-runtime budget and duration. */
  startedAt: number;
  /** Signed, token-bound scope: only restores this surviving job after restart. */
  moduleRecovery?: string;
}

const MODULE = "assistant";
const COLLECTION = "cli-jobs";

function store(executor?: Executor | null) {
  const uid = getContextUserId();
  const collection = uid ? `${COLLECTION}-u${uid}` : COLLECTION;
  return dataStore<CliJobDescriptor>(executor, MODULE, collection, { idStrategy: "uuid", timestamps: false });
}

export const cliJobsRepository = {
  async get(executor: Executor | null | undefined, conversationId: string): Promise<CliJobDescriptor | null> {
    return store(executor).get(conversationId) as Promise<CliJobDescriptor | null>;
  },

  /** Record (or replace) the descriptor for a conversation's live CLI job. */
  async set(
    executor: Executor | null | undefined,
    conversationId: string,
    desc: Omit<CliJobDescriptor, "id">,
  ): Promise<CliJobDescriptor> {
    return store(executor).set(conversationId, { ...desc, conversationId });
  },

  /** All in-flight descriptors on this target for this user. */
  async list(executor: Executor | null | undefined): Promise<CliJobDescriptor[]> {
    return store(executor).list() as Promise<CliJobDescriptor[]>;
  },

  async delete(executor: Executor | null | undefined, conversationId: string): Promise<boolean> {
    try {
      return await store(executor).delete(conversationId);
    } catch {
      return false;
    }
  },
};
