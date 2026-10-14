/**
 * blog-managers — gestores de categorías y tags del blog, usados como pestañas
 * del editor. Extraídos de blog-editor sin cambio de comportamiento.
 */
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "./BlogScreen.styles";
import { Pencil, Trash2 } from "lucide-react-native";
import {
  createBlogCategory,
  updateBlogCategory,
  deleteBlogCategory,
  createBlogTag,
  updateBlogTag,
  deleteBlogTag,
  type BlogCategoryDef,
} from "../api/blog";
import { getMessages, formatMessage } from "../i18n";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { type ThemeTokens, FieldLabel, FormError, ActionIcon } from "./blog-shared";

// ── Gestión de categorías ─────────────────────────────────────────────────────

export function CategoryManager({
  token,
  language,
  tokens,
  categories,
  setCategories,
  askConfirm,
}: {
  token: string;
  language: string;
  tokens: ThemeTokens;
  categories: BlogCategoryDef[];
  setCategories: React.Dispatch<React.SetStateAction<BlogCategoryDef[]>>;
  askConfirm: (cfg: { title: string; message: string; action: (() => Promise<void>) | null }) => void;
}) {
  const t = getMessages(language).blog;
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [renaming, setRenaming] = useState<BlogCategoryDef | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const add = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setErr("");
    try {
      const created = await createBlogCategory(trimmed, token);
      if (created) {
        setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setName("");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.categoryError);
    }
  };

  const doRename = async () => {
    if (!renaming) return;
    const trimmed = renameValue.trim();
    if (trimmed.length < 2) return;
    try {
      await updateBlogCategory(renaming.id, trimmed, token);
      setCategories((prev) => prev.map((c) => (c.id === renaming.id ? { ...c, name: trimmed } : c)));
      setRenaming(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.categoryError);
    }
  };

  const askDelete = (c: BlogCategoryDef) =>
    askConfirm({
      title: t.categoryDeleteTitle,
      message: formatMessage(t.categoryDeleteMessage, { name: c.name }),
      action: async () => {
        await deleteBlogCategory(c.id, token);
        setCategories((prev) => prev.filter((x) => x.id !== c.id));
      },
    });

  return (
    <>
      <View style={styles.inlineRow}>
        <View style={{ flex: 1 }}>
          <Input label={t.categoriesTitle} value={name} placeholder={t.categoryNewPlaceholder} onChangeText={setName} />
        </View>
        <Button label={t.categoryAdd} variant="primary" onPress={() => void add()} />
      </View>
      {err ? <FormError tokens={tokens} message={err} /> : null}
      {categories.length === 0 ? (
        <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.categoriesEmpty}</Text>
      ) : (
        categories.map((c) => (
          <View key={c.id} style={[styles.mgrRow, { borderColor: tokens.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tokens.textPrimary, fontWeight: "700", fontSize: 14 }}>{c.name}</Text>
              <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{formatMessage(t.categoryTagsCount, { count: c.tags.length })}</Text>
            </View>
            <ActionIcon icon={<Pencil />} color={tokens.brand} onPress={() => { setRenaming(c); setRenameValue(c.name); }} />
            <ActionIcon icon={<Trash2 />} color={tokens.danger} onPress={() => askDelete(c)} />
          </View>
        ))
      )}

      <Modal
        visible={renaming !== null}
        onClose={() => setRenaming(null)}
        title={t.categoryRename}
        language={language}
        footer={
          <>
            <Button label={t.cancel} variant="ghost" onPress={() => setRenaming(null)} />
            <Button label={t.save} variant="primary" onPress={() => void doRename()} />
          </>
        }
      >
        <Input label={t.categoryNameLabel} value={renameValue} onChangeText={setRenameValue} />
      </Modal>
    </>
  );
}

// ── Gestión de tags por categoría ─────────────────────────────────────────────

export function TagManager({
  token,
  language,
  tokens,
  categories,
  setCategories,
  askConfirm,
}: {
  token: string;
  language: string;
  tokens: ThemeTokens;
  categories: BlogCategoryDef[];
  setCategories: React.Dispatch<React.SetStateAction<BlogCategoryDef[]>>;
  askConfirm: (cfg: { title: string; message: string; action: (() => Promise<void>) | null }) => void;
}) {
  const t = getMessages(language).blog;
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const cat = categories.find((c) => c.id === categoryId) ?? null;
  const catOptions = useMemo(
    () => [{ value: "", label: t.tagPickCategory }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
    [categories, t.tagPickCategory],
  );

  const add = async () => {
    if (!cat) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setErr("");
    try {
      const created = await createBlogTag(cat.id, trimmed, token);
      if (created) {
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, tags: [...c.tags, created].sort((a, b) => a.name.localeCompare(b.name)) } : c)),
        );
        setName("");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.tagError);
    }
  };

  const doRename = async () => {
    if (!renaming || !cat) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    try {
      await updateBlogTag(renaming.id, trimmed, token);
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, tags: c.tags.map((tg) => (tg.id === renaming.id ? { ...tg, name: trimmed } : tg)) } : c)),
      );
      setRenaming(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.tagError);
    }
  };

  const askDelete = (tagId: string, tagName: string) =>
    askConfirm({
      title: t.tagDeleteTitle,
      message: formatMessage(t.tagDeleteMessage, { name: tagName }),
      action: async () => {
        await deleteBlogTag(tagId, token);
        if (cat) {
          setCategories((prev) =>
            prev.map((c) => (c.id === cat.id ? { ...c, tags: c.tags.filter((tg) => tg.id !== tagId) } : c)),
          );
        }
      },
    });

  return (
    <>
      <View>
        <FieldLabel tokens={tokens} language={language}>{t.tagsTitle}</FieldLabel>
        <Select value={categoryId} options={catOptions} onChange={setCategoryId} />
      </View>
      {cat ? (
        <View style={styles.inlineRow}>
          <View style={{ flex: 1 }}>
            <Input label={t.tagNewPlaceholder} value={name} onChangeText={setName} />
          </View>
          <Button label={t.tagAdd} variant="primary" onPress={() => void add()} />
        </View>
      ) : null}
      {err ? <FormError tokens={tokens} message={err} /> : null}
      {!cat ? (
        <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.tagsManageEmpty}</Text>
      ) : cat.tags.length === 0 ? (
        <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.tagsCategoryEmpty}</Text>
      ) : (
        cat.tags.map((tg) => (
          <View key={tg.id} style={[styles.mgrRow, { borderColor: tokens.border }]}>
            <Text style={{ flex: 1, color: tokens.textPrimary, fontWeight: "700", fontSize: 14 }}>{tg.name}</Text>
            <ActionIcon icon={<Pencil />} color={tokens.brand} onPress={() => { setRenaming(tg); setRenameValue(tg.name); }} />
            <ActionIcon icon={<Trash2 />} color={tokens.danger} onPress={() => askDelete(tg.id, tg.name)} />
          </View>
        ))
      )}

      <Modal
        visible={renaming !== null}
        onClose={() => setRenaming(null)}
        title={t.categoryRename}
        language={language}
        footer={
          <>
            <Button label={t.cancel} variant="ghost" onPress={() => setRenaming(null)} />
            <Button label={t.save} variant="primary" onPress={() => void doRename()} />
          </>
        }
      >
        <Input label={t.tagNameLabel} value={renameValue} onChangeText={setRenameValue} />
      </Modal>
    </>
  );
}

