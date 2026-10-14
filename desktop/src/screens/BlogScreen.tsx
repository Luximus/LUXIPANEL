// BlogScreen (desktop) — port nativo React DOM de la sección "Blog" de la app
// (mirror-port RN→React DOM de `app/src/screens/BlogScreen.tsx` + hermanos
// blog-editor/blog-shared/blog-managers). Autoría de blog: lista de posts en
// DataTable (buscador/orden/paginación), acciones por fila (retraducir/editar/
// ver público/borrar) y editor modal con pestañas Publicar / Categorías / Tags,
// asistente de borrador IA, generación SEO/redes y subida de portada.
//
// Convenciones desktop (como Jobs/Publicaciones): Tailwind + daisyUI, lucide-react,
// useToast/useDialog, getMessages(language).blog, DataTable y modales lp-modal-*.
// La API vive en `api/blog.ts`; la i18n en `i18n/messages/screens/blog.ts`.
// El editor modal y los gestores de categorías/tags viven en `./blog/`
// (blog-editor / blog-managers / blog-shared, como en la app RN).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Newspaper, Plus, RefreshCw } from "lucide-react";
import { NavActions } from "../components/NavActions";
import { useToast } from "../components/ToastProvider";
import { useDialog } from "../hooks/useDialog";
import { getMessages, formatMessage } from "../i18n";
import { ENV } from "../config/env";
import { openExternal } from "../features/app/utils";
import type { NavAction } from "../features/app/types";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableRowActionConfig,
} from "../components/DataTable";
import {
  getBlogTaxonomy, getBlogPosts, deleteBlogPost, retranslateBlogPost,
  type BlogPost, type BlogCategory,
} from "../api/blog";
import type { BlogPostRow } from "./blog/blog-shared";
import { BlogEditorModal } from "./blog/blog-editor";

