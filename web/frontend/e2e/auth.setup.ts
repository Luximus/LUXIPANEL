import { expect, test as setup } from "@playwright/test";

const AUTH_FILE = "e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  // Credenciales SOLO por env — nunca hardcodear aquí: este repo se publica en
  // GitHub y una contraseña real como default acaba en el historial.
  const username = process.env.E2E_USERNAME ?? "panel-admin";
  const password = process.env.E2E_PASSWORD;
  if (!password) {
    throw new Error("E2E_PASSWORD no definida — exporta E2E_USERNAME/E2E_PASSWORD antes de correr los e2e");
  }

  await page.goto("/login");
  await expect(page).toHaveURL(/\/login/);

  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator("#btn-password").click();

  // Login redirects to /panel via window.location.href. The panel middleware
  // may bounce back to / once until the cookie is recognized, so poll for the
  // panel URL with a generous timeout.
  await page.waitForURL(/\/panel/, { timeout: 30_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
