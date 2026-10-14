/**
 * Dashboard E2E tests — authenticated.
 */

import { expect, test } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/panel");
  });

  test("loads dashboard with stat cards", async ({ page }) => {
    await expect(page).toHaveURL(/\/panel$/);
    await expect(page).toHaveTitle(/Dashboard.*LuxiPanel/i);

    // Stat cards should be present
    await expect(page.locator("text=CPU")).toBeVisible();
    await expect(page.locator("text=Memoria RAM")).toBeVisible();
  });

  test("sidebar navigation is visible", async ({ page }) => {
    // Sidebar links
    await expect(page.getByRole("link", { name: /dashboard/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /cuentas/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /monitor/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /terminal/i })).toBeVisible();
  });

  test("command palette opens with keyboard shortcut", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.locator("#cmd-palette")).toBeVisible();
    await expect(page.locator("#cmd-input")).toBeFocused();
  });

  test("command palette filters results", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.locator("#cmd-input").fill("monitor");
    await expect(page.locator("#cmd-results li")).toHaveCount(1);
    await expect(page.locator("#cmd-results")).toContainText("Monitor");
  });

  test("command palette closes on Escape", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.locator("#cmd-palette")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#cmd-palette")).not.toBeVisible();
  });

  test("command palette navigates with arrow keys and Enter", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.locator("#cmd-input").fill("correo");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/panel\/mail/);
    await expect(page).toHaveURL(/\/panel\/mail/);
  });

  test("theme toggle switches dark/light", async ({ page }) => {
    const html = page.locator("html");
    await expect(html).toHaveClass(/dark/);

    await page.locator("#theme-toggle").click();
    await expect(html).not.toHaveClass(/dark/);

    await page.locator("#theme-toggle").click();
    await expect(html).toHaveClass(/dark/);
  });

  test("quick actions grid is visible", async ({ page }) => {
    // Quick actions section
    await expect(page.locator("text=Acciones rápidas")).toBeVisible();
  });

  test("services section renders", async ({ page }) => {
    // Services should load (even if backend is not available they show empty state)
    await expect(page.locator("text=Servicios").first()).toBeVisible();
  });
});