export function BlogScreen({
  token,
  language,
}: {
  token: string;
  language?: string;
  isAdmin?: boolean;
}) {
  const t = getMessages(language).blog;
  const toast = useToast();
  const dialog = useDialog(language);

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [canManageAll, setCanManageAll] = useState(false);
  const [scopeAll, setScopeAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadTaxonomy = useCallback(async () => {
    try {
      const tax = await getBlogTaxonomy(token);
      setCategories(tax.categories);
      setAiEnabled(tax.aiEnabled);
    } catch {
      setCategories([]);
    }
  }, [token]);

  const loadPosts = useCallback(async (scope: boolean) => {
    setLoading(true);
    setListError("");
    try {
      const data = await getBlogPosts(token, scope);
      setPosts(data.posts);
      setCanManageAll(data.canManageAll);
    } catch (e) {
      setListError(e instanceof Error ? e.message : t.loadError);
    } finally {
      setLoading(false);
    }
  }, [token, t.loadError]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
  useEffect(() => { void loadTaxonomy(); }, [loadTaxonomy]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
  useEffect(() => { void loadPosts(scopeAll); }, [loadPosts, scopeAll]);

  const rows = useMemo<BlogPostRow[]>(
    () =>
      posts.map((p) => ({
        id: p.id,
        title: p.title,
        categoryLabel: p.category ?? "—",
        statusLabel: p.status === "published" ? t.statusPublished : t.statusDraft,
        tagsLabel: (p.tags ?? []).join(", "),
        authorLabel: p.authorName ?? "—",
        views: p.viewCount,
        dateLabel: p.publishedAt
          ? new Date(p.publishedAt).toLocaleDateString()
          : new Date(p.createdAt).toLocaleDateString(),
        searchBlob: `${p.title} ${p.excerpt} ${p.category ?? ""} ${(p.tags ?? []).join(" ")} ${p.authorName ?? ""}`.toLowerCase(),
        source: p,
      })),
    [posts, t.statusPublished, t.statusDraft],
  );

  const columns = useMemo<DataTableColumnConfig<BlogPostRow>[]>(() => {
    const cols: DataTableColumnConfig<BlogPostRow>[] = [
      {
        id: "title", header: t.colTitle, accessorKey: "title", sortable: true, hideable: true,
        cell: (row) => (
          <div className="flex min-w-0 items-center gap-2">
            {row.source.coverImageUrl ? (
              <img src={row.source.coverImageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
            ) : null}
            <span className="truncate font-medium">{row.title}</span>
          </div>
        ),
      },
      { id: "category", header: t.colCategory, accessorKey: "categoryLabel", sortable: true, hideable: true },
      {
        id: "status", header: t.colStatus, accessorKey: "statusLabel", sortable: true, hideable: true,
        cell: (row) => (
          <span className={`badge badge-sm ${row.source.status === "published" ? "badge-success" : "badge-ghost"}`}>
            {row.statusLabel}
          </span>
        ),
      },
      {
        id: "tags", header: t.colTags, accessorKey: "tagsLabel", sortable: false, hideable: true,
        cell: (row) =>
          row.source.tags.length ? (
            <div className="flex flex-wrap gap-1">
              {row.source.tags.map((tag) => (
                <span key={tag} className="badge badge-ghost badge-sm">{tag}</span>
              ))}
            </div>
          ) : (
            <span className="opacity-40">—</span>
          ),
      },
    ];
    if (scopeAll) {
      cols.push({ id: "author", header: t.colAuthor, accessorKey: "authorLabel", sortable: true, hideable: true });
    }
    cols.push(
      { id: "views", header: t.colViews, accessorKey: "views", sortable: true, hideable: true },
      { id: "date", header: t.colDate, accessorKey: "dateLabel", sortable: true, hideable: true },
    );
    return cols;
  }, [t, scopeAll]);

  const rowActions = useMemo<DataTableRowActionConfig<BlogPostRow>[]>(
    () => [
      { id: "edit", label: t.edit },
      { id: "retranslate", label: t.retranslate, visible: (row) => row.source.status === "published" },
      { id: "viewPublic", label: t.viewPublic, visible: (row) => Boolean(row.source.slug) },
      { id: "delete", label: t.delete, variant: "danger" },
    ],
    [t],
  );

  const publicBase = (ENV.luxipanelUrl ?? "").replace(/\/+$/, "");

  const onRetranslate = useCallback(async (p: BlogPost) => {
    setBusyId(p.id);
    try {
      await retranslateBlogPost(p.id, token);
      toast.success(t.retranslateStarted);
      await loadPosts(scopeAll);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.retranslateError);
    } finally {
      setBusyId(null);
    }
  }, [token, toast, t, loadPosts, scopeAll]);

  const onDeletePost = useCallback(async (p: BlogPost) => {
    const ok = await dialog.confirm({
      title: t.deletePostTitle,
      message: formatMessage(t.deletePostConfirm, { title: p.title }),
      tone: "danger",
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
    });
    if (!ok) return;
    try {
      await deleteBlogPost(p.id, token);
      toast.success(t.deletePostTitle);
      await loadPosts(scopeAll);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.deleteError);
    }
  }, [dialog, t, token, toast, loadPosts, scopeAll]);

  const onRowAction = useCallback((actionId: string, row: BlogPostRow) => {
    const p = row.source;
    switch (actionId) {
      case "edit":
        setEditingId(p.id);
        setEditorOpen(true);
        break;
      case "retranslate":
        void onRetranslate(p);
        break;
      case "viewPublic":
        openExternal(publicBase ? `${publicBase}/blog/${p.slug}` : `/blog/${p.slug}`);
        break;
      case "delete":
        void onDeletePost(p);
        break;
    }
  }, [onRetranslate, onDeletePost, publicBase]);

  const openCreate = () => { setEditingId(null); setEditorOpen(true); };

  const editingPost = editingId ? posts.find((p) => p.id === editingId) ?? null : null;

  const actions: NavAction[] = [
    { id: "refresh", label: t.refresh, icon: <RefreshCw size={16} />, onClick: () => void loadPosts(scopeAll), disabled: loading, busy: loading },
    { id: "new", label: t.newPost, icon: <Plus size={16} />, variant: "primary", onClick: openCreate },
  ];

  return (
    <main className="h-full w-full overflow-y-auto p-3 sm:p-4 md:p-6">
      <div className="panel-wrapper">
        <section className="panel-hero">
          <div className="panel-hero__grid">
            <div className="panel-hero__content">
              <span className="panel-hero__eyebrow inline-flex items-center gap-1"><Newspaper size={14} /> {t.tab}</span>
              <h1 className="panel-hero__title">{t.title}</h1>
              <p className="panel-hero__subtitle">{t.subtitle}</p>
            </div>
          </div>
        </section>

        <section className="panel-section">
          <div className="support-section">
            <div className="support-section__header flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {canManageAll ? (
                  <button
                    type="button"
                    className={`btn btn-sm ${scopeAll ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setScopeAll((v) => !v)}
                  >
                    {scopeAll ? t.scopeAll : t.scopeMine}
                  </button>
                ) : null}
              </div>
              <NavActions actions={actions} />
            </div>

            {listError ? (
              <div className="mt-3 flex items-center gap-3">
                <p className="text-sm text-error">{listError}</p>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => void loadPosts(scopeAll)}>{t.refresh}</button>
              </div>
            ) : null}

            <div className="mt-4">
              {!loading && rows.length === 0 && !listError ? (
                <p className="py-10 text-center text-base-content/60">{t.empty}</p>
              ) : (
                <DataTable
                  tableId="portal-blog-posts-table"
                  title={t.title}
                  data={rows}
                  columns={columns}
                  rowActions={rowActions}
                  pageSizeOptions={[10, 20, 50]}
                  language={language}
                  loading={loading || busyId !== null}
                  onRowAction={onRowAction}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      {editorOpen ? (
        <BlogEditorModal
          token={token}
          language={language}
          t={t}
          dialog={dialog}
          toast={toast}
          post={editingPost}
          categories={categories}
          setCategories={setCategories}
          aiEnabled={aiEnabled}
          onClose={() => setEditorOpen(false)}
          onSaved={async () => { setEditorOpen(false); await loadPosts(scopeAll); }}
        />
      ) : null}

      {dialog.element}
    </main>
  );
}
