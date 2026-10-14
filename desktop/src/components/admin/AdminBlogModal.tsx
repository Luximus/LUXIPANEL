import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { formatMessage, getMessages } from "../../i18n";
import type { DialogApi } from "../../hooks/useDialog";
import { LOCALES } from "../../i18n/locales";
import styles from "./AdminBlogModal.module.css";
import {
  createBlogPost, updateBlogPost, uploadBlogImage,
  createBlogTag,
  startBlogAiDraft, pollBlogAiDraft, generateBlogSeoSocial,
  type BlogPost, type BlogCategory, type BlogPostPayload, type AiUsage,
} from "../../api/blog";
import {
  parseHashtags, slugify, findCategoryByName, PUBLIC_BLOG_BASE,
  type BlogTab, type FailedField,
} from "./adminBlog/helpers";
import { CategoriesManager } from "./adminBlog/CategoriesManager";
import { TagsManager } from "./adminBlog/TagsManager";
import { AiUsageTable } from "./adminBlog/AiUsageTable";
import { SeoSocialFieldset } from "./adminBlog/SeoSocialFieldset";
import { AiDraftRow, TagsPicker, ContentField, CoverImageField } from "./adminBlog/PublishFields";
import { useBlogTaxonomy } from "./adminBlog/useBlogTaxonomy";

/**
 * Editor de publicaciones del blog (espejo de `frontend/src/lib/portal-blog.ts`).
 * Modal con 3 tabs: Publicar / Categorías / Tags. El contenido es un textarea
 * Markdown grande (no TipTap). El botón IA arranca un job asíncrono y sondea el
 * jobId, rellenando el formulario al terminar. Validación con focus-al-guardar
 * sobre los campos obligatorios (título, categoría, contenido).
 */
