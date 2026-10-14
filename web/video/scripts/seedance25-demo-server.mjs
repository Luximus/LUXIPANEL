// Actual installed LUXIPANEL frontend + isolated demo-only API. No real sessions,
// server actions, live user data or production API requests are used.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'out/seedance25');
const PORT = 48690, API_PORT = 48691;
const ids = ['assistant','terminal','monitor','files','nginx','firewall','backups','databases','cron','obsidian','codebase-graph','project-map','module-dev','repository-store','expo','hosting','cloudflare','mail','modules','settings','preferences','server-alerts'];
const labels = {assistant:'Asistente IA',terminal:'Terminal',monitor:'Monitor',files:'Archivos',nginx:'Proxy y SSL',firewall:'Firewall',backups:'Respaldos',databases:'Bases de datos',cron:'Cron',obsidian:'Contexto de proyectos', 'codebase-graph':'Grafo de código','project-map':'Mapa de proyectos','module-dev':'Mis módulos','repository-store':'GitHub',expo:'Expo',hosting:'Hosting',cloudflare:'Cloudflare',mail:'Correo',modules:'Marketplace',settings:'Ajustes',preferences:'Preferencias','server-alerts':'Alertas'};
const user = { userId: 999999, username: 'demo', displayName: 'LUXIPANEL Demo', kind: 'admin', role: 'admin', modules: ['*'], targetName: 'VPS Desarrollo', targetHost: 'desarrollo.luxipanel.demo' };
const installed = ids.map(id=>({id,name:labels[id],enabled:true,installed:true,source:'builtin',version:'1.0.0',menu:{label:labels[id],icon:'ti-puzzle',href:'/panel/'+id},manifest:{id,name:labels[id],version:'1.0.0',enabled:true}}));
const layout = { layout_app_name:'LUXIPANEL',layout_brand_name:'LUXIPANEL',layout_logo:'/logo_300.webp',layout_logo_url:'/logo_300.webp',layout_default_theme:'dark',layout_panel_background_enabled:'false' };
const jwt = Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({...user,exp:Math.floor(Date.now()/1000)+86400})).toString('base64url')+'.demo-fixture-only';
const calls=[];
function snapshot(i=0) { return {timestamp:Date.now()-i*60000,ts:Date.now()-i*60000,cpu:{usagePercent:14+4*Math.sin(Date.now()/4000+i),loadAvg1m:.42,loadAvg5m:.38,loadAvg15m:.34,cores:4,model:'Virtual CPU'},memory:{usagePercent:34,totalBytes:8589934592,usedBytes:2920577761,freeBytes:5669356831},disk:{usagePercent:28,totalBytes:85899345920,usedBytes:24051816857,availableBytes:61847529063},network:{rxBytesPerSec:327680,txBytesPerSec:125952},uptime:86400*17}; }
const services = ['nginx','postgresql','redis','docker'].map(name=>({name,active:true,installed:true,installable:false,status:'active'}));
const processes = [{pid:1240,name:'nginx',user:'www-data',cpuPercent:.7,memPercent:1.2,memRss:103079215},{pid:1278,name:'postgres',user:'postgres',cpuPercent:2.3,memPercent:4.1,memRss:352187318},{pid:1360,name:'node',user:'deploy',cpuPercent:4.5,memPercent:5.3,memRss:455266533}];
function responseFor(path,url,method){
 if(path==='/api/session') return {ok:true,user};
 if(path==='/api/auth/login-methods') return {ok:true,data:{password:true,passkey:false,recovery:false,hcaptchaEnabled:false}};
 if(path==='/api/login'||path==='/api/auth/refresh') return {ok:true,mfaPending:false,expiresAt:Date.now()+86400000,token:jwt};
 if(path==='/api/ui/bootstrap') return {ok:true,data:{version:1,user,targetId:'video-demo',layout,preferences:{theme:'dark',language:'es'},modules:installed,assistant:{enabled:true}}};
 if(path==='/api/public/layout'||path==='/api/ui/layout') return {ok:true,data:layout,targetId:'video-demo'};
 if(path==='/api/me/modules') return {ok:true,data:{modules:{assistant:true,terminal:true},available:installed}};
 if(path==='/api/modules/installed'||path==='/api/modules') return {ok:true,data:installed};
 if(path==='/api/preferences'||path==='/api/me/preferences') return {ok:true,data:{theme:'dark',language:'es',locale:'es',assistant:{enabled:true}}};
 if(path==='/api/ui/data/capabilities') return {ok:true,data:{versionedReads:false,events:false,resources:[]}};
 if(path==='/api/monitor/snapshot') return {ok:true,data:snapshot()};
 if(path==='/api/monitor/services') return {ok:true,data:services};
 if(path==='/api/monitor/processes') return {ok:true,data:processes};
 if(path==='/api/monitor/history') {
  if(url.searchParams.get('resolution')!=='chart') return {ok:true,data:Array.from({length:30},(_,i)=>snapshot(29-i))};
  const fromTs=Number(url.searchParams.get('from'))||Date.now()-3600000,toTs=Number(url.searchParams.get('to'))||Date.now(),bucketMs=(toTs-fromTs)/30;
  const buckets=Array.from({length:30},(_,index)=>{const average={cpu:12+5*Math.sin(index/3),ram:33+2*Math.sin(index/5),disk:28,rx:327680,tx:125952};return {index,fromTs:fromTs+index*bucketMs,toTs:fromTs+(index+1)*bucketMs,sampleCount:5,average,maximum:{...average,cpu:average.cpu+2}};});
  const summary=Object.fromEntries(Object.keys(buckets[0].average).map(k=>[k,{latest:buckets.at(-1).average[k],average:buckets[0].average[k],maximum:Math.max(...buckets.map(b=>b.maximum[k]))}]));
  return {ok:true,data:{fromTs,toTs,bucketMs,totalSamples:150,firstTs:fromTs,lastTs:toTs,latestSnapshot:snapshot(),summary,buckets,peaks:{cpu:[],ram:[],disk:[],rx:[],tx:[]}}};
 }
 if(path==='/api/monitor/watchdog') return {ok:true,data:{config:{enabled:true,cpuPercent:85,memPercent:90,sustainedSeconds:60}}};
 if(path.includes('alerts')||path.includes('notifications')||path.includes('messages')) return {ok:true,data:[],unread:0};
 if(path.includes('server-switch')||path.includes('servers')||path.includes('panels')) return {ok:true,data:[{id:'demo-development',name:'VPS Desarrollo',customDomain:'https://desarrollo.luxipanel.demo',status:'online'},{id:'demo-production',name:'VPS Producción',customDomain:'https://produccion.luxipanel.demo',status:'online'}]};
 if(path==='/api/ai/config') return {ok:true,config:{enabled:true,activeProvider:'codex',uiMode:'simple',defaultAgentsTab:'leaders',defaultConversationsTab:'chats',defaultChatProvider:'codex',defaultChatModel:'auto',approval:{mode:'plan',autoApproveTools:[]},autoRouting:{enabled:true,maxTier:'high'},providers:Object.fromEntries(['claude','codex','gemini','deepseek','grok','minimax'].map(id=>[id,{mode:'cli',active:id==='codex',api:{hasApiKey:false,apiKeyHint:'',model:''},cli:{installed:id==='codex',loggedIn:id==='codex',model:'gpt-6-sol'}}]))}};
 if(path==='/api/ai/stats/cli-quota') return {ok:true,quota:null};
 if(path==='/api/ai/stats/usage-summary') return {ok:true,summary:{active:{used:0,limit:100},total:0,inputTokens:0,outputTokens:0}};
 if(path==='/api/ai/stats/usage') return {ok:true,items:[],total:0,totals:{input:0,output:0,total:0}};
 if(path==='/api/ai/stats/daily') return {ok:true,series:[]};
 if(path==='/api/ai/stats/models') return {ok:true,models:['gpt-6-sol']};
 if(path==='/api/ai/projects') return {ok:true,projects:[{id:'demo-project',title:'Infraestructura LUXIPANEL',name:'Infraestructura LUXIPANEL',icon:'ti-code',path:'/srv/demo',instructions:'Proyecto de demostración',provider:'codex',parentId:null,autoCapture:true,graphIndex:{status:'ready',nodes:128,edges:320},ownerId:999999,relation:'owner'}]};
 if(path==='/api/ai/agents') return {ok:true,agents:[{id:'demo-agent',name:'DevOps',description:'Infraestructura y despliegues',systemPrompt:'Asistente de demostración',providerId:'codex',providerIds:['codex'],agentMode:'single',model:'gpt-6-sol',allowedTools:null,projectIds:['demo-project'],parentAgentId:null,isTeamLeader:true,subordinateIds:[],color:'#06b6d4'}]};
 if(path==='/api/ai/conversations') return {ok:true,conversations:[],items:[],total:0};
 if(path==='/api/files/config') {const data={uploadMaxBytes:536870912,snapshotsEnabled:true,snapshotMaxBytes:10485760,snapshotMaxPerPath:10,snapshotMaxTotal:100,sharingEnabled:true,shareMaxExpiryMin:1440,sharePasswordRequired:false};return {ok:true,data:{...data,ceilings:data}};}
 if(path.includes('/assistant')&&path.includes('projects')) return {ok:true,data:[{id:'demo-project',name:'LUXIPANEL Demo',rootPath:'/srv/demo',description:'Infraestructura y desarrollo conectados',parentId:null}]};
 if(path.includes('/assistant')&&path.includes('agents')) return {ok:true,data:[{id:'demo-agent',name:'DevOps',description:'Asistente de infraestructura',provider:'codex',model:'gpt-6',enabled:true}]};
 if(path.includes('/assistant')&&path.includes('stats')) return {ok:true,data:{enabled:true,providers:{codex:{available:true},openai:{available:true}},codex:{installed:true,authenticated:true},conversations:0,running:0,queued:0}};
 if(path.includes('/assistant')&&path.includes('conversations')) return {ok:true,data:[]};
 if(path.includes('/files')) return {ok:true,data:{path:'/srv/demo',entries:[{name:'src',type:'directory',isDirectory:true,size:4096},{name:'package.json',type:'file',size:1824},{name:'README.md',type:'file',size:2048}],files:[{name:'src',type:'directory',isDirectory:true,size:4096},{name:'package.json',type:'file',size:1824},{name:'README.md',type:'file',size:2048}]}};
 if(path.includes('/backups')&&path.includes('jobs')) return {ok:true,data:[{id:'demo-backup',name:'Respaldo diario',schedule:'0 3 * * *',enabled:true,status:'success',lastRun:new Date().toISOString()}]};
 if(path.includes('license')||path.includes('status')||path.includes('dependencies')) return {ok:true,data:{active:true,valid:true,enabled:true,installed:true,status:'ready'}};
 return {ok:true,data:[]};
}
const mime={'.webp':'image/webp','.png':'image/png','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml'};
const api=createServer((req,res)=>{
 const url=new URL(req.url,'http://fixture.invalid'),path=url.pathname.replace(/^\/panel(?=\/api\/)/,'');
 if(path==='/logo_300.webp') {res.setHeader('content-type','image/webp');res.end(readFileSync(resolve(ROOT,'../frontend/public/logo_300.webp')));return;}
 const method=req.method||'GET';calls.push({path,method,at:Date.now()});
 // Mutations only affect simulated demo responses, never a real account.
 if(path==='/api/auth/login-methods') res.setHeader('Set-Cookie','luxipanel_csrf=demo-fixture-csrf; Path=/');
 if(path==='/api/login'||path==='/api/auth/refresh') res.setHeader('Set-Cookie',`luxipanel_session=${jwt}; Path=/; HttpOnly; Max-Age=86400`);
 res.setHeader('content-type','application/json');res.end(JSON.stringify(responseFor(path,url,method)));
});
await new Promise(r=>api.listen(API_PORT,'127.0.0.1',r));
process.env.ASTRO_NODE_AUTOSTART='disabled';
process.env.BACKEND_URL=`http://127.0.0.1:${API_PORT}`;
process.env.SITE_URL=`http://127.0.0.1:${PORT}`;
const {handler}=await import(resolve(ROOT,'../frontend/dist/server/entry.mjs'));
const web=createServer((req,res)=>{
 if(req.url.startsWith('/api/')||req.url.startsWith('/panel/api/')) {api.emit('request',req,res);return;}
 handler(req,res);
});
await new Promise(r=>web.listen(PORT,'127.0.0.1',r));
mkdirSync(OUT,{recursive:true});
writeFileSync(resolve(OUT,'demo-server.pid'),String(process.pid));
function close(){writeFileSync(resolve(OUT,'demo-api-requests.json'),JSON.stringify({environment:'Isolated installed frontend and existing Android app; synthetic demo data only; zero production API requests',calls},null,2));web.close();api.close();setTimeout(()=>process.exit(0),500).unref();}
process.on('SIGTERM',close);process.on('SIGINT',close);
console.log(JSON.stringify({web:`http://127.0.0.1:${PORT}`,api:`http://127.0.0.1:${API_PORT}`,nativeEmulatorApi:`http://10.0.2.2:${API_PORT}`,productionRequests:false}));
