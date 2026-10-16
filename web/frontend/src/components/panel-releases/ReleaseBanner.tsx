import CommunityActivity from "./CommunityActivity";
import { useEffect, useRef, useState } from "react";
import { version } from "../../../package.json";
import { installPanelBranch, installPanelRelease, readPanelReleases, type PanelReleaseStatus } from "@/lib/panel-releases";

export default function ReleaseBanner({ isAdmin, labels, locale }: { isAdmin: boolean; labels: Record<string, string>; locale: string }) {
  const [status, setStatus] = useState<PanelReleaseStatus | null>(null);
  const [error, setError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const generation = useRef(0);
  const installing = useRef(false);
  useEffect(() => {
    const reset = () => { generation.current++; setStatus(null); setError(""); setCatalogError(""); setEpoch(value => value + 1); };
    window.addEventListener("luxipanel:target-changed", reset);
    return () => window.removeEventListener("luxipanel:target-changed", reset);
  }, []);
  useEffect(() => {
    let active = true;
    const current = generation.current;
    const load = async () => {
      try { const next = await readPanelReleases(); if (active && current === generation.current) { setStatus(next); setCatalogError(""); } }
      catch { if (active && current === generation.current) setCatalogError(labels.loadError); }
    };
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [epoch, labels.loadError]);
  const update = async (tag: string) => {
    if (installing.current || !isAdmin || !status?.canInstall || !status.updateAvailable || status.error || catalogError || tag !== status.latest?.tag || status.operation?.status === "running") return;
    const current = generation.current;
    installing.current = true;
    setBusy(true); setError("");
    try {
      await installPanelRelease(tag);
      if (current !== generation.current) return;
      const next = await readPanelReleases();
      if (current === generation.current) { setStatus(next); setCatalogError(""); }
    }
    catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : labels.loadError); }
    finally { installing.current = false; setBusy(false); }
  };
  const updateBranch = async (branch: string, commit: string) => {
    const row = status?.branches?.find(item => item.name === branch && item.commit === commit);
    if (installing.current || !isAdmin || !status?.canInstall || !row || row.error || status.branchesError || catalogError || status.operation?.status === "running") return;
    if (status.installed?.commit === commit) return;
    const current = generation.current;
    installing.current = true; setBusy(true); setError("");
    try {
      await installPanelBranch(branch, commit);
      if (current !== generation.current) return;
      setStatus(prior => prior ? { ...prior, operation: { status: "running", branch, commit, stage: "queued" } } : prior);
    } catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : labels.loadError); }
    finally { installing.current = false; setBusy(false); }
  };
  return <CommunityActivity labels={labels} locale={locale} status={status} installedVersion={version}
    canInstall={isAdmin && status?.canInstall === true} busy={busy} error={error} catalogError={catalogError} onInstall={update} onInstallBranch={updateBranch} />;
}
