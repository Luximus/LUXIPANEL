// SPDX-License-Identifier: AGPL-3.0-only
import { createHash, randomUUID } from "node:crypto";
import { runWithExecutor } from "../../../shared/executor/index.js";
import { releaseTranslationBridge, type ReleaseTranslation } from "../../../shared/releases/translation-bridge.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { translateReleaseDocument } from "./release-translation-provider.js";

const cache = new Map<string, { until: number; value: ReleaseTranslation }>();
const pending = new Map<string, Promise<ReleaseTranslation>>();
const active = new Set<string>();
const recent = new Map<string, number[]>();

export function registerReleaseTranslator(): void {
  releaseTranslationBridge.register((input) => runWithExecutor(input.executor, async (): Promise<ReleaseTranslation> => {
    const original: ReleaseTranslation = { status: "original", texts: input.texts };
    if (input.locale === "en" || input.texts.every(text => !text.trim())) return original;
    // Per-user and target: never borrow another user's credentials or running request.
    const principal = JSON.stringify([input.executor.target.id, input.user.tenantId, input.user.direct, input.user.userId]);
    const config = await assistantConfigRepository.load(input.executor);
    // Changing credentials, enabled agents, mode or model must take effect now,
    // including when the previous agent returned a cached failure.
    const digest = createHash("sha256").update(JSON.stringify([input.locale, input.texts, config.enabled, config.defaultChatProvider, config.activeProvider, config.providers])).digest("hex");
    const key = `${principal}:${digest}`;
    const saved = cache.get(key);
    if (saved && saved.until > Date.now()) return saved.value;
    if (pending.has(key)) return pending.get(key)!;
    const starts = (recent.get(principal) || []).filter(time => time > Date.now() - 60000);
    if (active.has(principal) || pending.size >= 4 || starts.length >= 3) return { ...original, status: "unavailable" };
    if (recent.size >= 128 && !recent.has(principal)) recent.delete(recent.keys().next().value!);
    recent.set(principal, [...starts, Date.now()]); active.add(principal);
    const request = (async (): Promise<ReleaseTranslation> => {
      // Code markers are protected by the existing translation service. One no-tools
      // completion covers notes + comments; edited content gets a new cache digest.
      const marker = `LXP_${randomUUID().replaceAll("-", "")}_`;
      const markers = input.texts.map((_, index) => `\`${marker}${index}\``);
      const document = input.texts.map((text, index) => `${markers[index]}\n${text}`).join("\n\n");
      const result = await translateReleaseDocument(config, document, input.locale, input.executor, String(input.user.userId));
      if (!result.ok) return {
        ...original, status: "unavailable",
        ...(/insufficient[ _-]*(?:balance|credits)|credit balance.*too low/i.test(result.error || "") ? { reason: "insufficient_balance" as const } : {}),
      };
      const positions = markers.map(marker => result.text.indexOf(marker));
      if (positions.some((position, index) => position < 0 || (index > 0 && position <= positions[index - 1]!) || result.text.indexOf(markers[index]!, position + 1) !== -1)) return { ...original, status: "unavailable" };
      const texts = positions.map((position, index) => result.text.slice(position + markers[index]!.length, positions[index + 1] ?? result.text.length).trim());
      if (texts.some((text, index) => input.texts[index]!.trim() && !text)) return { ...original, status: "unavailable" };
      return { status: "translated", texts };
    })().catch((): ReleaseTranslation => ({ ...original, status: "unavailable" })).then(value => {
      if (cache.size >= 128) cache.delete(cache.keys().next().value!);
      cache.set(key, { until: Date.now() + (value.status === "translated" ? 86400000 : 60000), value });
      return value;
    }).finally(() => { pending.delete(key); active.delete(principal); });
    pending.set(key, request);
    return request;
  }, input.user.userId, input.user));
}
