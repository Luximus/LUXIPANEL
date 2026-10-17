// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";
import tailwind from "@tailwindcss/vite";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
// Components and CSS are real; provider/history HTTP and WS are isolated fixtures.
const base = ".cache/api-activity-contract-qa";
const historyMessage = {
  "role": "assistant",
  "content": "Archivo revisado y resultado conservado.",
  "ts": "2026-10-17T00:00:00Z",
  "apiActivity": {
    "events": [
      {
        "type": "text",
        "delta": "Voy a revisar el archivo.",
        "phase": "commentary"
      },
      {
        "type": "tool_use",
        "id": "read",
        "name": "files.read",
        "input": {
          "path": "sample.txt"
        }
      },
      {
        "type": "tool_result",
        "id": "read",
        "success": true,
        "output": "Resultado íntegro de la llamada"
      },
      {
        "type": "text",
        "delta": "Avance posterior a la última llamada.",
        "phase": "commentary"
      }
    ]
  }
};
fs.mkdirSync(base, { recursive: true });
const report = { cases: [], pageErrors: [], production: false };
const entry = [
  "import {createElement} from \"react\";",
  "import {createRoot} from \"react-dom/client\";",
  "import {TurnView} from \"/src/components/floating-assistant/chat-pane/turn-view.tsx\";",
  "import {bubblePrefs} from \"/src/components/floating-assistant/bubble-prefs.ts\";",
  "import {applyEvent} from \"/src/components/floating-assistant/chat-engine/stream-apply.ts\";",
  "import {chats} from \"/src/components/floating-assistant/chat-engine/state.ts\";",
  "import {historyTurn} from \"/src/components/floating-assistant/chat-engine/history.ts\";",
  "import {assistantConversationsApi} from \"/src/components/floating-assistant/assistant-api.ts\";",
  "import \"/src/styles/starwind.css\";",
  "import \"/src/styles/motion.css\";",
  "import \"/src/styles/reactbits-kit.css\";",
  "import \"/src/styles/extracted/layouts/PanelLayout-style1.css\";",
  "import \"/src/styles/extracted/pages/panel/assistant/index-style1.css\";",
  "bubblePrefs.set(\"codex\",{terminalLive:true});",
  "const root = createRoot(document.getElementById(\"root\"));",
  "const message = {\"role\":\"assistant\",\"content\":\"Archivo revisado y resultado conservado.\",\"ts\":\"2026-10-17T00:00:00Z\",\"apiActivity\":{\"events\":[{\"type\":\"text\",\"delta\":\"Voy a revisar el archivo.\",\"phase\":\"commentary\"},{\"type\":\"tool_use\",\"id\":\"read\",\"name\":\"files.read\",\"input\":{\"path\":\"sample.txt\"}},{\"type\":\"tool_result\",\"id\":\"read\",\"success\":true,\"output\":\"Resultado íntegro de la llamada\"},{\"type\":\"text\",\"delta\":\"Avance posterior a la última llamada.\",\"phase\":\"commentary\"}]}};",
  "window.qaRender = async (state = \"done\") => {",
  "const key=\"qa-api\";",
  "chats.set(key,{provider:\"codex\",conversationId:key,streaming:false,turns:[{role:\"assistant\",text:\"\",tools:[],pending:true}]});",
  "const events = message.apiActivity.events.filter(e => state !== \"running\" || e.type !== \"tool_result\");",
  "events.forEach((event,seq) => applyEvent(key,state===\"failed\"&&event.type===\"tool_result\"?{...event,success:false}:event,{isCli:false,startedAt:Date.now(),seq}));",
  "if([\"done\",\"failed\",\"history\",\"truncated\"].includes(state)) applyEvent(key,{type:\"text\",phase:\"final_answer\",delta:message.content},{isCli:false,startedAt:Date.now(),seq:10});",
  "if(state!==\"running\") applyEvent(key,{type:\"done\",...(state===\"waiting\"?{pending:true}:{})},{isCli:false,startedAt:Date.now(),seq:11});",
  "let turn=chats.get(key).turns[0];",
  "if(state===\"interrupted\") turn={...turn,interrupted:true};",
  "if(state===\"history\") {const response=await assistantConversationsApi.messages(\"qa-history\",30,0);turn=historyTurn(response.items[0]);}",
  "if(state===\"truncated\") turn=historyTurn({...message,apiActivity:{...message.apiActivity,truncated:true}});",
  "if(state===\"cli-waiting\") turn=historyTurn({role:\"assistant\",content:\"\",ts:\"\",cli:true,cliLog:\"$ codex\\nTrabajo en curso.\",pending:true});",
  "if(state===\"files-history\") turn=historyTurn({...message,apiActivity:{events:[{type:\"tool_use\",id:\"write\",name:\"modules.execute\",input:{tool:\"files.write\",input:{path:\"/fixture/src/Changed.ts\"}}},{type:\"tool_result\",id:\"write\",success:true,output:\"Archivo guardado\"}]}});",
  "root.render(createElement(TurnView,{turn,provider:\"codex\",projectPath:\"/fixture\",onOpenFile:path=>{window.qaOpenedFile=path;}}));",
  "}; await window.qaRender(); window.qaReady = true;"
].join("\n");
let server, browser;
try {
  server = await createServer({
    configFile: false, envDir: false, root: process.cwd(), publicDir: "public", cacheDir: base + "/vite",
    resolve: { alias: { "@": path.resolve("src") } },
    plugins: [{
      name: "activity-fixture",
      resolveId(id) { if (id === "/qa-entry.js") return "\0qa-entry.js"; },
      load(id) { if (id === "\0qa-entry.js") return entry; },
      configureServer(s) { s.middlewares.use((req, res, next) => {
        if (req.url !== "/") return next();
        res.setHeader("Content-Type", "text/html");
        res.end('<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style id="xterm-css-cdn"></style></head><body class="bg-background text-foreground"><main id="root" class="p-2"></main><script type="module" src="/qa-entry.js"></script></body></html>');
      }); }
    }, tailwind()],
    server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: false, include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "lucide-react", "dompurify", "marked", "motion/react", "@hugeicons/react", "@hugeicons/core-free-icons"] }
  });
  await server.listen();
  browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext();
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (url.pathname === "/api/ai/conversations/qa-history/messages") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, items: [historyMessage], total: 1, hasMore: false }) });
    if (url.pathname.startsWith("/api/")) return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, data: { items: [], tasks: [], projects: [] } }) });
    return route.continue();
  });
  await context.routeWebSocket("**/*", () => {});
  const page = await context.newPage();
  page.on("pageerror", error => report.pageErrors.push(error.message));
  const url = "http://127.0.0.1:" + server.httpServer.address().port;
  await page.goto(url);
  await page.waitForFunction(() => window.qaReady);
  for (const width of [360, 1280]) for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(theme => document.documentElement.classList.toggle("dark", theme === "dark"), theme);
    await page.evaluate(() => window.qaRender("done"));
    const activity = page.locator(".thought-line__head");
    const history = page.locator('[data-execution-source="API"]');
    const summary = history.locator(":scope > summary");
    await expect(activity).toHaveAttribute("aria-expanded", "false");
    await expect(history).not.toHaveAttribute("open");
    await expect(page.locator("[data-api-progress]").first()).toBeHidden();
    await expect(page.locator('[data-message-section="answer"]')).toContainText("Archivo revisado");
    await activity.focus();
    expect(await activity.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("solid");
    await page.keyboard.press("Enter");
    await expect(activity).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Space");
    await expect(activity).toHaveAttribute("aria-expanded", "false");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(history).toHaveAttribute("open");
    await expect(page.locator("[data-api-progress]").first()).toContainText("Voy a revisar");
    await expect(page.locator("[data-api-progress]").last()).toContainText("Avance posterior");
    const tool = history.locator("details");
    if (!await tool.evaluate(el => el.open)) await tool.locator("summary").click();
    await expect(tool).toHaveAttribute("open");
    await expect(tool).toContainText("Resultado íntegro");
    const expandedAudit = await new AxeBuilder({page}).include('[data-message-section="console"]').withRules(["color-contrast", "button-name", "aria-valid-attr-value"]).analyze();
    expect(expandedAudit.violations).toEqual([]);
    await summary.focus();
    await page.keyboard.press("Space");
    await expect(history).not.toHaveAttribute("open");
    const metrics = await page.evaluate(() => [...document.querySelectorAll('.thought-line__head,[data-execution-source="API"] > summary')].map(el => ({
      height: el.getBoundingClientRect().height, width: el.getBoundingClientRect().width,
      controls: !!document.getElementById(el.getAttribute("aria-controls")),
      focusOutline: getComputedStyle(el).outlineStyle, focusShadow: getComputedStyle(el).boxShadow
    })));
    expect(metrics.every(m => m.height >= 44 && m.width >= 44 && m.controls)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: base + "/" + theme + "-" + width + ".png" });
    const states = [];
    for (const state of ["running", "failed", "unconfirmed", "waiting", "interrupted", "done", "history"]) {
      await page.evaluate(state => window.qaRender(state), state);
      await expect(history).not.toHaveAttribute("open");
      const label = state === "running" ? "ejecutando" : state === "failed" ? "Error" : state === "waiting" ? "En espera" : ["unconfirmed", "interrupted"].includes(state) ? "Resultado no confirmado" : "Ver historial";
      await expect(summary).toContainText(label);
      await page.waitForTimeout(250); // Let the 200 ms label transition finish.
      const axe = await new AxeBuilder({page}).include('[data-message-section="reasoning"]').include('[data-message-section="console"]').withRules(["color-contrast", "button-name", "aria-valid-attr-value"]).analyze();
      states.push({ state, violations: axe.violations.map(v => ({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})) });
      expect(axe.violations).toEqual([]);
    }
    await page.evaluate(() => window.qaRender("truncated"));
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-api-truncated]")).toContainText("Parte del detalle no se conservó");
    await summary.focus();
    await page.keyboard.press("Space");
    await page.evaluate(() => window.qaRender("files-history"));
    const files = page.locator('[data-message-section="files"]');
    const filesSummary = files.locator("summary");
    await expect(filesSummary).toContainText("Archivos modificados");
    await filesSummary.focus();
    await page.keyboard.press("Enter");
    await expect(files.locator("details")).toHaveAttribute("open");
    const fileButton = files.getByRole("button");
    await expect(fileButton).toContainText("Changed.ts");
    await fileButton.focus();
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => window.qaOpenedFile)).toBe("/fixture/src/Changed.ts");
    const fileMetrics = await files.locator("summary,button").evaluateAll(elements => elements.map(el => ({
      height: el.getBoundingClientRect().height, width: el.getBoundingClientRect().width,
    })));
    expect(fileMetrics.every(metric => metric.height >= 44 && metric.width >= 44)).toBe(true);
    expect(await fileButton.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe("none");
    const filesAudit = await new AxeBuilder({page}).include('[data-message-section="files"]')
      .withRules(["color-contrast", "button-name", "aria-valid-attr-value"]).analyze();
    expect(filesAudit.violations).toEqual([]);
    await page.screenshot({ path: base + "/files-" + theme + "-" + width + ".png" });
    await filesSummary.focus();
    await page.keyboard.press("Space");
    await expect(files.locator("details")).not.toHaveAttribute("open");
    await page.evaluate(() => window.qaRender("cli-waiting"));
    const cliHistory = page.locator('[data-message-section="console"] > details');
    const cliSummary = cliHistory.locator(":scope > summary");
    await expect(cliSummary).toContainText("En espera");
    await cliSummary.focus();
    await page.keyboard.press("Enter");
    await expect(cliSummary).toHaveAttribute("aria-expanded", "true");
    await expect(cliHistory).toContainText("Trabajo en curso.");
    const fullscreen = cliHistory.getByRole("button", { name: "Expandir a pantalla completa" });
    expect(await fullscreen.evaluate(el => el.getBoundingClientRect().height >= 44 && el.getBoundingClientRect().width >= 44)).toBe(true);
    await cliSummary.focus();
    await page.keyboard.press("Space");
    await expect(cliSummary).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator('[data-message-section="answer"]')).toHaveCount(0);
    report.cases.push({width,theme,keyboard:true,metrics,states,cliPending:true,truncated:true,
      files:{keyboard:true,translated:true,editorPath:"/fixture/src/Changed.ts",metrics:fileMetrics,violations:filesAudit.violations}});
  }
  expect(report.pageErrors).toEqual([]);
  report.success = true;
} catch (error) {
  report.error = String(error.stack ?? error); process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
  report.cleanup = true;
  fs.writeFileSync(base + "/verification.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
