// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (declared BEFORE importing the repository) ────────────────────────

// Keep the assistant config dir deterministic and env-free.
vi.mock("@config/paths.js", () => ({ CONFIG_DIR: "/etc/luxipanel" }));

// Pin the context user so `userSuffix()` = "-u1" and the store scope is "user"
// (mirrors the real incident: the visible list is `conversations-u1.json`).
vi.mock("../../../shared/executor/context.js", () => ({
  getContextUserId: () => 1,
}));

// In-memory dataStore double keyed by `${module}/${collection}`. Faithful to the
// real kv-store in that the map key is the canonical id and list()/get() inject
// it (the stored value carries no embedded id) — reconstruction relies on that.
let idSeq = 0;
const stores = new Map<string, Map<string, Record<string, unknown>>>();
// Round-trip counters. Every one of these is an SSH/SFTP hop against the target
// in production, so the perf invariants below assert on their COUNT, not just on
// the returned data.
const calls = { get: 0, list: 0, set: 0, transaction: 0 };
function col(mod: string, collection: string): Map<string, Record<string, unknown>> {
  const key = `${mod}/${collection}`;
  if (!stores.has(key)) stores.set(key, new Map());
  return stores.get(key)!;
}
vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: (_executor: unknown, mod: string, collection: string) => {
    const map = col(mod, collection);
    return {
      async get(id: string) {
        calls.get += 1;
        const d = map.get(String(id));
        return d ? { ...d, id: String(id) } : null;
      },
      async list() {
        calls.list += 1;
        return [...map.entries()].map(([id, d]) => ({ ...d, id }));
      },
      async create(value: Record<string, unknown>) {
        const id = (value.id as string) ?? `gen-${(idSeq += 1)}`;
        const { id: _drop, ...rest } = value;
        map.set(String(id), rest);
        return { ...rest, id: String(id) };
      },
      async count() {
        return map.size;
      },
      async set(id: string, value: Record<string, unknown>) {
        calls.set += 1;
        const { id: _drop, ...rest } = value;
        map.set(String(id), rest);
        return { ...rest, id: String(id) };
      },
      async update(id: string, patch: Record<string, unknown>) {
        const cur = map.get(String(id));
        if (!cur) return null;
        const next = { ...cur, ...patch };
        map.set(String(id), next);
        return { ...next, id: String(id) };
      },
      async delete(id: string) {
        return map.delete(String(id));
      },
      async transaction(
        fn: (cur: Record<string, Record<string, unknown>>) => Promise<{
          next: Record<string, Record<string, unknown>>;
          result: unknown;
        }>,
      ) {
        calls.transaction += 1;
        const obj: Record<string, Record<string, unknown>> = Object.fromEntries(map);
        const { next, result } = await fn(obj);
        map.clear();
        for (const [k, v] of Object.entries(next)) map.set(k, v);
        return result;
      },
    };
  },
}));

import { conversationsRepository } from "./conversations.repository.js";
import { reconstructMissingIndex } from "./conversations/reconstruction.js";
import type { Executor } from "../../../shared/executor/index.js";

// ── Test helpers ────────────────────────────────────────────────────────────

let seq = 0;

/** A fake per-server executor whose `readdir` returns the given filenames.
 *  `targetId` pins the target: the reconstruction cooldown is keyed by it and
 *  lives at module scope (it survives `beforeEach`), so a test that goes through
 *  `list()` must use an id no other test has burned. */
function makeExecutor(files: string[], targetId?: string): Executor {
  return {
    target: { id: targetId ?? `t-${++seq}`, name: "test" },
    async readdir() {
      return files.map((name) => ({ name, isDir: false, path: `/x/${name}` }));
    },
  } as unknown as Executor;
}

function msg(role: "user" | "assistant", content: string, ts: string) {
  return { role, content, ts };
}

/** Seed a transcript sidecar (collection `conv…-<id>`, doc key "messages"). */
function seedTranscript(collection: string, messages: unknown[]) {
  col("assistant", collection).set("messages", { messages });
}

