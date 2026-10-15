vi.mock("../../../shared/executor/index.js", async () => await import("../../../shared/executor/context.js"));
vi.mock("../../../config/env.js", () => ({ env: { LOG_LEVEL: "silent", NODE_ENV: "test", LUXIPANEL_CONFIG_DIR: "/tmp" } }));
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../repositories/assistant-config.repository.js", () => ({ assistantConfigRepository: { load: vi.fn() } }));
vi.mock("./translation.service.js", () => ({ translationService: { translateDetailed: vi.fn() } }));
vi.mock("./translation/ai-translator.js", () => ({ resolveEffectiveTranslationProvider: () => ({ providerId: "codex", model: "test" }) }));
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { translationService } from "./translation.service.js";
import { registerReleaseTranslator } from "./release-translation-adapter.js";
import { releaseTranslationBridge } from "../../../shared/releases/translation-bridge.js";
import { getContextUserId, getContextExecutor } from "../../../shared/executor/index.js";
const executor = { target: { id: "server-one" } } as never;
const config = { enabled: true, providers: { codex: { api: { apiKey: "test-key" } } }, translation: { engine: "argos" } } as never;
let id = 10;
beforeEach(() => { vi.resetAllMocks(); registerReleaseTranslator(); id++; vi.mocked(assistantConfigRepository.load).mockResolvedValue(config); });
it("deduplicates requests, preserves code, caches by content and isolates target/user credentials", async () => {
  vi.mocked(translationService.translateDetailed).mockImplementation(async (_config, text, _from, _to, usage) => {
    expect(_config.translation.engine).toBe("ai"); expect(usage?.userId).toBe(String(getContextUserId())); expect(getContextExecutor()).toBe(executor);
    return { ok: true, text: text.replace("Fixed", "Corregido").replace("Thanks", "Gracias") };
  });
  const input = { executor, user: { userId: id } as never, locale: "es", texts: ["Fixed `some-code()`", "Thanks"] };
  const [first, second] = await Promise.all([releaseTranslationBridge.translate(input), releaseTranslationBridge.translate(input)]);
  expect(first).toEqual({ status: "translated", texts: ["Corregido `some-code()`", "Gracias"] }); expect(second).toEqual(first);
  await releaseTranslationBridge.translate(input); expect(translationService.translateDetailed).toHaveBeenCalledTimes(1);
  await releaseTranslationBridge.translate({ ...input, texts: ["Fixed new code"] });
  await releaseTranslationBridge.translate({ ...input, user: { userId: id + 1000 } as never });
  expect(assistantConfigRepository.load).toHaveBeenCalledTimes(3);
});
it("falls back to originals on failure, missing markers and missing credentials", async () => {
  const input = { executor, user: { userId: id } as never, locale: "fr", texts: ["Original"] };
  vi.mocked(translationService.translateDetailed).mockResolvedValue({ ok: true, text: "Lost markers" });
  expect(await releaseTranslationBridge.translate(input)).toEqual({ status: "unavailable", texts: input.texts });
  vi.mocked(assistantConfigRepository.load).mockResolvedValue({ ...config, providers: {} } as never);
  expect(await releaseTranslationBridge.translate({ ...input, texts: ["Another original"] })).toEqual({ status: "unavailable", texts: ["Another original"] });
  expect(translationService.translateDetailed).toHaveBeenCalledTimes(1);
});
it("keeps English releases in their original form without paid calls", async () => {
  expect(await releaseTranslationBridge.translate({ executor, user: { userId: id } as never, locale: "en", texts: ["Fixed"] })).toEqual({ status: "original", texts: ["Fixed"] });
  expect(assistantConfigRepository.load).not.toHaveBeenCalled();
});
