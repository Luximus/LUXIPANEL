import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eye, Search } from "lucide-react";
import type { Messages } from "../i18n";
import {
  getPublicBlogPost,
  getPublicBlogPosts,
  getPublicBlogTaxonomy,
  type PublicBlogDetail,
  type PublicBlogListItem,
} from "../api/blog";
import styles from "./BlogReaderTab.module.css";

/**
 * Lector de BLOG (solo lectura) para el tab "Blog" del lateral de servidores.
 * Muestra las MISMAS publicaciones que el blog público de la web (CMS), leyendo
 * `GET /blog/posts` (listado) y `GET /blog/posts/:slug` (detalle con cuerpo HTML
 * ya saneado en backend). Reemplaza al antiguo muro social (`FeedTab`).
 *
 * Scroll INFINITO estilo blog público de la web (`blog-feed.ts`): tandas de 7
 * por página, sentinel + IntersectionObserver, 1 petición a la vez y cooldown
 * de 2 s tras cada tanda. Filtros (búsqueda / categoría / tag) server-side con
 * las opciones de la taxonomía pública (`GET /blog/taxonomy`). Por defecto
 * queda preseleccionada la categoría "LuxiPanel" (últimas noticias de
 * LuxiPanel) si existe en la taxonomía; si no, "Todas las categorías".
 */

/** Tamaño de tanda del scroll infinito (publicaciones por página). */
const PAGE_SIZE = 7;
/** Categoría preseleccionada por defecto (match case-insensitive en taxonomía). */
const DEFAULT_CATEGORY = "luxipanel";

