/**
 * Accessibility E2E tests using axe-core.
 * Checks critical/serious WCAG violations on key pages.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES_TO_CHECK = [
  { path: "/panel", name: "Dashboard" },
  { path: "/panel/files", name: "Files" },
  { path: "/panel/mail", name: "Mail" },
  { path: "/panel/monitor", name: "Monitor" },
  { path: "/panel/settings", name: "Settings" },
  { path: "/panel/preferences", name: "Preferences" },
];

test.describe("Accessibility — WCAG 2.1 AA", () => {
  for (const { path, name } of PAGES_TO_CHECK) {
    test(`${name} — no critical violations`, async ({ page }) => {
      await page.goto(path);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .exclude("iframe, .xterm-screen") // exclude terminal canvas
        .analyze();

      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );

      if (critical.length > 0) {
        const details = critical
          .map(
            (v) =>
              `[${v.impact}] ${v.id}: ${v.description}\n  Nodes: ${v.nodes
                .slice(0, 3)
                .map((n) => n.html)
                .join(", ")}`
          )
          .join("\n\n");
        console.error(`Accessibility violations on ${path}:\n${details}`);
      }

      expect(critical).toHaveLength(0);
    });
  }

  test("Login page — no critical violations", async ({ page, browser }) => {
    // Run unauthenticated
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const unauthPage = await ctx.newPage();

    await unauthPage.goto("/login");

    const results = await new AxeBuilder({ page: unauthPage })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(critical).toHaveLength(0);
    await ctx.close();
  });

  test("dialogs have focus trap when open", async ({ page }) => {
    await page.goto("/panel/mail");

    // Open a dialog
    await page.getByRole("button", { name: /nueva cuenta/i }).click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();

    // Tab through focusable elements — should stay within dialog
    const focusableSelector = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusables = dialog.locator(focusableSelector);
    const count = await focusables.count();
    expect(count).toBeGreaterThan(0);

    // Press Tab multiple times and verify focus stays in dialog
    for (let i = 0; i < count + 2; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.closest("dialog") !== null;
      });
      expect(focused, `Focus escaped dialog after ${i + 1} Tab presses`).toBe(true);
    }
  });
});
