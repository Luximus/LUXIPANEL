import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireFrontend = createRequire(resolve(root, "../frontend/package.json"));
const { chromium } = requireFrontend("playwright");
const dir = resolve(root, "public/higgsfield45/captures");
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, locale: "es-CO", reducedMotion: "reduce" });
// Public pages only. No existing browser profile, authentication or product actions.
await context.route("**/*", route => ["GET", "HEAD"].includes(route.request().method()) ? route.continue() : route.abort());
const page = await context.newPage();
const records = [];
try {
  const url = "https://luxipanel.com/es";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1800);
  const sections = await page.locator("main section").evaluateAll(nodes => nodes.map(node => ({ id: node.id, title: node.querySelector("h2")?.textContent?.trim() ?? "" })));
  for (const [name, pattern] of [["public-ai", /\bIA\b|asistente|servidor.*trabajo/i], ["public-apps", /bolsillo|pocket|VPS.*contigo/i]]) {
    const section = sections.find(s => pattern.test(s.title));
    if (!section?.id) continue;
    const locator = page.locator(`[id="${section.id}"]`);
    await locator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await locator.screenshot({ path: resolve(dir, `${name}.png`), animations: "disabled" });
    records.push({ name, url, selector: `#${section.id}`, type: "public marketing page; not authenticated panel footage" });
  }
  await page.goto("https://luxipanel.com/es/modules", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(dir, "public-modules.png"), animations: "disabled" });
  records.push({ name: "public-modules", url: page.url(), type: "public module catalog; not publishing-flow footage" });
  writeFileSync(resolve(root, "out/higgsfield45/public-captures.json"), JSON.stringify({ capturedAt: new Date().toISOString(), records, sections }, null, 2));
  console.log(JSON.stringify({ records, sections }));
} finally {
  await browser.close();
}
