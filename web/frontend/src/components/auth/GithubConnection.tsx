import OwnerContributions from "./OwnerContributions";
// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { githubCopy } from "@/lib/github-copy";
type Status={canEditCore?:boolean;connected:boolean;login?:string;deviceFlowAvailable:boolean};
type Device={id:string;userCode:string;url:string;expiresAt:number;intervalMs:number};
export default function GithubConnection({locale,initial}:{locale:string;initial:Status}) {
 const t=githubCopy(locale),[status,setStatus]=useState(initial),[token,setToken]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[device,setDevice]=useState<Device|null>(null);
 useEffect(()=>{ void api.get<Status>("/api/auth/github",{fresh:true}).then(r=>{if(r.ok&&r.data)setStatus(r.data);}); },[]);
 useEffect(()=>{
  if(!device)return;
  let active=true,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{
   if(!active)return;
   if(Date.now()>=device.expiresAt){setDevice(null);setError(t.failed);return;}
   try {
    const r=await api.post<{pending:boolean;status?:Status}>("/api/auth/github/device/poll",{id:device.id});
    if(!active)return;
    if(!r.ok){setError(r.error||t.failed);setDevice(null);return;}
    if(r.data?.status){setStatus(r.data.status);setDevice(null);return;}
   } catch { if(active)setError(t.failed); }
   if(active)timer=setTimeout(poll,device.intervalMs);
  };
  timer=setTimeout(poll,device.intervalMs);
  return()=>{active=false;clearTimeout(timer);};
 },[device,t.failed]);
 async function connect(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError("");try{const r=await api.post<Status>("/api/auth/github",{token:token.trim()});if(!r.ok||!r.data)throw Error(r.error||t.failed);setToken("");setStatus(r.data);setDevice(null);}catch(e){setError(e instanceof Error?e.message:t.failed);}finally{setBusy(false);}}
 async function start(){setBusy(true);setError("");try{const r=await api.post<Device>("/api/auth/github/device");if(!r.ok||!r.data)throw Error(r.error||t.failed);setDevice(r.data);}catch(e){setError(e instanceof Error?e.message:t.failed);}finally{setBusy(false);}}
 async function disconnect(){setBusy(true);try{const r=await api.delete("/api/auth/github");if(!r.ok)throw Error(r.error||t.failed);setStatus({...status,connected:false,login:undefined});}catch(e){setError(e instanceof Error?e.message:t.failed);}finally{setBusy(false);}}
 const button="inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50";
 return <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
  <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true"><svg viewBox="0 0 24 24" className="size-7" fill="currentColor"><path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.14.68-3.8-1.33-3.8-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.29-.5-1.43.11-2.97 0 0 .95-.3 3.1 1.16a10.8 10.8 0 0 1 5.62 0c2.15-1.46 3.1-1.16 3.1-1.16.61 1.54.23 2.68.11 2.97.72.79 1.16 1.79 1.16 3.02 0 4.32-2.64 5.28-5.15 5.56.4.35.76 1.04.76 2.1v3.07c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z"/></svg></div>
  <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{t.description}</p>
  {status.connected?<div className="mt-6 space-y-3"><p role="status" className="rounded-xl border border-border bg-muted p-4 font-medium">@{status.login}</p><a href="/" className={button+" bg-primary text-primary-foreground hover:bg-primary/90"}>{t.continue}</a><button disabled={busy} onClick={disconnect} className={button+" border border-border hover:bg-muted"}>{t.disconnect}</button></div>:<form className="mt-6 space-y-4" onSubmit={connect}>
   {status.deviceFlowAvailable&&<button type="button" disabled={busy} onClick={start} className={button+" bg-primary text-primary-foreground hover:bg-primary/90"}>{t.browser}</button>}
   {device&&<div className="space-y-3 rounded-xl border border-border p-4" role="status"><p>{t.waiting}</p><code className="block text-center text-2xl font-bold tracking-widest" dir="ltr">{device.userCode}</code><a href={device.url} target="_blank" rel="noopener noreferrer" className={button+" border border-border hover:bg-muted"}>{t.browser}</a></div>}
   <label className="block text-sm font-medium" htmlFor="github-personal-token">{t.token}</label>
   <input id="github-personal-token" type="password" autoComplete="off" spellCheck={false} required maxLength={4096} value={token} onChange={e=>setToken(e.target.value)} className="min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 focus:outline-2 focus:outline-primary" aria-describedby="github-token-help"/>
   <p id="github-token-help" className="text-xs leading-5 text-muted-foreground">{t.tokenHelp} <a className="underline underline-offset-2" href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">GitHub ↗</a></p>
   <button disabled={busy||!token.trim()} className={button+" bg-primary text-primary-foreground hover:bg-primary/90"}>{t.connect}</button>
  </form>}
  {status.canEditCore&&<OwnerContributions locale={locale}/>}
  {error&&<p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
  <button className={button+" mt-4 text-muted-foreground hover:bg-muted"} onClick={async()=>{const r=await api.post("/api/logout");if(r.ok)window.location.replace("/login");else setError(r.error||t.failed);}}>{t.logout}</button>
 </div>;
}
