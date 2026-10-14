import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getPanelAudit, type ServerAuditEntry } from "../api/client";
import { getMessages } from "../i18n";

function metaSummary(meta: unknown): string {
  if (meta == null) return "—";
  if (typeof meta === "string") return meta;
  try {
    return JSON.stringify(meta);
  } catch {
    return "—";
  }
}

export function AuditModal({
  open,
  panelId,
  panelName,
  token,
  language,
  onClose,
}: {
  open: boolean;
  panelId: string | null;
  panelName?: string;
  token: string | null;
  language?: string;
  onClose: () => void;
}) {
  const t = getMessages(language);
  const [rows, setRows] = useState<ServerAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !panelId || !token) return;
    let alive = true;
    setLoading(true);
    setError(null);
    getPanelAudit(token, panelId, 200)
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch(() => {
        if (alive) setError(t.audit.error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, panelId, token, t]);

  if (!open) return null;

  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4">
      <div className="lp-modal-card flex max-h-full w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{t.audit.title}{panelName ? ` — ${panelName}` : ""}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={t.common.close}>
            <X size={18} />
          </button>
        </div>

        <div className="lp-modal-body" style={{ overflowX: "auto" }}>
          {loading ? (
            <p>{t.audit.loading}</p>
          ) : error ? (
            <p className="lp-modal-error">{error}</p>
          ) : rows.length === 0 ? (
            <p>{t.audit.empty}</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  {[t.audit.colDate, t.audit.colAction, t.audit.colActor, t.audit.colIp, t.audit.colMeta].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "0.45rem 0.6rem", opacity: 0.8 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td style={{ padding: "0.4rem 0.6rem", whiteSpace: "nowrap" }}>
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>
                      <code>{e.action}</code>
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>{e.actor}</td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>{e.ip ?? "—"}</td>
                    <td style={{ padding: "0.4rem 0.6rem", maxWidth: "32ch", overflowWrap: "anywhere", opacity: 0.85 }}>
                      {metaSummary(e.meta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
