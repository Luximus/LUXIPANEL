// SPDX-License-Identifier: AGPL-3.0-only
import path from "node:path";
import { CONFIG_DIR } from "@config/paths.js";
import { dataStore } from "../../../shared/data-store/index.js";
import { getContextUserId, type Executor } from "../../../shared/executor/index.js";
import type { ConversationMeta, ConversationDoc } from "./conversations/types.js";
import { MSG_DOC_ID } from "./conversations/types.js";
import type { CliJobDescriptor } from "./cli-jobs.repository.js";

export interface AssignmentActivity {
  conversationId: string;
  pendingQuestion: boolean;
  pendingCliJob: boolean;
}
/**
 * Internal withdrawal guard, never a history endpoint. Shared legacy profiles
 * may have work under another administrator's user namespace. Read only the
 * booleans needed to block withdrawal, on the SAME target; never expose text.
 * Errors propagate: an unreadable activity index cannot prove idleness.
 */
export const agentActivityRepository = {
  async forAssignment(executor: Executor, agentId: string, projects: Set<string>): Promise<AssignmentActivity[]> {
    const entries = await executor.readdir(path.posix.join(CONFIG_DIR, "assistant"));
    const suffixes = new Set(["", getContextUserId() ? "-u" + getContextUserId() : ""]);
    for (const entry of entries) {
      const match = !entry.isDir && /^(?:conversations|cli-jobs)(-u\d+)?\.json$/.exec(entry.name);
      if (match) suffixes.add(match[1] ?? "");
    }
    const out: AssignmentActivity[] = [];
    for (const suffix of suffixes) {
      const [metas, jobs] = await Promise.all([
        dataStore<ConversationMeta>(executor, "assistant", "conversations" + suffix, { idStrategy: "uuid" }).list(),
        dataStore<CliJobDescriptor>(executor, "assistant", "cli-jobs" + suffix, { idStrategy: "uuid", timestamps: false }).list(),
      ]);
      for (const meta of metas) {
        if (meta.agentId !== agentId || (meta.projectId && !projects.has(meta.projectId))) continue;
        const id = String(meta.id);
        let doc = await dataStore<ConversationDoc>(executor, "assistant", "conv" + suffix + "-" + id, { idStrategy: "uuid", timestamps: false }).get(MSG_DOC_ID);
        if (!doc?.messages?.length && suffix) {
          doc = await dataStore<ConversationDoc>(executor, "assistant", "conv-" + id, { idStrategy: "uuid", timestamps: false }).get(MSG_DOC_ID);
        }
        const last = doc?.messages?.at(-1);
        out.push({
          conversationId: id,
          pendingQuestion: last?.role === "assistant" && !!last.ask?.length,
          pendingCliJob: jobs.some(job => job.conversationId === id),
        });
      }
      // A surviving CLI job without its metadata cannot be safely attributed.
      // Preserve it until recovery restores that binding, without exposing it.
      for (const job of jobs) if (!metas.some(meta => meta.id === job.conversationId)) {
        out.push({ conversationId: job.conversationId, pendingQuestion: false, pendingCliJob: true });
      }
    }
    return out;
  },
};
