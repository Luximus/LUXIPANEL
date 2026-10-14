import { useCallback, useEffect, useRef, useState } from "react";
import { logsRequest, openLogsSettings, type LogsLabels, type Setup } from "./logs-api";

interface LogEvent { id: string; timestamp: string; severity: string; source: string; module: string; message: string; stack?: string; requestId?: string; details?: unknown; url?: string }
interface Job { id: string; status: string; branch: string; commit?: string; prUrl?: string; createdAt: string; error?: string; result?: string; tokens: number; progress: string[]; pendingApproval?: { id: string; path: string; preview?: string }; publication?: string; releaseTag?: string; issueNumber?: number; checks: { name: string; passed: boolean; output: string }[] }
interface Incident { id: string; severity: string; source: string; module: string; message: string; firstSeen: string; lastSeen: string; count: number; sample: LogEvent; repair?: Job }
interface Page { items: Incident[]; total: number; page: number; modules: string[]; sources: string[]; summary: { error: number; warn: number; fatal: number } }
interface Detail { incident: Incident; events: LogEvent[]; total: number; repairs: Job[] }
interface Health { accepted: number; dropped: number; error: string; lastWrite: string; capture: boolean; history: Record<string, { status: string; offset: number }> }
const terminal = new Set(["pr-created", "failed", "canceled", "interrupted", "manual-action"]);
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50";
const input = "min-h-10 min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-xs";
const date = (value: string) => new Date(value).toLocaleString();
export default function LogsPanel({ labels: L, active: externalActive, view = "luxipanel" }: { labels: LogsLabels; active?: boolean; view?: "luxipanel" | "modules" }) {
  const [visible, setVisible] = useState(false); const [page, setPage] = useState<Page>(); const [detail, setDetail] = useState<Detail>();
  const [reportUrl, setReportUrl] = useState("");
  const [selected, setSelected] = useState(""); const [offset, setOffset] = useState(0); const [health, setHealth] = useState<Health>(); const [setup, setSetup] = useState<Setup>();
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false); const [showSources, setShowSources] = useState(false);
  const [filters, setFilters] = useState({ q: "", severity: "", source: "", module: "", state: "", from: "", to: "", page: 1 });
  const [targetEpoch, setTargetEpoch] = useState(0); const scopeEpoch = useRef(0);
  const generation = useRef(0); const selectedRef = useRef(selected); selectedRef.current = selected;
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    if (externalActive !== undefined) { setVisible(externalActive); return () => { generation.current++; }; }
    const dialog = document.getElementById("module-dev-logs-modal") as HTMLDialogElement | null; if (!dialog) return;
    const observe = () => setVisible(dialog.open);
    const observer = new MutationObserver(observe); observer.observe(dialog, { attributes: true, attributeFilter: ["open"] }); observe();
    const gear = document.getElementById("md-logs-settings"); gear?.addEventListener("click", openLogsSettings);
    return () => { observer.disconnect(); gear?.removeEventListener("click", openLogsSettings); generation.current++; };
  }, [externalActive]);
  useEffect(() => { generation.current++; setSelected(""); setReportUrl(""); setDetail(undefined); setPage(undefined); setOffset(0); }, [view]);
  useEffect(() => {
    const reset = () => { generation.current++; scopeEpoch.current++; setSelected(""); setReportUrl(""); setPage(undefined); setDetail(undefined); setSetup(undefined); setHealth(undefined); setError(""); setBusy(false); setFilters((f) => ({ ...f, page: 1, source: "", module: "" })); setTargetEpoch((epoch) => epoch + 1); };
    window.addEventListener("luxipanel:target-changed", reset);
    return () => { scopeEpoch.current++; window.removeEventListener("luxipanel:target-changed", reset); };
  }, []);
  const scoped = (path: string) => `${path}${path.includes("?") ? "&" : "?"}view=${view}`;
  const reload = useCallback(async (quiet = false) => {
    const current = ++generation.current; if (!quiet) setLoading(true);
    try {
      const query = new URLSearchParams(Object.entries(JSON.parse(filtersKey)).map(([k, v]) => [k, String(v)]));
      const data = await logsRequest<Page>("get", `?${query}&view=${view}`);
      if (current !== generation.current) return; setPage(data); setError("");
      if (selectedRef.current) {
        const id = selectedRef.current; const selection = await logsRequest<Detail>("get", `/incidents/${id}?offset=${offset}&view=${view}`);
        if (current === generation.current && selectedRef.current === id) setDetail(selection);
      }
    } catch (e) { if (current === generation.current) setError((e as Error).message); }
    finally { if (current === generation.current) setLoading(false); }
  }, [filtersKey, offset, view, targetEpoch]);
  const loadSetup = useCallback(async () => {
    const epoch = scopeEpoch.current;
    try { const [config, state] = await Promise.all([logsRequest<Setup>("get", "/config"), logsRequest<Health>("get", "/status")]); if (epoch === scopeEpoch.current) { setSetup(config); setHealth(state); } } catch (e) { if (epoch === scopeEpoch.current) setError((e as Error).message); }
  }, [targetEpoch]);
  useEffect(() => { if (!visible) return; void reload(); void loadSetup(); const timer = window.setInterval(() => { if (!document.hidden) void reload(true); }, 5000); return () => { clearInterval(timer); generation.current++; }; }, [visible, reload, loadSetup]);
  useEffect(() => { if (!selected || !visible) return; void reload(); }, [selected]);
  useEffect(() => { const listener = () => void loadSetup(); window.addEventListener("lxp:logs:config-updated", listener); return () => window.removeEventListener("lxp:logs:config-updated", listener); }, [loadSetup]);
  const change = (key: keyof typeof filters, value: string) => { setFilters((f) => ({ ...f, [key]: value, page: 1 })); };
  const action = async (path: string, body?: unknown) => { if (busy) return; const epoch = scopeEpoch.current; setBusy(true); setError(""); try { await logsRequest("post", scoped(path), body); if (epoch === scopeEpoch.current) await reload(true); } catch (e) { if (epoch === scopeEpoch.current) setError((e as Error).message); } finally { if (epoch === scopeEpoch.current) setBusy(false); } };
  const severity = (value: string) => <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium ${value === "warn" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-destructive/10 text-destructive"}`}><i className={`ti ${value === "warn" ? "ti-alert-triangle" : "ti-alert-circle"}`} aria-hidden="true" />{L[`severity-${value}`] || value}</span>;
  const status = (value: string) => L[`status-${value}`] || value;
  const active = detail?.repairs.find((j) => !terminal.has(j.status));
  return <div data-logs-panel data-logs-selected={Boolean(selected)} className="flex h-full min-h-0 w-full flex-col">
    <div className="shrink-0 space-y-3 border-b border-border px-3 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-3 text-xs"><span className="font-medium">{page?.total || 0} {L.incidents}</span><span className="text-destructive">{page?.summary.error || 0} {L.errors}</span><span className="text-amber-600 dark:text-amber-400">{page?.summary.warn || 0} {L.warnings}</span>{!!page?.summary.fatal && <span className="text-destructive">{page.summary.fatal} {L.fatals}</span>}</div>
        <div className="flex items-center gap-1"><button type="button" className={button} onClick={() => { setShowSources(!showSources); void loadSetup(); }} aria-expanded={showSources}><i className="ti ti-activity" />{L.sources}</button><button type="button" className={button} onClick={() => void reload()} disabled={loading} aria-label={L.refresh}><i className={`ti ti-refresh ${loading ? "animate-spin" : ""}`} /></button></div></div>
      <div data-logs-filters className={`${selected ? "hidden md:grid" : "grid"} grid-cols-2 gap-2 sm:grid-cols-4`}><input aria-label={L.search} type="search" className={`${input} col-span-2`} placeholder={L.search} value={filters.q} onChange={(e) => change("q", e.target.value)} />
        <select aria-label={L.severity} className={input} value={filters.severity} onChange={(e) => change("severity", e.target.value)}><option value="">{L.allSeverities}</option>{["warn", "error", "fatal"].map((v) => <option key={v} value={v}>{L[`severity-${v}`]}</option>)}</select>
        <select aria-label={L.state} className={input} value={filters.state} onChange={(e) => change("state", e.target.value)}><option value="">{L.allStates}</option>{["new", "queued", "fixing", "approval", "testing", "publishing", "pr-created", "failed", "interrupted", "manual-action", "canceled"].map((v) => <option key={v} value={v}>{status(v)}</option>)}</select>
        <select aria-label={L.source} className={input} value={filters.source} onChange={(e) => change("source", e.target.value)}><option value="">{L.allSources}</option>{page?.sources.map((v) => <option key={v}>{v}</option>)}</select>
        <select aria-label={L.module} className={input} value={filters.module} onChange={(e) => change("module", e.target.value)}><option value="">{L.allModules}</option>{page?.modules.map((v) => <option key={v}>{v}</option>)}</select>
        <input aria-label={L.from} title={L.from} type="date" className={input} value={filters.from} onChange={(e) => change("from", e.target.value)} /><input aria-label={L.to} title={L.to} type="date" className={input} value={filters.to} onChange={(e) => change("to", e.target.value)} />
      </div>
      {showSources && <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs"><p>{health?.capture ? L.captureActive : L.capturePaused} · {health?.accepted || 0} {L.received} · {health?.dropped || 0} {L.dropped}</p><p className="mt-1 text-muted-foreground">{L.historyHint}</p>{health?.error && <p className="mt-2 text-destructive">{health.error}</p>}<ul className="mt-2 space-y-1">{Object.entries(health?.history || {}).map(([name, source]) => <li key={name}><span className="font-mono">{name}</span> · {source.status}</li>)}</ul></div>}
      {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{error}</div>}
    </div>
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      <section data-logs-list aria-label={L.incidents} className={`${selected ? "hidden md:block md:w-[38%] md:shrink-0 md:border-r md:border-border" : "w-full"} min-h-0 overflow-y-auto`}>
        {!page?.items.length && <div className="px-5 py-12 text-center"><i className="ti ti-clipboard-check text-3xl text-muted-foreground" /><h3 className="mt-3 text-sm font-medium">{loading ? L.loading : L.empty}</h3><p className="mx-auto mt-2 max-w-sm text-xs text-muted-foreground">{L.emptyHint}</p></div>}
        {page?.items.map((incident) => <button type="button" key={incident.id} aria-pressed={selected === incident.id} onClick={() => { if (selected !== incident.id) { setDetail(undefined); setReportUrl(""); setSelected(incident.id); setOffset(0); } }} className={`w-full border-b border-border px-4 py-4 text-left transition-colors hover:bg-accent/40 ${selected === incident.id ? "bg-primary/5 shadow-[inset_3px_0_0_var(--color-primary)]" : ""}`}>
          <div className="mb-2 flex flex-wrap items-center gap-2">{severity(incident.severity)}<span className="truncate font-mono text-[11px] text-muted-foreground">{incident.module}</span><span className="ml-auto rounded-md bg-muted px-2 py-1 font-mono text-[11px]">×{incident.count}</span></div>
          <p className="line-clamp-2 break-words text-sm leading-relaxed">{incident.message}</p><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground"><span>{incident.source} · {date(incident.lastSeen)}</span><span className={incident.repair?.status === "pr-created" ? "text-primary" : ""}>{status(incident.repair?.status || "new")}</span></div>
        </button>)}
        {!!page?.total && <div className="flex items-center justify-between gap-2 p-3 text-xs"><button className={button} type="button" disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>{L.previous}</button><span>{filters.page} / {Math.max(1, Math.ceil(page.total / 25))}</span><button className={button} type="button" disabled={filters.page * 25 >= page.total} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>{L.next}</button></div>}
      </section>
      {selected && <section aria-label={L.detail} className="min-h-0 min-w-0 flex-1 overflow-y-auto border-t border-border p-4 md:border-t-0 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{L.detail}</h3><button type="button" onClick={() => { setSelected(""); setReportUrl(""); setDetail(undefined); }} className={button} aria-label={L.close}><i className="ti ti-x" /></button></div>
        {!detail ? <p className="text-sm text-muted-foreground">{L.loading}</p> : <>
          <div className="flex flex-wrap items-center gap-2">{severity(detail.incident.severity)}<span className="font-mono text-xs text-muted-foreground">{detail.incident.module}</span></div><p className="mt-3 break-words text-sm leading-relaxed">{detail.incident.message}</p>
          <dl className="my-4 grid grid-cols-2 gap-3 rounded-lg border border-border p-3 text-xs"><div><dt className="text-muted-foreground">{L.firstSeen}</dt><dd className="mt-1">{date(detail.incident.firstSeen)}</dd></div><div><dt className="text-muted-foreground">{L.lastSeen}</dt><dd className="mt-1">{date(detail.incident.lastSeen)}</dd></div></dl>
          <button type="button" className={button} disabled={busy} onClick={async () => { const epoch = scopeEpoch.current; setBusy(true); try { const result = await logsRequest<{ issueUrl: string }>("post", scoped(`/incidents/${selected}/report`)); if (epoch === scopeEpoch.current && selectedRef.current === selected) setReportUrl(result.issueUrl); } catch (cause) { if (epoch === scopeEpoch.current) setError((cause as Error).message); } finally { if (epoch === scopeEpoch.current) setBusy(false); } }}>{L.report}</button>
          {reportUrl && /^https:\/\/github\.com\/Luxisoft\/LUXIPANEL\/issues\/\d+$/.test(reportUrl) && <a href={reportUrl} target="_blank" rel="noopener noreferrer" className={button}>{L.openIssue}</a>}
          <button type="button" disabled={busy || !setup?.ready || Boolean(active)} onClick={() => void action("/repairs", { incidentId: selected })} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"><i className="ti ti-sparkles" />{busy ? L.starting : active ? status(active.status) : L.fix}</button>
          {!setup?.ready && <button type="button" onClick={openLogsSettings} className="mt-2 w-full text-left text-xs text-muted-foreground underline">{L.setupRequired}</button>}
          <p className="mt-2 text-[11px] text-muted-foreground">{L.deliveryHint}</p>
          {detail.repairs.map((job) => <article key={job.id} className="mt-5 space-y-3 rounded-xl border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><strong>{status(job.status)}</strong><span className="text-muted-foreground">{date(job.createdAt)}</span></div>
            <div className="break-all font-mono text-[11px] text-muted-foreground">{job.branch}{job.commit && <span> · {job.commit.slice(0, 8)}</span>} · {job.tokens.toLocaleString()} {L.tokens}</div>
            {job.pendingApproval && <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs"><p>{L.approvalRequired} <code className="break-all">{job.pendingApproval.path}</code></p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-3 font-mono text-[11px]">{job.pendingApproval.preview}</pre><div className="flex gap-2"><button className={button} disabled={busy} type="button" onClick={() => void action(`/repairs/${job.id}/approval`, { permissionId: job.pendingApproval!.id, allow: true })}>{L.approve}</button><button className={button} disabled={busy} type="button" onClick={() => void action(`/repairs/${job.id}/approval`, { permissionId: job.pendingApproval!.id, allow: false })}>{L.deny}</button></div></div>}
            {job.publication && <p className="text-xs font-medium text-primary">{L[`publication-${job.publication}`] || job.publication}{job.releaseTag && ` · ${job.releaseTag}`}</p>}
            {job.error && <p className="break-words text-xs text-destructive">{job.error}</p>}
            {job.prUrl && /^https:\/\/github\.com\/Luxisoft\/LUXIPANEL\/pull\/\d+$/i.test(job.prUrl) && <a href={job.prUrl} target="_blank" rel="noopener noreferrer" className={`${button} text-primary`}><i className="ti ti-git-pull-request" />{L.openPr}</a>}
            {!!job.progress.length && <details open={!terminal.has(job.status)}><summary className="cursor-pointer text-xs font-medium">{L.progress}</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">{job.progress.join("\n")}</pre></details>}
            {job.result && <details><summary className="cursor-pointer text-xs font-medium">{L.diagnosis}</summary><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed">{job.result}</p></details>}
            {!!job.checks.length && <div className="space-y-2">{job.checks.map((check, index) => <details key={`${check.name}-${index}`}><summary className={`cursor-pointer text-xs ${check.passed ? "text-primary" : "text-destructive"}`}>{check.passed ? "✓" : "×"} {L[`check-${check.name}`]}</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-3 font-mono text-[11px]">{check.output}</pre></details>)}</div>}
            {!terminal.has(job.status) && <button type="button" className={button} disabled={busy} onClick={() => void action(`/repairs/${job.id}/cancel`)}>{L.cancel}</button>}{["failed", "interrupted", "canceled", "manual-action"].includes(job.status) && <button type="button" className={button} disabled={busy} onClick={() => void action(`/repairs/${job.id}/retry`)}>{job.commit ? L.retryPublish : L.retry}</button>}
          </article>)}
          <div className="mt-5 border-t border-border pt-4"><h4 className="mb-3 text-xs font-semibold">{L.records} · {detail.total}</h4>{detail.events.map((event) => <details key={event.id} className="mb-2 rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs"><time>{date(event.timestamp)}</time>{event.requestId && <span className="ml-2 font-mono text-muted-foreground">{event.requestId}</span>}</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">{JSON.stringify(event, null, 2)}</pre></details>)}
            {detail.total > 100 && <div className="flex items-center justify-between"><button type="button" className={button} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}>{L.previous}</button><span className="text-xs">{offset + 1}–{Math.min(offset + 100, detail.total)} / {detail.total}</span><button type="button" className={button} disabled={offset + 100 >= detail.total} onClick={() => setOffset(offset + 100)}>{L.next}</button></div>}
          </div>
        </>}
      </section>}
    </div>
  </div>;
}
