/* eslint-disable react-hooks/set-state-in-effect -- historial remoto al abrir */
import { useLiveModuleData } from "../../../lib/use-live-module-data";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Archive, Download, Play, RefreshCw, Trash2 } from "lucide-react";
import { callServerApi, downloadServerFile, unwrap } from "../../../api/serverApi";
import type { ModuleProps } from "../module-host";

type Backup = { id: number; label: string; provider: string; status: string; destination: string | null; sizeBytes: number | null; startedAt: string; error: string | null };
type Storage = { id: string | number; name?: string; provider?: string };
type Schedule = { id: number; name: string; schedule: string; enabled: boolean; provider?: string; lastRunAt?: string | null };
const size = (bytes: number | null) => bytes == null ? "—" : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function BackupsModule({ serverId, language }: ModuleProps) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [backups, setBackups] = useState<Backup[]>([]);
  const [storages, setStorages] = useState<Storage[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [label, setLabel] = useState("manual");
  const [storageId, setStorageId] = useState("local");
  const [includeDatabases, setIncludeDatabases] = useState(false);
  const [includeMail, setIncludeMail] = useState(false);
  const [includePanelConfig, setIncludePanelConfig] = useState(true);
  const [fullServer, setFullServer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setBusy(true); setError("");
    const [backupsRes, storagesRes, schedulesRes] = await Promise.all([
      callServerApi(serverId, "", "GET", "/api/backups?limit=100"),
      callServerApi(serverId, "", "GET", "/api/backups/storages"),
      callServerApi(serverId, "", "GET", "/api/backups/schedules"),
    ]);
    const b = unwrap<Backup[]>(backupsRes), s = unwrap<Storage[]>(storagesRes), jobs = unwrap<Schedule[]>(schedulesRes);
    if (Array.isArray(b)) setBackups(b); else setError(es ? "No se pudo cargar el historial de copias." : "Could not load backup history.");
    setStorages(Array.isArray(s) ? s : []); setSchedules(Array.isArray(jobs) ? jobs : []);
    setBusy(false);
  }, [es, serverId]);
  useLiveModuleData(serverId, ["backup/schedules"], load);

  useEffect(() => { void load(); }, [load]);
  const trigger = async (event: FormEvent) => {
    event.preventDefault();
    if (fullServer && !window.confirm(es ? "La copia completa puede consumir bastantes recursos. ¿Continuar?" : "A full backup may use significant resources. Continue?")) return;
    setBusy(true); setError(""); setNotice("");
    const res = await callServerApi(serverId, "", "POST", "/api/backups", { label, storageId, includeDatabase: false, includeDatabases, includeMail, includePanelConfig, fullServer, includePaths: [] });
    if (!res.ok) setError(res.error || (es ? "No se pudo iniciar la copia." : "Could not start backup."));
    else setNotice(es ? "Copia iniciada; consulta el historial para ver el resultado." : "Backup started; check history for its result.");
    setBusy(false); void load();
  };
  const remove = async (job: Backup) => {
    if (!window.confirm(es ? `¿Eliminar la copia ${job.label}?` : `Delete backup ${job.label}?`)) return;
    setBusy(true); setError("");
    const res = await callServerApi(serverId, "", "DELETE", `/api/backups/${job.id}`);
    if (!res.ok) setError(res.error || (es ? "No se pudo eliminar la copia." : "Could not delete backup."));
    setBusy(false); void load();
  };
  const download = async (job: Backup) => {
    setError("");
    try {
      const blob = await downloadServerFile(serverId, "", `/api/backups/${job.id}/download`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${job.label.replace(/[^A-Za-z0-9_.-]/g, "_")}.tar.gz`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setError(es ? "No se pudo descargar esta copia." : "Could not download this backup."); }
  };

  return <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-8"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Archive size={22} className="text-primary" /><h2 className="text-xl font-semibold">{es ? "Copias de seguridad" : "Backups"}</h2></div><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void load()}><RefreshCw size={15} className={busy ? "animate-spin" : ""} />{es ? "Actualizar" : "Refresh"}</button></div>{error ? <p role="alert" className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p> : null}{notice ? <p role="status" className="rounded-lg bg-success/10 p-3 text-sm text-success">{notice}</p> : null}
    <form onSubmit={(event) => void trigger(event)} className="rounded-xl border border-base-300 bg-base-100 p-4"><h3 className="mb-3 text-sm font-semibold">{es ? "Nueva copia" : "New backup"}</h3><div className="flex flex-wrap items-end gap-3"><label className="text-xs">{es ? "Etiqueta" : "Label"}<input className="input input-bordered input-sm mt-1 block" required value={label} onChange={(event) => setLabel(event.target.value)} /></label><label className="text-xs">{es ? "Destino" : "Storage"}<select className="select select-bordered select-sm mt-1 block" value={storageId} onChange={(event) => setStorageId(event.target.value)}><option value="local">Local</option>{storages.filter((storage) => String(storage.id) !== "local").map((storage) => <option key={storage.id} value={storage.id}>{storage.name || storage.provider || storage.id}</option>)}</select></label><button type="submit" className="btn btn-primary btn-sm" disabled={busy}><Play size={14} />{es ? "Iniciar copia" : "Start backup"}</button></div><div className="mt-3 flex flex-wrap gap-4">{[[includeDatabases, setIncludeDatabases, es ? "Bases de datos" : "Databases"], [includeMail, setIncludeMail, "Mail"], [includePanelConfig, setIncludePanelConfig, es ? "Config. panel" : "Panel config"], [fullServer, setFullServer, es ? "Servidor completo" : "Full server"]].map(([checked, setter, text]) => <label key={String(text)} className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="checkbox checkbox-xs" checked={Boolean(checked)} onChange={(event) => (setter as (v: boolean) => void)(event.target.checked)} />{String(text)}</label>)}</div></form>
    <section className="overflow-hidden rounded-xl border border-base-300 bg-base-100"><h3 className="border-b border-base-300 p-4 text-sm font-semibold">{es ? "Historial" : "History"}</h3><div className="overflow-x-auto"><table className="table table-sm"><thead><tr><th>{es ? "Copia" : "Backup"}</th><th>{es ? "Estado" : "Status"}</th><th>{es ? "Destino" : "Storage"}</th><th>{es ? "Tamaño" : "Size"}</th><th>{es ? "Fecha" : "Date"}</th><th></th></tr></thead><tbody>{backups.map((job) => <tr key={job.id}><td><span className="font-medium">{job.label}</span>{job.error ? <p className="max-w-xs truncate text-xs text-error" title={job.error}>{job.error}</p> : null}</td><td><span className={`badge badge-sm ${job.status === "completed" ? "badge-success" : job.status === "failed" ? "badge-error" : "badge-warning"}`}>{job.status}</span></td><td>{job.provider}</td><td>{size(job.sizeBytes)}</td><td className="text-xs">{job.startedAt ? new Date(job.startedAt).toLocaleString() : "—"}</td><td className="whitespace-nowrap">{job.status === "completed" && job.provider === "local" ? <button type="button" className="btn btn-ghost btn-xs" onClick={() => void download(job)} aria-label={es ? "Descargar" : "Download"}><Download size={14} /></button> : null}<button type="button" className="btn btn-ghost btn-xs text-error" disabled={busy} onClick={() => void remove(job)} aria-label={es ? "Eliminar" : "Delete"}><Trash2 size={14} /></button></td></tr>)}</tbody></table>{!backups.length ? <p className="p-4 text-sm opacity-60">{es ? "Sin copias todavía." : "No backups yet."}</p> : null}</div></section><section className="rounded-xl border border-base-300 bg-base-100 p-4"><h3 className="mb-2 text-sm font-semibold">{es ? "Programaciones" : "Schedules"}</h3>{schedules.length ? <div className="divide-y divide-base-300">{schedules.map((schedule) => <div key={schedule.id} className="flex items-center gap-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate">{schedule.name}</span><code className="text-xs">{schedule.schedule}</code><span className={`badge badge-sm ${schedule.enabled ? "badge-success" : "badge-ghost"}`}>{schedule.enabled ? (es ? "Activa" : "Active") : (es ? "Pausada" : "Paused")}</span></div>)}</div> : <p className="text-sm opacity-60">{es ? "Sin programaciones." : "No schedules."}</p>}</section></div>;
}
