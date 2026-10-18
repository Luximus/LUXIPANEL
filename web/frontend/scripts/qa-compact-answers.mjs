// SPDX-License-Identifier: AGPL-3.0-only
// Real chat components with synthetic history; no agent/provider calls.
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";
import tailwind from "@tailwindcss/vite";
import { chromium, expect } from "@playwright/test";

const base = path.join(".cache/compact-answers-qa", new Date().toISOString().replace(/[:.]/g, "-"));
fs.mkdirSync(base, { recursive: true });
const longText = "La revisión terminó y se conservaron los cambios solicitados con todas las comprobaciones disponibles. La publicación sigue pendiente de verificación antes de confirmar el resultado al usuario.\n\n" + "Evidencia completa: no reiniciar otros servicios y conservar el historial. ".repeat(60);
const codeBody = Array.from({ length: 32 }, (_, index) => `export const resultado${index} = "conservado-${index}";`).join("\n");
const codeText = "Documento solicitado.\n\n```ts\n" + codeBody + "\n```\n\nÚltima sección del documento conservada.";
const overflowText = "La revisión del servidor terminó correctamente y confirmó que todas las aplicaciones responden aunque todavía quedan tareas menores de documentación que pueden completarse durante la siguiente sesión.";
const packet = 'protocol: lxp.agent.v1\nkind: result\nsummary: El agente terminó la revisión.\ndata:\n  verified: true\n  checks[1]: Pruebas locales completadas\n  constraints[1]: No borrar datos';
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
 createElement(CompactAnswer,{text:answer,presentation:"summary"}),
 createElement("section",{className:"border border-border rounded-lg p-3"},
   createElement("h2",{className:"text-sm mb-3"},"Coordinación del equipo"),
   createElement(TeamExecutionContent,{notices:[{role:"user",auto:true,text:packet,tools:[],presentation:"summary"}]}))));
