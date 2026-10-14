import { useEffect, useState } from "react";
import { Settings, Plus, X, Minus, Square, RotateCw, Pencil, Trash2, Server } from "lucide-react";
import type { PanelDesktopState, PanelProfile } from "./panel-desktop";
import "./styles/direct-panels.css";
import messages from "../electron/connections.json";
const locales: Record<string,string> = {es:"Español",en:"English",fr:"Français",de:"Deutsch",it:"Italiano",pt:"Português",ar:"العربية",bn:"বাংলা",hi:"हिन्दी",ja:"日本語",ko:"한국어",ru:"Русский"};
const api = window.panelDesktop;
export default function App() {
  const [state, setState] = useState<PanelDesktopState>({ profiles: [], tabs: [] });
  const [name, setName] = useState(""); const [url, setUrl] = useState(""); const [id, setId] = useState<string>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [checked, setChecked] = useState("");
  const t = (messages as Record<string,typeof messages.en>)[state.language || "en"] || messages.en;
  const overlay = new URLSearchParams(location.search).get("surface") === "settings";
  useEffect(() => {
    if (!api) return;
    const stop = api.subscribe(setState); let active = true;
    void api.state().then(async initial => {
      if (!initial.profiles.length) {
        try { const legacy = JSON.parse(localStorage.getItem("lxp.desktop.standaloneServers.v1") || "{}"); if (Array.isArray(legacy.servers)) initial = await api.migrate(legacy.servers); } catch { /* no old profiles */ }
      }
      if (active) setState(initial);
      if (!overlay && !initial.tabs.length) void api.settings();
    });
    return () => { active = false; stop(); };
  }, []);
  useEffect(() => { document.documentElement.lang = state.language || "en"; document.documentElement.dir = state.language === "ar" ? "rtl" : "ltr"; }, [state.language]);
  if (!api) return <main className="panel-empty">{t.desktopOnly}</main>;
  const edit = (p?: PanelProfile) => { setId(p?.id); setName(p?.name || ""); setUrl(p?.baseUrl || ""); setError(""); setChecked(""); };
  const probe = async () => { setBusy(true); setError(""); try { const result = await api.probe(url); setUrl(result.baseUrl); setChecked(t.available); return result.baseUrl; } catch (e) { setError(/no responde como/.test(String(e)) ? t.notPanel : /URL|dominio|credenciales|Invalid/.test(String(e)) ? t.invalidUrl : t.unreachable); return null; } finally { setBusy(false); } };
  const save = async () => { const baseUrl = await probe(); if (!baseUrl) return; setBusy(true); try { const p = await api.save({ id, name, baseUrl }); edit(); await api.open(p.id); } catch (e) { setError(t.unreachable); } finally { setBusy(false); } };
  if (overlay) return <div className="panel-scrim" onClick={() => void api.hideSettings()}><aside className="panel-settings" role="dialog" aria-modal="true" aria-label={t.connections} onClick={e => e.stopPropagation()}>
    <header><h2><Settings size={20}/> {t.connections}</h2><button aria-label={t.close} onClick={() => void api.hideSettings()}><X size={20}/></button></header>
    <p>{t.deployed}</p><select aria-label={t.language} value={state.language || "en"} onChange={e => void api.language(e.target.value)}>{Object.entries(locales).map(([code,label]) => <option value={code} key={code}>{label}</option>)}</select>
    <div className="panel-profile-list">{state.profiles.map(p => <article key={p.id}><button className="panel-profile" onClick={() => void api.open(p.id)}><Server size={20}/><span><strong>{p.name}</strong><small>{p.baseUrl}</small></span></button><button aria-label={`${t.edit} ${p.name}`} onClick={() => edit(p)}><Pencil size={16}/></button><button aria-label={`${t.remove} ${p.name}`} onClick={() => { if (confirm(`${p.name}: ${t.removePrompt}`)) void api.remove(p.id); }}><Trash2 size={16}/></button></article>)}</div>
    <form onSubmit={e => { e.preventDefault(); void save(); }}><h3>{id ? t.edit : t.add}</h3><label>{t.name}<input value={name} onChange={e => setName(e.target.value)} autoComplete="off"/></label><label>{t.url}<input value={url} onChange={e => { setUrl(e.target.value); setChecked(""); }} placeholder="https://panel.ejemplo.com" required autoComplete="url"/></label><small>{t.urlHint}</small>{error && <p role="alert" className="panel-error">{error}</p>}{checked && <p role="status" className="panel-success">{checked}</p>}<div className="panel-form-actions"><button type="button" disabled={busy || !url} onClick={() => void probe()}>{t.test}</button><button className="panel-primary" disabled={busy}>{busy ? t.connecting : t.save}</button></div>{id && <button type="button" onClick={() => edit()}>{t.cancelEdit}</button>}</form>
  </aside></div>;
  const current = state.tabs.find(t => t.id === state.activeTab);
  return <><div className="panel-titlebar"><strong className="panel-brand">LUXIPANEL</strong><nav aria-label={t.tabs}>{state.tabs.map(tab => <div className={`panel-tab ${tab.id === state.activeTab ? "active" : ""}`} key={tab.id}><button onClick={() => void api.activate(tab.id)}>{state.profiles.find(p => p.id === tab.profileId)?.name || "Panel"}{tab.loading ? " ···" : ""}</button><button aria-label={t.closeTab} onClick={() => void api.close(tab.id)}><X size={14}/></button></div>)}</nav><button aria-label={t.newTab} onClick={() => void api.settings()}><Plus size={18}/></button><button aria-label={t.reload} onClick={() => void api.reload()}><RotateCw size={16}/></button><button aria-label={t.configure} onClick={() => void api.settings()}><Settings size={18}/></button><div className="panel-window"><button aria-label={t.minimize} onClick={() => void api.window("minimize")}><Minus size={16}/></button><button aria-label={t.maximize} onClick={() => void api.window("maximize")}><Square size={14}/></button><button aria-label={t.closeApp} onClick={() => void api.window("close")}><X size={18}/></button></div></div>{!current && <main className="panel-empty"><Server size={42}/><h1>LUXIPANEL</h1><p>{t.selectServer}</p><button onClick={() => void api.settings()}>{t.configure}</button></main>}{current?.error && <div className="panel-load-error" role="alert">{current.error}<button onClick={() => void api.reload()}>{t.retry}</button><button onClick={() => void api.settings()}>{t.configure}</button></div>}</>;
}
