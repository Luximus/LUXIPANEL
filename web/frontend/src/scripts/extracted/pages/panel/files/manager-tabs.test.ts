import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("/scripts/extracted/lib/api-client.js", async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  LOCAL_TARGET_SCOPE: "local",
  SERVER_SWITCHER_ID: "server-switcher",
  ATTR_CURRENT_TARGET_ID: "data-current-target-id",
}));

import { S } from "./state";
import { managerTabLabel, renderFilesManagerTabs } from "./manager-tabs";

beforeEach(() => {
  document.body.innerHTML = '<div id="files-manager-tabs" role="tablist"></div>';
  S.filesManagers = [
    { id: "one", label: "Gestor 1", path: "/srv/site/public", treeRoot: "/srv/site" },
    { id: "two", label: "Gestor 2", path: "/home/site/public", treeRoot: "/home/site" },
  ];
  S.activeFilesManagerId = "two";
});

describe("folder tabs", () => {
  it("names the folder being viewed and distinguishes identical names with parent paths", () => {
    expect(managerTabLabel(S.filesManagers[0]!)).toBe("public");
    renderFilesManagerTabs();
    const tabs = document.querySelectorAll<HTMLElement>('[role="tab"]');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.textContent).toContain("/srv/site");
    expect(tabs[1]?.textContent).toContain("/home/site");
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]?.tabIndex).toBe(0);
    expect(document.querySelectorAll("[data-manager-close]")).toHaveLength(2);
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    tabs[1]?.focus();
    renderFilesManagerTabs();
    expect(document.activeElement?.getAttribute("data-manager-id")).toBe("two");
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    focus.mockRestore();
  });

  it("keeps the only folder tab open", () => {
    S.filesManagers = [S.filesManagers[0]!];
    S.activeFilesManagerId = "one";
    renderFilesManagerTabs();
    expect(document.querySelector("[data-manager-close]")).toBeNull();
  });
});
