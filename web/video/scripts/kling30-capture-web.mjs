import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const OUT=resolve(ROOT,'out/kling30/captures');mkdirSync(OUT,{recursive:true});
const requireFrontend=createRequire(resolve(ROOT,'../frontend/package.json'));
const {chromium}=requireFrontend('playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const records=[],errors=[];
try {
 for(const [name,path] of [['web-ai','/panel/assistant'],['web-monitor','/panel/monitor'],['web-modules','/panel/module-dev']]){
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,locale:'es-CO',colorScheme:'dark',recordVideo:{dir:OUT,size:{width:1440,height:900}}});
  await context.addCookies([{name:'luxipanel_session',value:'demo-fixture-only',domain:'127.0.0.1',path:'/'},{name:'luxipanel_locale',value:'es',domain:'127.0.0.1',path:'/'}]);
  await context.addInitScript(()=>{localStorage.setItem('theme','dark');localStorage.setItem('luxipanel_theme','dark');const set=()=>document.documentElement?.classList.add('dark');if(document.documentElement)set();else document.addEventListener('DOMContentLoaded',set,{once:true});});
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1'||u.hostname==='localhost'||u.protocol==='data:') return route.continue();
   return route.abort();
  });
  const page=await context.newPage(),recordingStarted=Date.now(),video=page.video();
  page.on('pageerror',e=>errors.push({name,message:e.message,stack:e.stack}));
  try{
  await page.goto('http://127.0.0.1:48694'+path,{waitUntil:'domcontentloaded',timeout:30000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(1800);
  if(name==='web-ai'){await page.evaluate(()=>window.dispatchEvent(new CustomEvent('luxipanel:assistant-open-conversation',{detail:{conversationId:'demo-innovation',provider:'codex'}})));await page.waitForTimeout(1800);const chat=page.getByText('Despliegue con IA y control humano',{exact:true});if(await chat.count())await chat.first().click();await page.waitForTimeout(1800);}
  if(page.url().includes('/login')) throw new Error('Isolated demo session was not accepted');
  await page.mouse.move(500,380);await page.mouse.move(810,450,{steps:30});
  await page.waitForTimeout(1200);
  const visible=await page.locator('body').innerText();
  await page.screenshot({path:resolve(OUT,name+'.png')});
  const stableStartSeconds=(Date.now()-recordingStarted)/1000;
  await page.mouse.move(name==='web-ai'?465:620,name==='web-ai'?394:580,{steps:24});
  await page.waitForTimeout(2200);
  if(name==='web-monitor'){await page.mouse.wheel(0,230);await page.waitForTimeout(1200);await page.mouse.move(1020,700,{steps:30});}
  if(name==='web-modules'){await page.mouse.move(440,458,{steps:30});}
  await page.waitForTimeout(2400);
  records.push({name,path,screenshot:name+'.png',movie:name+'.webm',stableStartSeconds,usableSeconds:(Date.now()-recordingStarted)/1000-stableStartSeconds,type:'Actual installed LUXIPANEL interface with isolated synthetic demo API',visibleText:visible.slice(0,12000)});
  }finally{await context.close();await video.saveAs(resolve(OUT,name+'.webm'));await video.delete();}
 }
 writeFileSync(resolve(OUT,'web-captures.json'),JSON.stringify({capturedAt:new Date().toISOString(),records,errors,productionRequests:0},null,2));
 console.log(JSON.stringify({captured:records.map(r=>r.name),errors:errors.slice(0,12)}));
} finally {await browser.close();}
