import CommunityActivity from "./CommunityActivity";
import { useEffect, useState } from "react";
import { installPanelRelease, readPanelReleases, type PanelReleaseStatus } from "@/lib/panel-releases";

export default function ReleaseBanner({ isAdmin, labels: L }: { isAdmin: boolean; labels: Record<string, string> }) {
  const [status, setStatus] = useState<PanelReleaseStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const next = await readPanelReleases(); if (active) setStatus(next); }
      catch { if (active) setStatus(null); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    const sync = () => document.querySelector("[data-assistant-topbar]")?.toggleAttribute("data-release-update", !!status?.updateAvailable);
    sync();
    document.addEventListener("astro:after-swap", sync);
    return () => {
      document.removeEventListener("astro:after-swap", sync);
      document.querySelector("[data-assistant-topbar]")?.removeAttribute("data-release-update");
    };
  }, [status?.updateAvailable]);
  if (!status?.updateAvailable || !status.latest) return <CommunityActivity labels={L} />;
  const release = status.latest;
  const running = status.operation?.status === "running";
  const update = async () => {
    setBusy(true); setError("");
    try { await installPanelRelease(release.tag); setStatus(await readPanelReleases()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo iniciar la actualización."); }
    finally { setBusy(false); }
  };
  return <div className="lxp-release-banner" role="status">
    <span className="lxp-release-title"><span className="lxp-release-signal" aria-hidden="true" />LUXIPANEL <code>{release.tag}</code></span>
    <button type="button" className="lxp-release-notes-toggle" onClick={() => setNotesOpen(value => !value)} aria-label={L.notes} aria-expanded={notesOpen}>{L.notes}</button>
    {isAdmin && <button type="button" className="lxp-release-action" onClick={() => void update()} disabled={busy || running}>
      {running ? L.updating : busy ? L.updating : L.update}
    </button>}
    {notesOpen && <div className="lxp-release-notes" role="note"><strong>{release.name}</strong><p>{release.notes || "Esta versión no incluye notas."}</p></div>}
    <CommunityActivity labels={L} />
    {(error || status.operation?.error) && <span className="lxp-release-error">{error || status.operation?.error}</span>}
  </div>;
}
