/** Shared by extracted scripts and React. The seed expires and never crosses a session/target. */
type Seed = {version:number;targetId:string;user:{userId:number;username?:string;bridgeSessionId?:string};modules:unknown[];preferences:unknown;assistant:unknown};
const slot=Symbol.for("luxipanel.startup.v3");
type State={node:Element|null;workspace:Element|null;seed:Seed|null;until:number;invalid:boolean;history:boolean;listeners:Set<()=>void>};
function state():State {
  const host=window as unknown as Record<symbol,State>;
  if(!host[slot]) {
    host[slot]={node:null,workspace:null,seed:null,until:0,invalid:false,history:false,listeners:new Set()};
    for(const event of ["luxipanel:logout","luxipanel:session-ended","luxipanel:target-changed","luxipanel:permissions-changed","luxipanel:session-started"]) window.addEventListener(event,()=>{
      const s=host[slot];s.seed=null;s.invalid=true;s.history=false;s.workspace=null;for(const fn of s.listeners)fn();
    });
  }
  const s=host[slot]; const node=document.getElementById("lxp-ui-bootstrap");
  if(node!==s.node){
    let seed: Seed|null; try{seed=JSON.parse(node?.textContent??"null");}catch{seed=null;}
    const workspace=document.getElementById("persistent-assistant-workspace");
    // Astro persists the assistant across navigation. Its ready history stays
    // ready only while both the actual island and its authenticated scope match.
    const sameScope=!!seed && !!s.seed && seed.targetId===s.seed.targetId && seed.user.userId===s.seed.user.userId
      && seed.user.username===s.seed.user.username && seed.user.bridgeSessionId===s.seed.user.bridgeSessionId;
    s.history=s.history && !s.invalid && !!workspace && workspace===s.workspace && sameScope;
    s.node=node;s.workspace=workspace;s.invalid=false;s.seed=seed;s.until=Date.now()+20_000;
  }
  return s;
}
export function startupSeed():Seed|null {
  if(typeof window==="undefined")return null;
  const s=state(); if(s.invalid||Date.now()>s.until)return null;
  let target="",bridge="";
  try{target=sessionStorage.getItem("panel-active-target-scope")??"";bridge=sessionStorage.getItem("panel-active-bridge-session")??"";}catch{}
  const username=document.getElementById("messenger-link")?.getAttribute("data-me");
  if(username && s.seed?.user.username && username!==s.seed.user.username)return null;
  if(target && target!==s.seed?.targetId)return null;
  if(bridge && bridge!==(s.seed?.user.bridgeSessionId??""))return null;
  return s.seed;
}
export function hasStartupShell(){return typeof document!=="undefined"&&!!document.getElementById("lxp-ui-bootstrap");}
export function invalidateStartup(){if(typeof window!=="undefined"){const s=state();s.seed=null;s.invalid=true;}}
export function historyReady(){if(typeof window!=="undefined"){const s=state();s.history=true;s.workspace=document.getElementById("persistent-assistant-workspace");window.dispatchEvent(new Event("lxp:startup:history-ready"));}}
/** Only peripheral reads wait here. A failed history must also release the gate. */
export function afterPrimaryReady(task:()=>void, delay = 500):()=>void {
  let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
  const run=()=>{if(stopped)return;window.removeEventListener("lxp:startup:history-ready",schedule);timer=setTimeout(()=>{if(!stopped)task();},delay);};
  const schedule=()=>{if(timer)clearTimeout(timer);run();};
  if(!hasStartupShell()||state().history)schedule();
  else {window.addEventListener("lxp:startup:history-ready",schedule);timer=setTimeout(run,10_000);}
  return ()=>{stopped=true;if(timer)clearTimeout(timer);window.removeEventListener("lxp:startup:history-ready",schedule);};
}
