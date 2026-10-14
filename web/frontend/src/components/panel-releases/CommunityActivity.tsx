import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
interface Entry { id: string; kind: string; title: string; author: string; url: string; updatedAt: string; read: boolean }
interface Activity { items: Entry[]; unread: number; error?: string }
export default function CommunityActivity({ labels: L }: { labels: Record<string, string> }) {
  const [feed, setFeed] = useState<Activity>(); const [error, setError] = useState("");
  const [targetEpoch, setTargetEpoch] = useState(0);
  useEffect(() => { const reset = () => { generation.current++; setFeed(undefined); setError(""); setTargetEpoch((n) => n + 1); }; window.addEventListener("luxipanel:target-changed", reset); return () => window.removeEventListener("luxipanel:target-changed", reset); }, []);
  const dialog = useRef<HTMLDialogElement>(null); const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    const load = async () => { try { const result = await api.get<Activity>("/api/ui/community"); if (generation.current === current && result.ok && result.data) setFeed(result.data); } catch { /* release settings exposes availability */ } };
    void load(); const timer = setInterval(() => { if (!document.hidden) void load(); }, 60000);
    return () => { generation.current++; clearInterval(timer); };
  }, [targetEpoch]);
  const read = async (id: string) => { try { const result = await api.post(`/api/ui/community/${id}/read`, {}); if (!result.ok) throw new Error(result.error); setFeed((prior) => prior ? { ...prior, items: prior.items.map((item) => item.id === id ? { ...item, read: true } : item), unread: Math.max(0, prior.unread - (prior.items.some((item) => item.id === id && !item.read) ? 1 : 0)) } : prior); } catch (cause) { setError((cause as Error).message); } };
  return <>
    <button type="button" className="inline-flex min-h-11 items-center gap-2 px-3 text-xs" aria-label={L.title} onClick={() => dialog.current?.showModal()}><i className="ti ti-bell" />{L.title}{!!feed?.unread && <span className="rounded-full bg-primary px-1.5 text-primary-foreground">{feed.unread}</span>}</button>
    <dialog ref={dialog} className="w-[min(95vw,42rem)] max-h-[85vh] rounded-xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40">
      <header className="flex items-center justify-between border-b border-border p-4"><h2 className="font-semibold">{L.title}</h2><button type="button" className="min-h-11 min-w-11" aria-label={L.close} onClick={() => dialog.current?.close()}><i className="ti ti-x" /></button></header>
      <div className="max-h-[65vh] overflow-auto p-4">{(error || feed?.error) && <p role="status" className="mb-3 break-words text-sm text-muted-foreground">{error || feed?.error}</p>}{!feed?.items.length && <p className="text-sm text-muted-foreground">{L.empty}</p>}
        {feed?.items.map((item) => <article key={item.id} className={`mb-3 rounded-lg border border-border p-3 ${!item.read ? 'bg-primary/5' : ''}`}><p className="mb-1 text-xs text-muted-foreground">@{item.author} · {new Date(item.updatedAt).toLocaleString()}</p><p className="whitespace-pre-wrap break-words text-sm">{item.title}</p><div className="mt-2 flex flex-wrap items-center gap-3 text-xs">{/^https:\/\/github\.com\/Luxisoft\/LUXIPANEL\/(?:issues|pull)\/\d+(?:#.*)?$/i.test(item.url) && <a href={item.url} target="_blank" rel="noopener noreferrer" className="min-h-10 py-2 text-primary underline">{L.openGithub}</a>}{!item.read && <button type="button" className="min-h-10 py-2" onClick={() => void read(item.id)}>{L.read}</button>}</div></article>)}
      </div>
    </dialog>
  </>;
}
