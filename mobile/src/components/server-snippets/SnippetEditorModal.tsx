// Editor de snippets en drawer lateral, sobre su módulo de origen.
import React, { useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { FormDrawer } from "../ui/FormDrawer";
import type { ServerSnippet } from "../../api/client";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Chip } from "../ui/Chip";
import { styles, type ThemeTokens } from "./snippet-styles";
import type { SnippetStrings } from "./snippet-strings";

export function SnippetEditorModal({
  tokens, t, busy, categories, tags, tagsForCategory, snippet, defaultCategoryId, onClose, onSubmit,
}: {
  tokens: ThemeTokens;
  t: SnippetStrings;
  busy: boolean;
  categories: { id: number; name: string }[];
  tags: { id: number; categoryId: number; name: string }[];
  tagsForCategory: (categoryId: number) => { id: number; name: string }[];
  snippet: ServerSnippet | null;
  defaultCategoryId: number | null;
  onClose: () => void;
  onSubmit: (input: { name: string; categoryId: number; command: string; tagIds: number[] }) => void;
}) {
  const [name, setName] = useState(snippet?.name ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(snippet?.categoryId ?? defaultCategoryId);
  const [command, setCommand] = useState(snippet?.command ?? "");
  const [tagIds, setTagIds] = useState<number[]>(snippet?.tagIds ?? []);

  const submit = () => {
    if (!name.trim() || !categoryId || !command.trim()) {
      Alert.alert(t.editSnippet, t.requireNameCategory);
      return;
    }
    onSubmit({ name: name.trim(), categoryId, command: command.trim(), tagIds });
  };

  const catTags = categoryId ? tagsForCategory(categoryId) : [];

  return (
    <FormDrawer visible onClose={onClose} title={snippet ? t.editSnippet : t.newSnippet} footer={
      <View style={{ flexDirection: "row", gap: 10, flex: 1 }}>
        <Button label={t.cancel} variant="ghost" style={styles.flex1} onPress={onClose} />
        <Button label={t.save} variant="primary" style={styles.flex1} loading={busy} onPress={submit} />
      </View>
    }>
      <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>{t.name}</Text>
      <TextInput
        value={name} onChangeText={setName} placeholder={t.namePlaceholder} placeholderTextColor={tokens.textMuted}
        style={[styles.input, { backgroundColor: tokens.bgInput, borderColor: tokens.border, color: tokens.textPrimary }]}
      />
      <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>{t.category}</Text>
      <Select
        value={categoryId ? String(categoryId) : ""}
        placeholder={t.selectCategory}
        onChange={(v) => { setCategoryId(v ? Number(v) : null); setTagIds([]); }}
        options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
      />
      <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>{t.tags}</Text>
      {!categoryId ? (
        <Text style={[styles.hint, { color: tokens.textMuted }]}>{t.tagsHelp}</Text>
      ) : catTags.length === 0 ? (
        <Text style={[styles.hint, { color: tokens.textMuted }]}>{t.categoryNoTags}</Text>
      ) : (
        <View style={styles.tagWrap}>
          {catTags.map((tg) => (
            <Chip
              key={tg.id}
              label={tg.name}
              selected={tagIds.includes(tg.id)}
              onPress={() => setTagIds((cur) => cur.includes(tg.id) ? cur.filter((x) => x !== tg.id) : [...cur, tg.id])}
            />
          ))}
        </View>
      )}
      <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>{t.command}</Text>
      <TextInput
        value={command} onChangeText={setCommand} placeholder={t.commandPlaceholder} placeholderTextColor={tokens.textMuted}
        multiline
        style={[styles.input, styles.cmdInput, { backgroundColor: tokens.bgInput, borderColor: tokens.border, color: tokens.textPrimary }]}
      />
    </FormDrawer>
  );
}
