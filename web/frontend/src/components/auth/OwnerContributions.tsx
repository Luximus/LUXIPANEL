import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { contributionCopy } from "@/lib/github-copy";
import { contributionReviewCopy } from "@/lib/contribution-review-copy";
type Entry = { id: string; status: string; updatedAt: string; commit?: string; error?: string; ci?: string; sourceCommit?: string; checksUrl?: string; canRetry?: boolean; canReview?: boolean; recoveredBy?: string; files?: string[] };
type Preview = { id: string; snapshotHash: string; files: string[]; patch: string };
export default function OwnerContributions({ locale, onUpdated }: { locale: string; onUpdated?: () => Promise<void> }) {
 const t = contributionCopy(locale), r = contributionReviewCopy(locale);
 const [items, setItems] = useState<Entry[]>([]), [busy, setBusy] = useState("");
 const [preview, setPreview] = useState<Preview>(), [error, setError] = useState(""), [notice, setNotice] = useState("");
 const [loading, setLoading] = useState(true);
 const generation = useRef(0), request = useRef(0), action = useRef(false);
 const refresh = useCallback(async () => {
  const current = generation.current, sequence = ++request.current;
  try {
   const response = await api.get<Entry[]>("/api/auth/github/contributions", { fresh: true });
   if (current !== generation.current || sequence !== request.current) return;
   if (!response.ok || !Array.isArray(response.data)) throw new Error(response.error || r.failed);
   setItems(response.data);
  } catch (cause) { if (current === generation.current && sequence === request.current) setError(cause instanceof Error ? cause.message : r.failed); }
  finally { if (current === generation.current && sequence === request.current) setLoading(false); }
 }, [r.failed]);
 useEffect(() => {
  const reset = () => { generation.current++; request.current++; setItems([]); setPreview(undefined); setError(""); setNotice(""); setBusy(""); action.current = false; setLoading(true); void refresh(); };
  void refresh();
  const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
  window.addEventListener("luxipanel:target-changed", reset);
  return () => { generation.current++; clearInterval(timer); window.removeEventListener("luxipanel:target-changed", reset); };
 }, [refresh]);
 const run = async (id: string, operation: "preview" | "recover" | "retry") => {
  if (action.current) return;
  action.current = true; const current = generation.current;
  setBusy(id); setError(""); setNotice("");
  try {
   if (operation === "preview") {
    const response = await api.get<Preview>(`/api/auth/github/contributions/${id}/recovery`, { fresh: true });
    if (current !== generation.current) return;
    if (!response.ok || !response.data) throw new Error(response.error || r.failed);
    setPreview(response.data);
   } else {
    if (operation === "recover" && preview?.id !== id) return;
    const response = await api.post(`/api/auth/github/contributions/${operation}`, operation === "recover" ? { id, snapshotHash: preview!.snapshotHash } : { id });
    if (current !== generation.current) return;
    if (!response.ok) throw new Error(response.error || r.failed);
    setPreview(undefined); setNotice(r.queued); await refresh();
    if (current === generation.current) await onUpdated?.();
   }
  } catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : r.failed); }
  finally { if (current === generation.current) { action.current = false; setBusy(""); } }
 };
 const buttonClass = "mt-2 rounded-md border border-border px-3 py-2 hover:bg-muted disabled:opacity-50";
 return <section className="my-4 border-t border-border pt-4" aria-label={t.title}>
  <h2 className="text-sm font-semibold">{t.title}</h2>
  {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  {notice && <p role="status" className="mt-2 text-sm">{notice}</p>}
  {loading ? <p role="status" className="mt-2 text-sm text-muted-foreground">{r.loading}</p> : !items.length && !error && <p className="mt-2 text-sm text-muted-foreground">{r.empty}</p>}
  <ul className="mt-3 max-h-80 space-y-3 overflow-y-auto">{items.map(item => <li key={item.id} className="rounded-lg border border-border p-3 text-xs">
   <p className="font-medium">{item.recoveredBy ? r.recovered : t.status[item.status] || t.status.blocked}</p>
   <time className="text-muted-foreground" dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleString(locale)}</time>
   {item.status === "pushed" && item.commit && <a target="_blank" rel="noopener noreferrer" className="ml-2 underline" href={"https://github.com/Luxisoft/LUXIPANEL/commit/" + item.commit}>{item.commit.slice(0, 8)} ↗</a>}
   {item.ci && <p className="mt-1 text-muted-foreground">{t.checks[item.ci] || t.ci}{item.checksUrl && <a target="_blank" rel="noopener noreferrer" className="ml-2 underline" href={item.checksUrl}>GitHub ↗</a>}</p>}
   {item.sourceCommit && item.status !== "pushed" && <p className="mt-1 text-muted-foreground">{t.saved}: {item.sourceCommit.slice(0, 8)}</p>}
   {item.error && !item.recoveredBy && <p className="mt-2 text-destructive">{item.error}</p>}
   {item.canRetry && <button type="button" disabled={!!busy} className={buttonClass} onClick={() => void run(item.id, "retry")}>{t.retry}</button>}
   {item.canReview && <button type="button" disabled={!!busy} className={buttonClass} onClick={() => void run(item.id, "preview")}>{r.review}</button>}
  </li>)}</ul>
  {preview && <div className="mt-4 space-y-3 rounded-lg border border-border p-3" aria-label={r.review}>
   <p className="text-sm">{r.description}</p>
   <details><summary className="cursor-pointer text-sm">{r.files} ({preview.files.length})</summary><ul className="mt-2 break-all text-xs">{preview.files.map(file => <li key={file}>{file}</li>)}</ul></details>
   <pre dir="ltr" className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{preview.patch}</pre>
   <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={!!busy} onClick={() => void run(preview.id, "recover")}>{r.publish}</button><button type="button" className={buttonClass} disabled={!!busy} onClick={() => setPreview(undefined)}>{r.close}</button></div>
  </div>}
 </section>;
}
