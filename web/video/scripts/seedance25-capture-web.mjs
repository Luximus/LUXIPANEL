import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const OUT=resolve(ROOT,'out/seedance25/captures');mkdirSync(OUT,{recursive:true});
const requireFrontend=createRequire(resolve(ROOT,'../frontend/package.json'));
const {chromium}=requireFrontend('playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,locale:'es-CO',colorScheme:'dark',recordVideo:{dir:OUT,size:{width:1440,height:900}}});
await context.addCookies([{name:'luxipanel_session',value:'demo-fixture-only',domain:'127.0.0.1',path:'/'},{name:'luxipanel_locale',value:'es',domain:'127.0.0.1',path:'/'}]);
await context.addInitScript(()=>{localStorage.setItem('theme','dark');localStorage.setItem('luxipanel_theme','dark');const set=()=>document.documentElement?.classList.add('dark');if(document.documentElement)set();else document.addEventListener('DOMContentLoaded',set,{once:true});});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',route=>{
 const u=new URL(route.request().url());
 if(u.hostname==='127.0.0.1'||u.hostname==='localhost'||u.protocol==='data:') return route.continue();
 // Product capture cannot read production account data, invoke AI or perform real server actions.
 return route.abort();
});
const records=[];
try {
 for(const [name,path] of [['web-ai','/panel/assistant'],['web-monitor','/panel/monitor'],['web-files','/panel/files'],['web-modules','/panel/module-dev']]){
  await page.goto('http://127.0.0.1:48690'+path,{waitUntil:'domcontentloaded',timeout:30000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(3000);
  if(page.url().includes('/login')) throw new Error('Isolated demo session was not accepted');
  await page.mouse.move(500,380);await page.mouse.move(810,450,{steps:30});
  await page.waitForTimeout(1200);
  const visible=await page.locator('body').innerText();
  await page.screenshot({path:resolve(OUT,name+'.png')});
  records.push({name,path,screenshot:name+'.png',type:'Actual installed LUXIPANEL interface with isolated synthetic demo API',visibleText:visible.slice(0,12000)});
  await page.waitForTimeout(1500);
 }
 writeFileSync(resolve(OUT,'web-captures.json'),JSON.stringify({capturedAt:new Date().toISOString(),records,errors,productionRequests:0},null,2));
 console.log(JSON.stringify({captured:records.map(r=>r.name),errors:errors.slice(0,12)}));
} finally {await context.close();await browser.close();}
