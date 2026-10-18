// SPDX-License-Identifier: AGPL-3.0-only
// Real chat components with synthetic history; no agent/provider calls.
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";
import tailwind from "@tailwindcss/vite";
import { chromium, expect } from "@playwright/test";

const base = ".cache/compact-answers-qa";
fs.mkdirSync(base, { recursive: true });
const longText = "La revisión terminó y se conservaron los cambios solicitados con todas las comprobaciones disponibles. La publicación sigue pendiente de verificación antes de confirmar el resultado al usuario.\n\n" + "Evidencia completa: no reiniciar otros servicios y conservar el historial. ".repeat(60);
const packet = 'protocol: lxp.agent.v1\nkind: blocked\nsummary: El agente terminó la revisión. Falta verificar la publicación.\ndata:\n  verified: false\n  checks[1]: Pruebas locales completadas\n  constraints[1]: No borrar datos';
const entry = `
import {createElement} from "react";
import {createRoot} from "react-dom/client";
import {CompactAnswer} from "/src/components/floating-assistant/chat-pane/CompactAnswer.tsx";
import {TeamExecutionContent} from "/src/components/floating-assistant/chat-pane/team-execution.tsx";

import "/src/styles/starwind.css";
import "/src/styles/reactbits-kit.css";
const answer=${JSON.stringify(longText)};
const packet=${JSON.stringify(packet)};
const root=createRoot(document.getElementById("root"));
window.qaRender=(mode="api")=>root.render(createElement("div",{className:"space-y-6"},
 createElement("h1",{className:"text-lg font-semibold"},"Resumen del chat"),
 createElement(CompactAnswer,{text:answer}),
 createElement("section",{className:"border border-border rounded-lg p-3"},
   createElement("h2",{className:"text-sm mb-3"},"Coordinación del equipo"),
   createElement(TeamExecutionContent,{notices:[{role:"user",auto:true,text:packet,tools:[]}]}))));
window.qaRender(new URLSearchParams(location.search).get("mode")||"api"); window.qaReady=true;
`;
const server = await createServer({ configFile: false, envDir: false, root: process.cwd(), publicDir: "public", cacheDir: base + "/vite",
 optimizeDeps: { noDiscovery: true, include: ["react", "react-dom/client", "react/jsx-dev-runtime", "lucide-react", "@hugeicons/react", "@hugeicons/core-free-icons", "dompurify", "marked", "motion/react", "clsx", "tailwind-merge"] },
 resolve: { alias: { "@": path.resolve("src") } }, plugins: [{ name: "compact-answer-fixture",
 resolveId(id) { if (id === "/qa-entry.js") return "\0qa-entry.js"; }, load(id) { if (id === "\0qa-entry.js") return entry; },
 configureServer(s) { s.middlewares.use((req,res,next)=>{
   if(req.url?.startsWith("/api/")){res.setHeader("Content-Type","application/json");res.end(JSON.stringify({ok:true,items:[],tasks:[],projects:[]}));return;}
   if(req.url?.split("?")[0]!=="/")return next();
   res.setHeader("Content-Type","text/html");res.end('<!doctype html><html lang="es" class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resumen del chat</title><style id="xterm-css-cdn"></style></head><body class="bg-background text-foreground"><main id="root" class="p-4 max-w-4xl mx-auto"></main><script type="module" src="/qa-entry.js"></script></body></html>');
 }); } }, tailwind()], server: { host:"127.0.0.1",port:0,hmr:false,watch:null } });
await server.listen();
const url="http://127.0.0.1:"+server.httpServer.address().port;
console.log(url);
if(process.env.LXP_QA_SERVE_ONLY === "1") {
 for(const signal of ["SIGTERM","SIGINT"]) process.on(signal,async()=>{await server.close();process.exit(0);});
} else {
 const report={cases:[],pageErrors:[],production:false}; let browser;
 try {
  browser=await chromium.launch({executablePath:"/usr/bin/chromium",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  const context=await browser.newContext();
  await context.route("**/*",route=>new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await context.routeWebSocket("**/*",()=>{});
  const page=await context.newPage(); page.on("pageerror",error=>report.pageErrors.push(error.message));
  for(const width of [360,1280]) for(const theme of ["light","dark"]) for(const mode of ["api","cli"]) {
   await page.setViewportSize({width,height:900}); await page.goto(url+"/?mode="+mode);
   await page.waitForFunction(()=>window.qaReady, {timeout:30000});
   await page.evaluate(theme=>document.documentElement.classList.toggle("dark",theme==="dark"),theme);
   const previews=page.locator("[data-visible-summary]"); await expect(previews).toHaveCount(2);
   const metrics=await previews.evaluateAll(elements=>elements.map(el=>({height:el.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(el).lineHeight),text:el.textContent})));
   expect(metrics.every(m=>m.height<=2*m.lineHeight+1 && m.text.length<=240)).toBe(true);
   expect(await page.locator("body").innerText()).not.toContain("lxp.agent.v1");
   expect(await page.locator("body").innerText()).not.toContain("Evidencia completa");
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:base+`/${mode}-${theme}-${width}.png`});
   const detail=page.locator("[data-compact-answer] > details").first();
   await detail.locator(":scope > summary").focus(); await page.keyboard.press("Enter");
   await expect(detail.locator("[data-answer-detail]")).toContainText("Evidencia completa");
   expect((await detail.locator("[data-answer-detail]").innerText()).replace(/\s+/g," ").trim()).toBe(longText.replace(/\s+/g," ").trim());
   await page.keyboard.press("Space"); await expect(detail).not.toHaveAttribute("open");
   report.cases.push({width,theme,mode,metrics,detailsPreserved:true,keyboard:true});
  }
  expect(report.pageErrors).toEqual([]);report.success=true;
 } catch(error){report.error=String(error.stack??error);process.exitCode=1;}
 finally {await browser?.close();await server.close();fs.writeFileSync(base+"/verification.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));}
}
