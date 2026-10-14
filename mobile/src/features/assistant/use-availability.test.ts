import { expect, it } from "vitest";
import { assistantAvailabilityReason } from "./availability-reason";
import type { ServerMetricsState } from "../app/viewModels";

it("mantiene disponible el chat directo aunque falle el sondeo legado del portal", () => {
  const failed: ServerMetricsState = { status: "error" };
  expect(assistantAvailabilityReason(failed, true)).toBeNull();
  expect(assistantAvailabilityReason(failed, false)).toBe("generic");
});
