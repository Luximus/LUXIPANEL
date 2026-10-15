import CommunityActivity from "./CommunityActivity";
import { useEffect, useState } from "react";
import { version } from "../../../package.json";
import { installPanelRelease, readPanelReleases, type PanelReleaseStatus } from "@/lib/panel-releases";

export default function ReleaseBanner({ isAdmin, labels, locale }: { isAdmin: boolean; labels: Record<string, string>; locale: string }) {
  const [status, setStatus] = useState<PanelReleaseStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const reset = () => { setStatus(null); setError(""); setEpoch(value => value + 1); };
    window.addEventListener("luxipanel:target-changed", reset);
    return () => window.removeEventListener("luxipanel:target-changed", reset);
  }, []);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const next = await readPanelReleases(); if (active) setStatus(next); }
      catch { /* Keep the installed version and previously known update visible. */ }
    };
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [epoch]);
  const update = async (tag: string) => {
    setBusy(true); setError("");
    try { await installPanelRelease(tag); setStatus(await readPanelReleases()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : labels.loadError); }
    finally { setBusy(false); }
  };
  return <CommunityActivity labels={labels} locale={locale} status={status} installedVersion={version}
    canInstall={isAdmin && status?.canInstall === true} busy={busy} error={error} onInstall={update} />;
}
