/**
 * admin-modules — sección Módulos premium de AdminScreen (extraída sin cambio de comportamiento).
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

// ── Módulos premium ──────────────────────────────────────────────────────────

export function ModulesSection({ token, language, tokens }: { token: string; language: string; tokens: ThemeTokens }) {
  const t = getMessages(language).admin;
  const textAlign = getLocaleTextAlign(language);
  const { items: modules, busy, error, refresh } = useListLoader<PremiumModule>(() => getPremiumModules(token));
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyModuleForm());
  const [invalid, setInvalid] = useState<"code" | "configSchema" | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: "", message: "", busy: false, action: null as null | (() => Promise<void>) });
  const codeRef = useRef<TextInput>(null);
  const schemaRef = useRef<TextInput>(null);

  useEffect(() => {
    if (invalid === "code") codeRef.current?.focus();
    else if (invalid === "configSchema") schemaRef.current?.focus();
  }, [invalid]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter((m) => `${m.code} ${m.name} ${m.category} ${m.createdBy}`.toLowerCase().includes(q));
  }, [modules, search]);

  const tagOptions = useMemo(() => [
    { value: "free", label: t.moduleTagFree },
    { value: "premium", label: t.moduleTagPremium },
  ], [t]);
  const kindOptions = useMemo(() => [
    { value: "module", label: t.moduleKindModule },
    { value: "mcp_server", label: t.moduleKindMcp },
  ], [t]);
  const statusOptions = useMemo(() => [
    { value: "active", label: t.moduleStatusActive },
    { value: "disabled", label: t.moduleStatusDisabled },
  ], [t]);

  const openCreate = () => {
    setInvalid(null); setFormError("");
    setForm(emptyModuleForm());
    setEditingId(null);
    setOpen(true);
  };
  const openEdit = (m: PremiumModule) => {
    setInvalid(null); setFormError("");
    setForm({
      code: m.code,
      name: m.name ?? "",
      description: m.description ?? "",
      category: m.category ?? "",
      tag: m.tag ?? "free",
      kind: m.kind ?? "module",
      version: m.version ?? "1.0.0",
      rating: String(m.rating ?? 0),
      createdBy: m.createdBy ?? "system",
      scriptPath: m.scriptPath ?? "",
      scriptHash: m.scriptHash ?? "",
      features: (m.features ?? []).join("\n"),
      configSchema: m.configSchema ? JSON.stringify(m.configSchema, null, 2) : "",
      status: m.status === "disabled" ? "disabled" : "active",
    });
    setEditingId(m.id);
    setOpen(true);
  };

  const save = async () => {
    const trimmedSchema = form.configSchema.trim();
    let parsedSchema: unknown = null;
    if (trimmedSchema) {
      try { parsedSchema = JSON.parse(trimmedSchema); }
      catch (err) { setFormError(formatMessage(t.moduleConfigSchemaInvalid, { error: (err as Error).message })); setInvalid("configSchema"); return; }
    }
    const features = form.features.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const base = {
      name: form.name.trim() || undefined,
      description: form.description ?? "",
      category: form.category.trim() || undefined,
      tag: form.tag || "free",
      kind: form.kind || "module",
      version: form.version.trim() || "1.0.0",
      rating: Number(form.rating) || 0,
      createdBy: form.createdBy.trim() || "system",
      scriptPath: form.scriptPath.trim() || null,
      scriptHash: form.scriptHash.trim() || null,
      features,
      configSchema: parsedSchema,
      status: (form.status === "disabled" ? "disabled" : "active") as "active" | "disabled",
    };
    setSaving(true); setFormError("");
    try {
      if (editingId) {
        await updatePremiumModule(editingId, base, token);
      } else {
        const code = form.code.trim();
        if (!code) { setFormError(t.moduleCodeRequired); setInvalid("code"); setSaving(false); return; }
        await createPremiumModule({ ...base, code }, token);
      }
      setOpen(false);
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (m: PremiumModule) => {
    setConfirm({
      open: true,
      title: t.moduleDeleteTitle,
      message: formatMessage(t.moduleDeleteMessage, { code: m.code }),
      busy: false,
      action: async () => { await deletePremiumModule(m.id, token); await refresh(); },
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
      onNew={openCreate}
    >
      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Card tokens={tokens}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[styles.cardTitle, { color: tokens.textPrimary, textAlign }]}>{item.name || item.code}</Text>
                <Text numberOfLines={1} style={[styles.cardMeta, { color: tokens.textMuted, textAlign }]}>{item.code} · {item.category}</Text>
              </View>
              <View style={styles.cardActions}>
                <ActionIcon icon={<Pencil />} color={tokens.brand} onPress={() => openEdit(item)} />
                <ActionIcon icon={<Trash2 />} color={tokens.danger} onPress={() => askDelete(item)} />
              </View>
            </View>
            <View style={styles.badgeRow}>
              <Badge label={item.tag === "premium" ? t.moduleTagPremium : t.moduleTagFree} color={item.tag === "premium" ? "#f59e0b" : tokens.success} />
              <Badge label={item.kind === "mcp_server" ? t.moduleKindMcp : t.moduleKindModule} color={tokens.brand} />
              <Badge label={item.status === "disabled" ? t.moduleStatusDisabled : t.moduleStatusActive} color={item.status === "disabled" ? tokens.textMuted : tokens.success} />
            </View>
          </Card>
        )}
      />

      <Modal
        visible={open}
        onClose={() => setOpen(false)}
        title={editingId ? t.moduleEditTitle : t.moduleCreateTitle}
        language={language}
        footer={
          <>
            <Button label={t.cancel} variant="ghost" onPress={() => setOpen(false)} disabled={saving} />
            <Button label={editingId ? t.save : t.create} variant="primary" onPress={() => void save()} loading={saving} disabled={saving} />
          </>
        }
      >
        <Input ref={codeRef} label={t.moduleCodeLabel} value={form.code} autoCapitalize="none" editable={!editingId}
          error={invalid === "code" ? " " : undefined}
          onChangeText={(v) => { setInvalid(null); setForm((f) => ({ ...f, code: v })); }} />
        <Input label={t.moduleNameLabel} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
        <Input label={t.moduleDescriptionLabel} value={form.description} multiline onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} />
        <Input label={t.moduleCategoryLabel} value={form.category} onChangeText={(v) => setForm((f) => ({ ...f, category: v }))} />
        <View>
          <FieldLabel tokens={tokens} language={language}>{t.moduleTagLabel}</FieldLabel>
          <Select value={form.tag} options={tagOptions} onChange={(v) => setForm((f) => ({ ...f, tag: v }))} />
        </View>
        <View>
          <FieldLabel tokens={tokens} language={language}>{t.moduleKindLabel}</FieldLabel>
          <Select value={form.kind} options={kindOptions} onChange={(v) => setForm((f) => ({ ...f, kind: v }))} />
        </View>
        <Input label={t.moduleVersionLabel} value={form.version} autoCapitalize="none" onChangeText={(v) => setForm((f) => ({ ...f, version: v }))} />
        <Input label={t.moduleRatingLabel} value={form.rating} keyboardType="numeric" onChangeText={(v) => setForm((f) => ({ ...f, rating: v }))} />
        <Input label={t.moduleCreatedByLabel} value={form.createdBy} autoCapitalize="none" onChangeText={(v) => setForm((f) => ({ ...f, createdBy: v }))} />
        <Input label={t.moduleScriptPathLabel} value={form.scriptPath} autoCapitalize="none" onChangeText={(v) => setForm((f) => ({ ...f, scriptPath: v }))} />
        <Input label={t.moduleScriptHashLabel} value={form.scriptHash} autoCapitalize="none" onChangeText={(v) => setForm((f) => ({ ...f, scriptHash: v }))} />
        <Input label={t.moduleFeaturesLabel} value={form.features} multiline onChangeText={(v) => setForm((f) => ({ ...f, features: v }))} />
        <Input ref={schemaRef} label={t.moduleConfigSchemaLabel} value={form.configSchema} multiline autoCapitalize="none"
          error={invalid === "configSchema" ? " " : undefined}
          onChangeText={(v) => { setInvalid(null); setForm((f) => ({ ...f, configSchema: v })); }} />
        <View>
          <FieldLabel tokens={tokens} language={language}>{t.moduleStatusLabel}</FieldLabel>
          <Select value={form.status} options={statusOptions} onChange={(v) => setForm((f) => ({ ...f, status: v }))} />
        </View>
        {formError ? <FormError tokens={tokens} message={formError} /> : null}
      </Modal>

      <ConfirmModal state={confirm} language={language} tokens={tokens}
        onCancel={() => setConfirm({ open: false, title: "", message: "", busy: false, action: null })}
        onConfirm={() => void runConfirm()} />
    </SectionShell>
  );
}

function emptyModuleForm() {
  return {
    code: "",
    name: "",
    description: "",
    category: "",
    tag: "free",
    kind: "module",
    version: "1.0.0",
    rating: "0",
    createdBy: "system",
    scriptPath: "",
    scriptHash: "",
    features: "",
    configSchema: "",
    status: "active",
  };
}

