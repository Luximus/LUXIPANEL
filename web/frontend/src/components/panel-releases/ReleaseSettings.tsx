import { useEffect, useState } from "react";
import { installPanelRelease, readPanelReleases, type PanelReleaseStatus } from "@/lib/panel-releases";

export default function ReleaseSettings() {
  const [status, setStatus] = useState<PanelReleaseStatus | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const next = await readPanelReleases(); if (active) setStatus(next); }
      catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "No se pudo consultar GitHub."); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const running = status?.operation?.status === "running";
  const choices = status?.releases.filter(release => release.tag !== status.installed?.tag) ?? [];
  const install = async () => {
    if (!selected) return;
    setBusy(true); setError("");
    try { await installPanelRelease(selected); setStatus(await readPanelReleases()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo iniciar la instalación."); }
    finally { setBusy(false); }
  };
  return <section className="rounded-xl border border-border bg-card p-5 space-y-3" aria-labelledby="panel-release-heading">
    <h3 id="panel-release-heading" className="font-semibold">Versión de LUXIPANEL</h3>
    <p className="text-sm text-muted-foreground">Instalada: {status?.installed?.tag ?? status?.currentVersion ?? "—"}{status?.installed?.commit ? ` · ${status.installed.commit.slice(0, 12)}` : ""}</p>
    {status?.latest && <p className="text-sm">Última publicada: {status.latest.tag} · {status.latest.name}</p>}
    {status?.error && <p className="text-sm text-amber-600">{status.error}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="panel-release-select" className="text-sm">Cambiar o restaurar versión</label>
      <select id="panel-release-select" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={selected} onChange={event => setSelected(event.target.value)} disabled={running || busy}>
        <option value="">Selecciona una Release</option>
        {choices.map(release => <option key={release.tag} value={release.tag}>{release.tag} · {release.name}</option>)}
      </select>
      <button type="button" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={!selected || running || busy} onClick={() => void install()}>{running ? "En curso…" : "Instalar versión"}</button>
    </div>
    {status?.operation && <p className="text-sm" role="status">Operación {status.operation.tag}: {status.operation.status}{status.operation.stage ? ` · ${status.operation.stage}` : ""}{status.operation.error ? ` · ${status.operation.error}` : ""}{status.operation.rollbackError ? ` · Restauración fallida: ${status.operation.rollbackError}` : ""}</p>}
    {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
  </section>;
}
