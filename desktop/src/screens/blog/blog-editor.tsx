// blog-editor (desktop) — modal de edición/creación de posts del Blog con
// pestañas Publicar / Categorías / Tags, asistente de borrador IA, generación
// SEO/redes y subida de portada. Extraído de `screens/BlogScreen.tsx`; espeja
// la convención de hermanos de la app RN (`blog-editor`). Autocontenido: todo
// el estado compartido con la pantalla llega por props.
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Sparkles, Upload, X } from "lucide-react";
import type { useToast } from "../../components/ToastProvider";
import type { DialogApi } from "../../hooks/useDialog";
import { formatMessage, LOCALES } from "../../i18n";
import { ENV } from "../../config/env";
import {
  createBlogPost, updateBlogPost, generateBlogSeoSocial, createBlogTag,
  uploadBlogImage, startBlogAiDraft, pollBlogAiDraft,
  type BlogPost, type BlogCategory, type AiUsage,
} from "../../api/blog";
import { UsageBlock, parseHashtags, slugify, type BlogT, type Tab } from "./blog-shared";
import { CategoryManager, TagManager } from "./blog-managers";

// ── Editor con pestañas Publicar / Categorías / Tags ─────────────────────────

export function BlogEditorModal({
  token, t, dialog, toast, post, categories, setCategories, aiEnabled, onClose, onSaved,
}: {
  token: string;
  language?: string;
  t: BlogT;
  dialog: DialogApi;
  toast: ReturnType<typeof useToast>;
  post: BlogPost | null;
  categories: BlogCategory[];
  setCategories: Dispatch<SetStateAction<BlogCategory[]>>;
  aiEnabled: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("publish");

  // Form de publicación
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [category, setCategory] = useState(post?.category ?? "");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(post?.tags ?? []));
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [status, setStatus] = useState<"draft" | "published">(post?.status === "published" ? "published" : "draft");
  const [sourceLocale, setSourceLocale] = useState(post?.sourceLocale ?? "es");
  const [coverUrl, setCoverUrl] = useState<string | null>(post?.coverImageUrl ?? null);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(post?.aiUsage ?? null);

  // SEO y redes
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(post?.seoDescription ?? "");
  const [hashtags, setHashtags] = useState(Array.isArray(post?.hashtags) ? post!.hashtags.join(" ") : "");
  const [socialCaption, setSocialCaption] = useState(post?.socialCaption ?? "");
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

  const fileRef = useRef<HTMLInputElement>(null);

  const editingId = post?.id ?? null;
  const currentCategory = categories.find((c) => c.name === category) ?? null;
  const publicBase = (ENV.luxipanelUrl ?? "").replace(/\/+$/, "");

  const toggleTag = (name: string) =>
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  const pickCover = async (file: File) => {
    setUploading(true);
    setFormError("");
    try {
      const res = await uploadBlogImage(file, token);
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
    const hasContent = Boolean(title.trim() || content.replace(/<[^>]+>/g, "").trim());
    const doRun = async () => {
      setAiBusy(true);
      setAiStatus(t.aiStatusStart);
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
        const result = await pollBlogAiDraft(jobId, token, (s) => setAiStatus(formatMessage(t.aiStatusProgress, { seconds: s })));
        const d = result.draft;
        setAiUsage(result.usage ?? null);
        setTitle(d.title ?? "");
        // La IA reescribe el post → regeneramos la URL pública desde el nuevo
        // título; el backend la unifica al guardar.
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
        setAiStatus(t.aiStatusDone);
      } catch (e) {
        setAiStatus("");
        setFormError(e instanceof Error ? e.message : t.aiError);
      } finally {
        setAiBusy(false);
      }
    };
    if (hasContent) {
      const ok = await dialog.confirm({ title: t.regenConfirmTitle, message: t.regenConfirm, confirmLabel: t.aiGenerate, cancelLabel: t.cancel });
      if (!ok) return;
    }
    await doRun();
  };

  const runSeo = async () => {
    if (!title.trim() || !content.replace(/<[^>]+>/g, "").trim()) {
      setSeoStatus(t.contentRequired);
      return;
    }
    setSeoBusy(true);
    setSeoStatus(t.seoOptimizing);
    try {
      const res = await generateBlogSeoSocial(
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
        slug: slug.trim() || undefined,
        category: category || null,
        tags: Array.from(selectedTags),
        excerpt: excerpt.trim(),
        content,
        status,
        sourceLocale: sourceLocale || "es",
        coverImageUrl: coverUrl,
        ...(coverKey ? { coverImageKey: coverKey } : {}),
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        hashtags: parseHashtags(hashtags),
        socialCaption: socialCaption.trim() || null,
        ...(!editingId && aiUsage && aiUsage.total.total > 0 ? { aiUsage } : {}),
      };
      if (editingId) await updateBlogPost(editingId, payload, token);
      else await createBlogPost(payload, token);
      toast.success(editingId ? t.modalEditTitle : t.modalNewTitle);
      await onSaved();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const aiDisabledReason = !aiEnabled ? t.aiDisabled : !currentCategory ? t.aiNeedCategory : "";

  const inputCls = "input input-bordered input-sm w-full";
  const errCls = " border-error";

  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[160] grid place-items-center p-4">
      <div className="lp-modal-card flex max-h-full w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{editingId ? t.modalEditTitle : t.modalNewTitle}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={t.close}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-base-300 px-4 pt-2">
          {(["publish", "categories", "tags"] as Tab[]).map((tk) => {
            const active = tab === tk;
            const label = tk === "publish" ? t.tabPublish : tk === "categories" ? t.tabCategories : t.tabTags;
            return (
              <button
                key={tk}
                type="button"
                className={`px-3 py-2 text-sm font-medium transition ${active ? "border-b-2 border-primary text-primary" : "text-base-content/60 hover:text-base-content"}`}
                onClick={() => setTab(tk)}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="lp-modal-body">
          {tab === "publish" ? (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="lp-modal-label">{t.fieldTitle}</span>
                <input
                  className={`${inputCls}${invalid === "title" ? errCls : ""}`}
                  value={title}
                  onChange={(e) => { setInvalid(null); setTitle(e.target.value); }}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="lp-modal-label">{t.fieldSlug}</span>
                <input
                  className={inputCls}
                  value={slug}
                  autoCapitalize="none"
                  autoCorrect="off"
                  onChange={(e) => setSlug(slugify(e.target.value))}
                />
                <span className="lp-modal-hint">{t.fieldSlugHint}</span>
                {slug.trim() ? (
                  <span className="lp-modal-hint">{t.publicUrlLabel} {publicBase ? `${publicBase}/blog/${slug.trim()}` : `/blog/${slug.trim()}`}</span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1">
                <span className="lp-modal-label">{t.fieldCategory}</span>
                <select
                  className={`select select-bordered select-sm w-full${invalid === "category" ? errCls : ""}`}
                  value={category}
                  onChange={(e) => { setInvalid(null); setCategory(e.target.value); }}
                >
                  <option value="">{t.selectCategory}</option>
                  {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </label>

              {/* Tags de la categoría (chips) */}
              <div className="flex flex-col gap-1">
                <span className="lp-modal-label">{t.fieldTagsLabel}</span>
                {!currentCategory ? (
                  <p className="text-sm text-base-content/60">{t.tagsHintNoCategory}</p>
                ) : currentCategory.tags.length === 0 ? (
                  <p className="text-sm text-base-content/60">{t.tagsHintNoTags}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {currentCategory.tags.map((tg) => {
                      const on = selectedTags.has(tg.name);
                      return (
                        <button
                          key={tg.id}
                          type="button"
                          className={`badge cursor-pointer ${on ? "badge-primary" : "badge-outline"}`}
                          onClick={() => toggleTag(tg.name)}
                        >
                          {tg.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Asistente IA */}
              {aiEnabled ? (
                <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-200/40 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="lp-modal-label">{t.aiMinChars}</span>
                      <input className={inputCls} inputMode="numeric" value={minChars} onChange={(e) => setMinChars(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="lp-modal-label">{t.aiImageCount}</span>
                      <input className={inputCls} inputMode="numeric" value={imageCount} onChange={(e) => setImageCount(e.target.value)} />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm gap-1 self-start"
                    onClick={() => void runAiDraft()}
                    disabled={aiBusy || !currentCategory}
                    title={t.aiTooltip}
                  >
                    {aiBusy ? <span className="loading loading-spinner loading-xs" /> : <Sparkles size={16} />}
                    {aiBusy ? t.aiGenerating : t.aiGenerate}
                  </button>
                  {aiDisabledReason && !aiBusy ? <p className="text-xs text-base-content/60">{aiDisabledReason}</p> : null}
                  {aiStatus ? <p className="text-xs text-base-content/70">{aiStatus}</p> : null}
                  {aiUsage && aiUsage.total.total > 0 ? <UsageBlock t={t} usage={aiUsage} /> : null}
                </div>
              ) : null}

              <label className="flex flex-col gap-1">
                <span className="lp-modal-label">{t.fieldExcerpt}</span>
                <textarea className="textarea textarea-bordered w-full" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="lp-modal-label">{t.fieldContent}</span>
                <textarea
                  className={`textarea textarea-bordered w-full${invalid === "content" ? errCls : ""}`}
                  rows={10}
                  placeholder={t.contentPlaceholder}
                  value={content}
                  onChange={(e) => { setInvalid(null); setContent(e.target.value); }}
                />
                <span className="lp-modal-hint">{t.contentHelp}</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="lp-modal-label">{t.fieldStatus}</span>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={status}
                    onChange={(e) => setStatus(e.target.value === "published" ? "published" : "draft")}
                  >
                    <option value="draft">{t.statusDraft}</option>
                    <option value="published">{t.statusPublished}</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="lp-modal-label">{t.fieldLocale}</span>
                  <select className="select select-bordered select-sm w-full" value={sourceLocale} onChange={(e) => setSourceLocale(e.target.value)}>
                    {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
                  </select>
                </label>
              </div>

              {/* SEO y redes */}
              <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-200/40 p-3">
                <p className="lp-modal-label font-semibold">{t.seoSocialTitle}</p>
                <label className="flex flex-col gap-1">
                  <span className="lp-modal-label">{t.seoTitleLabel}</span>
                  <input className={inputCls} maxLength={70} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="lp-modal-label">{t.seoDescLabel}</span>
                  <textarea className="textarea textarea-bordered w-full" rows={2} maxLength={200} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="lp-modal-label">{t.hashtagsLabel}</span>
                  <input className={inputCls} autoCapitalize="none" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
                  <span className="lp-modal-hint">{t.hashtagsHint}</span>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="lp-modal-label">{t.socialCaptionLabel}</span>
                  <textarea className="textarea textarea-bordered w-full" rows={3} maxLength={2200} value={socialCaption} onChange={(e) => setSocialCaption(e.target.value)} />
                </label>
                {aiEnabled ? (
                  <button type="button" className="btn btn-outline btn-sm gap-1 self-start" onClick={() => void runSeo()} disabled={seoBusy}>
                    {seoBusy ? <span className="loading loading-spinner loading-xs" /> : <Sparkles size={16} />}
                    {seoBusy ? t.seoOptimizing : t.seoOptimize}
                  </button>
                ) : null}
                {seoStatus ? <p className="text-xs text-base-content/70">{seoStatus}</p> : null}
              </div>

              {/* Portada */}
              <div className="flex flex-col gap-2">
                <span className="lp-modal-label">{t.fieldCover}</span>
                {coverUrl ? (
                  <div className="relative w-fit">
                    <img src={coverUrl} alt="" className="h-28 rounded-box object-cover" />
                    <button
                      type="button"
                      className="btn btn-circle btn-error btn-xs absolute -right-2 -top-2"
                      onClick={() => { setCoverUrl(null); setCoverKey(null); }}
                      aria-label={t.coverRemove}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-base-content/50">{t.coverEmpty}</p>
                )}
                <input className={inputCls} autoCapitalize="none" placeholder="https://…" value={coverUrl ?? ""} onChange={(e) => { setCoverUrl(e.target.value || null); setCoverKey(null); }} />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickCover(f); e.target.value = ""; }}
                />
                <button type="button" className="btn btn-outline btn-sm gap-1 self-start" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <span className="loading loading-spinner loading-xs" /> : <Upload size={16} />}
                  {uploading ? t.coverUploading : t.coverUpload}
                </button>
              </div>

              {formError ? <p className="lp-modal-error">{formError}</p> : null}
            </div>
          ) : tab === "categories" ? (
            <CategoryManager token={token} t={t} dialog={dialog} toast={toast} categories={categories} setCategories={setCategories} />
          ) : (
            <TagManager token={token} t={t} dialog={dialog} toast={toast} categories={categories} setCategories={setCategories} />
          )}
        </div>

        <div className="lp-modal-footer">
          {tab === "publish" ? (
            <>
              <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose} disabled={saving}>{t.cancel}</button>
              <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => void save()} disabled={saving || aiBusy || seoBusy}>
                {saving ? t.saving : t.save}
              </button>
            </>
          ) : (
            <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>{t.close}</button>
          )}
        </div>
      </div>
    </div>
  );
}
