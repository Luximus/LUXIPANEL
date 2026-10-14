import { expect, it } from "vitest";
import { cliQuotaRows, hasCliQuotaWindow } from "./cli-usage-rows";

it("renders the available CLI quota window when the other one is null", () => {
  const quota = { provider: "codex", fiveHour: null, sevenDay: { utilization: 39, resetsAt: null } };
  expect(hasCliQuotaWindow(quota)).toBe(true);
  expect(cliQuotaRows(quota, { session: "Sesión 5h", week: "Semana" }, () => undefined))
    .toEqual([{ label: "Semana", pct: 39, detail: undefined }]);
});

it("recognizes when the provider returned no usable quota windows", () => {
  expect(hasCliQuotaWindow({ provider: "codex", fiveHour: null, sevenDay: null })).toBe(false);
});
