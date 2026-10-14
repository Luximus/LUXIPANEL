// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { initRepositorySettingsTabs } from "./repository-settings-tabs";

function renderDrawer(): void {
  document.body.innerHTML = `
    <div data-repo-settings-tabs>
      <nav role="tablist">
        <button role="tab" data-repo-settings-tab="catalog" aria-selected="true"></button>
        <button role="tab" data-repo-settings-tab="cloning" aria-selected="false"></button>
        <button role="tab" data-repo-settings-tab="connection" aria-selected="false"></button>
      </nav>
      <section data-repo-settings-panel="catalog"></section>
      <section data-repo-settings-panel="cloning" class="hidden"></section>
      <form data-repo-settings-panel="cloning" class="hidden"></form>
      <section data-repo-settings-panel="connection" class="hidden"></section>
      <div data-repo-settings-save></div>
    </div>`;
}

describe("GitHub settings drawer tabs", () => {
  beforeEach(renderDrawer);

  it("shows cloning preferences and link form, then connection without save controls", () => {
    initRepositorySettingsTabs();
    document.querySelector<HTMLButtonElement>('[data-repo-settings-tab="cloning"]')!.click();
    expect(document.querySelectorAll('[data-repo-settings-panel="cloning"].hidden')).toHaveLength(0);
    expect(document.querySelector('[data-repo-settings-panel="catalog"]')!.classList.contains("hidden")).toBe(true);
    expect(document.querySelector('[data-repo-settings-tab="cloning"]')!.getAttribute("aria-selected")).toBe("true");

    document.querySelector<HTMLButtonElement>('[data-repo-settings-tab="connection"]')!.click();
    expect(document.querySelector('[data-repo-settings-panel="connection"]')!.classList.contains("hidden")).toBe(false);
    expect(document.querySelector('[data-repo-settings-save]')!.classList.contains("hidden")).toBe(true);
  });

  it("supports keyboard navigation and rebinds after a page replacement", () => {
    initRepositorySettingsTabs();
    const first = document.querySelector<HTMLButtonElement>('[data-repo-settings-tab="catalog"]')!;
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.querySelector<HTMLButtonElement>('[data-repo-settings-tab="cloning"]')!.tabIndex).toBe(0);

    renderDrawer();
    initRepositorySettingsTabs();
    document.querySelector<HTMLButtonElement>('[data-repo-settings-tab="connection"]')!.click();
    expect(document.querySelector('[data-repo-settings-panel="connection"]')!.classList.contains("hidden")).toBe(false);
  });
});
