// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { API_LOCALES } from "../../../shared/i18n/errors.js";
import { AI_JOBS_MESSAGE_KEYS, aiJobsMessage } from "./ai-jobs-i18n.js";

describe("scheduled AI job responses", () => {
  it("provides every message in every supported locale", () => {
    for (const locale of API_LOCALES) {
      for (const key of AI_JOBS_MESSAGE_KEYS) {
        expect(aiJobsMessage(locale, key).trim(), `${locale}.${key}`).not.toBe("");
      }
    }
    expect(aiJobsMessage("es", "jobNotFound")).toBe("Tarea programada del agente de IA no encontrada");
    expect(aiJobsMessage("en", "selfChain")).toBe("An agent cannot be chained to itself");
  });
});