export function AdminBlogModal({
  open,
  post,
  categories,
  aiEnabled,
  token,
  language,
  dialog,
  onClose,
  onSaved,
  onTaxonomyChange,
}: {
  open: boolean;
  post: BlogPost | null;
  categories: BlogCategory[];
  aiEnabled: boolean;
  token: string;
  language: string;
  dialog: DialogApi;
  onClose: () => void;
  onSaved: () => void;
  /** Notifica al padre la nueva taxonomía tras CRUD de categorías/tags. */
  onTaxonomyChange: (categories: BlogCategory[]) => void;
}) {
  const t = getMessages(language);
  const b = t.blog;
  const isEditing = Boolean(post);

  const [tab, setTab] = useState<BlogTab>("publish");

  // Campos del post.
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [locale, setLocale] = useState("en");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);

  // SEO / redes sociales.
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [socialCaption, setSocialCaption] = useState("");
  const [seoBusy, setSeoBusy] = useState(false);
  const [seoStatus, setSeoStatus] = useState("");

  // Parámetros IA.
  const [minChars, setMinChars] = useState("");
  const [imageCount, setImageCount] = useState("");

  // Gestión de taxonomía (locales, sincronizados con `categories` del padre).
  const [cats, setCats] = useState<BlogCategory[]>(categories);
  const [newCatName, setNewCatName] = useState("");
  const [tagMgrCategoryId, setTagMgrCategoryId] = useState("");
  const [newTagName, setNewTagName] = useState("");

  // Estado de operación.
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingContent, setUploadingContent] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<FailedField>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const contentFileRef = useRef<HTMLInputElement>(null);

  // Reset al abrir / cambiar de post.
  useEffect(() => {
    if (!open) return;
    setTab("publish");
    setError("");
    setFailed(null);
    setAiStatus("");
    setCats(categories);
    setTitle(post?.title ?? "");
    setSlug(post?.slug ?? "");
    setCategoryName(post?.category ?? "");
    setSelectedTags(new Set(post?.tags ?? []));
    setExcerpt(post?.excerpt ?? "");
    setContent(post?.content ?? "");
    setStatus(post?.status ?? "draft");
    setLocale(post?.sourceLocale ?? "en");
    setCoverUrl(post?.coverImageUrl ?? null);
    setCoverKey(null);
    setAiUsage(post?.aiUsage ?? null);
    setSeoTitle(post?.seoTitle ?? "");
    setSeoDescription(post?.seoDescription ?? "");
    setHashtagsText((post?.hashtags ?? []).map((h) => `#${h}`).join(" "));
    setSocialCaption(post?.socialCaption ?? "");
    setSeoStatus("");
    setMinChars("");
    setImageCount("");
    setNewCatName("");
    setNewTagName("");
    setTagMgrCategoryId("");
  }, [open, post, categories]);

  useEffect(() => {
    if (failed === "title") { setTab("publish"); titleRef.current?.focus(); }
    else if (failed === "category") { setTab("publish"); categoryRef.current?.focus(); }
    else if (failed === "content") { setTab("publish"); contentRef.current?.focus(); }
  }, [failed]);

  const busy = saving || uploadingCover || uploadingContent || aiBusy || seoBusy;


  const currentCategory = useMemo(
    () => findCategoryByName(cats, categoryName),
    [cats, categoryName],
  );

  if (!open) return null;

  const syncCats = (next: BlogCategory[]) => { setCats(next); onTaxonomyChange(next); };

  // ── Subida de imágenes ───────────────────────────────────────────────
  const onUploadCover = async (file: File) => {
    setUploadingCover(true);
    setError("");
    try {
      const res = await uploadBlogImage(file, token);
      setCoverUrl(res.url);
      setCoverKey(res.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : b.uploadError);
    } finally {
      setUploadingCover(false);
    }
  };

  const onUploadContentImage = async (file: File) => {
    setUploadingContent(true);
    setError("");
    try {
      const res = await uploadBlogImage(file, token);
      // En modo Markdown insertamos la sintaxis de imagen al final del contenido.
      setContent((cur) => `${cur}${cur && !cur.endsWith("\n") ? "\n" : ""}![](${res.url})\n`);
    } catch (err) {
      setError(err instanceof Error ? err.message : b.uploadError);
    } finally {
      setUploadingContent(false);
    }
  };

  // ── Borrador con IA (asíncrono) ──────────────────────────────────────
  const runAiDraft = async () => {
    const cat = currentCategory;
    if (!cat) return;
    const hasContent = !!(title.trim() || content.replace(/<[^>]+>/g, "").trim());
    if (hasContent) {
      const ok = await dialog.confirm({
        title: b.regenConfirmTitle,
        message: b.regenConfirm,
        confirmLabel: b.aiGenerate,
      });
      if (!ok) return;
    }
    setAiBusy(true);
    setError("");
    setAiStatus(b.aiStatusStart);
    try {
      const min = parseInt(minChars, 10);
      const imgs = parseInt(imageCount, 10);
      const jobId = await startBlogAiDraft(
        {
          category: cat.name,
          locale: locale || "es",
          minChars: Number.isFinite(min) && min > 0 ? min : undefined,
          imageCount: Number.isFinite(imgs) && imgs >= 0 ? imgs : undefined,
          tags: selectedTags.size > 0 ? Array.from(selectedTags) : undefined,
        },
        token,
      );
      const { draft, usage } = await pollBlogAiDraft(jobId, token, (secs) => {
        setAiStatus(formatMessage(b.aiStatusProgress, { seconds: secs }));
      });
      // Reemplazo total del borrador actual.
      setAiUsage(usage ?? null);
      setTitle(draft.title ?? "");
      // Regenerar con IA actualiza también la URL pública.
      setSlug(slugify(draft.title ?? ""));
      setExcerpt(draft.excerpt ?? "");
      setContent(draft.contentHtml ?? "");
      if (draft.coverImageUrl) { setCoverUrl(draft.coverImageUrl); setCoverKey(draft.coverImageKey ?? null); }
      // Crea en la categoría los tags propuestos que no existan y márcalos.
      const proposed = Array.isArray(draft.tags) ? draft.tags : [];
      const nextSelected = new Set<string>();
      let working = cats;
      for (const raw of proposed) {
        const name = raw.trim();
        if (!name) continue;
        const liveCat = working.find((c) => c.id === cat.id);
        let tag = liveCat?.tags.find((tg) => tg.name.toLowerCase() === name.toLowerCase());
        if (!tag && liveCat) {
          try {
            tag = await createBlogTag(liveCat.id, name, token);
            working = working.map((c) => (c.id === liveCat.id ? { ...c, tags: [...c.tags, tag!] } : c));
          } catch { continue; }
        }
        if (tag) nextSelected.add(tag.name);
      }
      if (working !== cats) syncCats(working);
      setSelectedTags(nextSelected);
      setAiStatus(b.aiStatusDone);
    } catch (err) {
      setAiStatus("");
      setError(err instanceof Error ? err.message : b.aiError);
      setTab("publish");
    } finally {
      setAiBusy(false);
    }
  };

  // ── SEO / redes (IA, síncrono) ───────────────────────────────────────
  const runSeoSocial = async () => {
    setSeoBusy(true);
    setError("");
    setSeoStatus(b.seoOptimizing);
    try {
      const res = await generateBlogSeoSocial(
        {
          title: title.trim(),
          excerpt: excerpt.trim(),
          content,
          category: categoryName.trim() || null,
          tags: Array.from(selectedTags),
          locale: locale || "es",
        },
        token,
      );
      if (res.seoTitle !== null) setSeoTitle(res.seoTitle);
      if (res.seoDescription !== null) setSeoDescription(res.seoDescription);
      if (res.hashtags.length > 0) setHashtagsText(res.hashtags.map((h) => `#${h}`).join(" "));
      if (res.socialCaption !== null) setSocialCaption(res.socialCaption);
      setSeoStatus(b.seoDone);
    } catch (err) {
      setSeoStatus("");
      setError(err instanceof Error ? err.message : b.seoError);
      setTab("publish");
    } finally {
      setSeoBusy(false);
    }
  };

  // ── Guardado del post ────────────────────────────────────────────────
  const submit = async () => {
    setError("");
    const titleValue = title.trim();
    if (titleValue.length < 3) { setFailed("title"); setError(b.titleRequired); return; }
    if (!categoryName.trim()) { setFailed("category"); setError(b.categoryRequired); return; }
    if (!content.trim()) { setFailed("content"); setError(b.contentRequired); return; }

    const payload: BlogPostPayload = {
      title: titleValue,
      slug: slug.trim() || undefined,
      category: categoryName.trim() || null,
      tags: Array.from(selectedTags),
      excerpt: excerpt.trim(),
      content,
      status,
      sourceLocale: locale || "es",
      coverImageUrl: coverUrl,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      hashtags: parseHashtags(hashtagsText),
      socialCaption: socialCaption.trim() || null,
    };
    if (coverKey) payload.coverImageKey = coverKey;
    // Persistir tokens del borrador IA solo al crear (en edición ya están guardados).
    if (!isEditing && aiUsage && aiUsage.total.total > 0) payload.aiUsage = aiUsage;

    setSaving(true);
    try {
      if (isEditing && post) await updateBlogPost(post.id, payload, token);
      else await createBlogPost(payload, token);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : b.saveError);
    } finally {
      setSaving(false);
    }
  };

  // ── CRUD categorías / tags (concern cohesivo en su propio hook) ───────
  const { addCategory, renameCategory, removeCategory, addTag, renameTag, removeTag } = useBlogTaxonomy({
    t, b, token, dialog, cats, syncCats,
    categoryName, setCategoryName,
    selectedTags, setSelectedTags,
    tagMgrCategoryId, setTagMgrCategoryId,
    newCatName, setNewCatName,
    newTagName, setNewTagName,
  });

  // ── Render ───────────────────────────────────────────────────────────
  const aiCanRun = aiEnabled && !!currentCategory;
  const aiTitle = !aiEnabled ? b.aiDisabled : !currentCategory ? b.aiNeedCategory : b.aiTooltip;

  const tabs: Array<{ id: BlogTab; label: string }> = [
    { id: "publish", label: b.tabPublish },
    { id: "categories", label: b.tabCategories },
    { id: "tags", label: b.tabTags },
  ];

  return (
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4"
    >
      <div className="lp-modal-card flex max-h-full w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{isEditing ? b.modalEditTitle : b.modalNewTitle}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={b.close} disabled={busy}>
            <X size={18} />
          </button>
        </div>

        <div className={`lp-modal-body ${styles.body}`}>
          <div className="flex flex-wrap gap-2">
            {tabs.map((tb) => (
              <button
                key={tb.id}
                type="button"
                className={`btn btn-sm lp-seg-tab ${tab === tb.id ? "is-active" : "btn-outline"}`}
                onClick={() => setTab(tb.id)}
                disabled={busy}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {/* ── Tab Publicar ── */}
          {tab === "publish" ? (
            <div className={styles.publishTab}>
              <label className={`lp-modal-label ${styles.label}`}>
                <span>{b.fieldTitle}</span>
                <input
                  ref={titleRef}
                  className={`lp-modal-input${failed === "title" ? " lp-modal-input--error" : ""}`}
                  aria-invalid={failed === "title" || undefined}
                  type="text"
                  value={title}
                  disabled={busy}
                  onChange={(e) => { setTitle(e.target.value); setFailed(null); }}
                />
              </label>

              {/* URL pública (slug) */}
              <label className={`lp-modal-label ${styles.label}`}>
                <span>{b.fieldSlug}</span>
                <input
                  className="lp-modal-input"
                  type="text"
                  value={slug}
                  disabled={busy}
                  placeholder={b.fieldSlug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                />
                <span className={styles.publicUrl}>
                  <b>{b.publicUrlLabel}</b>{" "}
                  {`${PUBLIC_BLOG_BASE}/blog/${slug || "…"}`}
                </span>
                <span className="text-xs opacity-60">{b.fieldSlugHint}</span>
              </label>

              <div className={styles.grid2}>
                <label className={`lp-modal-label ${styles.label}`}>
                  <span>{b.fieldCategory}</span>
                  <select
                    ref={categoryRef}
                    className={`lp-modal-input${failed === "category" ? " lp-modal-input--error" : ""}`}
                    aria-invalid={failed === "category" || undefined}
                    value={categoryName}
                    disabled={busy}
                    onChange={(e) => {
                      setCategoryName(e.target.value);
                      setSelectedTags(new Set());
                      setFailed(null);
                    }}
                  >
                    <option value="">{b.selectCategory}</option>
                    {cats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </label>
                <label className={`lp-modal-label ${styles.label}`}>
                  <span>{b.fieldLocale}</span>
                  <select className="lp-modal-input" value={locale} disabled={busy} onChange={(e) => setLocale(e.target.value)}>
                    {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </label>
              </div>

              {/* IA */}
              <AiDraftRow
                b={b}
                busy={busy}
                minChars={minChars}
                onMinCharsChange={setMinChars}
                imageCount={imageCount}
                onImageCountChange={setImageCount}
                aiBusy={aiBusy}
                aiCanRun={aiCanRun}
                aiTitle={aiTitle}
                onRun={() => void runAiDraft()}
              />
              {aiStatus ? <p className="text-xs opacity-80">{aiStatus}</p> : null}

              {/* Tags por categoría */}
              <TagsPicker
                b={b}
                busy={busy}
                currentCategory={currentCategory}
                selectedTags={selectedTags}
                onToggle={(name, checked) => {
                  const s = new Set(selectedTags);
                  if (checked) s.add(name); else s.delete(name);
                  setSelectedTags(s);
                }}
              />

              <label className={`lp-modal-label ${styles.label}`}>
                <span>{b.fieldExcerpt}</span>
                <textarea className={`lp-modal-input ${styles.resizable}`} rows={2} value={excerpt} disabled={busy} onChange={(e) => setExcerpt(e.target.value)} />
              </label>

              <ContentField
                b={b}
                busy={busy}
                content={content}
                onContentChange={(v) => { setContent(v); setFailed(null); }}
                contentRef={contentRef}
                failed={failed === "content"}
                uploadingContent={uploadingContent}
                contentFileRef={contentFileRef}
                onUploadContentImage={(f) => void onUploadContentImage(f)}
              />

              {/* Portada */}
              <CoverImageField
                b={b}
                busy={busy}
                coverUrl={coverUrl}
                onCoverUrlChange={(v) => { setCoverUrl(v); setCoverKey(null); }}
                onClearCover={() => { setCoverUrl(null); setCoverKey(null); }}
                uploadingCover={uploadingCover}
                coverFileRef={coverFileRef}
                onUploadCover={(f) => void onUploadCover(f)}
              />

              {/* SEO y redes */}
              <SeoSocialFieldset
                b={b}
                aiEnabled={aiEnabled}
                busy={busy}
                seoBusy={seoBusy}
                seoStatus={seoStatus}
                onRunSeo={() => void runSeoSocial()}
                seoTitle={seoTitle}
                onSeoTitleChange={setSeoTitle}
                seoDescription={seoDescription}
                onSeoDescriptionChange={setSeoDescription}
                hashtagsText={hashtagsText}
                onHashtagsTextChange={setHashtagsText}
                socialCaption={socialCaption}
                onSocialCaptionChange={setSocialCaption}
              />

              <label className={`lp-modal-label ${styles.label}`}>
                <span>{b.fieldStatus}</span>
                <select className="lp-modal-input" value={status} disabled={busy} onChange={(e) => setStatus(e.target.value === "published" ? "published" : "draft")}>
                  <option value="draft">{b.statusDraft}</option>
                  <option value="published">{b.statusPublished}</option>
                </select>
              </label>

              {/* Uso de tokens IA */}
              {aiUsage && aiUsage.total.total > 0 ? (
                <AiUsageTable aiUsage={aiUsage} b={b} />
              ) : null}
            </div>
          ) : null}

          {/* ── Tab Categorías ── */}
          {tab === "categories" ? (
            <CategoriesManager
              b={b}
              cats={cats}
              busy={busy}
              newCatName={newCatName}
              onNewCatNameChange={setNewCatName}
              onAdd={() => void addCategory()}
              onRename={(id) => void renameCategory(id)}
              onRemove={(id) => void removeCategory(id)}
            />
          ) : null}

          {/* ── Tab Tags ── */}
          {tab === "tags" ? (
            <TagsManager
              b={b}
              cats={cats}
              busy={busy}
              tagMgrCategoryId={tagMgrCategoryId}
              onCategoryChange={setTagMgrCategoryId}
              newTagName={newTagName}
              onNewTagNameChange={setNewTagName}
              onAdd={() => void addTag()}
              onRename={(catId, tagId) => void renameTag(catId, tagId)}
              onRemove={(catId, tagId) => void removeTag(catId, tagId)}
            />
          ) : null}

          {error ? <p className="lp-modal-error">{error}</p> : null}
        </div>

        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose} disabled={busy}>{b.cancel}</button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => void submit()} disabled={busy}>
            {saving ? b.saving : b.save}
          </button>
        </div>
      </div>
    </div>
  );
}
