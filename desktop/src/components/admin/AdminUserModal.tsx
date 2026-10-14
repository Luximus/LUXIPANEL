import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { getMessages } from "../../i18n";
import { updateAdminUser, type AdminUser, type AdminRoleSummary } from "../../api/admin";
import styles from "./AdminUserModal.module.css";

type FailedField = "name" | "email" | "role" | null;

export function AdminUserModal({
  user,
  roles,
  token,
  language,
  onClose,
  onSaved,
}: {
  user: AdminUser | null;
  roles: AdminRoleSummary[];
  token: string;
  language: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = getMessages(language);
  const a = t.admin;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<FailedField>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const roleRef = useRef<HTMLSelectElement>(null);

  // Hidrata al abrir; selecciona el rol por roleId o, si falta, por el key del
  // rol legacy (admin/user) — espejo del web (openEditModal).
  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    setCompany(user.company ?? "");
    setCountry(user.country ?? "");
    setPhone(user.phone ?? "");
    setError("");
    setFailed(null);
    if (user.roleId) setRoleId(user.roleId);
    else {
      const match = roles.find((r) => r.key === user.role);
      setRoleId(match?.id ?? "");
    }
  }, [user, roles]);

  useEffect(() => {
    if (failed === "name") nameRef.current?.focus();
    else if (failed === "email") emailRef.current?.focus();
    else if (failed === "role") roleRef.current?.focus();
  }, [failed]);


  if (!user) return null;

  const submit = async () => {
    setError("");
    const nameValue = name.trim();
    const emailValue = email.trim();
    if (!nameValue) { setError(a.nameRequired); setFailed("name"); return; }
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) { setError(a.emailInvalid); setFailed("email"); return; }
    if (!roleId) { setError(a.roleRequired); setFailed("role"); return; }
    setSaving(true);
    try {
      const selectedRole = roles.find((r) => r.id === roleId);
      const payload: Parameters<typeof updateAdminUser>[1] = {
        name: nameValue,
        email: emailValue,
        roleId: roleId || null,
        company: company.trim() || null,
        country: country.trim() || null,
        phone: phone.trim() || null,
      };
      // El backend acepta `role` (enum legacy) solo para admin/user.
      if (selectedRole && (selectedRole.key === "admin" || selectedRole.key === "user")) {
        payload.role = selectedRole.key;
      }
      await updateAdminUser(user.id, payload, token);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : a.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4"
    >
      <div className="lp-modal-card flex max-h-full w-full max-w-lg flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{a.editUser}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={a.close} disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <div className={`lp-modal-body ${styles.body}`}>
          <label className={`lp-modal-label ${styles.labelCol}`}>
            <span>{a.colName}</span>
            <input
              ref={nameRef}
              className={`lp-modal-input${failed === "name" ? " lp-modal-input--error" : ""}`}
              aria-invalid={failed === "name" || undefined}
              type="text"
              value={name}
              disabled={saving}
              onChange={(e) => { setName(e.target.value); setFailed(null); }}
            />
          </label>

          <label className={`lp-modal-label ${styles.labelCol}`}>
            <span>{a.colEmail}</span>
            <input
              ref={emailRef}
              className={`lp-modal-input${failed === "email" ? " lp-modal-input--error" : ""}`}
              aria-invalid={failed === "email" || undefined}
              type="email"
              value={email}
              disabled={saving}
              onChange={(e) => { setEmail(e.target.value); setFailed(null); }}
            />
          </label>

          <label className={`lp-modal-label ${styles.labelCol}`}>
            <span>{a.colRole}</span>
            <select
              ref={roleRef}
              className={`lp-modal-input${failed === "role" ? " lp-modal-input--error" : ""}`}
              aria-invalid={failed === "role" || undefined}
              value={roleId}
              disabled={saving}
              onChange={(e) => { setRoleId(e.target.value); setFailed(null); }}
            >
              <option value="">{a.selectRole}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>

          <label className={`lp-modal-label ${styles.labelCol}`}>
            <span>{a.colCompany}</span>
            <input className="lp-modal-input" type="text" value={company} disabled={saving} onChange={(e) => setCompany(e.target.value)} />
          </label>

          <label className={`lp-modal-label ${styles.labelCol}`}>
            <span>{a.colCountry}</span>
            <input className="lp-modal-input" type="text" value={country} disabled={saving} onChange={(e) => setCountry(e.target.value)} />
          </label>

          <label className={`lp-modal-label ${styles.labelCol}`}>
            <span>{a.fieldPhone}</span>
            <input className="lp-modal-input" type="text" value={phone} disabled={saving} onChange={(e) => setPhone(e.target.value)} />
          </label>

          {error ? <p className="lp-modal-error">{error}</p> : null}
        </div>

        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose} disabled={saving}>{a.cancel}</button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => void submit()} disabled={saving}>
            {saving ? a.saving : a.save}
          </button>
        </div>
      </div>
    </div>
  );
}
