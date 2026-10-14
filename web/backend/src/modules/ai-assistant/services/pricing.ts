// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Estimated API pricing — the "ClaudeBar"-style cost model: token usage × a
 * per-model rate (USD per 1M tokens, separate input/output) → estimated USD.
 *
 * These are BEST-EFFORT public list-price ESTIMATES, kept as an editable table.
 * They answer "how much would this usage have cost on the metered API?" — useful
 * even when running through a CLI/subscription (where you pay a flat plan, not
 * per token), to show the equivalent metered cost. The UI labels it "estimado".
 *
 * Rates are matched by ORDERED rules per provider (first regex match wins),
 * falling back to a per-provider default for unknown/aliased model ids.
 */

interface ModelRate {
  /** USD per 1,000,000 input tokens. */
  inputPerM: number;
  /** USD per 1,000,000 output tokens. */
  outputPerM: number;
}

const RULES: Record<string, Array<{ re: RegExp; rate: ModelRate }>> = {
  claude: [
    { re: /fable-5-1/, rate: { inputPerM: 10, outputPerM: 50 } },
    { re: /opus-5-5/, rate: { inputPerM: 4, outputPerM: 20 } },
    { re: /sonnet-5/, rate: { inputPerM: 2, outputPerM: 10 } },
    { re: /haiku-4-5/, rate: { inputPerM: 1, outputPerM: 5 } },
    { re: /fable-5/, rate: { inputPerM: 5, outputPerM: 25 } },
    { re: /opus-4-[678]/, rate: { inputPerM: 2.5, outputPerM: 12.5 } },
  ],
  codex: [
    { re: /gpt-6-astra/, rate: { inputPerM: 10, outputPerM: 50 } },
    { re: /gpt-6-sol/, rate: { inputPerM: 2, outputPerM: 10 } },
    { re: /gpt-6-luna/, rate: { inputPerM: 0.1, outputPerM: 0.5 } },
    { re: /mini/, rate: { inputPerM: 0.25, outputPerM: 2 } },
    { re: /gpt-5/, rate: { inputPerM: 1.25, outputPerM: 10 } },
    { re: /gpt-4\.1/, rate: { inputPerM: 2, outputPerM: 8 } },
    { re: /gpt-4o/, rate: { inputPerM: 2.5, outputPerM: 10 } },
  ],
  gemini: [
    { re: /3\.5-flash-lite/, rate: { inputPerM: 0.3, outputPerM: 2.5 } },
    { re: /3\.1-pro-preview/, rate: { inputPerM: 2, outputPerM: 12 } },
    { re: /flash-lite/, rate: { inputPerM: 0.1, outputPerM: 0.4 } },
    { re: /flash/, rate: { inputPerM: 0.3, outputPerM: 2.5 } },
    { re: /pro/, rate: { inputPerM: 1.25, outputPerM: 10 } },
  ],
  deepseek: [
    // Conservative peak rates; off-peak and cache-hit discounts are omitted.
    { re: /deepseek-flash/, rate: { inputPerM: 0.3, outputPerM: 1.2 } },
    { re: /deepseek-v4-pro/, rate: { inputPerM: 1.32, outputPerM: 3.96 } },
    { re: /reasoner/, rate: { inputPerM: 0.55, outputPerM: 2.19 } },
    { re: /chat/, rate: { inputPerM: 0.27, outputPerM: 1.1 } },
  ],
  grok: [
    { re: /grok-4\.7/, rate: { inputPerM: 2, outputPerM: 6 } },
    { re: /fast|mini/, rate: { inputPerM: 0.3, outputPerM: 0.5 } },
    { re: /vision/, rate: { inputPerM: 2, outputPerM: 10 } },
    { re: /grok-4/, rate: { inputPerM: 3, outputPerM: 15 } },
    { re: /grok-3/, rate: { inputPerM: 3, outputPerM: 15 } },
  ],
  minimax: [
    // M3 rate for contexts up to 512K; longer contexts cost more.
    { re: /minimax-m3/, rate: { inputPerM: 0.3, outputPerM: 1.2 } },
    { re: /m2\.7-highspeed/, rate: { inputPerM: 0.6, outputPerM: 2.4 } },
    { re: /m2\.7/, rate: { inputPerM: 0.3, outputPerM: 1.2 } },
  ],
};

const DEFAULTS: Record<string, ModelRate> = {
  claude: { inputPerM: 3, outputPerM: 15 },
  codex: { inputPerM: 2, outputPerM: 8 },
  gemini: { inputPerM: 0.3, outputPerM: 2.5 },
  deepseek: { inputPerM: 0.27, outputPerM: 1.1 },
  grok: { inputPerM: 3, outputPerM: 15 },
  minimax: { inputPerM: 0.3, outputPerM: 1.2 },
};

const GLOBAL_DEFAULT: ModelRate = { inputPerM: 2, outputPerM: 8 };

/** Resolve the rate for a (provider, model). `known=false` when it fell back to
 *  a provider/global default (UI shows it as a rougher estimate). */
function rateFor(provider: string, model: string): { rate: ModelRate; known: boolean } {
  const p = (provider || "").split(":")[0]!.toLowerCase();
  const m = (model || "").toLowerCase().replace(/-cli$/, "").trim();
  // Introductory Google standard pricing expires at the end of 2026.
  if (p === "gemini" && /^gemini-3\.[78]-flash$/.test(m)) {
    return {
      rate: Date.now() < Date.UTC(2027, 0, 1)
        ? { inputPerM: 0.75, outputPerM: 3.75 }
        : { inputPerM: 1.5, outputPerM: 7.5 },
      known: true,
    };
  }
  for (const { re, rate } of RULES[p] ?? []) {
    if (re.test(m)) return { rate, known: true };
  }
  return { rate: DEFAULTS[p] ?? GLOBAL_DEFAULT, known: false };
}

interface CostEstimate {
  inputUsd: number;
  outputUsd: number;
  usd: number;
  rate: ModelRate;
  known: boolean;
}

/** Estimated metered-API cost (USD) for a token count on a given model. */
export function estimateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): CostEstimate {
  const { rate, known } = rateFor(provider, model);
  const inputUsd = (Math.max(0, inputTokens) / 1_000_000) * rate.inputPerM;
  const outputUsd = (Math.max(0, outputTokens) / 1_000_000) * rate.outputPerM;
  return { inputUsd, outputUsd, usd: inputUsd + outputUsd, rate, known };
}
