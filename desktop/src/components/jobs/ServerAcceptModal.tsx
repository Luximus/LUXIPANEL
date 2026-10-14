// Modal "Aceptar — trabajo en servidor" (Modalidad "Servidor", AI Dev Marketplace).
// El profesional elige DESDE qué servidor suyo trabajará (donde corre su asistente
// IA) y qué proveedor usar; al aceptar se envían professionalServerId + provider.
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { listMyServers, listServerProviders, type JobServer } from "../../api/jobs";
import type { JobsServerMessages } from "./i18n";

export function ServerAcceptModal({
  open, token, s, cancelLabel, onClose, onConfirm,
}: {
  open: boolean;
  token: string;
  s: JobsServerMessages;
  cancelLabel: string;
  onClose: () => void;
  onConfirm: (professionalServerId: string, provider: string | null) => void;
}) {
  const [servers, setServers] = useState<JobServer[]>([]);
  const [serverId, setServerId] = useState("");
  const [providers, setProviders] = useState<string[]>([]);
  const [provider, setProvider] = useState("");
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void listMyServers(token).then((list) => {
      if (!alive) return;
      setServers(list);
      if (list.length) setServerId(list[0].id);
    }).catch(() => { /* ignore */ });
    return () => { alive = false; };
  }, [open, token]);

  useEffect(() => {
    if (!open || !serverId) { setProviders([]); setProvider(""); return; }
    const srv = servers.find((x) => x.id === serverId);
    if (!srv) return;
    let alive = true;
    setLoadingProviders(true);
    void listServerProviders(token, srv.panelId).then((res) => {
      if (!alive) return;
      setProviders(res.providers ?? []);
      setProvider(res.providers?.[0] ?? "");
    }).finally(() => { if (alive) setLoadingProviders(false); });
    return () => { alive = false; };
  }, [open, serverId, servers, token]);

  if (!open) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <button type="button" className="btn btn-sm btn-circle btn-ghost absolute end-3 top-3" onClick={onClose} aria-label="x">
          <X size={16} />
        </button>
        <h3 className="text-lg font-bold">{s.acceptTitle}</h3>
        <p className="mt-1 text-sm opacity-70">{s.acceptHint}</p>

        <label className="form-control mt-4">
          <span className="label-text mb-1">{s.myServer}</span>
          {servers.length ? (
            <select className="select select-bordered" value={serverId} onChange={(e) => setServerId(e.target.value)}>
              {servers.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.hostname})</option>)}
            </select>
          ) : (
            <p className="text-sm text-warning">{s.noServers}</p>
          )}
        </label>

        <label className="form-control mt-3">
          <span className="label-text mb-1">{s.provider}</span>
          <select className="select select-bordered" value={provider} onChange={(e) => setProvider(e.target.value)} disabled={!providers.length}>
            {loadingProviders ? <option>{s.providerLoading}</option> : null}
            {providers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {!loadingProviders && !providers.length ? <span className="label-text-alt mt-1 opacity-70">{s.providerNone}</span> : null}
        </label>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{cancelLabel}</button>
          <button
            type="button"
            className="btn btn-primary gap-2"
            disabled={submitting || !serverId}
            onClick={() => { setSubmitting(true); onConfirm(serverId, provider || null); }}
          >
            {submitting ? <span className="loading loading-spinner loading-xs" /> : null}
            {s.acceptTitle}
          </button>
        </div>
      </div>
    </div>
  );
}