window.qaRenderAnswer=(props,width=240)=>root.render(createElement("div",{ "data-qa-answer":true,style:{width,fontFamily:"Arial",fontSize:14,lineHeight:"20px"} },createElement(CompactAnswer,props)));
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
 const report={cases:[],pageErrors:[],production:false,artifacts:base}; let browser;
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
  // Real layout regression: equal preview/body can still overflow two lines.
  // Change container width without remounting to exercise ResizeObserver.
  report.overflowCases=[];
  for (const theme of ["light","dark"]) {
   await page.setViewportSize({width:375,height:812});
   await page.evaluate(({text,theme})=>{
    document.documentElement.classList.toggle("dark",theme==="dark");
    window.qaRenderAnswer({text,presentation:"summary"});
   },{text:overflowText,theme});
   const preview=page.locator("[data-qa-answer] [data-visible-summary]");
   const detail=page.locator("[data-qa-answer] > [data-compact-answer] > details");
   await expect(preview).toHaveText(overflowText);
   await expect(detail).toHaveCount(1);
   const clipped=await preview.evaluate(el=>({
    clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,
    lineHeight:parseFloat(getComputedStyle(el).lineHeight),lineClamp:getComputedStyle(el).webkitLineClamp,
   }));
   expect(clipped.scrollHeight).toBeGreaterThan(clipped.clientHeight);
   expect(clipped.clientHeight).toBeLessThanOrEqual(2*clipped.lineHeight+1);
   expect(clipped.lineClamp).toBe("2");
   await page.screenshot({path:base+"/overflow-"+theme+"-collapsed.png"});
   const control=detail.locator(":scope > summary");
   await expect(control).toHaveAttribute("aria-expanded","false");
   expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
   await control.focus(); await page.keyboard.press("Enter");
   await expect(control).toHaveAttribute("aria-expanded","true");
   await expect(preview).toHaveCount(0);
   await expect(detail.locator("[data-answer-detail]")).toHaveText(overflowText);
   expect(await control.evaluate(el=>!!document.getElementById(el.getAttribute("aria-controls")))).toBe(true);
   await page.screenshot({path:base+"/overflow-"+theme+"-expanded.png"});
   await page.keyboard.press("Space");
   await expect(detail).not.toHaveAttribute("open");
   await expect(preview).toHaveText(overflowText);
   await page.setViewportSize({width:1280,height:900});
   await page.locator("[data-qa-answer]").evaluate(el=>el.style.width="900px");
   await expect(detail).toHaveCount(0);
   const fitting=await preview.evaluate(el=>({clientHeight:el.clientHeight,scrollHeight:el.scrollHeight}));
   expect(fitting.scrollHeight).toBeLessThanOrEqual(fitting.clientHeight+1);
   await page.locator("[data-qa-answer]").evaluate(el=>el.style.width="240px");
   await expect(detail).toHaveCount(1);
   await page.evaluate(()=>window.qaRenderAnswer({text:"Listo.",presentation:"summary"}));
   await expect(preview).toHaveText("Listo.");
   await expect(detail).toHaveCount(0);
   await page.evaluate(text=>window.qaRenderAnswer({text,presentation:"summary"}),overflowText);
   await expect(detail).toHaveCount(1);
   // Absence of the explicit summary signal always preserves the complete body.
   for (const props of [
    {text:overflowText},
    {text:overflowText,presentation:"full"},
    {text:overflowText,presentation:"summary",streaming:true},
   ]) {
    await page.evaluate(props=>window.qaRenderAnswer(props),props);
    await expect(page.locator("[data-qa-answer] [data-compact-answer]")).toHaveCount(0);
    await expect(page.locator("[data-qa-answer]")).toContainText(overflowText);
   }
   report.overflowCases.push({theme,clipped,fitting,keyboard:true,resize:true,updatedText:true,fullBody:true});
  }
  // Exercise the complete-body contract in Chromium, including Markdown code.
  // A supplied projection never authorizes compaction without presentation=summary.
  report.presentationCases=[];
  for (const width of [375,1280]) for (const theme of ["light","dark"]) {
   await page.setViewportSize({width,height:900});
   await page.evaluate(theme=>document.documentElement.classList.toggle("dark",theme==="dark"),theme);
   for (const fixture of [
    {name:"ordinary",text:overflowText},
    {name:"long",text:longText},
    {name:"code",text:codeText},
   ]) for (const presentation of ["absent","full","summary"]) {
    const props={text:fixture.text,summary:"Proyección breve."};
    if (presentation!=="absent") props.presentation=presentation;
    await page.evaluate(({props,width})=>window.qaRenderAnswer(props,width),{props,width:width===375?240:900});
    const root=page.locator("[data-qa-answer]");
    const compact=root.locator("[data-compact-answer]");
    let content=root;
    if (presentation==="summary") {
     await expect(compact).toHaveCount(1);
     await expect(compact.locator("[data-visible-summary]")).toHaveText(props.summary);
     const control=compact.locator("details > summary");
     await expect(control).toHaveAttribute("aria-expanded","false");
     await control.focus();
     await expect(control).toBeFocused();
     await page.keyboard.press("Enter");
     await expect(control).toHaveAttribute("aria-expanded","true");
     await expect(compact.locator("[data-visible-summary]")).toHaveCount(0);
     content=compact.locator("[data-answer-detail]");
    } else {
     await expect(compact).toHaveCount(0);
     await expect(root).not.toContainText(props.summary);
    }
    if (fixture.name==="code") {
     // The isolated fixture blocks CDN requests, so CodeBlock's real fallback
     // must expose every line without relying on the external editor.
     await expect(content.locator("pre")).toHaveText(codeBody);
     await expect(content).toContainText("Documento solicitado.");
     await expect(content).toContainText("Última sección del documento conservada.");
     await expect(content.locator("p").last()).toBeVisible();
    } else {
     await expect(content).toHaveText(fixture.text.replace(/\s+/g," ").trim());
    }
    const geometry=await content.evaluate(el=>({
     clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,
     overflow:getComputedStyle(el).overflowY,
     clamped:!!el.querySelector("[data-visible-summary]"),
    }));
    expect(geometry.clamped).toBe(false);
    if (presentation==="summary") {
     expect(geometry.overflow).toBe("auto");
     await content.evaluate(el=>{el.scrollTop=el.scrollHeight;});
     const end=await content.evaluate(el=>({scrollTop:el.scrollTop,remaining:el.scrollHeight-el.clientHeight}));
     expect(end.scrollTop).toBeGreaterThanOrEqual(end.remaining-1);
     const control=compact.locator("details > summary");
     await control.focus(); await page.keyboard.press("Space");
     await expect(control).toHaveAttribute("aria-expanded","false");
    } else {
     expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight+1);
    }
    report.presentationCases.push({width,theme,fixture:fixture.name,presentation,complete:true,geometry});
   }
  }
  expect(report.pageErrors).toEqual([]);report.success=true;
 } catch(error){report.error=String(error.stack??error);process.exitCode=1;}
 finally {await browser?.close();await server.close();fs.writeFileSync(base+"/verification.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));}
}
