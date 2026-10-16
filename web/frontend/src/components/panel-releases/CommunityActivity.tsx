import BranchChanges from "./BranchChanges";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { Markdown } from "../floating-assistant/Markdown";
import "./community-activity.css";
import { branchColor, readReleaseDetails, readProjectContributors, translateReleaseDetails, versionTag, type ProjectContributors, type PanelReleaseDetails, type PanelReleaseStatus } from "@/lib/panel-releases";
type Tab = "notes" | "comments" | "activity";
interface Entry { id: string; kind: string; title: string; author: string; url: string; updatedAt: string; read: boolean }
interface Activity { items: Entry[]; unread: number; error?: string }
interface Props {
  onRefresh?: () => Promise<void>;
  notice?: string;
  onInstallBranch?: (branch: string, commit: string) => Promise<void>;
  labels: Record<string, string>; locale: string; status: PanelReleaseStatus | null; installedVersion: string;
  canInstall: boolean; busy: boolean; error: string; catalogError?: string; onInstall: (tag: string) => Promise<void>;
}
export default function CommunityActivity({ labels: L, locale, status, installedVersion, canInstall, busy, error: installError, notice, catalogError, onRefresh, onInstall, onInstallBranch }: Props) {
  const [feed, setFeed] = useState<Activity>();
  const [error, setError] = useState("");
  const [targetEpoch, setTargetEpoch] = useState(0);
  const [opened, setOpened] = useState(false);
  const [tab, setTab] = useState<Tab>("notes");
  const [contributors, setContributors] = useState<ProjectContributors>();
  const [branch, setBranch] = useState("releases");
  const [selected, setSelected] = useState("");
  const [details, setDetails] = useState<PanelReleaseDetails>();
  const [translated, setTranslated] = useState<PanelReleaseDetails>();
  const [translating, setTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const content = useRef<HTMLDivElement>(null);
  const help = useRef<HTMLDetailsElement>(null);
  const heading = useId();
  const branches = status?.branches || [];
  const selectedBranch = branches.find(item => item.name === branch);
  const branchUpdates = catalogError || status?.branchesError ? [] : branches.filter(item => item.updateAvailable && !item.error).sort((a, b) => Number(b.name === "developer") - Number(a.name === "developer"));
  const open = (requestedBranch?: string) => {
    const requested = requestedBranch || new URLSearchParams(window.location.search).get("updates");
    setBranch(requested && ["main", "developer", "web", "desktop", "mobile", "modules"].includes(requested) ? requested : requested === "releases" ? "releases" : branch);
    if (requested) { const url = new URL(window.location.href); url.searchParams.delete("updates"); window.history.replaceState(window.history.state, "", url); }
    setSelected(status?.latest?.tag || ""); setTab("notes");
    if (!dialog.current?.open) dialog.current?.showModal(); setOpened(true);
    void onRefresh?.();
  };
  useEffect(() => { if (status && new URLSearchParams(window.location.search).has("updates")) open(); }, [status]);
  useEffect(() => {
    const onNotification = (event: Event) => {
      const detail = (event as CustomEvent<{ branch?: string; __ack?: boolean }>).detail;
      if (!detail || !["releases", "main", "developer", "web", "desktop", "mobile", "modules"].includes(detail.branch || "")) return;
      open(detail.branch); detail.__ack = true;
    };
    window.addEventListener("luxipanel:releases-open", onNotification);
    return () => window.removeEventListener("luxipanel:releases-open", onNotification);
  }, [status, branch, onRefresh]);
  useEffect(() => {
    const closeHelp = (event: MouseEvent) => { if (help.current && !help.current.contains(event.target as Node)) help.current.open = false; };
    document.addEventListener("click", closeHelp);
    return () => document.removeEventListener("click", closeHelp);
  }, []);
  const installed = versionTag(status?.installed?.tag || status?.currentVersion || installedVersion);
  const catalogFailure = catalogError || status?.error;
  const feedbackError = installError || status?.operation?.error || error || catalogError;
  const updating = busy || status?.operation?.status === "running";
  const update = !!status?.updateAvailable && !!status.latest && !catalogFailure;
  const tag = selected || status?.latest?.tag || "";
  useEffect(() => {
    const reset = () => {
      generation.current++; dialog.current?.close(); setOpened(false); setBranch("releases"); setFeed(undefined); setDetails(undefined);
      setTranslated(undefined); setSelected(""); setContributors(undefined); setTab("notes"); setError(""); setTargetEpoch(value => value + 1);
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
    if (!opened) return;
    let active = true;
    void readProjectContributors().then(value => { if (active) setContributors(value); })
      .catch(() => { if (active) setContributors({ items: [], unavailable: true }); });
    return () => { active = false; };
  }, [opened, targetEpoch]);
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "notes", label: L.notesTab, icon: "notes" },
    { id: "comments", label: L.comments, icon: "messages" },
    { id: "activity", label: L.activityTab, icon: "activity" },
  ];
  const selectTab = (next: Tab) => { setTab(next); if (content.current) content.current.scrollTop = 0; };
  useEffect(() => {
    let active = true;
    let loading = false;
    let lastAttempt = 0;
    let translatedContent = "";
    setDetails(undefined); setTranslated(undefined); setShowOriginal(false); setTranslating(false); setError("");
    if (content.current) content.current.scrollTop = 0;
    if (!opened || !tag || branch !== "releases") return;
    const load = async () => {
      if (loading) return;
      loading = true; lastAttempt = Date.now();
      try {
        const original = await readReleaseDetails(tag);
        if (!active) return;
        setDetails(original); setError("");
        const fingerprint = JSON.stringify([original.notes, original.comments]);
        if (locale !== "en" && fingerprint !== translatedContent) {
          setTranslated(undefined); setTranslating(true);
          try {
            const next = await translateReleaseDetails(tag, locale);
            if (active) {
              setTranslated(next);
              if (next.translation !== "unavailable") translatedContent = fingerprint;
            }
          }
          catch { if (active) setTranslated({ ...original, translation: "unavailable" }); }
          finally { if (active) setTranslating(false); }
        }
      } catch { if (active) setError(L.loadError); }
      finally { loading = false; }
    };
    // Refresh an open drawer and when returning from GitHub, without loading
    // other versions or exhausting GitHub's anonymous request allowance.
    const refresh = () => { if (!document.hidden && Date.now() - lastAttempt >= 60000) void load(); };
    void load();
    const timer = window.setInterval(refresh, 180000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false; window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [opened, tag, branch, locale, targetEpoch, L.loadError]);
  const read = async (id: string) => {
    const current = generation.current;
    try {
      const result = await api.post(`/api/ui/community/${id}/read`, {});
      if (current !== generation.current) return;
      if (!result.ok) throw new Error(result.error);
      setFeed(prior => prior ? { ...prior, items: prior.items.map(item => item.id === id ? { ...item, read: true } : item), unread: Math.max(0, prior.unread - (prior.items.some(item => item.id === id && !item.read) ? 1 : 0)) } : prior);
    } catch { if (current === generation.current) setError(L.loadError); }
  };
  const currentDetails = details?.tag === tag ? details : undefined;
  const currentTranslation = translated?.tag === tag ? translated : undefined;
  const displayed = !showOriginal && currentTranslation?.translation === "translated" ? currentTranslation : currentDetails;
  const discussionUrl = currentDetails?.discussionUrl?.toLowerCase();
  const releaseActivity = discussionUrl ? (feed?.items || []).filter(item => item.url.split("#")[0]?.toLowerCase() === discussionUrl) : [];
  const release = displayed || status?.releases.find(release => release.tag === tag);
  const link = (url: string, text: string, icon = "brand-github", variant = "secondary") => /^https:\/\/github\.com\/Luxisoft\/LUXIPANEL\/(?:releases\/tag\/v?\d+\.\d+\.\d+|(?:issues|pull)\/\d+(?:#.*)?)$/i.test(url)
    ? <a href={url} target="_blank" rel="noopener noreferrer" className={`lxp-community-action lxp-community-action--${variant}`}><i className={`ti ti-${icon}`} aria-hidden="true" /><span>{text}</span><i className="ti ti-arrow-up-right lxp-community-action-external" aria-hidden="true" /></a> : null;
  return <>
    <button type="button" data-panel-updates-open className="relative inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs hover:bg-muted" aria-label={`${L.title} · ${installed}${update ? ` · ${L.newVersion}: ${status?.latest?.tag}` : ""}${branchUpdates.map(item => ` · ${L.branchColorHelp.replace("{branch}", item.name)}`).join("")}`}
      title={`${L.title} · ${update ? L.newVersion : L.installed}`} aria-haspopup="dialog" aria-expanded={opened}
      onClick={() => open()}>
      <i className="ti ti-brand-github text-lg" aria-hidden="true" /><span className="font-mono">{installed}</span>
      {update && <span data-release-notification className="lxp-release-new-badge lxp-update-badge" style={{ backgroundColor: branchColor("releases") }} role="status">{L.newBadge}<span className="sr-only"> · {L.newVersion}: {status?.latest?.tag}</span></span>}
      {branchUpdates.map((item, index) => <span key={item.name} data-branch-notification={item.name} className={`lxp-update-badge ${update || index > 0 ? "lxp-update-dot" : ""}`} style={{ backgroundColor: branchColor(item.name), color: item.name === "developer" ? "#422006" : "#fff" }} aria-label={L.branchColorHelp.replace("{branch}", item.name)} title={L.branchColorHelp.replace("{branch}", item.name)}>{item.name}<span className="sr-only"> · {L.newBadge}</span></span>)}
    </button>
    <dialog ref={dialog} aria-label={L.title} onCancel={event => { if (help.current?.open) { event.preventDefault(); help.current.open = false; } }} onClose={() => setOpened(false)} className="lxp-community-drawer border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40">
      <header className="lxp-community-header">
        <div className="lxp-community-toolbar">
          <div className="lxp-update-selects"><label className="lxp-community-version-select" hidden={branch !== "releases"}>
            <i className="ti ti-brand-github" aria-hidden="true" /><span>{L.version}</span>
            {!!status?.releases.length ? <select value={tag} onChange={event => setSelected(event.target.value)}>
              {status.releases.map(release => <option key={release.tag} value={release.tag}>{release.tag}</option>)}
            </select> : <code>{installed}</code>}
          </label>
          <label className="lxp-community-version-select"><i className="ti ti-git-branch" aria-hidden="true" /><span>{L.branches}</span><select aria-label={L.branches} value={branch} onChange={event => { setBranch(event.target.value); setTab("notes"); }}>
            <option value="releases">{L.releases}</option>{branches.map(item => <option key={item.name} value={item.name}>{item.name}{item.updateAvailable ? " •" : ""}</option>)}
          </select></label></div>
          <details ref={help} className="lxp-update-help"><summary aria-label={L.colorHelp} title={L.colorHelp}><i className="ti ti-help-circle" aria-hidden="true" /></summary>
            <div className="lxp-update-legend"><strong>{L.colorHelp}</strong><p><span style={{ backgroundColor: branchColor("releases") }} />{L.releaseColorHelp}</p>{branches.map(item => <p key={item.name}><span style={{ backgroundColor: branchColor(item.name) }} />{L.branchColorHelp.replace("{branch}", item.name)}</p>)}</div>
          </details>
          <button type="button" className="lxp-community-close min-h-11 min-w-11 shrink-0" aria-label={L.close} onClick={() => dialog.current?.close()}><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
        <div className="lxp-community-tabs" hidden={branch !== "releases"} role="tablist" aria-label={L.title} onKeyDown={event => {
          const index = tabs.findIndex(item => item.id === tab);
          const direction = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
          const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" ? (index + direction + tabs.length) % tabs.length : event.key === "ArrowLeft" ? (index - direction + tabs.length) % tabs.length : -1;
          if (next < 0) return;
          event.preventDefault(); selectTab(tabs[next]!.id);
          event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}>
          {tabs.map(item => <button key={item.id} type="button" role="tab" id={`${heading}-tab-${item.id}`} aria-controls={`${heading}-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => selectTab(item.id)}><i className={`ti ti-${item.icon}`} aria-hidden="true" /><span>{item.label}</span></button>)}
        </div>
      </header>
      {updating ? <p role="status" className="lxp-community-feedback"><i className="ti ti-loader-2 animate-spin" aria-hidden="true" /><span>{L.updating}</span></p>
        : feedbackError && <p role="alert" className="lxp-community-feedback lxp-community-feedback--error"><i className="ti ti-alert-circle" aria-hidden="true" /><span>{feedbackError}</span></p>}
      {!updating && !feedbackError && notice && <p role="status" className="lxp-community-feedback"><i className="ti ti-refresh" aria-hidden="true" /><span>{notice}</span></p>}
      <div ref={content} className="lxp-community-content min-h-0 flex-1 overflow-auto p-4">
        {branch !== "releases" && selectedBranch && status && <BranchChanges key={`${targetEpoch}:${branch}`} branch={selectedBranch} locale={locale} status={status} labels={L} canInstall={canInstall} busy={busy} unavailable={!!catalogError || !!status.branchesError} onInstall={onInstallBranch} />}
        {branch !== "releases" && !selectedBranch && <p role="status" className="text-sm text-muted-foreground">{!status ? L.loading : L.branchLoadError}</p>}
        {status?.branchesError && <p role="status" className="text-sm text-muted-foreground">{status.branchesError}</p>}
        <div hidden={branch !== "releases"}>
        <section role="tabpanel" id={`${heading}-panel-notes`} aria-labelledby={`${heading}-tab-notes`} hidden={tab !== "notes"} tabIndex={0} className="lxp-community-panel space-y-3">
          <div className="lxp-community-version-row"><span className="lxp-community-installed"><i className="ti ti-circle-check" aria-hidden="true" />{L.installed}<code>{installed}</code></span></div>
          {update && tag === status?.latest?.tag && <p className="lxp-community-update" role="status"><i className="ti ti-sparkles" aria-hidden="true" /><span>{L.newVersion}: <strong>{status?.latest?.tag}</strong></span></p>}
          {release && <><h3 className="lxp-community-section-title"><i className="ti ti-notes" aria-hidden="true" />{L.notes}</h3><div className="lxp-community-notes" dir="auto"><Markdown text={release.notes || L.empty} /></div></>}
          {catalogFailure && <p role="status" className="text-sm text-muted-foreground">{catalogFailure}</p>}
          {!release && !catalogFailure && <p className="text-sm text-muted-foreground">{L.loading}</p>}
          {translating && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><i className="ti ti-language" aria-hidden="true" />{L.translating}</p>}
          {currentTranslation?.translation === "unavailable" && <p role="status" className="text-xs text-muted-foreground">{currentTranslation.translationReason === "insufficient_balance" ? L.translationInsufficientBalance : L.translationUnavailable}</p>}
          <div className="lxp-community-actions">
            {canInstall && update && tag === status?.latest?.tag && <button type="button" className="lxp-community-action lxp-community-action--primary" disabled={busy || status?.operation?.status === "running"} onClick={() => void onInstall(tag)}><i className="ti ti-download" aria-hidden="true" /><span>{busy || status?.operation?.status === "running" ? L.updating : L.updateTo.replace("{version}", tag)}</span></button>}
            {currentDetails && link(currentDetails.url, L.openGithub)}
            {currentTranslation?.translation === "translated" && <button type="button" className="lxp-community-action lxp-community-action--quiet" aria-pressed={showOriginal} onClick={() => setShowOriginal(value => !value)}><i className="ti ti-language" aria-hidden="true" /><span>{showOriginal ? L.showTranslation : L.showOriginal}</span></button>}
          </div>
        </section>
        <section role="tabpanel" id={`${heading}-panel-comments`} aria-labelledby={`${heading}-tab-comments`} hidden={tab !== "comments"} tabIndex={0} className="lxp-community-panel space-y-3">
          <h3 className="lxp-community-section-title"><i className="ti ti-messages" aria-hidden="true" /><span>{L.comments}</span><code className="lxp-community-section-tag">{tag}</code></h3>
          {translating && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><i className="ti ti-language" aria-hidden="true" />{L.translating}</p>}
          {currentTranslation?.translation === "unavailable" && <p role="status" className="text-xs text-muted-foreground">{currentTranslation.translationReason === "insufficient_balance" ? L.translationInsufficientBalance : L.translationUnavailable}</p>}
          {currentTranslation?.translation === "translated" && <button type="button" className="lxp-community-action lxp-community-action--quiet" aria-pressed={showOriginal} onClick={() => setShowOriginal(value => !value)}><i className="ti ti-language" aria-hidden="true" /><span>{showOriginal ? L.showTranslation : L.showOriginal}</span></button>}
          {displayed?.comments.map(comment => <article key={comment.id} className="lxp-community-card"><div className="lxp-community-author"><span className="lxp-community-avatar" aria-hidden="true">{comment.author.slice(0, 1).toUpperCase()}</span><div><p>@{comment.author}</p><time dateTime={comment.updatedAt}>{new Date(comment.updatedAt).toLocaleString(locale)}</time></div></div><p className="whitespace-pre-wrap break-words text-sm leading-relaxed" dir="auto">{comment.body}</p><div className="lxp-community-card-actions">{link(comment.url, L.openGithub, "brand-github", "quiet")}</div></article>)}
          {currentDetails && !currentDetails.comments.length && <p className="text-sm text-muted-foreground">{currentDetails.commentsUnavailable ? L.loadError : L.empty}</p>}
          {!currentDetails && !error && tag && <p role="status" className="text-sm text-muted-foreground">{L.loading}</p>}
          {currentDetails?.discussionUrl && <div className="lxp-community-actions">{link(currentDetails.discussionUrl, L.allComments, "messages")}</div>}
        </section>
        <section role="tabpanel" id={`${heading}-panel-activity`} aria-labelledby={`${heading}-tab-activity`} hidden={tab !== "activity"} tabIndex={0} className="lxp-community-panel space-y-3">
          <h3 className="lxp-community-section-title"><i className="ti ti-activity" aria-hidden="true" /><span>{L.activity}</span><code className="lxp-community-section-tag">{tag}</code></h3>
          {feed?.error && <p role="status" className="text-sm text-muted-foreground">{feed.error}</p>}
          {!releaseActivity.length && <p className="text-sm text-muted-foreground">{L.empty}</p>}
          {releaseActivity.map(item => <article key={item.id} className={`lxp-community-card ${!item.read ? "lxp-community-card--unread" : ""}`}><p className="text-xs text-muted-foreground">@{item.author} · {new Date(item.updatedAt).toLocaleString(locale)}</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed" dir="auto">{item.title}</p><div className="lxp-community-card-actions">{link(item.url, L.openGithub, "brand-github", "quiet")}{!item.read && <button type="button" className="lxp-community-action lxp-community-action--quiet" onClick={() => void read(item.id)}><i className="ti ti-checks" aria-hidden="true" /><span>{L.read}</span></button>}</div></article>)}
        </section>
        </div>
      </div>
      <footer className="lxp-community-footer" aria-label={L.contributors}>
        <div className="lxp-community-footer-heading"><span><i className="ti ti-users" aria-hidden="true" />{L.contributors}</span>{!!contributors?.items.length && <span className="lxp-community-contributor-count">{contributors.items.length}</span>}</div>
        {contributors?.items.length ? <ul className="lxp-community-contributors">
          {contributors.items.map(person => <li key={person.login}><a href={person.url} target="_blank" rel="noopener noreferrer" className="lxp-community-contributor">
            <span className="lxp-community-contributor-avatar" aria-hidden="true">{person.login.slice(0, 1).toUpperCase()}{person.avatarUrl && <img src={person.avatarUrl} width="28" height="28" alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none"; }} />}</span><span>@{person.login}</span><i className="ti ti-arrow-up-right" aria-hidden="true" />
          </a></li>)}
        </ul> : <p role="status" className="text-xs text-muted-foreground">{!contributors ? L.loading : contributors.unavailable ? L.contributorsUnavailable : L.empty}</p>}
      </footer>
    </dialog>
  </>;
}
