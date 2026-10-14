import { useEffect, useRef, useState } from "react";
import { Building2, X } from "lucide-react";
import { getPublicProfile, type PublicProfile } from "../api/client";
import { WorklogTab } from "./account/WorklogTab";

type Tab = "profile" | "worklog";

function strings(language?: string) {
  return (language ?? "es").startsWith("en")
    ? { profile: "Profile", worklog: "Worklog", sharedBy: "Shared by", close: "Close" }
    : { profile: "Perfil", worklog: "Bitácora", sharedBy: "Compartido por", close: "Cerrar" };
}

/**
 * Drawer izquierdo independiente para ver el perfil PÚBLICO de otro usuario
 * (quien te compartió un servidor). Tabs Perfil (avatar/nombre/empresa, sin
 * teléfono/correo/saldos) y Bitácora (worklog del usuario). Espejo del app.
 */
export function PublicProfileDrawer({
  open,
  onClose,
  userId,
  userName,
  token,
  language,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  userName?: string;
  token: string;
  language?: string;
}) {
  const s = strings(language);
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) setTab("profile");
  }, [open]);

  useEffect(() => {
    if (!open || !userId || !token) return;
    if (loadedIdRef.current === userId && profile) return;
    loadedIdRef.current = userId;
    setProfile(null);
    setLoading(true);
    let alive = true;
    getPublicProfile(userId, token)
      .then((p) => { if (alive) setProfile(p); })
      .catch(() => { if (alive) setProfile(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, userId, token]);

  if (!open) return null;

  const displayName = profile?.name || userName || "—";
  const initial = (displayName.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] flex" onClick={onClose}>
      <div
        className="flex h-full w-[min(380px,86vw)] flex-col border-r border-base-300 bg-base-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-base-300 p-2">
          <div className="join">
            <button type="button" className={`btn btn-sm join-item ${tab === "profile" ? "btn-primary text-white" : "btn-ghost"}`} onClick={() => setTab("profile")}>
              {s.profile}
            </button>
            <button type="button" className={`btn btn-sm join-item ${tab === "worklog" ? "btn-primary text-white" : "btn-ghost"}`} onClick={() => setTab("worklog")}>
              {s.worklog}
            </button>
          </div>
          <button type="button" className="lp-icon-btn ml-auto" onClick={onClose} aria-label={s.close}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {tab === "profile" ? (
            <div className="flex flex-col items-center gap-2 p-5 text-center">
              <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-base-300 bg-base-200">
                {profile?.photoUrl ? (
                  <img src={profile.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl font-black text-primary">{initial}</span>
                )}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wide opacity-60">{s.sharedBy}</span>
              <h3 className="text-lg font-extrabold leading-tight">{displayName}</h3>
              {loading && !profile ? (
                <span className="loading loading-spinner loading-sm text-primary mt-2" />
              ) : profile?.company ? (
                <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-base-300 bg-base-200 px-3 py-1.5">
                  <Building2 size={14} className="opacity-70" />
                  <span className="text-sm font-medium opacity-80">{profile.company}</span>
                </div>
              ) : null}
            </div>
          ) : (
            <WorklogTab language={language ?? "es"} token={token} userId={userId ?? undefined} />
          )}
        </div>
      </div>
      <div className="flex-1 bg-black/40" />
    </div>
  );
}
