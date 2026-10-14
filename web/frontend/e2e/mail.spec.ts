/**
 * Mail module E2E tests.
 */

import { expect, test } from "@playwright/test";

test.describe("Mail — Cuentas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/panel/mail");
  });

  test("renders mail accounts page", async ({ page }) => {
    await expect(page).toHaveTitle(/correo/i);
    await expect(page.getByRole("button", { name: /nueva cuenta/i })).toBeVisible();
  });

  test("search input is functional", async ({ page }) => {
    const search = page.getByPlaceholder(/buscar/i);
    await expect(search).toBeVisible();
    await search.fill("test");
    // After typing, table should filter (or show no results)
    await page.waitForTimeout(500); // debounce
    await expect(search).toHaveValue("test");
  });

  test("opens create account dialog", async ({ page }) => {
    await page.getByRole("button", { name: /nueva cuenta/i }).click();
    // Dialog should open
    await expect(page.locator("dialog[open]")).toBeVisible();
    await expect(page.getByLabel(/dirección de correo/i)).toBeVisible();
  });

  test("closes dialog on cancel", async ({ page }) => {
    await page.getByRole("button", { name: /nueva cuenta/i }).click();
    await expect(page.locator("dialog[open]")).toBeVisible();
    await page.getByRole("button", { name: /cancelar/i }).click();
    await expect(page.locator("dialog[open]")).not.toBeVisible();
  });
});

test.describe("Mail — Compose", () => {
  test("compose page renders correctly", async ({ page }) => {
    await page.goto("/panel/mail/compose");
    await expect(page).toHaveTitle(/redactar/i);
    await expect(page.getByPlaceholder(/asunto/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /enviar/i })).toBeVisible();
  });
});
