/* eslint-disable react-hooks/set-state-in-effect -- consulta remota al montar el módulo */
import { useLiveModuleData } from "../../../lib/use-live-module-data";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LockKeyhole, Plus, RefreshCw, Shield, Trash2 } from "lucide-react";
import { callServerApi, unwrap, withJob, type HttpMethod } from "../../../api/serverApi";
import type { ModuleProps } from "../module-host";

type Rule = { number: number; to?: string; from?: string; action?: string; comment?: string };
type Jail = { name?: string; jail?: string; banned?: string[]; bannedIps?: string[]; currentlyBanned?: number };
type Overview = { ufw?: { active?: boolean; installed?: boolean; logging?: string }; fail2ban?: { installed?: boolean; jails?: Jail[] } };

export function FirewallModule({ serverId, language }: ModuleProps) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<"allow" | "deny" | "limit" | "reject">("allow");
  const [port, setPort] = useState("");
  const [proto, setProto] = useState<"tcp" | "udp" | "any">("any");
  const [from, setFrom] = useState("any");
  const [comment, setComment] = useState("");
  const [jail, setJail] = useState("");
  const [ip, setIp] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true); setError("");
    const [statusRes, rulesRes] = await Promise.all([
      callServerApi(serverId, "", "GET", "/api/firewall/status"),
      callServerApi(serverId, "", "GET", "/api/firewall/rules"),
    ]);
    if (!statusRes.ok || !rulesRes.ok) setError(es ? "No se pudo consultar el firewall." : "Could not load the firewall.");
    if (statusRes.ok) setOverview(unwrap<Overview>(statusRes));
    const data = unwrap<Rule[]>(rulesRes);
    if (rulesRes.ok) setRules(Array.isArray(data) ? data : []);
    setBusy(false);
  }, [es, serverId]);
  useLiveModuleData(serverId, ["firewall/rules"], refresh);

  useEffect(() => { void refresh(); }, [refresh]);

  const mutate = async (method: HttpMethod, path: string, body?: unknown) => {
    setBusy(true); setError(""); setNotice("");
    const result = await callServerApi(serverId, "", method, path, body);
    if (result.ok) {
      const job = await withJob(result, serverId, "");
      if (job?.state === "failed") setError(job.error || (es ? "La operación falló." : "Action failed."));
      else setNotice(es ? "Cambio aplicado." : "Change applied.");
    } else setError(result.error || (es ? "No se pudo completar la operación." : "Action could not complete."));
    await refresh();
  };

  const addRule = (event: FormEvent) => {
    event.preventDefault();
    if (!port.trim()) return;
    void mutate("POST", "/api/firewall/rules", { action, port: port.trim(), proto, from: from.trim() || "any", comment: comment.trim() || undefined });
  };
  const removeRule = (rule: Rule) => {
    if (!Number.isInteger(rule.number) || !window.confirm(es ? `¿Eliminar la regla ${rule.number}?` : `Delete rule ${rule.number}?`)) return;
    // The server re-reads live UFW state and matches the content before delete.
    const signature = new URLSearchParams(Object.fromEntries(Object.entries({ to: rule.to, from: rule.from, action: rule.action, comment: rule.comment }).filter(([, value]) => typeof value === "string")) as Record<string, string>);
    void mutate("DELETE", `/api/firewall/rules/${rule.number}?${signature}`);
  };

  return <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-8">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Shield size={21} className="text-primary" /><div><h2 className="text-xl font-semibold">Firewall</h2><p className="text-xs opacity-60">UFW · Fail2ban</p></div></div><button type="button" className="btn btn-outline btn-sm" onClick={() => void refresh()} disabled={busy}><RefreshCw size={15} className={busy ? "animate-spin" : ""} />{es ? "Actualizar" : "Refresh"}</button></div>
    {error ? <p role="alert" className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p> : null}{notice ? <p role="status" className="rounded-lg bg-success/10 p-3 text-sm text-success">{notice}</p> : null}
    <section className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-base-300 bg-base-100 p-4"><h3 className="font-semibold">UFW</h3><p className="mt-1 text-sm">{overview?.ufw?.installed ? overview.ufw.active ? (es ? "Activo" : "Active") : (es ? "Detenido" : "Stopped") : (es ? "No instalado" : "Not installed")}</p><p className="mt-1 text-xs opacity-60">Logging: {overview?.ufw?.logging ?? "—"}</p><div className="mt-3 flex flex-wrap gap-2">{overview?.ufw?.installed ? <><button type="button" className="btn btn-primary btn-xs" disabled={busy || overview.ufw.active} onClick={() => void mutate("POST", "/api/firewall/enable")}><LockKeyhole size={13} />{es ? "Activar seguro" : "Enable safely"}</button><button type="button" className="btn btn-outline btn-xs" disabled={busy || !overview.ufw.active} onClick={() => { if (window.confirm(es ? "¿Desactivar el firewall?" : "Disable firewall?")) void mutate("POST", "/api/firewall/disable"); }}>{es ? "Desactivar" : "Disable"}</button></> : <button type="button" className="btn btn-primary btn-xs" disabled={busy} onClick={() => void mutate("POST", "/api/firewall/install", { ufw: true, fail2ban: false })}>{es ? "Instalar UFW" : "Install UFW"}</button>}</div></div><div className="rounded-xl border border-base-300 bg-base-100 p-4"><h3 className="font-semibold">Fail2ban</h3><p className="mt-1 text-sm">{overview?.fail2ban?.installed ? `${overview.fail2ban.jails?.length ?? 0} jails` : (es ? "No instalado" : "Not installed")}</p>{!overview?.fail2ban?.installed ? <button type="button" className="btn btn-primary btn-xs mt-3" disabled={busy} onClick={() => void mutate("POST", "/api/firewall/install", { ufw: false, fail2ban: true })}>{es ? "Instalar Fail2ban" : "Install Fail2ban"}</button> : null}</div></section>
    <section className="rounded-xl border border-base-300 bg-base-100 p-4"><h3 className="mb-3 font-semibold">{es ? "Reglas UFW" : "UFW rules"}</h3><div className="overflow-x-auto"><table className="table table-sm"><thead><tr><th>#</th><th>{es ? "Destino" : "To"}</th><th>{es ? "Acción" : "Action"}</th><th>{es ? "Origen" : "From"}</th><th></th></tr></thead><tbody>{rules.map((rule) => <tr key={`${rule.number}-${rule.to}`}><td>{rule.number}</td><td className="font-mono text-xs">{rule.to ?? "—"}</td><td>{rule.action ?? "—"}</td><td className="font-mono text-xs">{rule.from ?? "—"}</td><td><button type="button" className="btn btn-ghost btn-xs text-error" aria-label={es ? "Eliminar regla" : "Delete rule"} disabled={busy} onClick={() => removeRule(rule)}><Trash2 size={14} /></button></td></tr>)}</tbody></table>{!rules.length ? <p className="p-3 text-sm opacity-60">{es ? "Sin reglas." : "No rules."}</p> : null}</div><form className="mt-4 flex flex-wrap items-end gap-2 border-t border-base-300 pt-4" onSubmit={addRule}><label className="text-xs">{es ? "Acción" : "Action"}<select className="select select-bordered select-sm mt-1 block" value={action} onChange={(event) => setAction(event.target.value as typeof action)}><option value="allow">Allow</option><option value="deny">Deny</option><option value="limit">Limit</option><option value="reject">Reject</option></select></label><label className="text-xs">{es ? "Puerto/servicio" : "Port/service"}<input className="input input-bordered input-sm mt-1 block" required value={port} onChange={(event) => setPort(event.target.value)} placeholder="443" /></label><label className="text-xs">Protocolo<select className="select select-bordered select-sm mt-1 block" value={proto} onChange={(event) => setProto(event.target.value as typeof proto)}><option value="any">Any</option><option value="tcp">TCP</option><option value="udp">UDP</option></select></label><label className="text-xs">{es ? "Desde" : "From"}<input className="input input-bordered input-sm mt-1 block" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="text-xs">{es ? "Comentario" : "Comment"}<input className="input input-bordered input-sm mt-1 block" value={comment} onChange={(event) => setComment(event.target.value)} /></label><button type="submit" className="btn btn-primary btn-sm" disabled={busy}><Plus size={14} />{es ? "Añadir" : "Add"}</button></form></section>
    {overview?.fail2ban?.installed ? <section className="rounded-xl border border-base-300 bg-base-100 p-4"><h3 className="mb-3 font-semibold">Fail2ban jails</h3><div className="flex flex-wrap gap-2">{overview.fail2ban.jails?.map((entry, i) => <span key={i} className="badge badge-outline gap-2">{entry.name || entry.jail || `jail ${i + 1}`} · {entry.currentlyBanned ?? entry.banned?.length ?? entry.bannedIps?.length ?? 0}</span>)}</div><form className="mt-4 flex flex-wrap items-end gap-2 border-t border-base-300 pt-4" onSubmit={(event) => { event.preventDefault(); void mutate("POST", "/api/firewall/fail2ban/ban", { jail, ip }); }}><label className="text-xs">Jail<input className="input input-bordered input-sm mt-1 block" required value={jail} onChange={(event) => setJail(event.target.value)} /></label><label className="text-xs">IP<input className="input input-bordered input-sm mt-1 block" required value={ip} onChange={(event) => setIp(event.target.value)} /></label><button type="submit" className="btn btn-outline btn-sm" disabled={busy}>{es ? "Bloquear" : "Ban"}</button><button type="button" className="btn btn-ghost btn-sm" disabled={busy || !jail || !ip} onClick={() => void mutate("POST", "/api/firewall/fail2ban/unban", { jail, ip })}>{es ? "Desbloquear" : "Unban"}</button></form></section> : null}
  </div>;
}
