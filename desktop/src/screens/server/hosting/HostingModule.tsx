/* eslint-disable react-hooks/set-state-in-effect -- lectura remota al montar */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { HardDrive, RefreshCw } from "lucide-react";
import { callServerApi, unwrap } from "../../../api/serverApi";
import type { ModuleProps } from "../module-host";

type Account = { id: number; username: string; displayName?: string | null; email?: string | null; plan: string; status: string; homeRoot: string; diskQuotaMb: number; maxDomains: number; createdAt: string };
export function HostingModule({ serverId, language }: ModuleProps) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("basic");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const response = await callServerApi(serverId, "", "GET", `/api/hosting/accounts?limit=100&search=${encodeURIComponent(search)}`);
    const rows = unwrap<Account[]>(response);
    if (Array.isArray(rows)) setAccounts(rows); else setError(response.error || (es ? "No se pudieron cargar las cuentas." : "Could not load accounts."));
  }, [es, search, serverId]);
  useEffect(() => { void load(); }, [load]);
  const run = async (method: "POST" | "DELETE", path: string, body?: unknown) => {
    setBusy(true); setError(""); setNotice("");
    const response = await callServerApi(serverId, "", method, path, body);
    if (!response.ok) setError(response.error || (es ? "La operación falló." : "Operation failed."));
    else { setNotice(es ? "Cuenta actualizada." : "Account updated."); void load(); }
    setBusy(false);
    return response.ok;
  };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (await run("POST", "/api/hosting/accounts", { username: username.trim(), password, plan, ...(email.trim() ? { email: email.trim() } : {}) })) { setUsername(""); setPassword(""); setEmail(""); }
  };
  return <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-8"><div className="flex items-center gap-2"><HardDrive size={20} className="text-primary" /><h2 className="flex-1 text-xl font-semibold">Hosting</h2><button className="btn btn-ghost btn-sm" type="button" onClick={() => void load()}><RefreshCw size={15} />{es ? "Actualizar" : "Refresh"}</button></div>
    {error && <p role="alert" className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}{notice && <p role="status" className="rounded-lg bg-success/10 p-3 text-sm text-success">{notice}</p>}
    <form onSubmit={(event) => void create(event)} className="rounded-xl border border-base-300 p-4"><h3 className="mb-3 text-sm font-semibold">{es ? "Nueva cuenta" : "New account"}</h3><div className="flex flex-wrap items-end gap-2"><label className="text-xs">{es ? "Usuario" : "Username"}<input className="input input-bordered input-sm mt-1 block" required minLength={3} maxLength={32} pattern="[a-z][a-z0-9_-]*" value={username} onChange={(event) => setUsername(event.target.value)} /></label><label className="text-xs">{es ? "Contraseña" : "Password"}<input type="password" className="input input-bordered input-sm mt-1 block" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label><label className="text-xs">Email<input type="email" className="input input-bordered input-sm mt-1 block" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="text-xs">Plan<select className="select select-bordered select-sm mt-1 block" value={plan} onChange={(event) => setPlan(event.target.value)}>{["basic", "pro", "business", "custom"].map((p) => <option key={p}>{p}</option>)}</select></label><button className="btn btn-primary btn-sm" disabled={busy}>{es ? "Crear cuenta" : "Create account"}</button></div></form>
    <input className="input input-bordered input-sm w-full" placeholder={es ? "Buscar cuentas" : "Search accounts"} value={search} onChange={(event) => setSearch(event.target.value)} /><div className="overflow-auto rounded-xl border border-base-300"><table className="table table-sm"><thead><tr><th>{es ? "Cuenta" : "Account"}</th><th>Plan</th><th>{es ? "Estado" : "Status"}</th><th>{es ? "Directorio" : "Home"}</th><th>{es ? "Cuota" : "Quota"}</th><th></th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><strong>{account.username}</strong><span className="block text-xs opacity-60">{account.email}</span></td><td>{account.plan}</td><td>{account.status}</td><td className="font-mono text-xs">{account.homeRoot}</td><td className="text-xs">{account.diskQuotaMb} MB · {account.maxDomains} {es ? "dominios" : "domains"}</td><td className="whitespace-nowrap">{account.status === "active" || account.status === "suspended" ? <button type="button" className="btn btn-outline btn-xs" disabled={busy} onClick={() => { const action = account.status === "active" ? "suspend" : "unsuspend"; if (window.confirm(es ? `¿${action} ${account.username}?` : `${action} ${account.username}?`)) void run("POST", `/api/hosting/accounts/${account.id}/${action}`); }}>{account.status === "active" ? (es ? "Suspender" : "Suspend") : (es ? "Reactivar" : "Resume")}</button> : null}</td></tr>)}</tbody></table>{!accounts.length && <p className="p-4 text-sm opacity-60">{es ? "Sin cuentas." : "No accounts."}</p>}</div>
  </div>;
}
