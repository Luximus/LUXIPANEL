import { useEffect, useState } from "react";
import { branchColor, readPanelBranch, type PanelBranch, type PanelBranchDetails, type PanelReleaseStatus } from "@/lib/panel-releases";

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
  const installed = status.installed?.commit;
  const current = installed === branch.commit;
  return <section className="lxp-branch-changes" aria-label={L.branchChanges}>
    <div className="lxp-community-version-row">
      <span className="lxp-community-installed"><i className="ti ti-git-branch" style={{ color: branchColor(branch.name) }} aria-hidden="true" /><strong>{branch.name}</strong></span>
      <span className="lxp-community-installed">{L.selectedRevision}<code>{branch.commit.slice(0, 8)}</code></span>
      <span className="lxp-community-installed">{installed ? L.installedRevision : L.unregisteredRevision}<code>{(installed || status.checkout?.commit || "—").slice(0, 8)}</code></span>
    </div>
    <p className="text-sm text-muted-foreground">{L.branchPreview}</p>
    {current && <p role="status" className="text-sm">{L.branchCurrent}</p>}
    {!current && status.comparisonKnown !== false && !branch.updateAvailable && !branch.error && <p className="text-sm text-muted-foreground">{L.noBranchChanges}</p>}
    {(error || branch.error || status.branchesError) && <p role="alert" className="text-sm text-red-500">{error || branch.error || status.branchesError}</p>}
    {!ready && !error && <p role="status">{L.loading}</p>}
    {ready && !ready.installable && <p role="status" className="text-sm text-muted-foreground">{L.branchUnavailable}</p>}
    {ready?.installable && canInstall && onInstall && !current && !unavailable && !error && !branch.error && <button type="button" className="lxp-community-action lxp-community-action--primary" disabled={busy || status.operation?.status === "running"} onClick={() => void onInstall(branch.name, branch.commit)}><i className="ti ti-download" aria-hidden="true" /><span>{busy || status.operation?.status === "running" ? L.updating : L.branchUpdate.replace("{branch}", branch.name)}</span></button>}
    <h3 className="lxp-community-section-title"><i className="ti ti-git-commit" aria-hidden="true" />{L.branchChanges}</h3>
    <ol className="lxp-branch-commits">{ready?.commits.map(commit => <li key={commit.sha}>
      <a href={`https://github.com/Luxisoft/LUXIPANEL/commit/${commit.sha}`} target="_blank" rel="noopener noreferrer"><code>{commit.sha.slice(0, 8)}</code><span>{commit.message.split("\n")[0]}</span></a>
      <p className="text-xs text-muted-foreground">{commit.author}{commit.date && <> · <time dateTime={commit.date}>{new Date(commit.date).toLocaleDateString(locale)}</time></>}</p>
    </li>)}</ol>
  </section>;
}
