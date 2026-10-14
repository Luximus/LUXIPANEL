// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { afterPrimaryReady } from "@/lib/startup-state";
import { api } from "@/lib/api-client";

type Snapshot = {
  cpu?: { usagePercent?: number };
  memory?: { usagePercent?: number };
  disk?: { usagePercent?: number };
  network?: { rxBytesPerSec?: number; txBytesPerSec?: number };
};
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const read = (value: number | undefined) => Number.isFinite(value) ? clamp(value as number) : null;
const percent = (value: number | null) => value === null ? "—" : `${Math.round(value)}%`;
function rate(value: number | undefined): string {
  if (!Number.isFinite(value)) return "—";
  const bytes = Math.max(0, value ?? 0);
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB/s` : `${(bytes / 1024).toFixed(0)} KB/s`;
}

function KpiRow({ label, icon, tone, value }: { label: string; icon: string; tone: string; value: number | null }) {
  return <div className={`lxp-server-kpi lxp-server-kpi-${tone}`}>
    <div className="lxp-server-kpi-head"><span className="lxp-server-kpi-icon"><i className={`ti ${icon}`} aria-hidden="true" /></span><span>{label}</span></div>
    <span className="lxp-server-kpi-meter" role="meter" aria-label={`Uso de ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value === null ? undefined : Math.round(value)}><span style={{ "--kpi-value": `${value ?? 0}%` } as CSSProperties} /></span>
    <strong className="lxp-server-kpi-value">{percent(value)}</strong>
  </div>;
}

/** Live server context, shared by the global chat and every native module drawer. */
export default function ServerRailLive() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const networkTarget = typeof document !== "undefined" ? document.getElementById("server-rail-network") : null;

  useEffect(() => {
    let live = true;
    let generation = 0;
    let pending: AbortController | null = null;
    const load = () => {
      if (pending || document.hidden || !live) return;
      const controller = new AbortController();
      pending = controller;
      const request = ++generation;
      void api.get<Snapshot>("/api/monitor/snapshot", {signal: controller.signal}).then((res) => {
        if (!live || request !== generation) return;
        if (!res.ok || !res.data) { setSnapshot(null); return; }
        const next = res.data;
        setSnapshot(next);
        setUpdatedAt(new Date());
      }).catch(() => { if (live && request === generation) setSnapshot(null); }).finally(() => { if (pending === controller) pending = null; });
    };
    let timer: ReturnType<typeof setInterval> | undefined;
    const schedule = () => afterPrimaryReady(() => { load(); timer = setInterval(load, 20_000); }, 1500);
    let cancel = schedule();
    const onTargetChanged = () => {
      generation++; pending?.abort(); pending = null; cancel(); window.clearInterval(timer);
      setSnapshot(null); setUpdatedAt(null); cancel = schedule();
    };
    const onVisible = () => { if (!document.hidden && timer) load(); };
    window.addEventListener("luxipanel:target-changed", onTargetChanged);
    document.addEventListener("visibilitychange", onVisible);
    return () => { live = false; pending?.abort(); cancel(); window.clearInterval(timer); window.removeEventListener("luxipanel:target-changed", onTargetChanged); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  const network = <div className="lxp-server-network">
    <div className="lxp-server-network-title" title="Tráfico de red"><span className="lxp-server-kpi-icon"><i className="ti ti-arrows-down-up" aria-hidden="true" /></span><span className="sr-only">Red</span></div>
    <div className="lxp-server-network-rates"><span title="Entrada" aria-label={`Entrada: ${rate(snapshot?.network?.rxBytesPerSec)}`}><i className="ti ti-arrow-down" aria-hidden="true" />{rate(snapshot?.network?.rxBytesPerSec)}</span><span title="Salida" aria-label={`Salida: ${rate(snapshot?.network?.txBytesPerSec)}`}><i className="ti ti-arrow-up" aria-hidden="true" />{rate(snapshot?.network?.txBytesPerSec)}</span></div>
  </div>;

  return <><div className="lxp-server-rail-body px-3 pt-3 text-xs">
    <section aria-label="Uso del servidor">
      <span className="sr-only" aria-live="polite">{updatedAt ? `Uso del servidor actualizado ${updatedAt.toLocaleTimeString()}` : "Esperando datos del servidor"}</span>
      <div className="lxp-server-kpi-grid">
        <KpiRow label="CPU" icon="ti-cpu" tone="cyan" value={read(snapshot?.cpu?.usagePercent)} />
        <KpiRow label="RAM" icon="ti-device-desktop-analytics" tone="violet" value={read(snapshot?.memory?.usagePercent)} />
        <KpiRow label="Disco" icon="ti-device-floppy" tone="amber" value={read(snapshot?.disk?.usagePercent)} />
      </div>
    </section>
  </div>{networkTarget ? createPortal(network, networkTarget) : network}</>;
}
