// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn(),
}));
vi.mock("/scripts/extracted/lib/api-client.js?v=20260506a", () => ({ api: mocked, resolveTargetScope: () => "local" }));
vi.mock("/scripts/extracted/lib/confirm.js?v=3", () => ({ openConfirm: async () => true }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  document.body.innerHTML = `
    <div id="monitor-session" data-user-name="ana"></div>
    <div id="monitor-settings-modal">
      <button data-monitor-settings-nav="table"></button>
      <button data-monitor-settings-nav="alerts"></button>
      <section data-monitor-settings-panel="table"></section>
      <section id="monitor-settings-alerts" data-monitor-settings-panel="alerts" class="hidden">
        <form id="monitor-alert-form">
          <input id="monitor-alert-id" value=""><input id="monitor-alert-name" value="CPU elevada">
          <select id="monitor-alert-metric"><option value="cpu_usage_percent">CPU</option></select>
          <select id="monitor-alert-operator"><option value="gt">Mayor</option></select>
          <input id="monitor-alert-threshold" value="90"><input id="monitor-alert-samples" value="3">
          <button id="monitor-alert-submit" type="submit">Crear regla</button>
          <button id="monitor-alert-cancel" class="hidden" type="button"></button>
        </form>
        <p id="monitor-alert-status"></p><div id="monitor-alert-rules"></div><div id="monitor-alert-events"></div>
      </section>
    </div>`;
  mocked.get.mockImplementation(async (url: string) => ({ ok: true, data: url.includes("/events") ? [] : [{
    id: 1, name: "CPU elevada", metric: "cpu_usage_percent", operator: "gt", threshold: 90,
    sustainedSamples: 3, enabled: true, mutedUntil: null, firing: false,
  }] }));
  mocked.put.mockResolvedValue({ ok: true, data: {} });
  mocked.post.mockResolvedValue({ ok: true, data: {} });
});

it("publishes rules while the event history is still pending and ignores a replaced drawer", async () => {
  let finishEvents!: (value: any) => void;
  const events = new Promise(resolve => { finishEvents = resolve; });
  mocked.get.mockImplementation((url: string) => url.includes("/events") ? events : Promise.resolve({ ok: true, data: [{
    id: 1, name: "CPU elevada", metric: "cpu_usage_percent", operator: "gt", threshold: 90,
    sustainedSamples: 3, enabled: true, mutedUntil: null, firing: false,
  }] }));
  await import("./settings");
  (document.querySelector('[data-monitor-settings-nav="alerts"]') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(document.getElementById("monitor-alert-rules")?.textContent).toContain("CPU elevada"));
  document.getElementById("monitor-settings-modal")!.outerHTML = '<div id="monitor-settings-modal"><div id="monitor-alert-events">new drawer</div></div>';
  finishEvents({ ok: true, data: [{ ruleId: 1, triggeredAt: new Date().toISOString(), value: 99 }] });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.getElementById("monitor-alert-events")!.textContent).toBe("new drawer");
});

it("opens alert management and mutes the selected rule for an hour", async () => {
  await import("./settings");
  (document.querySelector('[data-monitor-settings-nav="alerts"]') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(document.getElementById("monitor-alert-rules")?.textContent).toContain("CPU elevada"));
  const mute = [...document.querySelectorAll<HTMLButtonElement>("#monitor-alert-rules button")]
    .find((button) => button.textContent === "Silenciar 1 h");
  mute?.click();
  await vi.waitFor(() => expect(mocked.put).toHaveBeenCalled());
  expect(mocked.put.mock.calls[0]?.[0]).toBe("/api/monitor/alerts/rules/1");
  expect(Date.parse(mocked.put.mock.calls[0]?.[1].mutedUntil)).toBeGreaterThan(Date.now());
});
