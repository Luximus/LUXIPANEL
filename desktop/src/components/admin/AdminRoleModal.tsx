import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { getMessages } from "../../i18n";
import { createAdminRole, updateAdminRole, type AdminRole, type PermissionDef } from "../../api/admin";
import styles from "./AdminRoleModal.module.css";

type FailedField = "name" | "key" | null;

export function AdminRoleModal({
  open,
  role,
  permissions,
  token,
  language,
  onClose,
  onSaved,
}: {
  open: boolean;
  role: AdminRole | null;
  permissions: PermissionDef[];
  token: string;
  language: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = getMessages(language);
  const a = t.admin;
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<FailedField>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  const isEditing = Boolean(role);
  // El rol "admin" tiene la matriz bloqueada (todos los permisos), igual que web.
  const isAdminRole = role?.isSystem === true && role.key === "admin";

  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? "");
    setKey(role?.key ?? "");
    setDescription(role?.description ?? "");
    setSelected(new Set(role?.permissions ?? []));
    setError("");
    setFailed(null);
  }, [open, role]);

  useEffect(() => {
    if (failed === "name") nameRef.current?.focus();
    else if (failed === "key") keyRef.current?.focus();
  }, [failed]);


  const groups = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const perm of permissions) {
      const list = map.get(perm.category) ?? [];
      list.push(perm);
      map.set(perm.category, list);
    }
    return Array.from(map.entries());
  }, [permissions]);

  if (!open) return null;

  const togglePerm = (permKey: string) => {
    if (isAdminRole) return;
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(permKey)) next.delete(permKey);
      else next.add(permKey);
      return next;
    });
  };

  const submit = async () => {
    setError("");
    const nameValue = name.trim();
    const descriptionValue = description.trim() || null;
    const perms = Array.from(selected);
    if (!nameValue) { setError(a.roleNameRequired); setFailed("name"); return; }
    setSaving(true);
    try {
      if (isEditing && role) {
        await updateAdminRole(role.id, { name: nameValue, description: descriptionValue, permissions: perms }, token);
      } else {
        const keyValue = key.trim().toLowerCase();
        if (!/^[a-z][a-z0-9_-]*$/.test(keyValue)) { setError(a.roleKeyFormat); setFailed("key"); setSaving(false); return; }
        await createAdminRole({ key: keyValue, name: nameValue, description: descriptionValue, permissions: perms }, token);
      }
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
      <div className="lp-modal-card flex max-h-full w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{isEditing ? `${a.editRole}: ${role?.name ?? ""}` : a.createRole}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={a.close} disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <div className={`lp-modal-body ${styles.body}`}>
          <label className={`lp-modal-label ${styles.labelCol}`}>
            <span>{a.fieldRoleName}</span>
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
            <span>{a.fieldRoleKey}</span>
            <input
              ref={keyRef}
              className={`lp-modal-input${failed === "key" ? " lp-modal-input--error" : ""}`}
              aria-invalid={failed === "key" || undefined}
              type="text"
              value={key}
              // La clave solo se edita al crear (readonly al editar), espejo del web.
              readOnly={isEditing}
              disabled={saving || (isEditing && role?.isSystem === true)}
              onChange={(e) => { setKey(e.target.value); setFailed(null); }}
            />
          </label>

          <label className={`lp-modal-label ${styles.labelCol}`}>
            <span>{a.fieldRoleDescription}</span>
            <input className="lp-modal-input" type="text" value={description} disabled={saving} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <div className={`lp-modal-label ${styles.labelCol}`}>
            <span>{a.permissions}</span>
            {groups.length === 0 ? (
              <p className={styles.noCatalog}>{a.noCatalog}</p>
            ) : (
              <div className={styles.permGroups}>
                {groups.map(([category, perms]) => (
                  <div key={category}>
                    <p className={styles.categoryLabel}>{category}</p>
                    <div className={styles.permGrid}>
                      {perms.map((perm) => (
                        <label
                          key={perm.key}
                          className={styles.permItem}
                          style={{ ["--perm-opacity" as string]: isAdminRole ? 0.6 : 1 }}
                        >
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={selected.has(perm.key)}
                            disabled={isAdminRole || saving}
                            onChange={() => togglePerm(perm.key)}
                          />
                          <span>{perm.label}{perm.route ? ` (${perm.route})` : ""}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error ? <p className="lp-modal-error">{error}</p> : null}
        </div>

        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose} disabled={saving}>{a.cancel}</button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => void submit()} disabled={saving}>
            {saving ? a.saving : isEditing ? a.save : a.create}
          </button>
        </div>
      </div>
    </div>
  );
}
