/**
 * admin-users — sección Usuarios de AdminScreen (extraída sin cambio de comportamiento).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Pencil, Trash2, Ban, CheckCircle2 } from "lucide-react-native";
import { styles } from "./AdminScreen.styles";
import {
  getAdminUsers,
  updateAdminUser,
  setAdminUserBlocked,
  deleteAdminUser,
  getAdminRoles,
  createAdminRole,
  updateAdminRole,
  deleteAdminRole,
  getWompiProducts,
  createWompiProduct,
  updateWompiProduct,
  deleteWompiProduct,
  getExchangeRate,
  getPremiumModules,
  createPremiumModule,
  updatePremiumModule,
  deletePremiumModule,
  type AdminUser,
  type AdminRole,
  type PermissionDef,
  type WompiProduct,
  type PremiumModule,
} from "../api/admin";
import { getMessages, formatMessage, getLocaleTextAlign } from "../i18n";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import {
  type ThemeTokens,
  useListLoader,
  SectionShell,
  Card,
  Badge,
  ActionIcon,
  ConfirmModal,
  FieldLabel,
  ToggleRow,
  FormError,
} from "./admin-shared";

// ── Usuarios ─────────────────────────────────────────────────────────────────

export function UsersSection({ token, language, tokens }: { token: string; language: string; tokens: ThemeTokens }) {
  const t = getMessages(language).admin;
  const textAlign = getLocaleTextAlign(language);
  const { items: users, busy, error, refresh } = useListLoader<AdminUser>(() => getAdminUsers(token));
  const [roles, setRoles] = useState<{ id: string; key: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState({ name: "", email: "", roleId: "", company: "", country: "", phone: "" });
  const [invalid, setInvalid] = useState<"name" | "email" | "role" | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: "", message: "", busy: false, action: null as null | (() => Promise<void>) });
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  useEffect(() => {
    void getAdminRoles(token).then((r) => setRoles(r.roles.map((x) => ({ id: x.id, key: x.key, name: x.name })))).catch(() => {});
  }, [token]);

  const roleOptions = useMemo(
    () => (roles.length > 0
      ? roles.map((r) => ({ value: r.id, label: r.name }))
      : [{ value: "", label: t.roleUser }]),
    [roles, t.roleUser],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.email} ${u.name} ${u.company ?? ""} ${u.country ?? ""}`.toLowerCase().includes(q));
  }, [users, search]);

  const openEdit = (u: AdminUser) => {
    setInvalid(null);
    setFormError("");
    const roleId = u.roleId ?? roles.find((r) => r.key === u.role)?.id ?? "";
    setForm({ name: u.name ?? "", email: u.email ?? "", roleId, company: u.company ?? "", country: u.country ?? "", phone: u.phone ?? "" });
    setEditing(u);
  };

  // Enfoca el primer campo inválido (espejo de focusInvalidField del web).
  useEffect(() => {
    if (invalid === "name") nameRef.current?.focus();
    else if (invalid === "email") emailRef.current?.focus();
  }, [invalid]);

  const save = async () => {
    if (!editing) return;
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name) { setFormError(t.userNameRequired); setInvalid("name"); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFormError(t.userEmailInvalid); setInvalid("email"); return; }
    if (!form.roleId && roles.length > 0) { setFormError(t.userRoleRequired); setInvalid("role"); return; }
    setSaving(true);
    setFormError("");
    try {
      const selectedRole = roles.find((r) => r.id === form.roleId);
      await updateAdminUser(editing.id, {
        name,
        email,
        roleId: form.roleId || null,
        ...(selectedRole && (selectedRole.key === "admin" || selectedRole.key === "user")
          ? { role: selectedRole.key as "admin" | "user" }
          : {}),
        company: form.company.trim() || null,
        country: form.country.trim() || null,
        phone: form.phone.trim() || null,
      }, token);
      setEditing(null);
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const askBlock = (u: AdminUser) => {
    const next = !u.blocked;
    setConfirm({
      open: true,
      title: next ? t.userBlockTitle : t.userUnblockTitle,
      message: formatMessage(next ? t.userBlockMessage : t.userUnblockMessage, { email: u.email }),
      busy: false,
      action: async () => { await setAdminUserBlocked(u.id, next, token); await refresh(); },
    });
  };

  const askDelete = (u: AdminUser) => {
    setConfirm({
      open: true,
      title: t.userDeleteTitle,
      message: formatMessage(t.userDeleteMessage, { email: u.email }),
      busy: false,
      action: async () => { await deleteAdminUser(u.id, token); await refresh(); },
    });
  };

  const runConfirm = async () => {
    if (!confirm.action) return;
    setConfirm((c) => ({ ...c, busy: true }));
    try {
      await confirm.action();
      setConfirm({ open: false, title: "", message: "", busy: false, action: null });
    } catch {
      setConfirm((c) => ({ ...c, busy: false }));
    }
  };

  return (
    <SectionShell
      tokens={tokens}
      language={language}
      busy={busy}
      error={error}
      empty={filtered.length === 0}
      emptyLabel={t.empty}
      retryLabel={t.retry}
      onRetry={refresh}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t.search}
    >
      <FlatList
        data={filtered}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Card tokens={tokens}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[styles.cardTitle, { color: tokens.textPrimary, textAlign }]}>{item.name || item.email}</Text>
                <Text numberOfLines={1} style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>{item.email}</Text>
              </View>
              <View style={styles.cardActions}>
                <ActionIcon icon={<Pencil />} color={tokens.brand} onPress={() => openEdit(item)} />
                <ActionIcon icon={item.blocked ? <CheckCircle2 /> : <Ban />} color={item.blocked ? tokens.success : tokens.warning} onPress={() => askBlock(item)} />
                <ActionIcon icon={<Trash2 />} color={tokens.danger} onPress={() => askDelete(item)} />
              </View>
            </View>
            <View style={styles.badgeRow}>
              <Badge label={item.role === "admin" ? t.roleAdmin : t.roleUser} color={item.role === "admin" ? "#f59e0b" : tokens.brand} />
              <Badge label={item.blocked ? t.userStatusBlocked : t.userStatusActive} color={item.blocked ? tokens.danger : tokens.success} />
            </View>
          </Card>
        )}
      />

      <Modal
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={t.userEditTitle}
        language={language}
        footer={
          <>
            <Button label={t.cancel} variant="ghost" onPress={() => setEditing(null)} disabled={saving} />
            <Button label={t.save} variant="primary" onPress={() => void save()} loading={saving} disabled={saving} />
          </>
        }
      >
        <Input ref={nameRef} label={t.userNameLabel} value={form.name} error={invalid === "name" ? " " : undefined}
          onChangeText={(v) => { setInvalid(null); setForm((f) => ({ ...f, name: v })); }} />
        <Input ref={emailRef} label={t.userEmailLabel} value={form.email} keyboardType="email-address" autoCapitalize="none"
          error={invalid === "email" ? " " : undefined}
          onChangeText={(v) => { setInvalid(null); setForm((f) => ({ ...f, email: v })); }} />
        <View>
          <FieldLabel tokens={tokens} language={language}>{t.userRoleLabel}</FieldLabel>
          <Select value={form.roleId} options={roleOptions} onChange={(v) => { setInvalid(null); setForm((f) => ({ ...f, roleId: v })); }}
            style={invalid === "role" ? { borderColor: tokens.danger } : undefined} />
        </View>
        <Input label={t.userCompanyLabel} value={form.company} onChangeText={(v) => setForm((f) => ({ ...f, company: v }))} />
        <Input label={t.userCountryLabel} value={form.country} onChangeText={(v) => setForm((f) => ({ ...f, country: v }))} />
        <Input label={t.userPhoneLabel} value={form.phone} keyboardType="phone-pad" onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} />
        {formError ? <FormError tokens={tokens} message={formError} /> : null}
      </Modal>

      <ConfirmModal state={confirm} language={language} tokens={tokens}
        onCancel={() => setConfirm({ open: false, title: "", message: "", busy: false, action: null })}
        onConfirm={() => void runConfirm()} />
    </SectionShell>
  );
}

