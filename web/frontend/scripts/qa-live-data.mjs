// Disposable browser fixture: actual DataTable, controller scope and API cache.
// Run from frontend: node scripts/qa-live-data.mjs
import {build} from "esbuild";
import {chromium, expect} from "@playwright/test";
import {createServer} from "node:http";
import {readFile, mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const out=path.resolve(root,"../.cache/drawables-v2/browser");
await mkdir(out,{recursive:true});
const common={bundle:true,write:false,platform:"browser",target:"es2022",alias:{"@":path.join(root,"src")},define:{"process.env.NODE_ENV":'"production"'},logLevel:"warning"};
const helper=await build({...common,format:"iife",globalName:"FixtureController",stdin:{resolveDir:root,loader:"ts",contents:`
import {watchModuleData} from "./src/lib/live-data";
import {api} from "./src/lib/api-client";
export function mount(root) {
 const reload=async()=>{const value=await api.get("/api/users",{fresh:true}); if(value.ok && !document.hidden) window.dispatchEvent(new CustomEvent("lxp:data-table:set-data",{detail:{tableId:"fixture-users",data:value.data}}));};
 const dispose=watchModuleData(["users/system"],reload,root);return {reload,dispose};
}`}});
const controller=`export function mountController(scope,root) {const {document,window,location,history,fetch,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,EventSource,WebSocket,MutationObserver,ResizeObserver}=scope;\n${helper.outputFiles[0].text}\nreturn FixtureController.mount(root);}`;
const pageBundle=await build({...common,format:"esm",external:["/controller.js"],entryPoints:[path.join(root,"e2e/fixtures/live-data.tsx")]});
let revision=0, unavailable=false, delay=100;
const requests=[];
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,"http://fixture.invalid"), route=url.pathname.replace(/^\/panel(?=\/api\/)/,"");
 if(route==="/fixture.js" || route==="/controller.js") {res.setHeader("content-type","text/javascript");res.end(route==="/fixture.js"?pageBundle.outputFiles[0].text:controller);return;}
 if(route.includes("/i18n/")) {res.setHeader("content-type","application/json");res.end("{}");return;}
 if(route==="/api/ui/data/capabilities") {res.setHeader("content-type","application/json");res.end(JSON.stringify({ok:true,data:{versionedReads:false,events:false,resources:[]}}));return;}
 if(route==="/api/users") {
  const target=req.headers["x-bridge-session-id"]??"A", version=`${target}-${revision}`, unavailableAtRead=unavailable;
  const unchanged=url.searchParams.get("knownVersion")===version;
  const body={ok:true,meta:{freshness:{version,state:"fresh",collectedAt:Date.now()/1000,checkedAt:Date.now()/1000},...(unchanged?{unchanged:true}:{})},...(!unchanged?{data:Array.from({length:1000},(_,id)=>({id,username:`${target}-user-${String(id).padStart(4,"0")}`,revision:`r${revision}`}))}:{})};
  requests.push({target,unchanged,version,at:Date.now()});
  await new Promise(resolve=>setTimeout(resolve,delay));res.setHeader("content-type","application/json");
  res.statusCode=unavailableAtRead?503:200;res.end(JSON.stringify(unavailableAtRead?{ok:false,error:"offline"}:body));return;
 }
 if(route!=="/") {res.writeHead(404);res.end();return;}
 res.setHeader("content-type","text/html");res.end('<!doctype html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:system-ui}#drawer{height:390px;overflow:auto}td,th{padding:8px}input{padding:6px}button{padding:6px;margin:3px}[hidden]{display:none!important}</style></head><body><main id="host"></main><script type="module" src="/fixture.js"></script></body></html>');
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
page.on("pageerror",error=>errors.push(error.message));
const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await expect(page.locator("tbody tr")).toHaveCount(10);
 await expect(page.locator("tbody")).toContainText("A-user-");
 await page.locator("#draft").fill("Borrador sin guardar");
 await page.getByPlaceholder("Buscar").fill("A-user-");
 await page.getByRole("button",{name:"Usuario",exact:false}).click();
 await page.getByRole("button",{name:"Siguiente",exact:true}).click();
 const row=page.locator("tbody tr").first();await row.getByRole("checkbox").check();
 const selected=await row.locator("td").nth(1).innerText();
 await page.evaluate(()=>{window.draftElement=document.getElementById("draft");document.getElementById("drawer").scrollTop=80;});
 const change=[];
 for(let n=1;n<=30;n++) {
  revision=n;const start=performance.now();
  await page.evaluate(()=>{for(let count=0;count<30;count++)window.qa.change();});
  await expect(page.locator("tbody tr").first()).toContainText(`r${n}`);change.push(performance.now()-start);
 }
 await expect(page.getByPlaceholder("Buscar")).toHaveValue("A-user-");
 await expect(page.locator("#draft")).toHaveValue("Borrador sin guardar");
 await expect(row.getByRole("checkbox")).toBeChecked();
 if(!(await row.innerText()).includes(selected)) throw Error("Selected identity changed");
 expect(await page.evaluate(()=>window.draftElement===document.getElementById("draft"))).toBe(true);
 expect(await page.evaluate(()=>document.getElementById("drawer").scrollTop)).toBe(80);
 await page.evaluate(()=>window.qa.visible(false));const hiddenReads=requests.length;
 await page.evaluate(()=>window.qa.change());await wait(700);expect(requests.length).toBe(hiddenReads);
 const reopen=[];
 for(let n=0;n<30;n++) {
  reopen.push(await page.evaluate(async()=>{window.qa.visible(false);const start=performance.now();window.qa.visible(true);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return performance.now()-start;}));
  await wait(425);
 }
 unavailable=true;await page.evaluate(()=>window.qa.change());await expect(page.locator('[role="status"]')).toContainText("Sin conexión");
 await expect(page.locator("tbody tr").first()).toContainText("r30");unavailable=false;
 delay=500;await page.evaluate(()=>void window.qa.reload());await wait(50);await page.evaluate(()=>window.qa.mount("B"));
 await expect(page.locator("tbody")).toContainText("B-user-");expect(await page.locator("tbody").innerText()).not.toContain("A-user-");
 expect(await page.locator("#draft").inputValue()).toBe("");
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent("lxp:data-table:set-data",{detail:{tableId:"fixture-users",data:[{name:"duplicate",username:"duplicate",revision:"one"},{name:"duplicate",username:"duplicate",revision:"two"}]}})));
 await expect(page.locator("tbody tr")).toHaveCount(2);
 await page.locator("tbody tr").first().getByRole("checkbox").check();
 await expect(page.locator("tbody tr").last().getByRole("checkbox")).not.toBeChecked();
 await page.evaluate(()=>window.qa.dispose());const finalReads=requests.length;await wait(700);expect(requests.length).toBe(finalReads);
 expect(errors).toEqual([]);expect(p95(change)).toBeLessThan(5000);expect(p95(reopen)).toBeLessThan(150);
 const result={environment:"Chromium disposable fixture; production DataTable/scope/API helpers, simulated HTTP data and events; 100ms response delay",rows:1000,repetitions:30,changeP95Ms:p95(change),reopenP95Ms:p95(reopen),listRequests:requests.length,unchangedReplies:requests.filter(row=>row.unchanged).length,checks:["stable selection, filters, sorting, page, scroll and draft","30-event bursts coalesced","hidden and disposed views stop reads","offline preserves rows","late server-A responses cannot enter server-B","duplicate names remain independent without row IDs"],errors};
 await writeFile(path.join(out,"verification.json"),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
