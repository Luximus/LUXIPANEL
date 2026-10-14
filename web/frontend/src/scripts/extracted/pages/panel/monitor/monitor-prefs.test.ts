// @vitest-environment happy-dom
import { beforeEach, expect, it } from "vitest";
import { readMonitorPrefs, saveMonitorPrefs } from "./monitor-prefs";

beforeEach(() => {
  document.body.innerHTML = '<div id="monitor-session" data-user-name="ana"></div>';
  localStorage.clear();
  sessionStorage.clear();
});

it("keeps Monitor view preferences separate for each server and user", () => {
  sessionStorage.setItem("panel-active-target-scope", "server-a");
  saveMonitorPrefs({ range: "7d", processesRefreshSeconds: 0 });
  expect(readMonitorPrefs()).toMatchObject({ range: "7d", processesRefreshSeconds: 0 });
  sessionStorage.setItem("panel-active-target-scope", "server-b");
  expect(readMonitorPrefs()).toMatchObject({ range: "1h", processesRefreshSeconds: 15 });
  sessionStorage.setItem("panel-active-target-scope", "server-a");
  document.getElementById("monitor-session")!.dataset.userName = "luis";
  expect(readMonitorPrefs().range).toBe("1h");
});