/** Seed an index meta entry (collection = the index file). */
function seedMeta(collection: string, id: string, meta: Record<string, unknown>) {
  col("assistant", collection).set(id, meta);
}

/** Seed the embedded `__meta` header inside a conversation's sidecar collection. */
function seedEmbedded(collection: string, meta: Record<string, unknown>) {
  col("assistant", collection).set("__meta", meta);
}

/** Seed a team-task board entry (used for agentId backfill). */
function seedTeamTask(id: string, task: Record<string, unknown>) {
  col("assistant", "team-tasks").set(id, task);
}

/** Let a fire-and-forget background pass settle before asserting on its effect. */
async function flushBackground(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  stores.clear();
  seq = 0;
  idSeq = 0;
  calls.get = 0;
  calls.list = 0;
  calls.set = 0;
  calls.transaction = 0;
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("conversations index reconstruction", () => {
  it("bounds recovery and advances past empty transcripts to later valid entries", async () => {
    const empty = Array.from({length: 20}, (_, i) => `conv-u1-a${String(i).padStart(2, "0")}.json`);
    const executor = makeExecutor([...empty, "conv-u1-z-valid.json"]);
    seedTranscript("conv-u1-z-valid", [msg("user", "Recover me", "2026-10-03T00:00:00Z")]);
    expect(await reconstructMissingIndex(executor)).toBe(0);
    expect(calls.get).toBe(20);
    expect(await reconstructMissingIndex(executor)).toBe(1);
    expect(col("assistant", "conversations-u1").has("z-valid")).toBe(true);
  });
  it("corrupt/empty index → rebuilds every entry from the transcripts on disk", async () => {
    // Index emptied (corrupt swallowed to {}), but the transcripts survive.
    seedTranscript("conv-u1-aaa", [
      msg("user", "Primera pregunta", "2026-07-01T10:00:00.000Z"),
      msg("assistant", "Respuesta", "2026-07-01T10:00:05.000Z"),
    ]);
    seedTranscript("conv-u1-bbb", [msg("user", "Segunda", "2026-07-01T11:00:00.000Z")]);

    const executor = makeExecutor([
      "conversations-u1.json", // the (emptied) index file itself
      "conv-u1-aaa.json",
      "conv-u1-bbb.json",
    ]);

    const created = await conversationsRepository.recoverIndex(executor);
    expect(created).toBe(2);

    const { items, total } = await conversationsRepository.list(executor);
    expect(total).toBe(2);
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.has("aaa")).toBe(true);
    expect(byId.has("bbb")).toBe(true);
    // Title/preview/timestamps derived from the messages.
    expect(byId.get("aaa")!.title).toBe("Primera pregunta");
    expect(byId.get("aaa")!.messageCount).toBe(2);
    expect(byId.get("aaa")!.createdAt).toBe("2026-07-01T10:00:00.000Z");
    expect(byId.get("aaa")!.updatedAt).toBe("2026-07-01T10:00:05.000Z");
  });

  it("legacy migration → includes legacy conv-<id> transcripts with no u-suffix", async () => {
    seedTranscript("conv-legacy1", [msg("user", "Chat viejo", "2026-06-30T09:00:00.000Z")]);
    seedTranscript("conv-u1-new1", [msg("user", "Chat nuevo", "2026-07-01T09:00:00.000Z")]);

    const executor = makeExecutor([
      "conv-legacy1.json", // legacy pre-per-user transcript
      "conv-u1-new1.json", // current user's per-user transcript
    ]);

    const created = await conversationsRepository.recoverIndex(executor);
    expect(created).toBe(2);

    const { items } = await conversationsRepository.list(executor);
    const ids = items.map((i) => i.id).sort();
    expect(ids).toEqual(["legacy1", "new1"]);
  });

  it("merge, not replace → keeps existing valid entries untouched", async () => {
    // A valid entry already in the index (with a custom pinned title)…
    seedMeta("conversations-u1", "keep1", {
      title: "Mantener este título",
      provider: "claude",
      messageCount: 3,
      preview: "…",
      pinned: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    });
    seedTranscript("conv-u1-keep1", [msg("user", "otro texto", "2026-07-01T00:00:00.000Z")]);
    // …plus a transcript whose index entry was lost.
    seedTranscript("conv-u1-lost1", [msg("user", "Recuperado", "2026-07-01T12:00:00.000Z")]);

    const executor = makeExecutor(["conv-u1-keep1.json", "conv-u1-lost1.json"]);

    const created = await conversationsRepository.recoverIndex(executor);
    expect(created).toBe(1); // only lost1 minted; keep1 already present

    const { items } = await conversationsRepository.list(executor);
    const byId = new Map(items.map((i) => [i.id, i]));
    // Existing entry preserved verbatim (title/pinned NOT overwritten).
    expect(byId.get("keep1")!.title).toBe("Mantener este título");
    expect(byId.get("keep1")!.pinned).toBe(true);
    expect(byId.get("keep1")!.messageCount).toBe(3);
    // Lost entry recovered.
    expect(byId.get("lost1")!.title).toBe("Recuperado");
  });

  it("ignores another user's per-user transcripts (isolation)", async () => {
    seedTranscript("conv-u1-mine", [msg("user", "Mío", "2026-07-01T00:00:00.000Z")]);
    seedTranscript("conv-u2-theirs", [msg("user", "Ajeno", "2026-07-01T00:00:00.000Z")]);

    const executor = makeExecutor(["conv-u1-mine.json", "conv-u2-theirs.json"]);

    const created = await conversationsRepository.recoverIndex(executor);
    expect(created).toBe(1);

    const { items } = await conversationsRepository.list(executor);
    expect(items.map((i) => i.id)).toEqual(["mine"]);
  });

  it("skips empty transcripts and unreadable dirs (fail-open)", async () => {
    seedTranscript("conv-u1-empty", []); // no messages → not a real chat

    const okExecutor = makeExecutor(["conv-u1-empty.json"]);
    expect(await conversationsRepository.recoverIndex(okExecutor)).toBe(0);

    // readdir throws → recovery is a no-op, never throws.
    const badExecutor = {
      target: { id: "bad", name: "bad" },
      async readdir() {
        throw new Error("EACCES");
      },
    } as unknown as Executor;
    expect(await conversationsRepository.recoverIndex(badExecutor)).toBe(0);
  });
});

