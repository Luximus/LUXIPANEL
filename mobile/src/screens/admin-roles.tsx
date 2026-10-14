/**
 * admin-roles — sección Roles de AdminScreen (extraída sin cambio de comportamiento).
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

// ── Roles ────────────────────────────────────────────────────────────────────

export function RolesSection({ token, language, tokens }: { token: string; language: string; tokens: ThemeTokens }) {
  const t = getMessages(language).admin;
  const textAlign = getLocaleTextAlign(language);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminRole | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ key: "", name: "", description: "", permissions: new Set<string>() });
  const [invalid, setInvalid] = useState<"name" | "key" | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: "", message: "", busy: false, action: null as null | (() => Promise<void>) });
  const nameRef = useRef<TextInput>(null);
  const keyRef = useRef<TextInput>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await getAdminRoles(token);
      setRoles(data.roles);
      setPermissions(data.permissions);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.loadError);
    } finally {
      setBusy(false);
    }
  }, [token, t.loadError]);
  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (invalid === "name") nameRef.current?.focus();
    else if (invalid === "key") keyRef.current?.focus();
  }, [invalid]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => `${r.name} ${r.key} ${r.description ?? ""}`.toLowerCase().includes(q));
  }, [roles, search]);

  const isOpen = editing !== null || creating;
  const isAdminRole = editing?.isSystem === true && editing.key === "admin";

  const openCreate = () => {
    setInvalid(null);
    setFormError("");
    setForm({ key: "", name: "", description: "", permissions: new Set() });
    setCreating(true);
    setEditing(null);
  };
  const openEdit = (r: AdminRole) => {
    setInvalid(null);
    setFormError("");
    setForm({ key: r.key, name: r.name, description: r.description ?? "", permissions: new Set(r.permissions) });
    setEditing(r);
    setCreating(false);
  };
  const close = () => { setEditing(null); setCreating(false); };

  const togglePerm = (k: string) => setForm((f) => {
    const next = new Set(f.permissions);
    if (next.has(k)) next.delete(k); else next.add(k);
    return { ...f, permissions: next };
  });

  const save = async () => {
    const name = form.name.trim();
    if (!name) { setFormError(t.roleNameRequired); setInvalid("name"); return; }
    const perms = Array.from(form.permissions);
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await updateAdminRole(editing.id, { name, description: form.description.trim() || null, permissions: perms }, token);
      } else {
        const key = form.key.trim().toLowerCase();
        if (!/^[a-z][a-z0-9_-]*$/.test(key)) { setFormError(t.roleKeyFormatError); setInvalid("key"); setSaving(false); return; }
        await createAdminRole({ key, name, description: form.description.trim() || null, permissions: perms }, token);
      }
      close();
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (r: AdminRole) => {
    if (r.isSystem) {
      setConfirm({ open: true, title: t.roleDeleteTitle, message: t.roleSystemCannotDelete, busy: false, action: null });
      return;
    }
    setConfirm({
      open: true,
      title: t.roleDeleteTitle,
      message: formatMessage(t.roleDeleteMessage, { name: r.name }),
      busy: false,
      action: async () => { await deleteAdminRole(r.id, token); await refresh(); },
    });
  };
  const runConfirm = async () => {
    if (!confirm.action) { setConfirm({ open: false, title: "", message: "", busy: false, action: null }); return; }
    setConfirm((c) => ({ ...c, busy: true }));
    try {
      await confirm.action();
      setConfirm({ open: false, title: "", message: "", busy: false, action: null });
    } catch {
      setConfirm((c) => ({ ...c, busy: false }));
    }
  };

  const permGroups = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const p of permissions) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return Array.from(map.entries());
  }, [permissions]);

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
      onNew={openCreate}
    >
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Card tokens={tokens}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[styles.cardTitle, { color: tokens.textPrimary, textAlign }]}>{item.name}</Text>
                <Text numberOfLines={1} style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>{item.key}</Text>
              </View>
              <View style={styles.cardActions}>
                <ActionIcon icon={<Pencil />} color={tokens.brand} onPress={() => openEdit(item)} />
                {!item.isSystem ? <ActionIcon icon={<Trash2 />} color={tokens.danger} onPress={() => askDelete(item)} /> : null}
              </View>
            </View>
            {item.description ? (
              <Text numberOfLines={2} style={[styles.cardMeta, { color: tokens.textSecondary, textAlign }]}>{item.description}</Text>
            ) : null}
            <View style={styles.badgeRow}>
              <Badge label={item.isSystem ? t.roleSystemBadge : t.roleCustomBadge} color={item.isSystem ? "#8b5cf6" : tokens.success} />
              <Badge label={formatMessage(t.rolePermissionsCount, { count: item.permissions.length })} color={tokens.brand} />
              <Badge label={formatMessage(t.roleUsersCount, { count: item.userCount })} color={tokens.textMuted} />
            </View>
          </Card>
        )}
      />

      <Modal
        visible={isOpen}
        onClose={close}
        title={editing ? t.roleEditTitle : t.roleCreateTitle}
        language={language}
        footer={
          <>
            <Button label={t.cancel} variant="ghost" onPress={close} disabled={saving} />
            <Button label={editing ? t.save : t.create} variant="primary" onPress={() => void save()} loading={saving} disabled={saving} />
          </>
        }
      >
        <Input ref={nameRef} label={t.roleNameLabel} value={form.name} error={invalid === "name" ? " " : undefined}
          onChangeText={(v) => { setInvalid(null); setForm((f) => ({ ...f, name: v })); }} />
        <Input ref={keyRef} label={t.roleKeyLabel} value={form.key} autoCapitalize="none" editable={!editing}
          error={invalid === "key" ? " " : undefined}
          onChangeText={(v) => { setInvalid(null); setForm((f) => ({ ...f, key: v })); }} />
        <Input label={t.roleDescriptionLabel} value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} />
        <View>
          <FieldLabel tokens={tokens} language={language}>{t.rolePermissionsLabel}</FieldLabel>
          {permGroups.length === 0 ? (
            <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.roleNoCatalog}</Text>
          ) : (
            permGroups.map(([category, perms]) => (
              <View key={category} style={{ marginTop: 8 }}>
                <Text style={[styles.permGroupTitle, { color: tokens.textSecondary }]}>{category}</Text>
                {perms.map((p) => {
                  const checked = form.permissions.has(p.key);
                  return (
                    <Pressable key={p.key} onPress={() => !isAdminRole && togglePerm(p.key)} disabled={isAdminRole}
                      style={[styles.permRow, isAdminRole ? { opacity: 0.5 } : null]}>
                      <View style={[styles.checkbox, { borderColor: tokens.border, backgroundColor: checked ? tokens.brand : "transparent" }]}>
                        {checked ? <CheckCircle2 size={12} color="#fff" /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "600" }}>{p.label}</Text>
                        {p.route ? <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{p.route}</Text> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
        </View>
        {formError ? <FormError tokens={tokens} message={formError} /> : null}
      </Modal>

      <ConfirmModal state={confirm} language={language} tokens={tokens}
        onCancel={() => setConfirm({ open: false, title: "", message: "", busy: false, action: null })}
        onConfirm={() => void runConfirm()} />
    </SectionShell>
  );
}

