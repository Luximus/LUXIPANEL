/**
 * UserDialog (desktop) — crear/editar usuario. Port React DOM de
 * `app/src/screens/server/users/UserDialog.tsx`: nombre/visible/email, contraseña
 * (solo al crear; deshabilitada al editar), lista de grupos con filtro + badge de
 * sistema, y checkbox "usuario activo". Modal daisyUI nativo (`lp-modal-*`).
 */
import { useEffect, useMemo, useState } from "react";
import { getMessages } from "../../../i18n";
import { ModalShell, DialogFooter, Field } from "./dialog-kit";
import type { ServerRole, ServerUser, UserFormPayload } from "./types";

export function UserDialog({
  mode,
  initial,
  roles,
  language,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: ServerUser | null;
  roles: ServerRole[];
  language?: string;
  onClose: () => void;
  onSave: (payload: UserFormPayload) => Promise<boolean>;
}) {
  const t = getMessages(language).serverUsers;

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [groupFilter, setGroupFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUsername(initial?.username ?? "");
    setDisplayName(initial?.displayName ?? "");
    setEmail(initial?.email ?? "");
    setPassword("");
    setGroups(initial?.groups ?? []);
    setEnabled(initial?.enabled ?? true);
    setGroupFilter("");
    setError(null);
  }, [initial]);

  const filteredRoles = useMemo(() => {
    const q = groupFilter.trim().toLowerCase();
    return roles.filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [roles, groupFilter]);

  const toggleGroup = (name: string) =>
    setGroups((prev) => (prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]));

  const title = mode === "create" ? t.userDialog.titleNew : t.titles.editUser;

  const submit = async () => {
    setError(null);
    if (!username.trim()) {
      setError(t.userDialog.labelUsername);
      return;
    }
    setSubmitting(true);
    const ok = await onSave({
      username: username.trim(),
      displayName: displayName.trim() || undefined,
      email: email.trim() || undefined,
      password: mode === "create" ? password : undefined,
      groups,
      enabled,
    });
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      closeLabel={t.userDialog.btnCancel}
      footer={
        <DialogFooter
          onCancel={onClose}
          cancelLabel={t.userDialog.btnCancel}
          onSubmit={() => void submit()}
          submitLabel={t.userDialog.btnSave}
          submitting={submitting}
        />
      }
    >
      {error ? <p className="lp-modal-error">{error}</p> : null}

      <Field label={t.userDialog.labelUsername}>
        <input className="lp-modal-input" value={username} placeholder={t.userDialog.placeholderUsername} autoCapitalize="none" onChange={(e) => setUsername(e.target.value)} />
      </Field>
      <Field label={t.userDialog.labelDisplayName}>
        <input className="lp-modal-input" value={displayName} placeholder={t.userDialog.placeholderDisplayName} onChange={(e) => setDisplayName(e.target.value)} />
      </Field>
      <Field label={t.userDialog.labelEmail}>
        <input className="lp-modal-input" type="email" value={email} placeholder={t.userDialog.placeholderEmail} autoCapitalize="none" onChange={(e) => setEmail(e.target.value)} />
      </Field>

      {mode === "create" ? (
        <Field label={t.userDialog.labelPassword} hint={t.labels.passwordHintNew}>
          <input className="lp-modal-input" type="password" value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
        </Field>
      ) : (
        <Field label={t.userDialog.labelPassword} hint={t.labels.passwordHintEdit}>
          <input className="lp-modal-input" value="" disabled placeholder="••••••••" />
        </Field>
      )}

      <Field label={t.userDialog.labelGroups} hint={t.userDialog.groupsHelp}>
        <input className="lp-modal-input" value={groupFilter} placeholder={t.userDialog.placeholderFilterGroups} autoCapitalize="none" onChange={(e) => setGroupFilter(e.target.value)} />
        <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-base-300 p-1">
          {filteredRoles.length === 0 ? (
            <p className="px-2 py-2 text-xs text-base-content/50">{t.userDialog.noGroupsAvailable}</p>
          ) : (
            filteredRoles.map((r) => (
              <label key={r.name} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-base-200/60">
                <input type="checkbox" className="checkbox checkbox-sm" checked={groups.includes(r.name)} onChange={() => toggleGroup(r.name)} />
                <span className="text-sm">{r.name}</span>
                {r.kind === "system" ? (
                  <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">{t.labels.systemBadge}</span>
                ) : null}
              </label>
            ))
          )}
        </div>
      </Field>

      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" className="checkbox checkbox-sm" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span className="text-sm">{t.userDialog.labelUserActive}</span>
      </label>
    </ModalShell>
  );
}
