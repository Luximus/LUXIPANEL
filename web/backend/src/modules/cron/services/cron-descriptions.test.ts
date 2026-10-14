import { describe, expect, it } from "vitest";
import { API_LOCALES } from "../../../shared/i18n/errors.js";
import { describeCron, localizeCronValidationError, cronInvalidExpressionMessage } from "./cron-descriptions.js";

describe("localized cron descriptions", () => {
  it("keeps existing Spanish descriptions and translates common schedules", () => {
    expect(describeCron("@daily")).toBe("Todos los días a medianoche");
    expect(describeCron("*/15 2-5 * * *")).toBe("cada 15 minutos, de 02:00 a 05:59");
    expect(describeCron("0 3 * * 1-5")).toBe("Cada lunes a viernes a las 03:00");
    expect(describeCron("0 3 * * 1-5", "en")).toBe("Every Monday to Friday at 03:00");
    expect(describeCron("0 0 3 * * 1-5", "en")).toBe("Every Monday to Friday at 03:00");
    expect(describeCron("@daily", "ja")).toBe("毎日午前0時");
  });

  it("provides descriptions and field errors for all supported locales", () => {
    for (const locale of API_LOCALES) {
      const description = describeCron("*/5 * * * *", locale);
      expect(description.trim()).not.toBe("");
      expect(description).not.toMatch(/\{\w+\}/);
      const error = cronInvalidExpressionMessage('Campo "90" fuera de rango [0-59]', locale);
      expect(error).toContain("90");
      expect(error).not.toMatch(/\{\w+\}/);
    }
    expect(localizeCronValidationError("Se esperaban 5 o 6 campos", "en")).toBe("Expected 5 or 6 fields");
  });
});
