/**
 * Navigation E2E tests — verifies all panel routes load without crashing.
 */

import { expect, test } from "@playwright/test";

const ROUTES = [
  { path: "/panel", title: /dashboard/i },
  { path: "/panel/mail", title: /correo/i },
  { path: "/panel/users", title: /usuarios/i },
  { path: "/panel/monitor", title: /monitor/i },
  { path: "/panel/files", title: /archivos/i },
  { path: "/panel/ssl", title: /ssl/i },
  { path: "/panel/firewall", title: /firewall/i },
  { path: "/panel/cron", title: /cron/i },
  { path: "/panel/backups", title: /backup/i },
  { path: "/panel/dns", title: /dns/i },
  { path: "/panel/terminal", title: /terminal/i },
  { path: "/panel/assistant", title: /asistente/i },
  { path: "/panel/webhooks", title: /webhook/i },
  { path: "/panel/settings", title: /ajustes/i },
  { path: "/panel/preferences", title: /preferencias/i },
];

test.describe("Panel routes load without errors", () => {
  for (const route of ROUTES) {
    test(`${route.path} loads`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(route.path);

      // Should not redirect to login (auth is in place)
      await expect(page).not.toHaveURL(/\/login/);

      // Title should match
      await expect(page).toHaveTitle(route.title);

      // No uncaught JS errors
      expect(errors, `JS errors on ${route.path}: ${errors.join(", ")}`).toHaveLength(0);
    });
  }
});

test.describe("404 page", () => {
  test("shows custom 404 for unknown routes", async ({ page }) => {
    const response = await page.goto("/ruta-que-no-existe");
    expect(response?.status()).toBe(404);
    await expect(page.locator("text=404")).toBeVisible();
    await expect(page.getByRole("link", { name: /volver/i })).toBeVisible();
  });
});

test.describe("Unauthenticated redirect", () => {
  test("panel redirects to login when not authenticated", async ({ browser }) => {
    // Fresh context with no cookies
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();

    await page.goto("/panel");
    await expect(page).toHaveURL(/\/login/);

    await ctx.close();
  });
});
