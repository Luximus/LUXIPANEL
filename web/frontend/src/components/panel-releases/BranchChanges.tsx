import { useEffect, useState } from "react";
import { readPanelBranch, versionTag, type PanelBranch, type PanelBranchDetails, type PanelReleaseStatus } from "@/lib/panel-releases";

export default function BranchChanges({ branch, locale, status, labels: L, canInstall, busy, unavailable, onInstall }: {
  branch: PanelBranch; locale: string; status: PanelReleaseStatus; labels: Record<string, string>; canInstall: boolean; busy: boolean; unavailable: boolean;
  onInstall?: (branch: string, commit: string) => Promise<void>;
}) {
  const [details, setDetails] = useState<PanelBranchDetails>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true; setDetails(undefined); setError("");
    void readPanelBranch(branch.name, branch.commit).then(value => { if (active) setDetails(value); }).catch(() => { if (active) setError(L.branchLoadError); });
    return () => { active = false; };
  }, [branch.name, branch.commit, L.branchLoadError]);
  const ready = details?.name === branch.name && details.commit === branch.commit ? details : undefined;
  const current = status.installed?.commit === branch.commit;
  const installedVersion = status.installed?.tag || status.currentVersion;
  const notes = ready?.notes || [];
  return <section className="lxp-branch-changes" aria-label={L.notes}>
    <div className="lxp-community-version-row">
      {installedVersion && <span className="lxp-community-installed"><i className="ti ti-circle-check" aria-hidden="true" />{L.installed}<code>{versionTag(installedVersion)}</code></span>}
      {branch.updateAvailable && !unavailable && !branch.error && <span className="lxp-community-installed">{L.newBadge}</span>}
    </div>
    <p className="text-sm text-muted-foreground">{L.branchPreview}</p>
    {current && <p role="status" className="text-sm">{L.branchCurrent}</p>}
    {!current && status.comparisonKnown !== false && !branch.updateAvailable && !branch.error && <p className="text-sm text-muted-foreground">{L.noBranchChanges}</p>}
    {(error || branch.error || status.branchesError) && <p role="alert" className="text-sm text-red-500">{error || branch.error || status.branchesError}</p>}
    {!ready && !error && <p role="status">{L.loading}</p>}
    {ready && !ready.installable && <p role="status" className="text-sm text-muted-foreground">{L.branchUnavailable}</p>}
    {ready?.installable && canInstall && onInstall && !current && !unavailable && !error && !branch.error && <button type="button" className="lxp-community-action lxp-community-action--primary" disabled={busy || status.operation?.status === "running"} onClick={() => void onInstall(branch.name, branch.commit)}><i className="ti ti-download" aria-hidden="true" /><span>{busy || status.operation?.status === "running" ? L.updating : L.branchUpdate.replace("{branch}", branch.name)}</span></button>}
    <h3 className="lxp-community-section-title"><i className="ti ti-notes" aria-hidden="true" />{L.notes}</h3>
    {notes.length > 0 && <div className="lxp-community-notes lxp-branch-notes" dir="auto">
      {notes.map(note => <article key={note.id} className="lxp-branch-note">
        <h4 className="font-semibold">{note.title}</h4>
        {note.date && Number.isFinite(Date.parse(note.date)) && <time className="text-xs text-muted-foreground" dateTime={note.date}>{new Date(note.date).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}</time>}
        <ul>{note.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>
      </article>)}
    </div>}
    {ready && notes.length === 0 && <p role="status" className="lxp-community-notes text-sm text-muted-foreground">{L.branchNotesUnavailable}</p>}
    {ready?.notesIncomplete && notes.length > 0 && <p className="text-xs text-muted-foreground">{L.branchNotesPartial}</p>}
  </section>;
}
