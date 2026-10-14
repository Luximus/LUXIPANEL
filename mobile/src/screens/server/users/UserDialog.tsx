import { localizeServerError } from '../../../lib/server-error-localization';
import { FormDrawer } from "../../../components/ui/FormDrawer";
/** UserDialog — crear/editar usuario (réplica de `#dialog-user` de users/index.astro). */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { getMessages } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { Input } from "../../../components/ui/Input";
import { Field, Checkbox, DialogFooter } from "../../../components/server/Form";
import type { ServerRole, ServerUser, UserFormPayload } from "./types";

export function UserDialog({
  visible,
  mode,
  initial,
  roles,
  onClose,
  onSave,
}: {
  visible: boolean;
  mode: "create" | "edit";
  initial?: ServerUser | null;
  roles: ServerRole[];
  onClose: () => void;
  onSave: (payload: UserFormPayload) => Promise<boolean>;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverUsers;

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [groupFilter, setGroupFilter] = useState("");
  const pending = useRef(false);
  const close = () => { if (!pending.current) onClose(); };
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setUsername(initial?.username ?? "");
    setDisplayName(initial?.displayName ?? "");
    setEmail(initial?.email ?? "");
    setPassword("");
    setGroups(initial?.groups ?? []);
    setEnabled(initial?.enabled ?? true);
    setGroupFilter("");
    setError(null);
  }, [visible, initial]);

  const filteredRoles = useMemo(() => {
    const q = groupFilter.trim().toLowerCase();
    return roles.filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [roles, groupFilter]);

  const toggleGroup = (name: string) =>
    setGroups((prev) => (prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]));

  const title = mode === "create" ? t.userDialog.titleNew : t.titles.editUser;

  const submit = async () => {
    if (pending.current) return;
    setError(null);
    if (!username.trim()) {
      setError(t.userDialog.labelUsername);
      return;
    }
    if (mode === "create" && !password) { setError(t.userDialog.labelPassword); return; }
    pending.current = true;
    setSubmitting(true);
    try {
    const ok = await onSave({
      username: username.trim(),
      displayName: displayName.trim() || undefined,
      email: email.trim() || undefined,
      password: mode === "create" ? password : undefined,
      groups,
      enabled,
    });
    if (ok) onClose();
    else setError(t.toasts.saveFailed);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.toasts.saveFailed); }
    finally { pending.current = false; setSubmitting(false); }
  };

  return (
    <FormDrawer
      visible={visible}
      onClose={close}
      title={title}
      language={language}
      footer={
        <DialogFooter
          onCancel={close}
          cancelLabel={t.userDialog.btnCancel}
          onSubmit={submit}
          submitLabel={t.userDialog.btnSave}
          submitting={submitting}
        />
      }
    >
      {error ? (
        <View
          style={{
            borderRadius: 8,
            borderWidth: 1,
            padding: 10,
            marginBottom: 12,
            backgroundColor: withAlpha(tokens.danger, 0.1),
            borderColor: withAlpha(tokens.danger, 0.3),
          }}
        >
          <Text style={{ color: tokens.danger, fontSize: 12 }}>{localizeServerError(error)}</Text>
        </View>
      ) : null}

      <Field label={t.userDialog.labelUsername}>
        <Input value={username} onChangeText={setUsername} placeholder={t.userDialog.placeholderUsername} autoCapitalize="none" />
      </Field>
      <Field label={t.userDialog.labelDisplayName}>
        <Input value={displayName} onChangeText={setDisplayName} placeholder={t.userDialog.placeholderDisplayName} />
      </Field>
      <Field label={t.userDialog.labelEmail}>
        <Input value={email} onChangeText={setEmail} placeholder={t.userDialog.placeholderEmail} autoCapitalize="none" keyboardType="email-address" />
      </Field>

      {mode === "create" ? (
        <Field label={t.userDialog.labelPassword} hint={t.labels.passwordHintNew}>
          <Input value={password} onChangeText={setPassword} secureTextEntry secureToggle autoCapitalize="none" />
        </Field>
      ) : (
        <Field label={t.userDialog.labelPassword} hint={t.labels.passwordHintEdit}>
          <Input value="" editable={false} placeholder="••••••••" />
        </Field>
      )}

      <Field label={t.userDialog.labelGroups} hint={t.userDialog.groupsHelp}>
        <Input value={groupFilter} onChangeText={setGroupFilter} placeholder={t.userDialog.placeholderFilterGroups} autoCapitalize="none" />
        <ScrollView style={{ maxHeight: 180, marginTop: 8 }} nestedScrollEnabled>
          {filteredRoles.length === 0 ? (
            <Text style={{ color: tokens.textMuted, fontSize: 12, paddingVertical: 8 }}>{t.userDialog.noGroupsAvailable}</Text>
          ) : (
            filteredRoles.map((r) => {
              const isSystem = r.kind === "system";
              return (
                <View key={r.name} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 }}>
                  <Checkbox value={groups.includes(r.name)} onChange={() => toggleGroup(r.name)} label={r.name} />
                  {isSystem ? (
                    <View style={{ borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: withAlpha(tokens.warning, 0.12) }}>
                      <Text style={{ color: tokens.warning, fontSize: 10 }}>{t.labels.systemBadge}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      </Field>

      <Pressable style={{ marginTop: 4 }}>
        <Checkbox value={enabled} onChange={setEnabled} label={t.userDialog.labelUserActive} />
      </Pressable>
    </FormDrawer>
  );
}
