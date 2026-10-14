import { useCallback, useEffect, useState } from "react";
import { X, Trash2, Plus, Users, KeyRound, Link2, Copy } from "lucide-react";
import {
  getSshKeys,
  listGroups,
  createGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
  listServerUserShares,
  createServerUserShare,
  createPanelAccessLink,
  revokeServerUserShare,
  type CustomerGroup,
  type ServerUserShare,
} from "../api/client";
import { getMessages } from "../i18n";

/**
 * Modal "Gestionar acceso" (solo dueño): comparte un usuario Linux / llave SSH
 * concreta de un servidor con clientes o grupos propios. Mediado por gateway:
 * el destinatario nunca ve la llave. Paridad con el web ServerSharingModal.
 */
type AttachedKey = { id: string; linuxUsername: string | null };

export function ServerSharingModal({
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
  const t = getMessages(language).sharing;
  const tc = getMessages(language).common;
  const [tab, setTab] = useState<"access" | "groups">("access");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attachedKeys, setAttachedKeys] = useState<AttachedKey[]>([]);
  const [shares, setShares] = useState<ServerUserShare[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);

  const [formKeyId, setFormKeyId] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formGroupId, setFormGroupId] = useState("");
  const [formExpires, setFormExpires] = useState("");

  const [newGroupName, setNewGroupName] = useState("");
  const [memberEmail, setMemberEmail] = useState<Record<string, string>>({});

  const [guestLink, setGuestLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const generateGuestLink = (kind: "full" | "granular") => {
    if (!panelId || !token || busy) return;
    if (kind === "granular" && !formKeyId) return;
    setBusy(true);
    setError(null);
    setLinkCopied(false);
    void createPanelAccessLink(panelId, "guest", token, {
      kind,
      sshKeyId: kind === "granular" ? formKeyId : undefined,
      expiresAt: formExpires ? new Date(formExpires).toISOString() : undefined,
    })
      .then((res) => { setGuestLink(res.link?.url ?? null); })
      .catch((err) => setError(err instanceof Error ? err.message : t.error))
      .finally(() => setBusy(false));
  };

  const copyGuestLink = () => {
    if (!guestLink) return;
    void navigator.clipboard?.writeText(guestLink).then(() => {
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => { /* ignore */ });
  };

  const loadAll = useCallback(async () => {
    if (!panelId || !token) return;
    setError(null);
    try {
      const keys = await getSshKeys(token);
      setAttachedKeys(
        keys
          .filter((k) => Array.isArray(k.panelIds) && k.panelIds.includes(panelId))
          .map((k) => ({ id: k.id, linuxUsername: k.linuxUsername ?? null })),
      );
      const [sharesRes, groupsRes] = await Promise.all([listServerUserShares(panelId, token), listGroups(token)]);
      setShares(sharesRes.shares ?? []);
      setGroups(groupsRes.groups ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    }
  }, [panelId, token, t.error]);

  useEffect(() => {
    if (open && panelId) {
      setTab("access");
      void loadAll();
    }
  }, [open, panelId, loadAll]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy || !token) return;
    setBusy(true);
    setError(null);
    try { await fn(); await loadAll(); }
    catch (err) { setError(err instanceof Error ? err.message : t.error); }
    finally { setBusy(false); }
  };

  if (!open) return null;
  const activeShares = shares.filter((s) => !s.revokedAt);

  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4" onClick={onClose}>
      <div className="lp-modal-card flex max-h-full w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{t.title}{panelName ? ` — ${panelName}` : ""}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={tc.close}>
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 px-4 pt-3">
          <button type="button" className={`lp-modal-btn lp-modal-btn--sm${tab === "access" ? " lp-modal-btn--primary" : ""}`} onClick={() => setTab("access")}>
            <KeyRound size={13} /> {t.tabAccess}
          </button>
          <button type="button" className={`lp-modal-btn lp-modal-btn--sm${tab === "groups" ? " lp-modal-btn--primary" : ""}`} onClick={() => setTab("groups")}>
            <Users size={13} /> {t.tabGroups}
          </button>
        </div>

        <div className="lp-modal-body">
          {error ? <p className="lp-modal-error">{error}</p> : null}

          {tab === "access" ? (
            <>
              <p style={{ fontSize: "0.83rem", opacity: 0.8, marginBottom: "0.85rem" }}>{t.accessIntro}</p>
              {attachedKeys.length === 0 ? (
                <p>{t.noKeys}</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "flex-end", marginBottom: "1rem" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", flex: "1 1 140px" }}>
                    <span>{t.selectUser}</span>
                    <select className="lp-input" value={formKeyId} onChange={(e) => setFormKeyId(e.target.value)}>
                      <option value="">—</option>
                      {attachedKeys.map((k) => <option key={k.id} value={k.id}>{k.linuxUsername ?? k.id.slice(0, 8)}</option>)}
                    </select>
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", flex: "1 1 140px" }}>
                    <span>{t.targetEmail}</span>
                    <input className="lp-input" type="email" value={formEmail} disabled={Boolean(formGroupId)} onChange={(e) => setFormEmail(e.target.value)} placeholder="cliente@email.com" />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", flex: "1 1 140px" }}>
                    <span>{t.orPickGroup}</span>
                    <select className="lp-input" value={formGroupId} disabled={Boolean(formEmail)} onChange={(e) => setFormGroupId(e.target.value)}>
                      <option value="">—</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", flex: "1 1 140px" }}>
                    <span>{t.expires}</span>
                    <input className="lp-input" type="date" value={formExpires} onChange={(e) => setFormExpires(e.target.value)} />
                  </label>
                  <button
                    type="button"
                    className="lp-modal-btn lp-modal-btn--primary"
                    disabled={busy || !formKeyId || (!formEmail && !formGroupId)}
                    onClick={() => void run(() => createServerUserShare(panelId!, {
                      sshKeyId: formKeyId,
                      targetEmail: formEmail || undefined,
                      targetGroupId: formGroupId || undefined,
                      expiresAt: formExpires ? new Date(formExpires).toISOString() : undefined,
                    }, token!).then(() => { setFormEmail(""); setFormGroupId(""); setFormExpires(""); }))}
                  >
                    <Plus size={14} /> {t.shareBtn}
                  </button>
                </div>
              )}

              {attachedKeys.length > 0 ? (
                <div style={{ borderTop: "1px solid var(--lp-border, #ddd)", paddingTop: "0.85rem", marginBottom: "1rem" }}>
                  <p style={{ fontSize: "0.86rem", fontWeight: 600, margin: "0 0 0.2rem" }}>{t.guestLinkTitle}</p>
                  <p style={{ fontSize: "0.8rem", opacity: 0.8, margin: "0 0 0.6rem" }}>{t.guestLinkIntro}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    <button type="button" className="lp-modal-btn lp-modal-btn--sm" disabled={busy} onClick={() => generateGuestLink("full")}>
                      <Link2 size={13} /> {t.genFullLink}
                    </button>
                    <button type="button" className="lp-modal-btn lp-modal-btn--sm" disabled={busy || !formKeyId} onClick={() => generateGuestLink("granular")}>
                      <Link2 size={13} /> {t.genGranularLink}
                    </button>
                  </div>
                  {guestLink ? (
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginTop: "0.6rem" }}>
                      <input className="lp-input" style={{ flex: "1 1 auto", fontSize: "0.78rem" }} readOnly value={guestLink} onFocus={(e) => e.currentTarget.select()} aria-label={t.generatedLink} />
                      <button type="button" className="lp-modal-btn lp-modal-btn--sm" onClick={copyGuestLink}>
                        <Copy size={13} /> {linkCopied ? t.linkCopied : t.copyLink}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeShares.length === 0 ? (
                <p>{t.noShares}</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {activeShares.map((s) => (
                    <li key={s.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", padding: "0.55rem 0.7rem", border: "1px solid var(--lp-border, #ddd)", borderRadius: 8 }}>
                      <span style={{ flex: "1 1 auto", fontSize: "0.86rem" }}>
                        <code>{s.linuxUsername ?? "—"}</code> → {s.targetType === "group" ? `${t.groupPrefix}: ${s.targetGroup?.name ?? ""}` : (s.targetCustomer?.email ?? s.targetCustomer?.name ?? "")}
                      </span>
                      <span style={{ fontSize: "0.76rem", opacity: 0.7 }}>{s.status === "accepted" ? t.statusAccepted : t.statusPending}</span>
                      <button type="button" className="lp-icon-btn" disabled={busy} onClick={() => void run(() => revokeServerUserShare(s.id, token!))} title={t.revoke}>
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: "0.83rem", opacity: 0.8, marginBottom: "0.85rem" }}>{t.groupsIntro}</p>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
                <input className="lp-input" style={{ flex: "1 1 auto" }} type="text" value={newGroupName} placeholder={t.newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                <button type="button" className="lp-modal-btn lp-modal-btn--primary" disabled={busy || !newGroupName.trim()} onClick={() => void run(() => createGroup(newGroupName.trim(), undefined, token!).then(() => setNewGroupName("")))}>
                  <Plus size={14} /> {t.createGroup}
                </button>
              </div>

              {groups.length === 0 ? (
                <p>{t.noGroups}</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {groups.map((g) => (
                    <li key={g.id} style={{ border: "1px solid var(--lp-border, #ddd)", borderRadius: 10, padding: "0.7rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                        <strong>{g.name}</strong>
                        <button type="button" className="lp-icon-btn" disabled={busy} onClick={() => void run(() => deleteGroup(g.id, token!))} title={t.deleteGroup}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {g.members.length === 0 ? (
                        <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.7 }}>{t.noMembers}</p>
                      ) : (
                        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                          {g.members.map((m) => (
                            <li key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", fontSize: "0.82rem" }}>
                              <span>{m.customer.email ?? m.customer.name ?? ""} · {m.status === "accepted" ? t.statusAccepted : t.statusPending}</span>
                              <button type="button" className="lp-icon-btn" disabled={busy} onClick={() => void run(() => removeGroupMember(g.id, m.id, token!))}>
                                <X size={13} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input className="lp-input" style={{ flex: "1 1 auto" }} type="email" value={memberEmail[g.id] ?? ""} placeholder={t.addMemberEmail} onChange={(e) => setMemberEmail((mm) => ({ ...mm, [g.id]: e.target.value }))} />
                        <button type="button" className="lp-modal-btn lp-modal-btn--sm" disabled={busy || !(memberEmail[g.id] ?? "").trim()} onClick={() => void run(() => addGroupMember(g.id, (memberEmail[g.id] ?? "").trim(), token!).then(() => setMemberEmail((mm) => ({ ...mm, [g.id]: "" }))))}>
                          <Plus size={12} /> {t.add}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
