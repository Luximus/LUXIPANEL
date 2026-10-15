import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { readReleaseDetails, translateReleaseDetails, versionTag, type PanelReleaseDetails, type PanelReleaseStatus } from "@/lib/panel-releases";
interface Entry { id: string; kind: string; title: string; author: string; url: string; updatedAt: string; read: boolean }
interface Activity { items: Entry[]; unread: number; error?: string }
interface Props {
  labels: Record<string, string>; locale: string; status: PanelReleaseStatus | null; installedVersion: string;
  canInstall: boolean; busy: boolean; error: string; onInstall: (tag: string) => Promise<void>;
}
export default function CommunityActivity({ labels: L, locale, status, installedVersion, canInstall, busy, error: installError, onInstall }: Props) {
  const [feed, setFeed] = useState<Activity>();
  const [error, setError] = useState("");
  const [targetEpoch, setTargetEpoch] = useState(0);
  const [opened, setOpened] = useState(false);
  const [selected, setSelected] = useState("");
  const [details, setDetails] = useState<PanelReleaseDetails>();
  const [translated, setTranslated] = useState<PanelReleaseDetails>();
  const [translating, setTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const heading = useId();
  const installed = versionTag(status?.currentVersion || installedVersion);
  const update = !!status?.updateAvailable;
  const tag = selected || status?.latest?.tag || "";
  useEffect(() => {
    const reset = () => {
      generation.current++; dialog.current?.close(); setOpened(false); setFeed(undefined); setDetails(undefined);
      setTranslated(undefined); setSelected(""); setError(""); setTargetEpoch(value => value + 1);
    };
    window.addEventListener("luxipanel:target-changed", reset);
    return () => window.removeEventListener("luxipanel:target-changed", reset);
  }, []);
  useEffect(() => {
    const current = ++generation.current;
    const load = async () => {
      try { const result = await api.get<Activity>("/api/ui/community"); if (generation.current === current && result.ok && result.data) setFeed(result.data); }
      catch { /* A GitHub outage must not hide the installed version. */ }
    };
    void load(); const timer = setInterval(() => { if (!document.hidden) void load(); }, 60000);
    return () => { generation.current++; clearInterval(timer); };
  }, [targetEpoch]);
  useEffect(() => {
    let active = true;
    setDetails(undefined); setTranslated(undefined); setShowOriginal(false); setTranslating(false); setError("");
    if (!opened || !tag) return;
    void (async () => {
      try {
        const original = await readReleaseDetails(tag);
        if (!active) return;
        setDetails(original);
        if (locale !== "en") {
          setTranslating(true);
          try { const next = await translateReleaseDetails(tag, locale); if (active) setTranslated(next); }
          catch { if (active) setTranslated({ ...original, translation: "unavailable" }); }
          finally { if (active) setTranslating(false); }
        }
      } catch { if (active) setError(L.loadError); }
    })();
    return () => { active = false; };
  }, [opened, tag, locale, targetEpoch, L.loadError]);
  const read = async (id: string) => {
    const current = generation.current;
    try {
      const result = await api.post(`/api/ui/community/${id}/read`, {});
      if (current !== generation.current) return;
      if (!result.ok) throw new Error(result.error);
      setFeed(prior => prior ? { ...prior, items: prior.items.map(item => item.id === id ? { ...item, read: true } : item), unread: Math.max(0, prior.unread - (prior.items.some(item => item.id === id && !item.read) ? 1 : 0)) } : prior);
    } catch { if (current === generation.current) setError(L.loadError); }
  };
  const displayed = !showOriginal && translated?.translation === "translated" ? translated : details;
  const release = displayed || status?.releases.find(release => release.tag === tag);
  const link = (url: string, text: string) => /^https:\/\/github\.com\/Luxisoft\/LUXIPANEL\/(?:releases\/tag\/v?\d+\.\d+\.\d+|(?:issues|pull)\/\d+(?:#.*)?)$/i.test(url)
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-xs text-primary underline">{text}</a> : null;
  return <>
    <button type="button" className="relative inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs hover:bg-muted" aria-label={`${L.title} · ${installed}${update ? ` · ${L.newVersion}: ${status?.latest?.tag}` : ""}`}
      title={`${L.title} · ${update ? L.newVersion : L.installed}`} aria-haspopup="dialog" aria-expanded={opened}
      onClick={() => { setSelected(status?.latest?.tag || ""); dialog.current?.showModal(); setOpened(true); }}>
      <i className="ti ti-brand-git text-lg" aria-hidden="true" /><span className="font-mono">{installed}</span>
      {update && <span data-release-notification className="h-2 w-2 rounded-full bg-primary" role="status"><span className="sr-only">{L.newVersion}: {status?.latest?.tag}</span></span>}
      {!!feed?.unread && <span className="rounded-full bg-primary px-1.5 text-primary-foreground">{feed.unread}</span>}
    </button>
    <dialog ref={dialog} aria-labelledby={heading} onClose={() => setOpened(false)} className="border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40">
      <header className="flex shrink-0 items-center justify-between border-b border-border p-4"><h2 id={heading} className="font-semibold"><i className="ti ti-brand-git me-2" aria-hidden="true" />{L.title}</h2><button type="button" className="min-h-11 min-w-11" aria-label={L.close} onClick={() => dialog.current?.close()}><i className="ti ti-x" aria-hidden="true" /></button></header>
      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
        <section className="space-y-3" aria-label={L.notes}>
          <p className="text-sm text-muted-foreground">{L.installed}: <code>{installed}</code></p>
          {update && <p className="rounded-lg bg-primary/10 p-3 text-sm" role="status">{L.newVersion}: <strong>{status?.latest?.tag}</strong></p>}
          {!!status?.releases.length && <label className="flex items-center gap-3 text-sm">{L.version}<select value={tag} onChange={event => setSelected(event.target.value)} className="min-h-11 rounded-lg border border-border bg-background px-3">{status.releases.map(release => <option key={release.tag} value={release.tag}>{release.tag}</option>)}</select></label>}
          {release && <><h3 className="font-semibold">{release.name} · {L.notes}</h3><p className="whitespace-pre-wrap break-words text-sm" dir="auto">{release.notes || L.empty}</p></>}
          {!release && <p className="text-sm text-muted-foreground">{status?.error || L.loading}</p>}
          {translating && <p role="status" className="text-xs text-muted-foreground">{L.translating}</p>}
          {translated?.translation === "translated" && <button type="button" className="min-h-10 text-xs text-primary underline" onClick={() => setShowOriginal(value => !value)}>{showOriginal ? L.showTranslation : L.showOriginal}</button>}
          {translated?.translation === "unavailable" && <p role="status" className="text-xs text-muted-foreground">{L.translationUnavailable}</p>}
          {details && link(details.url, L.openGithub)}
          {canInstall && update && tag === status?.latest?.tag && <button type="button" className="ms-3 min-h-11 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50" disabled={busy || status?.operation?.status === "running"} onClick={() => void onInstall(tag)}>{busy || status?.operation?.status === "running" ? L.updating : L.update}</button>}
          {(error || installError || status?.operation?.error) && <p role="alert" className="break-words text-sm text-red-500">{error || installError || status?.operation?.error}</p>}
        </section>
        <section className="space-y-3 border-t border-border pt-4" aria-label={L.comments}>
          <h3 className="font-semibold">{L.comments} · {tag}</h3>
          {displayed?.comments.map(comment => <article key={comment.id} className="rounded-lg border border-border p-3"><p className="mb-2 text-xs text-muted-foreground">@{comment.author} · {new Date(comment.updatedAt).toLocaleString(locale)}</p><p className="whitespace-pre-wrap break-words text-sm" dir="auto">{comment.body}</p>{link(comment.url, L.openGithub)}</article>)}
          {details && !details.comments.length && <p className="text-sm text-muted-foreground">{details.commentsUnavailable ? L.loadError : L.empty}</p>}
          {details?.discussionUrl && link(details.discussionUrl, L.allComments)}
        </section>
        <section className="space-y-3 border-t border-border pt-4" aria-label={L.activity}>
          <h3 className="font-semibold">{L.activity}</h3>
          {feed?.error && <p role="status" className="text-sm text-muted-foreground">{feed.error}</p>}
          {!feed?.items.length && <p className="text-sm text-muted-foreground">{L.empty}</p>}
          {feed?.items.map(item => <article key={item.id} className={`rounded-lg border border-border p-3 ${!item.read ? "bg-primary/5" : ""}`}><p className="mb-1 text-xs text-muted-foreground">@{item.author} · {new Date(item.updatedAt).toLocaleString(locale)}</p><p className="whitespace-pre-wrap break-words text-sm" dir="auto">{item.title}</p><div className="mt-2 flex flex-wrap items-center gap-3 text-xs">{link(item.url, L.openGithub)}{!item.read && <button type="button" className="min-h-10" onClick={() => void read(item.id)}>{L.read}</button>}</div></article>)}
        </section>
      </div>
    </dialog>
  </>;
}