describe("embedded __meta header preserves identity across an index loss", () => {
  it("reconstruction with an embedded header restores agentId + title", async () => {
    seedTranscript("conv-u1-aaa", [
      msg("user", "texto crudo del primer mensaje", "2026-07-01T10:00:00.000Z"),
      msg("assistant", "respuesta", "2026-07-01T10:00:05.000Z"),
    ]);
    // The header carries the REAL identity — the raw first message is NOT the title.
    seedEmbedded("conv-u1-aaa", {
      agentId: "agent-42",
      provider: "claude",
      originProvider: "claude",
      projectId: "proj-9",
      title: "Título real del agente",
      createdAt: "2026-06-30T08:00:00.000Z",
    });

    const executor = makeExecutor(["conv-u1-aaa.json"]);
    expect(await conversationsRepository.recoverIndex(executor)).toBe(1);

    const { items } = await conversationsRepository.list(executor, { withAgent: true });
    expect(items).toHaveLength(1);
    const it0 = items[0]!;
    expect(it0.id).toBe("aaa");
    expect(it0.agentId).toBe("agent-42");
    expect(it0.title).toBe("Título real del agente");
    expect(it0.projectId).toBe("proj-9");
    expect(it0.createdAt).toBe("2026-06-30T08:00:00.000Z");
  });

  it("no embedded header but a matching team task → backfills agentId", async () => {
    seedTranscript("conv-u1-ccc", [msg("user", "trabajo delegado", "2026-07-01T10:00:00.000Z")]);
    // Board maps this worker conversation to its agent.
    seedTeamTask("task-1", {
      leaderConversationId: "leader-conv",
      leaderAgentId: "leader-agent",
      workerConversationId: "ccc",
      workerAgentId: "worker-agent-7",
      status: "done",
      createdAt: "2026-07-01T09:00:00.000Z",
    });

    const executor = makeExecutor(["conv-u1-ccc.json"]);
    expect(await conversationsRepository.recoverIndex(executor)).toBe(1);

    const { items } = await conversationsRepository.list(executor, { withAgent: true });
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get("ccc")!.agentId).toBe("worker-agent-7");
  });

  it("no header and no team task → agentId stays null (loose chat)", async () => {
    seedTranscript("conv-u1-loose", [msg("user", "chat suelto", "2026-07-01T10:00:00.000Z")]);
    const executor = makeExecutor(["conv-u1-loose.json"]);
    expect(await conversationsRepository.recoverIndex(executor)).toBe(1);
    const { items } = await conversationsRepository.list(executor);
    expect(items[0]!.agentId ?? null).toBeNull();
  });

  it("message readers ignore the reserved __meta doc", async () => {
    seedTranscript("conv-u1-ddd", [
      msg("user", "pregunta", "2026-07-01T10:00:00.000Z"),
      msg("assistant", "respuesta", "2026-07-01T10:00:05.000Z"),
    ]);
    seedEmbedded("conv-u1-ddd", { agentId: "agent-x", provider: "claude", title: "T" });

    const executor = makeExecutor(["conv-u1-ddd.json"]);
    const all = await conversationsRepository.allMessages(executor, "ddd");
    expect(all).toHaveLength(2);
    expect(all.every((m) => m.role === "user" || m.role === "assistant")).toBe(true);
    const page = await conversationsRepository.messages(executor, "ddd", { limit: 10 });
    expect(page.total).toBe(2);
    expect(page.items.map((m) => m.content)).toEqual(["pregunta", "respuesta"]);
  });

  it("create() seeds the embedded header from the new conversation's identity", async () => {
    const executor = makeExecutor([]);
    const meta = await conversationsRepository.create(executor, "claude", "Hola mundo", "proj-1", "agent-99");
    const embedded = col("assistant", `conv-u1-${meta.id}`).get("__meta");
    expect(embedded).toBeTruthy();
    expect(embedded!.agentId).toBe("agent-99");
    expect(embedded!.projectId).toBe("proj-1");
    expect(embedded!.provider).toBe("claude");
  });

  it("appendMessages keeps the embedded header in sync in the same write", async () => {
    // A chat whose index meta carries the agent binding but whose sidecar has no
    // header yet (pre-migration chat). The first append must seed it.
    seedMeta("conversations-u1", "eee", {
      title: "Nueva conversación",
      provider: "claude",
      agentId: "agent-sync",
      projectId: "proj-sync",
      messageCount: 0,
      preview: "",
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    seedTranscript("conv-u1-eee", []);

    const executor = makeExecutor([]);
    await conversationsRepository.appendMessages(executor, "eee", [
      msg("user", "Primer turno del usuario", "2026-07-01T10:00:00.000Z"),
      msg("assistant", "ok", "2026-07-01T10:00:03.000Z"),
    ]);

    const embedded = col("assistant", "conv-u1-eee").get("__meta");
    expect(embedded).toBeTruthy();
    expect(embedded!.agentId).toBe("agent-sync");
    // The placeholder title must NOT be persisted — the derived title is used.
    expect(embedded!.title).toBe("Primer turno del usuario");
    // The transcript still holds exactly the two real messages.
    const doc = col("assistant", "conv-u1-eee").get("messages") as { messages: unknown[] };
    expect(doc.messages).toHaveLength(2);
  });
});

describe("list() agentId filter + real offset/limit paging", () => {
  // Seed 3 chats for agent-A, 2 for agent-B, and 2 loose (no agent). The
  // executor has no transcript files, so reconstruction mints nothing and the
  // list reflects exactly the seeded index.
  function seedMix() {
    const mk = (id: string, agentId: string | null, ts: string) =>
      seedMeta("conversations-u1", id, {
        title: id,
        provider: "claude",
        agentId,
        projectId: null,
        messageCount: 1,
        preview: "",
        createdAt: ts,
        updatedAt: ts,
      });
    mk("a1", "agent-A", "2026-07-01T10:00:00.000Z");
    mk("a2", "agent-A", "2026-07-01T10:01:00.000Z");
    mk("a3", "agent-A", "2026-07-01T10:02:00.000Z");
    mk("b1", "agent-B", "2026-07-01T10:03:00.000Z");
    mk("b2", "agent-B", "2026-07-01T10:04:00.000Z");
    mk("l1", null, "2026-07-01T10:05:00.000Z");
    mk("l2", null, "2026-07-01T10:06:00.000Z");
  }

  it("agentId=<id> returns only that agent's chats with the full filtered total", async () => {
    seedMix();
    const executor = makeExecutor([]);
    const { items, total } = await conversationsRepository.list(executor, { agentId: "agent-A" });
    expect(total).toBe(3);
    expect(items).toHaveLength(3);
    expect(items.every((c) => c.agentId === "agent-A")).toBe(true);
  });

  it('agentId="none" (null) returns only loose chats (no agent bound)', async () => {
    seedMix();
    const executor = makeExecutor([]);
    const { items, total } = await conversationsRepository.list(executor, { agentId: null });
    expect(total).toBe(2);
    expect(items.every((c) => (c.agentId ?? null) === null)).toBe(true);
    expect(items.map((c) => c.title).sort()).toEqual(["l1", "l2"]);
  });

  it("offset/limit apply AFTER the filter; total is the pre-paging filtered count", async () => {
    seedMix();
    const executor = makeExecutor([]);
    const page1 = await conversationsRepository.list(executor, { agentId: "agent-A", limit: 2, offset: 0 });
    expect(page1.total).toBe(3);
    expect(page1.items).toHaveLength(2);
    const page2 = await conversationsRepository.list(executor, { agentId: "agent-A", limit: 2, offset: 2 });
    expect(page2.total).toBe(3);
    expect(page2.items).toHaveLength(1);
    // No overlap between pages: offset truly advances the window.
    const ids1 = page1.items.map((c) => c.id);
    const ids2 = page2.items.map((c) => c.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it("offset can traverse the WHOLE set — no global 200 ceiling on the total", async () => {
    // 250 loose chats; total must report all 250 and a high offset must reach
    // the tail even though a single page is clamped to <=200.
    for (let i = 0; i < 250; i += 1) {
      const n = String(i).padStart(3, "0");
      seedMeta("conversations-u1", `c${n}`, {
        title: `c${n}`,
        provider: "claude",
        agentId: null,
        projectId: null,
        messageCount: 1,
        preview: "",
        createdAt: `2026-07-01T00:00:00.000Z`,
        updatedAt: `2026-07-01T00:00:00.000Z`,
      });
    }
    const executor = makeExecutor([]);
    const tail = await conversationsRepository.list(executor, { limit: 100, offset: 200 });
    expect(tail.total).toBe(250);
    expect(tail.items).toHaveLength(50); // 250 - 200
  });

  it("no new params → identical shape/behavior (backward compatible)", async () => {
    seedMix();
    const executor = makeExecutor([]);
    const { items, total } = await conversationsRepository.list(executor);
    // All 7 chats returned (default limit 50 > 7), total = full count, agentId
    // filter is inert when the option is absent.
    expect(total).toBe(7);
    expect(items).toHaveLength(7);
  });
});

describe("search across historical conversation messages", () => {
  it("finds an old user turn and an assistant translation, then refreshes a changed transcript", async () => {
    const executor = makeExecutor([], "full-text-history-unique");
    const timestamp = "2026-07-01T10:00:00.000Z";
    seedMeta("conversations-u1", "historical", {
      title: "Consulta general", provider: "claude", messageCount: 3,
      preview: "Respuesta más reciente", createdAt: timestamp, updatedAt: timestamp,
    });
    seedTranscript("conv-u1-historical", [
      msg("user", "Necesito revisar la facturación de marzo", timestamp),
      { ...msg("assistant", "The invoice is ready", timestamp), textTranslated: "La factura está lista" },
      msg("assistant", "Respuesta más reciente", timestamp),
    ]);

    const oldTurn = await conversationsRepository.list(executor, { q: "FACTURACION", limit: 1 });
    expect(oldTurn.total).toBe(1);
    expect(oldTurn.items[0]?.searchMatch).toMatchObject({ role: "user", messageIndex: 0 });
    expect(oldTurn.items[0]?.searchMatch?.snippet).toContain("facturación de marzo");
    const readsAfterIndex = calls.get;

    const translation = await conversationsRepository.list(executor, { q: "factura está" });
    expect(translation.items[0]?.searchMatch).toMatchObject({ role: "assistant", messageIndex: 1 });
    expect(calls.get).toBe(readsAfterIndex); // subsequent queries reuse the sidecar index

    seedTranscript("conv-u1-historical", [msg("user", "Nuevo contenido especial", timestamp)]);
    seedMeta("conversations-u1", "historical", {
      title: "Consulta general", provider: "claude", messageCount: 1,
      preview: "Otro resumen", createdAt: timestamp, updatedAt: "2026-07-01T11:00:00.000Z",
    });
    const changed = await conversationsRepository.list(executor, { q: "especial" });
    expect(changed.total).toBe(1);
    expect(changed.items[0]?.searchMatch?.snippet).toContain("Nuevo contenido especial");
    expect(calls.get).toBeGreaterThan(readsAfterIndex);
    expect((await conversationsRepository.list(executor, { q: "facturación" })).total).toBe(0);
  });

  it("keeps metadata searches cheap and only reads transcript sidecars on a content search", async () => {
    const executor = makeExecutor([], "full-text-metadata-unique");
    const timestamp = "2026-07-01T10:00:00.000Z";
    seedMeta("conversations-u1", "named", {
      title: "Diseño del panel", provider: "claude", messageCount: 1,
      preview: "Un resumen", createdAt: timestamp, updatedAt: timestamp,
    });
    seedTranscript("conv-u1-named", [msg("user", "Contenido interno", timestamp)]);
    expect((await conversationsRepository.list(executor)).total).toBe(1);
    expect((await conversationsRepository.list(executor, { q: "DISEÑO" })).total).toBe(1);
    expect(calls.get).toBe(0);
    expect((await conversationsRepository.list(executor, { q: "interno" })).total).toBe(1);
    expect(calls.get).toBeGreaterThan(0);
  });
});

// Every store call below is an SSH/SFTP round-trip against the target in
// production. These lock the two fixes that took `GET /api/ai/conversations`
// from a p95 of ~3.7 s (peaks of 13–35 s) back down to the p50: the listing must
// not pay for self-healing, and self-healing must not be O(candidates) in hops.
describe("list()/reconcileOrphans stay off the SSH critical path", () => {
  it("reconcileOrphans reads each index ONCE — no get() per candidate (N+1)", async () => {
    // Steady state: every CLI session already has an index entry, so there is
    // nothing to heal. The old code still paid 2 get()s per id to find that out.
    const ids: string[] = [];
    for (let i = 0; i < 30; i++) {
      const id = `known-${i}`;
      ids.push(id);
      seedMeta("conversations-u1", id, {
        title: `c${i}`,
        provider: "claude",
        messageCount: 1,
        preview: "p",
        updatedAt: `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`,
      });
    }
    const executor = makeExecutor([]);
    calls.get = 0;
    calls.list = 0;

    const created = await conversationsRepository.reconcileOrphans(executor, ids);

    expect(created).toBe(0);
    expect(calls.get).toBe(0); // was 60 (2 per candidate)
    expect(calls.list).toBe(2); // own index + legacy shared index, once each
  });

  it("mints orphans in ONE transactional write, not a set() per orphan", async () => {
    seedTranscript("conv-u1-orphanA", [msg("user", "hola", "2026-01-01T00:00:00.000Z")]);
    seedTranscript("conv-u1-orphanB", [msg("user", "adios", "2026-01-02T00:00:00.000Z")]);
    const executor = makeExecutor([]);
    calls.set = 0;
    calls.transaction = 0;

    const created = await conversationsRepository.reconcileOrphans(
      executor,
      ["orphanA", "orphanB", "ghost"], // `ghost` has no transcript → skipped
    );

    expect(created).toBe(2);
    expect(calls.transaction).toBe(1);
    expect(calls.set).toBe(0);
    // And they really landed in the index the list reads from.
    const { items } = await conversationsRepository.list(executor);
    expect(items.map((c) => c.id).sort()).toEqual(["orphanA", "orphanB"]);
  });

  it("a NON-empty index is served immediately; reconstruction heals in background", async () => {
    // `known` is indexed; `lost` only exists as a transcript on disk. The old
    // code awaited the readdir + transcript reads BEFORE answering.
    seedMeta("conversations-u1", "known", {
      title: "known",
      provider: "claude",
      messageCount: 1,
      preview: "p",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    seedTranscript("conv-u1-known", [msg("user", "hi", "2026-01-01T00:00:00.000Z")]);
    seedTranscript("conv-u1-lost", [msg("user", "lost chat", "2026-01-02T00:00:00.000Z")]);
    const executor = makeExecutor(["conv-u1-known.json", "conv-u1-lost.json"], "perf-bg");

    // First load: answered straight from the index — `lost` is NOT waited for.
    const first = await conversationsRepository.list(executor);
    expect(first.items.map((c) => c.id)).toEqual(["known"]);

    // The background pass persists it, so the next load (same executor, still
    // inside the reconstruction cooldown → no extra readdir) already has it.
    await flushBackground();
    const second = await conversationsRepository.list(executor);
    expect(second.items.map((c) => c.id).sort()).toEqual(["known", "lost"]);
  });

  it("an EMPTY index still heals SYNCHRONOUSLY — the corruption case can't wait", async () => {
    seedTranscript("conv-u1-only", [msg("user", "sobreviví", "2026-01-01T00:00:00.000Z")]);
    const executor = makeExecutor(["conv-u1-only.json"], "perf-empty");

    // Nothing to show otherwise, so this one path DOES block — and must return
    // the recovered chat on the very first call.
    const { items, total } = await conversationsRepository.list(executor);
    expect(total).toBe(1);
    expect(items[0]?.id).toBe("only");
  });

  it("a steady-state list() costs TWO index reads and zero per-id reads", async () => {
    // The budget of the endpoint the app opens on. Both reads are the two
    // indexes (own + legacy shared) and they go out in parallel; everything
    // after them is in-memory filtering. Anything that adds a get() here is a
    // per-conversation SSH round-trip and puts the seconds back.
    for (let i = 0; i < 40; i++) {
      seedMeta("conversations-u1", `c-${i}`, {
        title: `c${i}`,
        provider: "claude",
        messageCount: 1,
        preview: "p",
        updatedAt: `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`,
      });
    }
    const executor = makeExecutor([], "perf-budget");
    calls.get = 0;
    calls.list = 0;

    const { total } = await conversationsRepository.list(executor, { limit: 15, withAgent: false });

    expect(total).toBe(40);
    expect(calls.list).toBe(2);
    expect(calls.get).toBe(0);
  });

  it("listIds() sees EVERY chat — list()'s 200 clamp hid live runs on older ones", async () => {
    // `GET /api/ai/agent/active` intersects the run registry with the chats this
    // user owns. It asked list() for 1000, but list() clamps to 200, so a run on
    // the 201st-newest chat was reported as "not mine" and its in-progress state
    // silently vanished from the UI.
    for (let i = 0; i < 250; i++) {
      seedMeta("conversations-u1", `c-${i}`, {
        title: `c${i}`,
        provider: "claude",
        messageCount: 1,
        preview: "p",
        updatedAt: `2026-01-01T00:00:00.${String(i).padStart(3, "0")}Z`,
      });
    }
    const executor = makeExecutor([], "perf-ids");

    const paged = await conversationsRepository.list(executor, { limit: 1000 });
    expect(paged.items).toHaveLength(200); // the clamp that caused the bug

    calls.get = 0;
    calls.list = 0;
    const ids = await conversationsRepository.listIds(executor);

    expect(ids.size).toBe(250);
    expect(ids.has("c-0")).toBe(true); // the oldest — dropped by the clamped list
    expect(calls.list).toBe(2); // same two index reads, no extra cost
    expect(calls.get).toBe(0);
  });
});

describe("conversation history and options isolation", () => {
  it("does not write normalized read snapshots back over a new approval", async () => {
    const ex = makeExecutor([]);
    const c = await conversationsRepository.create(ex, "codex", "test");
    const original = { role: "assistant", provider: "claude", cli: true, content: "$ claude -p\nReading additional input from stdin...\n● Claude Code\nPlan pendiente.\n", ts: "2026-10-14T00:00:00Z" };
    seedTranscript(`conv-u1-${c.id}`, [original]);
    const before = calls.set;
    const result = await conversationsRepository.allMessages(ex, c.id!);
    expect(result[0]?.content).toBe("Plan pendiente.");
    expect(calls.set).toBe(before); // GET must never write a stale transcript.
    await conversationsRepository.appendMessages(ex, c.id!, [{ role: "user", content: "Aprobar plan", ts: "2026-10-14T00:01:00Z" }]);
    await conversationsRepository.allMessages(ex, c.id!);
    expect((await conversationsRepository.allMessages(ex, c.id!)).at(-1)?.content).toBe("Aprobar plan");
  });

  it("rejects a compaction snapshot when another message was appended", async () => {
    const ex = makeExecutor([]), c = await conversationsRepository.create(ex, "codex");
    await conversationsRepository.appendMessages(ex, c.id!, [msg("user", "plan", "1")]);
    const snapshot = await conversationsRepository.allMessages(ex, c.id!);
    await conversationsRepository.appendMessages(ex, c.id!, [msg("user", "Aprobar plan", "2")]);
    await expect(conversationsRepository.replaceMessages(ex, c.id!, [msg("assistant", "summary", "3")], snapshot)).rejects.toThrow("changed during compaction");
    expect(await conversationsRepository.allMessages(ex, c.id!)).toHaveLength(2);
  });

  it("persists each chat's options without altering another chat or its project", async () => {
    const ex = makeExecutor([]);
    const a = await conversationsRepository.create(ex, "codex", "A", "project-a", null, { model: "model-a", effort: "high", approvalMode: "plan" });
    const b = await conversationsRepository.create(ex, "claude", "B", null, null, { model: "model-b", approvalMode: "manual" });
    await conversationsRepository.patchMeta(ex, a.id!, { approvalMode: "auto", effort: "", model: "" });
    expect(await conversationsRepository.getMeta(ex, a.id!)).toMatchObject({ projectId: "project-a", model: "", effort: "", approvalMode: "auto" });
    expect(await conversationsRepository.getMeta(ex, b.id!)).toMatchObject({ projectId: null, model: "model-b", approvalMode: "manual" });
    await conversationsRepository.patchRuntime(ex, b.id!, { provider: "codex" });
    expect((await conversationsRepository.getMeta(ex, b.id!))?.provider).toBe("claude");
    expect(col("assistant", `conv-u1-${a.id}`).get("__meta")).toMatchObject({ approvalMode: "auto", effort: "", model: "" });
  });
});
