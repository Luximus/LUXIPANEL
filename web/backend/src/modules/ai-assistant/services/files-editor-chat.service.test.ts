// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AssistantConfig } from "../models/assistant-config.types.js";
import type { EditorChatRequest } from "../models/files-editor-chat.types.js";

// Mock the provider completion helper BEFORE importing the service under test.
const { aiCompleteMock } = vi.hoisted(() => ({ aiCompleteMock: vi.fn() }));
vi.mock("./translation/ai-translator.js", () => ({
  aiComplete: aiCompleteMock,
}));

import { filesEditorChatService, parseModelReply, MAX_CONTENT_BYTES } from "./files-editor-chat.service.js";
import { TranslationError } from "./translation/translation.types.js";
import { ServiceUnavailableError } from "../../../shared/errors/index.js";

const config = { activeProvider: "claude", enabled: true } as unknown as AssistantConfig;

function baseReq(overrides: Partial<EditorChatRequest> = {}): EditorChatRequest {
  return {
    path: "/etc/nginx/nginx.conf",
    content: "line1\nline2\nline3\n",
    language: "nginx",
    prompt: "cambia line2 por hola",
    ...overrides,
  };
}

function reply(text: string): void {
  aiCompleteMock.mockResolvedValue({ text, inputTokens: 10, outputTokens: 5 });
}

beforeEach(() => {
  aiCompleteMock.mockReset();
});

describe("filesEditorChatService.chat — model output parsing", () => {
  it("reply-only: question without a change returns just reply (no edit)", async () => {
    reply(JSON.stringify({ reply: "Este archivo configura nginx." }));
    const res = await filesEditorChatService.chat(config, baseReq({ prompt: "¿qué hace este archivo?" }));
    expect(res.reply).toBe("Este archivo configura nginx.");
    expect(res.edit).toBeUndefined();
  });

  it("edit replaceAll: global change returns a replaceAll edit", async () => {
    reply(
      JSON.stringify({
        reply: "Reescribí el archivo completo.",
        edit: { mode: "replaceAll", content: "nuevo contenido total\n" },
      }),
    );
    const res = await filesEditorChatService.chat(config, baseReq());
    expect(res.reply).toBe("Reescribí el archivo completo.");
    expect(res.edit).toEqual({ mode: "replaceAll", content: "nuevo contenido total\n" });
  });

  it("edit replaceRange: local change with selection returns a replaceRange edit", async () => {
    reply(
      JSON.stringify({
        reply: "Cambié la línea seleccionada.",
        edit: {
          mode: "replaceRange",
          range: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 6 },
          content: "hola",
        },
      }),
    );
    const res = await filesEditorChatService.chat(
      config,
      baseReq({
        selection: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 6, text: "line2" },
      }),
    );
    expect(res.edit).toEqual({
      mode: "replaceRange",
      range: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 6 },
      content: "hola",
    });
  });

  it("tolerates JSON wrapped in markdown fences + surrounding prose", async () => {
    reply('Claro:\n```json\n{ "reply": "listo", "edit": { "mode": "replaceAll", "content": "x" } }\n```\n');
    const res = await filesEditorChatService.chat(config, baseReq());
    expect(res.reply).toBe("listo");
    expect(res.edit).toEqual({ mode: "replaceAll", content: "x" });
  });

  it("invalid JSON: degrades to a reply-only answer with the raw text", async () => {
    reply("No es JSON, solo texto suelto del modelo.");
    const res = await filesEditorChatService.chat(config, baseReq());
    expect(res.reply).toBe("No es JSON, solo texto suelto del modelo.");
    expect(res.edit).toBeUndefined();
  });

  it("valid JSON but wrong edit shape: keeps reply, drops the edit", async () => {
    reply(JSON.stringify({ reply: "intenté editar", edit: { mode: "bogus", foo: 1 } }));
    const res = await filesEditorChatService.chat(config, baseReq());
    expect(res.reply).toBe("intenté editar");
    expect(res.edit).toBeUndefined();
  });
});

describe("filesEditorChatService.chat — guards", () => {
  it("oversized buffer: drops any proposed edit and keeps reply only", async () => {
    reply(
      JSON.stringify({
        reply: "El archivo es muy grande.",
        edit: { mode: "replaceAll", content: "x" },
      }),
    );
    const big = "a".repeat(MAX_CONTENT_BYTES + 1_000);
    const res = await filesEditorChatService.chat(config, baseReq({ content: big }));
    expect(res.reply).toBe("El archivo es muy grande.");
    expect(res.edit).toBeUndefined();
  });

  it("provider without credentials (TranslationError) → ServiceUnavailableError", async () => {
    aiCompleteMock.mockRejectedValue(new TranslationError("ai", "sin API key"));
    await expect(filesEditorChatService.chat(config, baseReq())).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("parseModelReply", () => {
  it("drops edit when allowEdit is false", () => {
    const raw = JSON.stringify({ reply: "hola", edit: { mode: "replaceAll", content: "x" } });
    expect(parseModelReply(raw, { allowEdit: false })).toEqual({ reply: "hola" });
  });

  it("empty raw output falls back to a safe message", () => {
    expect(parseModelReply("   ", { allowEdit: true }).reply).toMatch(/no pude/i);
  });
});
