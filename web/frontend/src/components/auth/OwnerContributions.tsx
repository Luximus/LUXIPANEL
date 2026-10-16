import {useEffect,useState,useCallback} from "react";
import {api} from "@/lib/api-client";
import {contributionCopy} from "@/lib/github-copy";
type Entry={id:string;status:string;updatedAt:string;commit?:string;error?:string;ci?:string;sourceCommit?:string;checksUrl?:string};
export default function OwnerContributions({locale}:{locale:string}){
 const t=contributionCopy(locale),[items,setItems]=useState<Entry[]>([]),[busy,setBusy]=useState("");
 const refresh=useCallback(async()=>{const r=await api.get<Entry[]>("/api/auth/github/contributions",{fresh:true});if(r.ok&&r.data)setItems(r.data);},[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer);},[refresh]);
 if(!items.length)return null;
 return <section className="mt-6 border-t border-border pt-5" aria-label={t.title}><h2 className="text-sm font-semibold">{t.title}</h2><ul className="mt-3 max-h-64 space-y-3 overflow-y-auto">{items.map(item=><li key={item.id} className="rounded-lg border border-border p-3 text-xs">
  <p className="font-medium">{t.status[item.status]||t.status.blocked}</p><time className="text-muted-foreground" dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleString(locale)}</time>
  {item.status==="pushed"&&item.commit&&<a target="_blank" rel="noopener noreferrer" className="ml-2 underline" href={"https://github.com/Luxisoft/LUXIPANEL/commit/"+item.commit}>{item.commit.slice(0,8)} ↗</a>}
  {item.ci&&<p className="mt-1 text-muted-foreground">{t.checks[item.ci]||t.ci}{item.checksUrl&&<a target="_blank" rel="noopener noreferrer" className="ml-2 underline" href={item.checksUrl}>GitHub ↗</a>}</p>}
  {item.sourceCommit&&item.status!=="pushed"&&<p className="mt-1 text-muted-foreground">{t.saved}: {item.sourceCommit.slice(0,8)}</p>}
  {item.error&&<p className="mt-2 text-destructive">{item.error}</p>}
  {["blocked","pending"].includes(item.status)&&<button disabled={!!busy} className="mt-2 rounded-md border border-border px-3 py-2 hover:bg-muted disabled:opacity-50" onClick={async()=>{setBusy(item.id);try{await api.post("/api/auth/github/contributions/retry",{id:item.id});await refresh();}finally{setBusy("");}}}>{t.retry}</button>}
 </li>)}</ul></section>;
}
