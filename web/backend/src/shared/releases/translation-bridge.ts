// SPDX-License-Identifier: AGPL-3.0-only
import type { Executor } from "../executor/index.js";
import type { SessionUser } from "../types/index.js";

export interface ReleaseTranslationInput {
  executor: Executor;
  user: SessionUser;
  locale: string;
  texts: string[];
}
export interface ReleaseTranslation {
  status: "translated" | "original" | "unavailable";
  texts: string[];
}
let translate: ((input: ReleaseTranslationInput) => Promise<ReleaseTranslation>) | undefined;
export const releaseTranslationBridge = {
  register(adapter: NonNullable<typeof translate>) { translate = adapter; },
  async translate(input: ReleaseTranslationInput): Promise<ReleaseTranslation> {
    if (!translate) return { status: "unavailable", texts: input.texts };
    try { return await translate(input); }
    catch { return { status: "unavailable", texts: input.texts }; }
  },
};
