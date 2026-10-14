// Paneles del sub-tab "Configuración": categorías + tags de snippets (server-backed).
// Extraído de `ServerSnippetsTab.tsx` (refactor conservador: código movido tal cual).
import React, { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { Check, Pencil, Trash2, X } from "lucide-react-native";
import { IconButton } from "../ui/IconButton";
import { Select } from "../ui/Select";
import { styles, type ThemeTokens } from "./snippet-styles";
import type { SnippetStrings } from "./snippet-strings";

// ── Panel de categorías (alta/edición/borrado) ───────────────────────────
export function CategoriesPanel({
  tokens, t, busy, categories, tagsForCategory, onCreate, onRename, onDelete,
}: {
  tokens: ThemeTokens;
  t: SnippetStrings;
  busy: boolean;
  categories: { id: number; name: string }[];
  tagsForCategory: (categoryId: number) => { id: number; name: string }[];
  onCreate: (name: string) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const [editId, setEditId] = useState<number | null>(null);

  const submit = () => {
    const name = draft.trim();
    if (!name) return;
    if (editId) onRename(editId, name); else onCreate(name);
    setDraft(""); setEditId(null);
  };

  return (
    <View style={styles.fill}>
      <View style={styles.formRow}>
        <TextInput
          value={draft} onChangeText={setDraft} placeholder={t.newCategoryPlaceholder} placeholderTextColor={tokens.textMuted}
          style={[styles.input, styles.flex1, { backgroundColor: tokens.bgInput, borderColor: tokens.border, color: tokens.textPrimary }]}
        />
        {editId ? <IconButton variant="secondary" icon={<X size={18} />} accessibilityLabel={t.cancel} onPress={() => { setDraft(""); setEditId(null); }} /> : null}
        <IconButton variant="primary" icon={<Check size={18} />} accessibilityLabel={t.save} loading={busy} onPress={submit} />
      </View>
      <ScrollView style={styles.fill} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        {categories.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.textMuted }]}>{t.noCategories}</Text>
        ) : categories.map((c) => (
          <View key={c.id} style={[styles.simpleRow, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
            <View style={styles.flex1}>
              <Text numberOfLines={1} style={[styles.snipName, { color: tokens.textPrimary }]}>{c.name}</Text>
              <Text style={[styles.snipCmd, { color: tokens.textMuted }]}>{tagsForCategory(c.id).length} tags</Text>
            </View>
            <IconButton size={32} variant="ghost" icon={<Pencil size={15} />} accessibilityLabel={t.save} onPress={() => { setEditId(c.id); setDraft(c.name); }} />
            <IconButton size={32} variant="ghost" icon={<Trash2 size={15} color={tokens.danger} />} accessibilityLabel={t.delete} onPress={() => onDelete(c.id)} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Panel de tags (por categoría) ────────────────────────────────────────
export function TagsPanel({
  tokens, t, busy, categories, tags, onCreate, onRename, onDelete,
}: {
  tokens: ThemeTokens;
  t: SnippetStrings;
  busy: boolean;
  categories: { id: number; name: string }[];
  tags: { id: number; categoryId: number; name: string }[];
  onCreate: (categoryId: number, name: string) => void;
  onRename: (id: number, categoryId: number, name: string) => void;
  onDelete: (id: number) => void;
}) {
  const [categoryId, setCategoryId] = useState<number | null>(categories[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [editId, setEditId] = useState<number | null>(null);

  const submit = () => {
    const name = draft.trim();
    if (!name || !categoryId) return;
    if (editId) onRename(editId, categoryId, name); else onCreate(categoryId, name);
    setDraft(""); setEditId(null);
  };

  const visible = categoryId ? tags.filter((tg) => tg.categoryId === categoryId) : [];

  if (categories.length === 0) {
    return <Text style={[styles.empty, { color: tokens.textMuted }]}>{t.noCategories}</Text>;
  }

  return (
    <View style={styles.fill}>
      <Select
        value={categoryId ? String(categoryId) : ""}
        placeholder={t.selectCategory}
        onChange={(v) => { setCategoryId(v ? Number(v) : null); setEditId(null); setDraft(""); }}
        options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
      />
      <View style={styles.formRow}>
        <TextInput
          value={draft} onChangeText={setDraft} placeholder={t.newTagPlaceholder} placeholderTextColor={tokens.textMuted}
          style={[styles.input, styles.flex1, { backgroundColor: tokens.bgInput, borderColor: tokens.border, color: tokens.textPrimary }]}
        />
        {editId ? <IconButton variant="secondary" icon={<X size={18} />} accessibilityLabel={t.cancel} onPress={() => { setDraft(""); setEditId(null); }} /> : null}
        <IconButton variant="primary" icon={<Check size={18} />} accessibilityLabel={t.save} loading={busy} disabled={!categoryId} onPress={submit} />
      </View>
      <ScrollView style={styles.fill} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        {visible.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.textMuted }]}>{t.categoryNoTags}</Text>
        ) : visible.map((tg) => (
          <View key={tg.id} style={[styles.simpleRow, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
            <Text numberOfLines={1} style={[styles.snipName, styles.flex1, { color: tokens.textPrimary }]}>{tg.name}</Text>
            <IconButton size={32} variant="ghost" icon={<Pencil size={15} />} accessibilityLabel={t.save} onPress={() => { setEditId(tg.id); setDraft(tg.name); }} />
            <IconButton size={32} variant="ghost" icon={<Trash2 size={15} color={tokens.danger} />} accessibilityLabel={t.delete} onPress={() => onDelete(tg.id)} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
