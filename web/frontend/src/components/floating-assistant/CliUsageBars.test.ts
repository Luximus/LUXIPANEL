// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assistantStatsApi } from "./assistant-api";
import { CliUsageBars } from "./CliUsageBars";

// Quota assertions start after the independent primary-workspace startup gate.
vi.mock("@/lib/startup-state", () => ({
  afterPrimaryReady: (run: () => void) => { run(); return () => {}; },
}));
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));

vi.mock("./assistant-api", () => ({
  assistantStatsApi: {
    cliQuota: vi.fn(async () => ({
      provider: "codex", fiveHour: null,
      sevenDay: { utilization: 39, resetsAt: null },
      sevenDayOpus: null, sevenDaySonnet: null, source: "account",
    })),
    summary: vi.fn(),
    daily: vi.fn(async () => {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 86_400_000);
      return [
        { day: yesterday.toISOString().slice(0, 10), total: 80 },
        { day: today.toISOString().slice(0, 10), total: 20 },
      ];
    }),
  },
}));
vi.mock("./i18n", () => ({
  formatAssistantMessage: (value: string) => value,
  mergeNamespaces: (fallback: object, strings: object) => ({ ...fallback, ...strings }),
  useAssistantI18n: () => ({ cliUsageBars: {
    cliUsage: "Disponible CLI", session5h: "Sesión", week: "Semana", sourceReal: "cuota disponible",
  } }),
}));

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

it("shows remaining Codex weekly quota first and marks an unreported session as unavailable", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(CliUsageBars, { provider: "codex" })); });
  expect(host.textContent).toContain("Semana");
  expect(host.textContent).toContain("Disponible CLI");
  expect(host.textContent).toContain("61%");
  expect(host.querySelector<HTMLElement>('[style*="width: 61%"]')).not.toBeNull();
  expect(host.textContent).not.toContain("39%");
  expect(host.textContent).not.toContain("Sesión");

  await act(async () => { (host.querySelector("button") as HTMLButtonElement).click(); });
  expect(host.textContent).toContain("Sesión");
  expect(host.textContent).toContain("—");
  expect(host.textContent).not.toContain("0%");
  await act(async () => { root.unmount(); });
});

it("shows only daily and weekly CLI usage in the server KPI style", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(CliUsageBars, { provider: "codex", variant: "rail" })); });
  expect(host.querySelectorAll(".lxp-server-kpi")).toHaveLength(2);
  expect(host.querySelectorAll(".slosh-gauge")).toHaveLength(0);
  expect(host.querySelector(".ti-calendar-time")).not.toBeNull();
  expect(host.querySelector(".ti-calendar-week")).not.toBeNull();
  expect(host.textContent).toContain("Diario");
  expect(host.textContent).toContain("Semanal");
  expect(host.textContent).toContain("20%");
  expect(host.textContent).toContain("39%");
  expect(host.textContent).not.toContain("Uso CLI ·");
  expect(host.textContent).not.toContain("Sesión");
  expect(host.querySelectorAll(".lxp-server-section-heading")).toHaveLength(0);
  await act(async () => { root.unmount(); });
});

it("does not retry unavailable quotas, coalesces completion events and pauses in the background", async () => {
  vi.useFakeTimers();vi.mocked(assistantStatsApi.cliQuota).mockClear();
  vi.mocked(assistantStatsApi.cliQuota).mockResolvedValue(null);
  vi.mocked(assistantStatsApi.summary).mockResolvedValue({session:{count:0},weekly:{count:0}} as any);
  const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
  try {
    await act(async()=>{root.render(createElement(CliUsageBars,{provider:"codex"}));});
    expect(assistantStatsApi.cliQuota).toHaveBeenCalledTimes(1);
    await act(async()=>{await vi.advanceTimersByTimeAsync(25_000);});
    expect(assistantStatsApi.cliQuota).toHaveBeenCalledTimes(1);
    await act(async()=>{for(let i=0;i<10;i++)window.dispatchEvent(new Event("lxp:assistant:usage-updated"));await vi.advanceTimersByTimeAsync(2500);});
    expect(assistantStatsApi.cliQuota).toHaveBeenCalledTimes(2);
    expect(assistantStatsApi.cliQuota).toHaveBeenLastCalledWith("codex",true);
    vi.spyOn(document,"visibilityState","get").mockReturnValue("hidden");
    await act(async()=>{await vi.advanceTimersByTimeAsync(120_000);});
    expect(assistantStatsApi.cliQuota).toHaveBeenCalledTimes(2);
  }finally{await act(async()=>root.unmount());vi.restoreAllMocks();vi.useRealTimers();}
});
