// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

process.env.JWT_SECRET ??= "x".repeat(40);
process.env.LICENSE_SERVER_URL ??= "http://127.0.0.1:3300";
const target = vi.hoisted(() => ({ name: "target-executor" }));
vi.mock("../../../shared/executor/index.js", () => ({ getExecutor: () => target }));
vi.mock("../repositories/assistant-config.repository.js", () => ({ assistantConfigRepository: { patch: vi.fn() } }));
const { assistantConfigController } = await import("./config.controller.js");
const { assistantConfigRepository } = await import("../repositories/assistant-config.repository.js");
const { defaultAssistantConfig } = await import("../models/assistant-config.types.js");
beforeEach(() => {
  vi.mocked(assistantConfigRepository.patch).mockReset().mockImplementation(async patch => ({ ...defaultAssistantConfig(), ...patch }));
});
async function invoke(body: unknown) {
  return new Promise<{ data?: any; error?: any }>((resolve) => {
    const res = { locals: { locale: "es" }, json: (data: unknown) => { resolve({ data }); } };
    assistantConfigController.patch({ body } as Request, res as Response, ((error: unknown) => resolve({ error })) as NextFunction);
  });
}
it.each(["", "low", "medium", "high", "xhigh", "max"])("accepts %s and writes to the connected target", async effort => {
  const result = await invoke({ defaultChatEffort: effort });
  expect(result.error).toBeUndefined();
  expect(result.data.config.defaultChatEffort).toBe(effort);
  expect(assistantConfigRepository.patch).toHaveBeenCalledWith({ defaultChatEffort: effort }, target);
});
it("accepts an explicit reset and rejects unsupported values without writing", async () => {
  expect((await invoke({ defaultChatEffort: null })).data.config.defaultChatEffort).toBe("");
  vi.mocked(assistantConfigRepository.patch).mockClear();
  expect((await invoke({ defaultChatEffort: "invalid" })).error?.statusCode).toBe(400);
  expect(assistantConfigRepository.patch).not.toHaveBeenCalled();
});
