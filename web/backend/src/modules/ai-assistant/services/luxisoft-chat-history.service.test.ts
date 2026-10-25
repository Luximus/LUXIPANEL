// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { text: string; values?: unknown[] }[],
  projectFound: true,
  readRows: [{ role: "user", content: "Cambiar el drawer", created_at: new Date("2026-10-25T12:00:00Z") }],
}));

vi.mock("node:fs/promises", () => ({ readFile: vi.fn(async () => "DATABASE_URL=postgresql://reader:secret@127.0.0.1:5432/luxisoft") }));
vi.mock("dotenv", () => ({ default: { parse: () => ({ DATABASE_URL: "postgresql://reader:secret@127.0.0.1:5432/luxisoft" }) } }));
vi.mock("../../../config/env.js", () => ({ env: { LUXISOFT_CHAT_DATABASE_ENV_FILE: "/var/www/luxisoft/backend/.env" } }));
vi.mock("pg", () => ({
  Pool: class {
    async connect() {
      return {
        query: async (text: string, values?: unknown[]) => {
          state.queries.push({ text, values });
          if (text.includes("FROM account_projects ap")) {
            return { rows: state.projectFound ? [{ project_id: "0f8551ae-3b16-4b44-ad2c-64b5d802ed4d", user_id: "user-uuid", project_name: "LuxiSoft" }] : [] };
          }
          if (text.includes("FROM store_assistant_conversations c")) {
            return { rows: [{ id: "11111111-1111-4111-8111-111111111111", title: "Drawer", last_message_at: new Date(), message_count: 2, preview: "Cambiar el drawer" }] };
          }
          if (text.includes("FROM store_assistant_messages m")) return { rows: state.readRows, rowCount: state.readRows.length };
          return { rows: [] };
        },
        release: vi.fn(),
      };
    }
  },
}));

describe("Luxisoft local chat history", () => {
  beforeEach(() => {
    vi.resetModules();
    state.queries = [];
    state.projectFound = true;
    state.readRows = [{ role: "user", content: "Cambiar el drawer", created_at: new Date("2026-10-25T12:00:00Z") }];
  });

  it("exposes tools only for the local Luxisoft workspace", async () => {
    const { isLuxisoftWorkspacePath, buildLuxisoftChatTools } = await import("./luxisoft-chat-history.service.js");
    expect(isLuxisoftWorkspacePath("/var/www/luxisoft")).toBe(true);
    expect(isLuxisoftWorkspacePath("/var/www/LUXIPANEL")).toBe(false);
    expect(buildLuxisoftChatTools({ projectPath: "/var/www/luxisoft", projectOwnerId: 1, userId: 1 }).length).toBe(2);
    expect(buildLuxisoftChatTools({ projectPath: "/var/www/LUXIPANEL", projectOwnerId: 1, userId: 1 })).toEqual([]);
    expect(buildLuxisoftChatTools({ projectPath: "/var/www/luxisoft", projectOwnerId: 1, userId: 2 })).toEqual([]);
    expect(buildLuxisoftChatTools({ projectPath: "/var/www/luxisoft" })).toEqual([]);
    expect(buildLuxisoftChatTools({ projectPath: "/var/www/luxisoft", projectOwnerId: 1, userId: 1 }).map(tool => tool.name)).toEqual([
      "luxisoft.chats.list", "luxisoft.chats.read",
    ]);
  });

  it("lists only a project owned by the supplied account and does the lookup read-only", async () => {
    const { buildLuxisoftChatTools } = await import("./luxisoft-chat-history.service.js");
    const tool = buildLuxisoftChatTools({ projectPath: "/var/www/luxisoft", projectOwnerId: 1, userId: 1 })[0]!;
    const result = await tool.handler({
      projectUrl: "https://luxisoft.com/es/plataforma?id=11346187-1792855213-43224&env=test&chat=project&project=0f8551ae-3b16-4b44-ad2c-64b5d802ed4d",
      ownerEmail: "owner@example.com", limit: 10,
    });
    expect(result).toMatchObject({ ok: true, output: { project: "LuxiSoft", chats: [{ title: "Drawer" }] } });
    expect(state.queries[0]?.text).toBe("BEGIN READ ONLY");
    expect(state.queries.some(q => /\b(INSERT|UPDATE|DELETE)\b/i.test(q.text))).toBe(false);
  });

  it("rejects non-Luxisoft URLs and projects not owned by the requested user", async () => {
    const { buildLuxisoftChatTools } = await import("./luxisoft-chat-history.service.js");
    const tool = buildLuxisoftChatTools({ projectPath: "/var/www/luxisoft", projectOwnerId: 1, userId: 1 })[0]!;
    const base = { ownerEmail: "owner@example.com" };
    expect((await tool.handler({ ...base, projectUrl: "https://example.com/?project=0f8551ae-3b16-4b44-ad2c-64b5d802ed4d" })).ok).toBe(false);
    state.projectFound = false;
    expect((await tool.handler({ ...base, projectUrl: "https://luxisoft.com/?project=0f8551ae-3b16-4b44-ad2c-64b5d802ed4d" })).output).toBe("Ese proyecto no está asociado a ese usuario.");
  });

  it("reads only user and assistant messages for the exact project conversation", async () => {
    const { buildLuxisoftChatTools } = await import("./luxisoft-chat-history.service.js");
    const tool = buildLuxisoftChatTools({ projectPath: "/var/www/luxisoft", projectOwnerId: 1, userId: 1 })[1]!;
    state.readRows = [{ role: "user", content: "Cambiar el drawer", created_at: new Date("2026-10-25T12:00:00Z"), blocks: [{
      type: "attachments", items: [{ mediaObjectId: "22222222-2222-4222-8222-222222222222", filename: "referencia.png", contentType: "image/png", kind: "image", size: 500, objectKey: "private-secret-key" }],
    }] }];
    const result = await tool.handler({
      projectUrl: "https://luxisoft.com/?project=0f8551ae-3b16-4b44-ad2c-64b5d802ed4d",
      ownerEmail: "owner@example.com", conversationId: "11111111-1111-4111-8111-111111111111",
    });
    expect(result).toMatchObject({ ok: true, output: { messages: [{
      role: "user", content: "Cambiar el drawer",
      attachments: [{ mediaObjectId: "22222222-2222-4222-8222-222222222222", filename: "referencia.png", contentType: "image/png" }],
    }] } });
    expect(JSON.stringify(result.output)).not.toContain("private-secret-key");
    const read = state.queries.find(q => q.text.includes("FROM store_assistant_messages m"));
    expect(read?.values?.slice(0, 3)).toEqual(["11111111-1111-4111-8111-111111111111", "0f8551ae-3b16-4b44-ad2c-64b5d802ed4d", "user-uuid"]);
  });
});
