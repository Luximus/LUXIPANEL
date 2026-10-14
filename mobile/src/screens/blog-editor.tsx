/**
 * blog-editor — editor de posts del blog con pestañas Publicar / Categorías /
 * Tags, extraído de BlogScreen sin cambio de comportamiento. Incluye el
 * asistente de borrador IA, generación de SEO, subida de portada y los gestores
 * de categorías y etiquetas.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from "react-native";
import { styles } from "./BlogScreen.styles";
import * as DocumentPicker from "expo-document-picker";
import { Sparkles, Upload, X as XIcon } from "lucide-react-native";
import {
  createBlogPost,
  updateBlogPost,
  generateBlogSeo,
  createBlogTag,
  uploadBlogImage,
  startBlogAiDraft,
  pollBlogAiDraft,
  type BlogPost,
  type BlogCategoryDef,
  type BlogAiUsage,
} from "../api/blog";
import { getMessages, formatMessage, getLocaleTextAlign } from "../i18n";
import { LOCALES } from "../i18n/locales";
import { ENV } from "../config/env";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { type ThemeTokens, type Tab, slugify, FieldLabel, FormError, ActionIcon } from "./blog-shared";
import { CategoryManager, TagManager } from "./blog-managers";

// ── Editor con tabs Publicar / Categorías / Tags ─────────────────────────────

export function BlogEditorModal({
  visible,
  onClose,
  token,
  language,
  tokens,
  tab,
  setTab,
  post,
  categories,
  setCategories,
  aiEnabled,
  onSaved,
  askConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  token: string;
  language: string;
  tokens: ThemeTokens;
  tab: Tab;
  setTab: (t: Tab) => void;
  post: BlogPost | null;
  categories: BlogCategoryDef[];
  setCategories: React.Dispatch<React.SetStateAction<BlogCategoryDef[]>>;
  aiEnabled: boolean;
  onSaved: () => Promise<void>;
  askConfirm: (cfg: { title: string; message: string; action: (() => Promise<void>) | null }) => void;
}) {
  const t = getMessages(language).blog;
  const textAlign = getLocaleTextAlign(language);

  // Form de publicación
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [sourceLocale, setSourceLocale] = useState("en");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [aiUsage, setAiUsage] = useState<BlogAiUsage | null>(null);

  // SEO y redes
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [socialCaption, setSocialCaption] = useState("");
  const [seoBusy, setSeoBusy] = useState(false);
  const [seoStatus, setSeoStatus] = useState("");

  const [invalid, setInvalid] = useState<"title" | "category" | "content" | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // IA
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [minChars, setMinChars] = useState("");
  const [imageCount, setImageCount] = useState("");

  const titleRef = useRef<TextInput>(null);
  const contentRef = useRef<TextInput>(null);

  // Inicializa el form cada vez que se abre.
  useEffect(() => {
    if (!visible) return;
    setTitle(post?.title ?? "");
    setSlug(post?.slug ?? "");
    setCategory(post?.category ?? "");
    setSelectedTags(new Set(post?.tags ?? []));
    setExcerpt(post?.excerpt ?? "");
    setContent(post?.content ?? "");
    setStatus(post?.status === "published" ? "published" : "draft");
    setSourceLocale(post?.sourceLocale ?? "es");
    setCoverUrl(post?.coverImageUrl ?? null);
    setCoverKey(null);
    setAiUsage(post?.aiUsage ?? null);
    setSeoTitle(post?.seoTitle ?? "");
    setSeoDescription(post?.seoDescription ?? "");
    setHashtags(Array.isArray(post?.hashtags) ? post.hashtags.join(" ") : "");
    setSocialCaption(post?.socialCaption ?? "");
    setSeoStatus("");
    setInvalid(null);
    setFormError("");
    setAiStatus("");
  }, [visible, post]);

  // Hashtags: el usuario los escribe separados por espacio o coma, con o sin "#".
  // Persistimos un string[] sin el "#" inicial ni vacíos.
  const parseHashtags = (raw: string): string[] =>
    raw
      .split(/[\s,]+/)
      .map((h) => h.replace(/^#+/, "").trim())
      .filter(Boolean);

  useEffect(() => {
    if (invalid === "title") titleRef.current?.focus();
    else if (invalid === "content") contentRef.current?.focus();
    // category no tiene ref (es un Select); el borde rojo lo señala.
  }, [invalid]);

  const editingId = post?.id ?? null;
  const currentCategory = categories.find((c) => c.name === category) ?? null;

  // Base pública del portal (donde vive el blog: <base>/blog/<slug>). Robusto a
  // que falte la env: si no hay base, la previsualización muestra solo el path.
  const publicBase = (ENV.luxipanelUrl ?? "").replace(/\/+$/, "");

  const categoryOptions = useMemo(
    () => [{ value: "", label: t.fieldCategoryPlaceholder }, ...categories.map((c) => ({ value: c.name, label: c.name }))],
    [categories, t.fieldCategoryPlaceholder],
  );
  const statusOptions = useMemo(
    () => [
      { value: "draft", label: t.statusDraft },
      { value: "published", label: t.statusPublished },
    ],
    [t.statusDraft, t.statusPublished],
  );
  const localeOptions = useMemo(() => LOCALES.map((l) => ({ value: l.code, label: `${l.flag} ${l.label}` })), []);

  const toggleTag = (name: string) =>
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  const pickCover = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "image/*", copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      setFormError("");
      const res = await uploadBlogImage(
        { uri: asset.uri, name: asset.name ?? "cover.jpg", type: asset.mimeType ?? "image/jpeg" },
        token,
      );
      setCoverUrl(res.url);
      setCoverKey(res.key);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t.uploadError);
    } finally {
      setUploading(false);
    }
  };

  const runAiDraft = async () => {
    if (!currentCategory) return;
    const hasContent = !!(title.trim() || content.replace(/<[^>]+>/g, "").trim());
    const doRun = async () => {
      setAiBusy(true);
      setAiStatus(formatMessage(t.aiProgress, { seconds: 0 }));
      try {
        const minN = parseInt(minChars, 10);
        const imgN = parseInt(imageCount, 10);
        const jobId = await startBlogAiDraft(
          {
            category: currentCategory.name,
            locale: sourceLocale || "es",
            ...(Number.isFinite(minN) && minN > 0 ? { minChars: minN } : {}),
            ...(Number.isFinite(imgN) && imgN >= 0 ? { imageCount: imgN } : {}),
            ...(selectedTags.size > 0 ? { tags: Array.from(selectedTags) } : {}),
          },
          token,
        );
        const result = await pollBlogAiDraft(jobId, token, (s) => setAiStatus(formatMessage(t.aiProgress, { seconds: s })));
        const d = result.draft;
        setAiUsage(result.usage ?? null);
        setTitle(d.title ?? "");
        // La IA reescribe el post → regeneramos la URL pública desde el nuevo
        // título. El backend la unificará al guardar.
        setSlug(slugify(d.title ?? ""));
        setExcerpt(d.excerpt ?? "");
        setContent(d.contentHtml ?? "");
        if (d.coverImageUrl) {
          setCoverUrl(d.coverImageUrl);
          setCoverKey(d.coverImageKey ?? null);
        }
        // Crea los tags propuestos que no existan en la categoría y los marca.
        const next = new Set<string>();
        if (Array.isArray(d.tags) && d.tags.length) {
          for (const raw of d.tags) {
            const name = raw.trim();
            if (!name) continue;
            let tagDef = currentCategory.tags.find((tg) => tg.name.toLowerCase() === name.toLowerCase());
            if (!tagDef) {
              try {
                const created = await createBlogTag(currentCategory.id, name, token);
                if (created) {
                  tagDef = created;
                  setCategories((prev) =>
                    prev.map((c) => (c.id === currentCategory.id ? { ...c, tags: [...c.tags, created] } : c)),
                  );
                }
              } catch {
                continue;
              }
            }
            if (tagDef) next.add(tagDef.name);
          }
        }
        setSelectedTags(next);
        setAiStatus(t.aiDone);
      } catch (e) {
        setAiStatus("");
        setFormError(e instanceof Error ? e.message : t.aiError);
      } finally {
        setAiBusy(false);
      }
    };
    if (hasContent) {
      askConfirm({ title: t.aiReplaceConfirmTitle, message: t.aiReplaceConfirmMessage, action: doRun });
    } else {
      void doRun();
    }
  };

  const runSeo = async () => {
    if (!title.trim() || !content.replace(/<[^>]+>/g, "").trim()) {
      setSeoStatus(t.seoNeedContent);
      return;
    }
    setSeoBusy(true);
    setSeoStatus(t.seoGenerating);
    try {
      const res = await generateBlogSeo(
        {
          title: title.trim(),
          excerpt: excerpt.trim(),
          content,
          category: category || null,
          tags: Array.from(selectedTags),
          locale: sourceLocale || "es",
        },
        token,
      );
      setSeoTitle(res.seoTitle ?? "");
      setSeoDescription(res.seoDescription ?? "");
      setHashtags(res.hashtags.join(" "));
      setSocialCaption(res.socialCaption ?? "");
      if (res.usage && res.usage.total.total > 0) setAiUsage(res.usage);
      setSeoStatus(t.seoDone);
    } catch (e) {
      setSeoStatus(e instanceof Error ? e.message : t.seoError);
    } finally {
      setSeoBusy(false);
    }
  };

  const save = async () => {
    const tt = title.trim();
    if (tt.length < 3) { setFormError(t.titleRequired); setInvalid("title"); return; }
    if (!category) { setFormError(t.categoryRequired); setInvalid("category"); return; }
    if (!content.replace(/<[^>]+>/g, "").trim()) { setFormError(t.contentRequired); setInvalid("content"); return; }

    setSaving(true);
    setFormError("");
    try {
      const payload = {
        title: tt,
        // URL pública: si va vacía el backend la deriva del título.
        slug: slug.trim() || undefined,
        category: category || null,
        tags: Array.from(selectedTags),
        excerpt: excerpt.trim(),
        content,
        status,
        sourceLocale: sourceLocale || "es",
        coverImageUrl: coverUrl,
        ...(coverKey ? { coverImageKey: coverKey } : {}),
        // SEO y redes (null limpia el campo en el backend).
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        hashtags: parseHashtags(hashtags),
        socialCaption: socialCaption.trim() || null,
        // Persistir tokens del borrador IA solo al crear (en edición ya están).
        ...(!editingId && aiUsage && aiUsage.total.total > 0 ? { aiUsage } : {}),
      };
      if (editingId) await updateBlogPost(editingId, payload, token);
      else await createBlogPost(payload, token);
      await onSaved();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const aiDisabledReason = !aiEnabled ? t.aiDisabled : !currentCategory ? t.aiNeedCategory : "";

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={editingId ? t.editorEditTitle : t.editorCreateTitle}
      language={language}
      footer={
        tab === "publish" ? (
          <>
            <Button label={t.cancel} variant="ghost" onPress={onClose} disabled={saving} />
            <Button label={t.save} variant="primary" onPress={() => void save()} loading={saving} disabled={saving || aiBusy || seoBusy} />
          </>
        ) : (
          <Button label={t.close} variant="ghost" onPress={onClose} />
        )
      }
    >
      {/* Tabs */}
      <View style={[styles.tabs, { borderColor: tokens.border }]}>
        {(["publish", "categories", "tags"] as Tab[]).map((tk) => {
          const active = tab === tk;
          const label = tk === "publish" ? t.tabPublish : tk === "categories" ? t.tabCategories : t.tabTags;
          return (
            <Pressable
              key={tk}
              onPress={() => setTab(tk)}
              style={[styles.tab, active && { borderBottomColor: tokens.brand, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabText, { color: active ? tokens.brand : tokens.textMuted }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "publish" ? (
        <>
          <Input
            ref={titleRef}
            label={t.fieldTitle}
            value={title}
            error={invalid === "title" ? " " : undefined}
            onChangeText={(v) => { setInvalid(null); setTitle(v); }}
          />
          {/* URL pública (slug). Editable; la IA la regenera al reescribir. */}
          <Input
            label={t.fieldSlug}
            value={slug}
            autoCapitalize="none"
            autoCorrect={false}
            hint={t.fieldSlugHint}
            onChangeText={(v) => setSlug(slugify(v))}
          />
          {slug.trim() ? (
            <Text style={{ color: tokens.textMuted, fontSize: 12, textAlign, marginTop: -2, marginBottom: 6 }}>
              {t.slugUrlLabel}: {publicBase ? `${publicBase}/blog/${slug.trim()}` : `/blog/${slug.trim()}`}
            </Text>
          ) : null}
          <View>
            <FieldLabel tokens={tokens} language={language}>{t.fieldCategory}</FieldLabel>
            <Select
              value={category}
              options={categoryOptions}
              onChange={(v) => { setInvalid(null); setCategory(v); }}
              style={invalid === "category" ? { borderColor: tokens.danger } : undefined}
            />
          </View>

          {/* Tags de la categoría seleccionada (checkboxes) */}
          <View>
            <FieldLabel tokens={tokens} language={language}>{t.fieldTags}</FieldLabel>
            {!currentCategory ? (
              <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.tagsNoCategory}</Text>
            ) : currentCategory.tags.length === 0 ? (
              <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.tagsEmpty}</Text>
            ) : (
              <View style={styles.tagChips}>
                {currentCategory.tags.map((tg) => {
                  const on = selectedTags.has(tg.name);
                  return (
                    <Pressable
                      key={tg.id}
                      onPress={() => toggleTag(tg.name)}
                      style={[
                        styles.chip,
                        { borderColor: on ? tokens.brand : tokens.border, backgroundColor: on ? tokens.brandDim : "transparent" },
                      ]}
                    >
                      <Text style={{ color: on ? tokens.brand : tokens.textSecondary, fontSize: 12.5, fontWeight: "600" }}>{tg.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Asistente IA */}
          {aiEnabled ? (
            <View style={[styles.aiBox, { borderColor: tokens.border, backgroundColor: tokens.bgSecondary }]}>
              <Input label={t.aiMinChars} value={minChars} keyboardType="numeric" onChangeText={setMinChars} />
              <Input label={t.aiImageCount} value={imageCount} keyboardType="numeric" onChangeText={setImageCount} />
              <Pressable
                onPress={() => void runAiDraft()}
                disabled={aiBusy || !currentCategory}
                style={[styles.aiBtn, { backgroundColor: tokens.brand, opacity: aiBusy || !currentCategory ? 0.5 : 1 }]}
              >
                <Sparkles size={16} color="#fff" />
                <Text style={styles.aiBtnText}>{aiBusy ? t.aiGenerating : t.aiGenerate}</Text>
              </Pressable>
              {aiDisabledReason && !aiBusy ? (
                <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{aiDisabledReason}</Text>
              ) : null}
              {aiStatus ? <Text style={{ color: tokens.textSecondary, fontSize: 12.5 }}>{aiStatus}</Text> : null}
              {aiUsage && aiUsage.total.total > 0 ? (
                <Text style={{ color: tokens.textMuted, fontSize: 12 }}>
                  {t.aiUsageTitle}: {aiUsage.total.total}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Input label={t.fieldExcerpt} value={excerpt} multiline onChangeText={setExcerpt} />
          <Input
            ref={contentRef}
            label={t.fieldContent}
            value={content}
            multiline
            hint={t.fieldContentHelp}
            error={invalid === "content" ? " " : undefined}
            onChangeText={(v) => { setInvalid(null); setContent(v); }}
            style={{ minHeight: 180 }}
          />

          <View>
            <FieldLabel tokens={tokens} language={language}>{t.statusLabel}</FieldLabel>
            <Select value={status} options={statusOptions} onChange={(v) => setStatus(v === "published" ? "published" : "draft")} />
          </View>
          <View>
            <FieldLabel tokens={tokens} language={language}>{t.fieldLocale}</FieldLabel>
            <Select value={sourceLocale} options={localeOptions} onChange={setSourceLocale} />
          </View>

          {/* SEO y redes */}
          <View style={[styles.aiBox, { borderColor: tokens.border, backgroundColor: tokens.bgSecondary }]}>
            <FieldLabel tokens={tokens} language={language}>{t.seoSection}</FieldLabel>
            <Input
              label={t.seoTitleLabel}
              value={seoTitle}
              maxLength={70}
              onChangeText={setSeoTitle}
            />
            <Input
              label={t.seoDescriptionLabel}
              value={seoDescription}
              multiline
              maxLength={200}
              onChangeText={setSeoDescription}
            />
            <Input
              label={t.seoHashtagsLabel}
              value={hashtags}
              autoCapitalize="none"
              hint={t.seoHashtagsHint}
              onChangeText={setHashtags}
            />
            <Input
              label={t.seoCaptionLabel}
              value={socialCaption}
              multiline
              maxLength={2200}
              onChangeText={setSocialCaption}
              style={{ minHeight: 90 }}
            />
            {aiEnabled ? (
              <Pressable
                onPress={() => void runSeo()}
                disabled={seoBusy}
                style={[styles.aiBtn, { backgroundColor: tokens.brand, opacity: seoBusy ? 0.5 : 1 }]}
              >
                <Sparkles size={16} color="#fff" />
                <Text style={styles.aiBtnText}>{t.seoGenerate}</Text>
              </Pressable>
            ) : null}
            {seoStatus ? <Text style={{ color: tokens.textSecondary, fontSize: 12.5 }}>{seoStatus}</Text> : null}
          </View>

          {/* Portada */}
          <View>
            <FieldLabel tokens={tokens} language={language}>{t.fieldCover}</FieldLabel>
            {coverUrl ? (
              <View style={styles.coverPreviewWrap}>
                <Image source={{ uri: coverUrl }} style={styles.coverPreview} resizeMode="cover" />
                <Pressable
                  onPress={() => { setCoverUrl(null); setCoverKey(null); }}
                  style={[styles.coverRemoveBtn, { backgroundColor: tokens.danger }]}
                  accessibilityLabel={t.coverRemove}
                >
                  <XIcon size={14} color="#fff" />
                </Pressable>
              </View>
            ) : null}
            <Input
              label={t.fieldCoverUrl}
              value={coverUrl ?? ""}
              autoCapitalize="none"
              onChangeText={(v) => { setCoverUrl(v || null); setCoverKey(null); }}
            />
            <Pressable
              onPress={() => void pickCover()}
              disabled={uploading}
              style={[styles.uploadBtn, { borderColor: tokens.border, opacity: uploading ? 0.6 : 1 }]}
            >
              {uploading ? <ActivityIndicator size="small" color={tokens.brand} /> : <Upload size={16} color={tokens.brand} />}
              <Text style={{ color: tokens.brand, fontWeight: "700", fontSize: 13 }}>
                {uploading ? t.uploading : t.coverUpload}
              </Text>
            </Pressable>
          </View>

          {formError ? <FormError tokens={tokens} message={formError} /> : null}
        </>
      ) : tab === "categories" ? (
        <CategoryManager token={token} language={language} tokens={tokens} categories={categories} setCategories={setCategories} askConfirm={askConfirm} />
      ) : (
        <TagManager token={token} language={language} tokens={tokens} categories={categories} setCategories={setCategories} askConfirm={askConfirm} />
      )}
    </Modal>
  );
}