function formatDate(iso: string | null, language?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(language === "en" ? "en" : language, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function CategoryBadge({ label }: { label: string }) {
  return (
    <span className={styles.badge}>
      {label}
    </span>
  );
}

// i18n inline (es/en) de los filtros del lector de blog. Se mantiene inline (no
// en los archivos de locale) por ser UI menor; otros idiomas caen a inglés.
const FILTER_STRINGS: Record<string, {
  searchPlaceholder: string; allCategories: string; allTags: string; noResults: string;
  loadingMore: string; endOfList: string;
}> = {
  es: {
    searchPlaceholder: "Buscar por título…",
    allCategories: "Todas las categorías",
    allTags: "Todos los tags",
    noResults: "No hay publicaciones con esos filtros.",
    loadingMore: "Cargando publicaciones…",
    endOfList: "No hay más publicaciones.",
  },
  en: {
    searchPlaceholder: "Search by title…",
    allCategories: "All categories",
    allTags: "All tags",
    noResults: "No posts match those filters.",
    loadingMore: "Loading posts…",
    endOfList: "No more posts.",
  },
};
function filterStrings(language?: string) {
  return FILTER_STRINGS[(language ?? "es").slice(0, 2)] ?? FILTER_STRINGS.es;
}

export function BlogReaderTab({
  token,
  t,
  language,
  fillHeight,
}: {
  token: string;
  t: Messages;
  language?: string;
  fillHeight?: boolean;
}) {
  const tf = t.feed;
  const ft = filterStrings(language);

  const [posts, setPosts] = useState<PublicBlogListItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Mensaje de "fin" solo tras agotar el scroll (no en la primera tanda).
  const [reachedEnd, setReachedEnd] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PublicBlogDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const loadedRef = useRef(false);

  // Opciones de filtro desde la taxonomía pública (mismas que el blog público).
  const [taxoCategories, setTaxoCategories] = useState<string[]>([]);
  const [taxoTags, setTaxoTags] = useState<string[]>([]);
  // true cuando la taxonomía resolvió (o falló) y la categoría por defecto ya
  // está decidida → habilita la primera carga del listado.
  const [filtersReady, setFiltersReady] = useState(false);

  // Filtros server-side: texto (con debounce), categoría y tag.
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");

  // ── Estado del scroll infinito (refs: lo leen callbacks del observer) ──────
  const pageRef = useRef(1);
  const seqRef = useRef(0); // generación de filtros; invalida respuestas obsoletas
  const inFlightRef = useRef(false);
  const hasMoreRef = useRef(false);
  const cooldownRef = useRef(0);
  const sentinelVisibleRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const rootStyle = useMemo(
    () => (fillHeight ? { display: "flex", flexDirection: "column" as const, minHeight: 0, flex: 1 } : {}),
    [fillHeight],
  );

  // Debounce de la búsqueda (la resuelve el backend con `q`).
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => window.clearTimeout(id);
  }, [query]);

  // Al montar: taxonomía + categoría por defecto (LuxiPanel si existe entre las
  // categorías con posts publicados).
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      try {
        const taxo = await getPublicBlogTaxonomy(token);
        setTaxoCategories(taxo.categories);
        setTaxoTags(taxo.tags);
        const def = taxo.categories.find((c) => c.trim().toLowerCase() === DEFAULT_CATEGORY);
        if (def) setCategory(def);
      } catch {
        // Sin taxonomía: filtros derivados de lo cargado y sin preselección.
      }
      setFiltersReady(true);
    })();
  }, [token]);

  const loadPage = useCallback(async (page: number, replace: boolean) => {
    const seq = replace ? ++seqRef.current : seqRef.current;
    inFlightRef.current = true;
    if (replace) {
      setBusy(true);
      setError("");
      setReachedEnd(false);
      setPosts([]);
      hasMoreRef.current = false;
    } else {
      setLoadingMore(true);
    }
    try {
      const { posts: batch, pagination } = await getPublicBlogPosts(token, {
        page,
        limit: PAGE_SIZE,
        locale: language,
        category: category || undefined,
        tag: tag || undefined,
        q: debouncedQuery || undefined,
      });
      if (seq !== seqRef.current) return; // respuesta de un filtro anterior
      setPosts((prev) => (replace ? batch : [...prev, ...batch]));
      pageRef.current = page;
      const more = batch.length > 0 && page < (pagination?.totalPages ?? 0);
      hasMoreRef.current = more;
      if (!more && !replace) setReachedEnd(true);
      // Cooldown de 2 s tras una respuesta OK antes de permitir otra tanda
      // (mismo patrón que el blog público), con re-chequeo del sentinel.
      cooldownRef.current = Date.now() + 2000;
      window.setTimeout(() => maybeLoad(), 2050);
    } catch (e) {
      if (seq !== seqRef.current) return;
      if (replace) {
        setError(e instanceof Error ? e.message : tf.loadError);
      } else {
        // Error de red en una tanda: reintenta al volver a tocar fondo.
        cooldownRef.current = Date.now() + 1500;
        window.setTimeout(() => maybeLoad(), 1550);
      }
    } finally {
      if (seq === seqRef.current) {
        inFlightRef.current = false;
        setBusy(false);
        setLoadingMore(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, language, category, tag, debouncedQuery, tf.loadError]);

  const loadPageRef = useRef(loadPage);
  useEffect(() => {
    loadPageRef.current = loadPage;
  }, [loadPage]);

  const maybeLoad = useCallback(() => {
    if (!hasMoreRef.current || inFlightRef.current || !sentinelVisibleRef.current) return;
    if (Date.now() < cooldownRef.current) return;
    void loadPageRef.current(pageRef.current + 1, false);
  }, []);

  // (Re)carga de la primera tanda al quedar listos los filtros y en cada cambio
  // de filtro/idioma (la identidad de `loadPage` cambia exactamente con ellos).
  useEffect(() => {
    if (!filtersReady) return;
    void loadPage(1, true);
  }, [filtersReady, loadPage]);

  // Observer del sentinel (root = viewport: respeta el clipping del contenedor
  // con scroll, sea la lista interna `dashboard-panel__scroll` o la ventana).
  useEffect(() => {
    if (selected) return; // vista detalle: la lista no está montada
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        sentinelVisibleRef.current = entries[0]?.isIntersecting ?? false;
        maybeLoad();
      },
      { rootMargin: "120px 0px" },
    );
    observer.observe(sentinel);
    return () => {
      sentinelVisibleRef.current = false;
      observer.disconnect();
    };
  }, [selected, maybeLoad]);

  const openPost = useCallback(
    async (item: PublicBlogListItem) => {
      setLoadingDetail(true);
      try {
        const post = await getPublicBlogPost(item.slug, token, language);
        setSelected(post ?? { ...item, content: "" });
      } catch {
        setSelected({ ...item, content: "" });
      } finally {
        setLoadingDetail(false);
      }
    },
    [token, language],
  );

  // ── Detalle ────────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div style={rootStyle}>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-base-content/80 hover:text-base-content"
          aria-label={t.common.close}
        >
          <ArrowLeft size={16} className="lp-rtl-flip" />
          <span>{t.common.close}</span>
        </button>

        <div className={`${styles.detailScroll}${fillHeight ? " dashboard-panel__scroll" : ""}`}>
          {selected.coverImageUrl ? (
            <img src={selected.coverImageUrl} alt="" className="lp-blog-cover" loading="lazy" />
          ) : null}
          {selected.category || (selected.tags?.length ?? 0) > 0 ? (
            <div className="lp-blog-taxo" style={{ marginTop: 10 }}>
              {selected.category ? <CategoryBadge label={selected.category} /> : null}
              {(selected.tags ?? []).map((tag) => (
                <span key={tag} className="lp-blog-tag">{tag}</span>
              ))}
            </div>
          ) : null}
          <h3 className={styles.detailTitle}>
            {selected.title}
          </h3>
          <hr className="lp-blog-sep" />
          <div className={`${styles.detailMeta} flex flex-wrap items-center gap-x-2 gap-y-1 text-xs opacity-60`}>
            <span>{selected.authorName || tf.authorFallback}</span>
            {selected.publishedAt ? <span>· {formatDate(selected.publishedAt, language)}</span> : null}
            <span className="inline-flex items-center gap-1">
              · <Eye size={12} /> {selected.viewCount}
            </span>
          </div>
          {selected.content ? (
            <div className="lp-blog-content" dangerouslySetInnerHTML={{ __html: selected.content }} />
          ) : selected.excerpt ? (
            <p className="text-sm opacity-80">{selected.excerpt}</p>
          ) : null}
        </div>
      </div>
    );
  }

  // ── Listado (timeline con scroll infinito en tandas de 7) ──────────────────
  // Opciones de los selects: taxonomía pública; si falló, derivadas de lo cargado.
  const categoryOptions = taxoCategories.length > 0
    ? taxoCategories
    : Array.from(new Set(posts.map((p) => p.category).filter((c): c is string => Boolean(c)))).sort((a, b) => a.localeCompare(b));
  const tagOptions = taxoTags.length > 0
    ? taxoTags
    : Array.from(new Set(posts.flatMap((p) => p.tags))).sort((a, b) => a.localeCompare(b));
  const hasFilters = Boolean(debouncedQuery || category || tag);
  return (
    <div style={rootStyle}>
      <div className="mb-2 flex flex-nowrap items-center gap-2">
        <label className="input input-sm input-bordered flex min-w-0 flex-[2] items-center gap-2">
          <Search size={14} className="opacity-60" />
          <input
            type="text"
            className="grow"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ft.searchPlaceholder}
            aria-label={ft.searchPlaceholder}
          />
        </label>
        <select className="select select-sm select-bordered w-32 shrink-0 truncate" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={ft.allCategories}>
          <option value="">{ft.allCategories}</option>
          {categoryOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <select className="select select-sm select-bordered w-32 shrink-0 truncate" value={tag} onChange={(e) => setTag(e.target.value)} aria-label={ft.allTags}>
          <option value="">{ft.allTags}</option>
          {tagOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <div className={`${styles.listScroll}${fillHeight ? " dashboard-panel__scroll" : ""}`}>
        {busy ? (
          <p className={`${styles.stateMsg} text-xs opacity-60`}>
            …
          </p>
        ) : error ? (
          <p className={`${styles.stateError} text-xs`}>
            {error}
          </p>
        ) : posts.length === 0 ? (
          <p className={`${styles.stateMsg} text-xs opacity-60`}>
            {hasFilters ? ft.noResults : tf.noPosts}
          </p>
        ) : (
          <ul className="timeline timeline-vertical timeline-compact lp-blog-timeline">
            {posts.map((post, idx) => (
              <li key={post.id}>
                {idx > 0 ? <hr /> : null}
                <div className="timeline-middle">
                  <span className="lp-blog-timeline-dot" aria-hidden="true" />
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => void openPost(post)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void openPost(post);
                    }
                  }}
                  className="timeline-end timeline-box lp-blog-timeline-box"
                >
                  {/* Texto a la izquierda, imagen a la derecha. */}
                  <div className="lp-blog-timeline-text">
                    {post.publishedAt ? (
                      <span className="lp-blog-timeline-date">{formatDate(post.publishedAt, language)}</span>
                    ) : null}
                    {post.category || post.tags.length > 0 ? (
                      <div className={`${styles.postTaxo} lp-blog-taxo`}>
                        {post.category ? <CategoryBadge label={post.category} /> : null}
                        {post.tags.map((tag) => (
                          <span key={tag} className="lp-blog-tag">{tag}</span>
                        ))}
                      </div>
                    ) : null}
                    <p className={styles.postTitle}>{post.title}</p>
                    {post.excerpt ? (
                      <p className={`${styles.postExcerpt} text-xs opacity-70`}>
                        {post.excerpt}
                      </p>
                    ) : null}
                    <div className={`${styles.postMeta} flex flex-wrap items-center gap-x-2 text-xs opacity-60`}>
                      <span>{post.authorName || tf.authorFallback}</span>
                      <span className="inline-flex items-center gap-1">
                        · <Eye size={12} /> {post.viewCount}
                      </span>
                    </div>
                  </div>
                  {post.coverImageUrl ? (
                    <img
                      src={post.coverImageUrl}
                      alt=""
                      className="lp-blog-timeline-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                {idx < posts.length - 1 ? <hr /> : null}
              </li>
            ))}
          </ul>
        )}
        {loadingMore ? (
          <p className={`${styles.loadingDetailMsg} text-xs opacity-60`}>
            {ft.loadingMore}
          </p>
        ) : null}
        {reachedEnd && posts.length > 0 ? (
          <p className={`${styles.loadingDetailMsg} text-xs opacity-60`}>
            {ft.endOfList}
          </p>
        ) : null}
        {loadingDetail ? (
          <p className={`${styles.loadingDetailMsg} text-xs opacity-60`}>
            …
          </p>
        ) : null}
        <div ref={sentinelRef} aria-hidden="true" style={{ height: 1, flexShrink: 0 }} />
      </div>
    </div>
  );
}
