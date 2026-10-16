import CommunityActivity from "./CommunityActivity";
import { useCallback, useEffect, useRef, useState } from "react";
import { version } from "../../../package.json";
import { readPanelReleasePreflight, installPanelBranch, installPanelRelease, readPanelReleases, type PanelReleaseStatus, type PanelReleasePreflight } from "@/lib/panel-releases";

export default function ReleaseBanner({ isAdmin, labels, locale }: { isAdmin: boolean; labels: Record<string, string>; locale: string }) {
  const [status, setStatus] = useState<PanelReleaseStatus | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const generation = useRef(0);
  const catalogRequest = useRef(0);
  const liveRequest = useRef(0);
  const installing = useRef(false);
  const blockedMessage = (reason: PanelReleasePreflight["reason"]) => {
    const keys = { "assistant-active": "updateAssistantActive", "publication-pending": "updatePublicationPending", "contribution-review": "updateContributionReview", "checkout-sync": "updateCheckoutSync", "local-changes": "localChangesBlocked" };
    return (reason && labels[keys[reason]]) || labels.localChangesBlocked;
  };
  useEffect(() => {
    const reset = () => { generation.current++; catalogRequest.current++; liveRequest.current = 0; setStatus(null); setError(""); setNotice(""); setCatalogError(""); setEpoch(value => value + 1); };
    window.addEventListener("luxipanel:target-changed", reset);
    return () => { generation.current++; window.removeEventListener("luxipanel:target-changed", reset); };
  }, []);
  const loadStatus = useCallback(async (fresh = false) => {
    if (!fresh && liveRequest.current) return;
    const current = generation.current;
    const request = ++catalogRequest.current;
    if (fresh) liveRequest.current = request;
    try {
      const next = await readPanelReleases(fresh);
      if (current !== generation.current || request !== catalogRequest.current) return;
      setStatus(next); setCatalogError("");
      return next;
    } catch (cause) {
      if (current === generation.current && request === catalogRequest.current) setCatalogError(labels.loadError);
      throw cause;
    } finally {
      if (liveRequest.current === request) liveRequest.current = 0;
    }
  }, [labels.loadError]);
  const refreshCatalog = useCallback(async () => {
    if (installing.current) return;
    setError(""); setNotice("");
    try { await loadStatus(true); } catch { /* The catalog error remains visible. */ }
  }, [loadStatus]);
  useEffect(() => {
    const load = () => { if (!installing.current) void loadStatus().catch(() => undefined); };
    void loadStatus().catch(() => undefined);
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 30000);
    return () => { catalogRequest.current++; window.clearInterval(timer); };
  }, [epoch, loadStatus]);
  const update = async (tag: string) => {
    if (installing.current || !isAdmin || !status?.canInstall || !status.updateAvailable || status.error || catalogError || tag !== status.latest?.tag || status.operation?.status === "running") return;
    const current = generation.current;
    installing.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      const readiness = await readPanelReleasePreflight();
      if (current !== generation.current) return;
      if (!readiness.ok) { setError(blockedMessage(readiness.reason)); return; }
      await installPanelRelease(tag);
      if (current !== generation.current) return;
      await loadStatus(true);
    }
    catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : labels.loadError); }
    finally { installing.current = false; setBusy(false); }
  };
  const updateBranch = async (branch: string, commit: string) => {
    const row = status?.branches?.find(item => item.name === branch && item.commit === commit);
    if (installing.current || !isAdmin || !status?.canInstall || status.comparisonKnown !== true || !row || !row.updateAvailable || row.ahead <= 0 || row.error || status.branchesError || catalogError || status.operation?.status === "running") return;
    if (status.installed?.commit === commit) return;
    const current = generation.current;
    installing.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const readiness = await readPanelReleasePreflight();
      if (current !== generation.current) return;
      if (!readiness.ok) { setError(blockedMessage(readiness.reason)); return; }
      const next = await loadStatus(true);
      if (!next || current !== generation.current) return;
      const latestBranch = next.branches?.find(item => item.name === branch);
      if (next.branchesError) { setError(next.branchesError); return; }
      if (!latestBranch) { setError(labels.branchLoadError); return; }
      if (latestBranch.commit !== commit) { setNotice(labels.branchRefreshed); return; }
      if (!next.canInstall || next.comparisonKnown !== true || !latestBranch.updateAvailable || latestBranch.ahead <= 0 || latestBranch.error || next.installed?.commit === commit || next.operation?.status === "running") return;
      await installPanelBranch(branch, commit);
      if (current !== generation.current) return;
      catalogRequest.current++;
      setStatus(prior => prior ? { ...prior, operation: { status: "running", branch, commit, stage: "queued" } } : prior);
    } catch (cause) {
      if (current !== generation.current) return;
      if (cause instanceof Error && "code" in cause && cause.code === "RELEASE_BRANCH_CHANGED") {
        try {
          const next = await loadStatus(true);
          if (next && current === generation.current) {
            const refreshed = next.branches?.find(item => item.name === branch);
            if (next.branchesError || !refreshed || refreshed.commit === commit) setError(next.branchesError || labels.branchLoadError);
            else setNotice(labels.branchRefreshed);
          }
        } catch { if (current === generation.current) setError(labels.loadError); }
      } else setError(cause instanceof Error ? cause.message : labels.loadError);
    }
    finally { installing.current = false; setBusy(false); }
  };
  return <CommunityActivity labels={labels} locale={locale} status={status} installedVersion={version}
    canInstall={isAdmin && status?.canInstall === true} busy={busy} error={error} notice={notice} catalogError={catalogError} onRefresh={refreshCatalog} onInstall={update} onInstallBranch={updateBranch} />;
}
