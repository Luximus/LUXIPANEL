/**
 * Reusable presets for scheduled AI-agent jobs — categories, tags and named
 * rule snippets managed from the module's "Configuración" modal and offered
 * as selectors in the agent create/edit dialog.
 *
 * Sidecar (per target): `${LUXIPANEL_CONFIG_DIR}/cron/agent-presets.json`
 * (single document under the fixed id "default").
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { isHostingSession } from "../../../shared/tenant/tenant-scope.js";

interface AgentRulePreset {
  id: string;
  title: string;
  text: string;
}

interface AgentTagPreset {
  name: string;
  /** Category the tag belongs to (tags are created under a category). */
  category: string;
}

interface AgentPresets {
  categories: string[];
  tags: AgentTagPreset[];
  rules: AgentRulePreset[];
}

const MODULE = "cron";
const COLLECTION = "agent-presets";
const DOC_ID = "default";
export function presetScope(user: SessionUser | undefined): string | undefined {
  if (!user) return undefined;
  return isHostingSession(user) ? `hosting:${user.tenantId ?? "unknown"}:${user.userId}` : `panel:${user.userId}`;
}

const store = makeKvStore<AgentPresets>({ module: MODULE, collection: COLLECTION, idStrategy: "uuid" });

export const agentPresetsRepository = {
  async get(executor?: Executor | null, scope?: string): Promise<AgentPresets> {
    const rec = await store(executor).get(scope || DOC_ID);
    return {
      categories: rec?.categories ?? [],
      // Normalize legacy plain-string tags (pre tag-per-category model).
      tags: (rec?.tags ?? []).map((t) =>
        typeof t === "string" ? { name: t, category: "" } : { name: t.name, category: t.category ?? "" },
      ),
      rules: rec?.rules ?? [],
    };
  },

  async save(data: AgentPresets, executor?: Executor | null, scope?: string): Promise<AgentPresets> {
    await store(executor).set(scope || DOC_ID, data);
    return data;
  },
};
