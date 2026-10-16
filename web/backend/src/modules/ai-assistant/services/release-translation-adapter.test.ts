vi.mock("../../../shared/executor/index.js", async () => await import("../../../shared/executor/context.js"));
vi.mock("../../../config/env.js", () => ({ env: { LOG_LEVEL: "silent", NODE_ENV: "test", LUXIPANEL_CONFIG_DIR: "/tmp" } }));
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../repositories/assistant-config.repository.js", () => ({ assistantConfigRepository: { load: vi.fn() } }));
vi.mock("./release-translation-provider.js", () => ({ translateReleaseDocument: vi.fn() }));
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { translateReleaseDocument } from "./release-translation-provider.js";
import { registerReleaseTranslator } from "./release-translation-adapter.js";
import { releaseTranslationBridge } from "../../../shared/releases/translation-bridge.js";
import { getContextUserId, getContextExecutor } from "../../../shared/executor/index.js";
const executor = { target: { id: "server-one" } } as never;
const config = { enabled: true, providers: { codex: { api: { apiKey: "test-key" } } }, translation: { engine: "argos" } } as never;
let id = 10;
beforeEach(() => { vi.resetAllMocks(); registerReleaseTranslator(); id++; vi.mocked(assistantConfigRepository.load).mockResolvedValue(config); });
it("deduplicates requests, preserves code, caches by content and isolates target/user credentials", async () => {
  vi.mocked(translateReleaseDocument).mockImplementation(async (_config, text, _locale, _executor, userId) => {
    expect(_config).toBe(config); expect(userId).toBe(String(getContextUserId())); expect(getContextExecutor()).toBe(executor);
    return { ok: true, text: text.replace("Fixed", "Corregido").replace("Thanks", "Gracias") };
  });
  const input = { executor, user: { userId: id } as never, locale: "es", texts: ["Fixed `some-code()`", "Thanks"] };
  const [first, second] = await Promise.all([releaseTranslationBridge.translate(input), releaseTranslationBridge.translate(input)]);
  expect(first).toEqual({ status: "translated", texts: ["Corregido `some-code()`", "Gracias"] }); expect(second).toEqual(first);
  await releaseTranslationBridge.translate(input); expect(translateReleaseDocument).toHaveBeenCalledTimes(1);
  await releaseTranslationBridge.translate({ ...input, texts: ["Fixed new code"] });
  await releaseTranslationBridge.translate({ ...input, user: { userId: id + 1000 } as never });
  expect(assistantConfigRepository.load).toHaveBeenCalledTimes(5);
});
it("falls back to originals on failure, missing markers and missing credentials", async () => {
  const input = { executor, user: { userId: id } as never, locale: "fr", texts: ["Original"] };
  vi.mocked(translateReleaseDocument).mockResolvedValue({ ok: true, text: "Lost markers" });
  expect(await releaseTranslationBridge.translate(input)).toEqual({ status: "unavailable", texts: input.texts });
  vi.mocked(translateReleaseDocument).mockResolvedValue({ ok: false, text: "Another original" });
  expect(await releaseTranslationBridge.translate({ ...input, texts: ["Another original"] })).toEqual({ status: "unavailable", texts: ["Another original"] });
  expect(translateReleaseDocument).toHaveBeenCalledTimes(2);
});
it("keeps English releases in their original form without paid calls", async () => {
  expect(await releaseTranslationBridge.translate({ executor, user: { userId: id } as never, locale: "en", texts: ["Fixed"] })).toEqual({ status: "original", texts: ["Fixed"] });
  expect(assistantConfigRepository.load).not.toHaveBeenCalled();
});
it("reports insufficient provider balance without exposing the raw provider response", async () => {
  vi.mocked(translateReleaseDocument).mockResolvedValue({ ok: false, text: "Original", error: 'Provider 402: {"type":"insufficient_balance_error","request_id":"private-trace"}' });
  const result = await releaseTranslationBridge.translate({ executor, user: { userId: id } as never, locale: "es", texts: ["Original"] });
  expect(result).toEqual({ status: "unavailable", texts: ["Original"], reason: "insufficient_balance" });
  expect(JSON.stringify(result)).not.toContain("private-trace");
});

it("invalidates a failed translation when agent credentials change", async () => {
  const input = { executor, user: { userId: id } as never, locale: "es", texts: ["Fixed"] };
  vi.mocked(translateReleaseDocument).mockResolvedValue({ ok: false, text: "Fixed" });
  expect((await releaseTranslationBridge.translate(input)).status).toBe("unavailable");
  vi.mocked(assistantConfigRepository.load).mockResolvedValue({ ...config, activeProvider: "claude" } as never);
  vi.mocked(translateReleaseDocument).mockImplementation(async (_c, text) => ({ ok: true, text: text.replace("Fixed", "Corregido") }));
  expect((await releaseTranslationBridge.translate(input)).status).toBe("translated");
  expect(translateReleaseDocument).toHaveBeenCalledTimes(2);
});
