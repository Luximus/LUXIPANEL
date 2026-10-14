import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { ArrowLeft, Eye, Search, X } from "lucide-react-native";
import {
  getPublicBlogPost,
  getPublicBlogPosts,
  getPublicBlogTaxonomy,
  type PublicBlogDetail,
  type PublicBlogListItem,
} from "../api/blog";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { getLocaleDirection, getLocaleTextAlign, getMessages } from "../i18n";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { HtmlView } from "../components/HtmlView";
import { Select, type SelectOption } from "../components/ui/Select";
import { usePullRefresh } from "../hooks/usePullRefresh";
import { ListPanelSkeleton } from "../components/skeletons";
import { makeStyles } from "./BlogReaderScreen.styles";


// Lector público del blog. Replica el blog web: filtros q/category/tag,
// taxonomía pública y carga paginada. En móvil se reutiliza dentro de un
// drawer lateral y también puede montarse como pantalla normal.
const PAGE_SIZE = 4;
const DEFAULT_CATEGORY = "luxipanel";

// (Los rótulos de los filtros y el fin de lista vivían aquí, hardcodeados en
// es/en: los otros 9 idiomas de la app caían a ESPAÑOL. Ahora salen del catálogo
// i18n `blogfeed`, traducido a los 11 locales.)

function formatDate(iso: string | null, language: string): string {
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

export function BlogReaderScreen({
  language,
  token,
  onClose,
  compact = false,
}: {
  language: string;
  token: string;
  onClose?: () => void;
  compact?: boolean;
}) {
  const t = getMessages(language).blogfeed;
  const tCommon = getMessages(language).common;
  // Labels del botón Copiar de los bloques de código (mismos del asistente).
  const tChat = getMessages(language).assistantChat;
  const textAlign = getLocaleTextAlign(language);
  // Dirección de escritura del locale (RTL): el cuerpo del artículo (HtmlView)
  // la necesita además del textAlign para invertir marcadores de lista, citas, etc.
  const writingDirection = getLocaleDirection(language);
  const { theme } = useTheme();
  const dark = theme === "dark";
  const tokens = getThemeTokens(dark);
  const styles = useMemo(() => makeStyles(tokens, compact), [tokens, compact]);
  const { height: screenHeight } = useWindowDimensions();

  const [posts, setPosts] = useState<PublicBlogListItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PublicBlogDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const detailSeqRef = useRef(0);
  const loadedRef = useRef(false);

  const [taxoCategories, setTaxoCategories] = useState<string[]>([]);
  const [taxoTags, setTaxoTags] = useState<string[]>([]);
  const [filtersReady, setFiltersReady] = useState(false);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");

  const pageRef = useRef(1);
  const seqRef = useRef(0);
  const inFlightRef = useRef(false);
  const hasMoreRef = useRef(false);
  const cooldownRef = useRef(0);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!token || loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      try {
        const taxo = await getPublicBlogTaxonomy(token);
        setTaxoCategories(taxo.categories);
        setTaxoTags(taxo.tags);
        const defaultCategory = taxo.categories.find((c) => c.trim().toLowerCase() === DEFAULT_CATEGORY);
        if (defaultCategory) setCategory(defaultCategory);
      } catch {
        setTaxoCategories([]);
        setTaxoTags([]);
      } finally {
        setFiltersReady(true);
      }
    })();
  }, [token]);

  const loadPage = useCallback(async (page: number, replace: boolean, opts?: { silent?: boolean }) => {
    const seq = replace ? ++seqRef.current : seqRef.current;
    inFlightRef.current = true;
    if (replace) {
      // `silent` (pull-to-refresh): no vaciar la lista ni mostrar el loader de
      // pantalla completa, así el spinner del RefreshControl se mantiene visible
      // y el contenido no parpadea.
      if (!opts?.silent) {
        setBusy(true);
        setPosts([]);
      }
      setError("");
      setReachedEnd(false);
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
      if (seq !== seqRef.current) return;
      setPosts((prev) => (replace ? batch : [...prev, ...batch]));
      pageRef.current = page;
      const more = batch.length > 0 && page < (pagination?.totalPages ?? 0);
      hasMoreRef.current = more;
      if (!more && !replace) setReachedEnd(true);
      cooldownRef.current = Date.now() + 500;
    } catch (e) {
      if (seq !== seqRef.current) return;
      if (replace) {
        setError(e instanceof Error ? e.message : t.loadError);
      } else {
        cooldownRef.current = Date.now() + 450;
      }
    } finally {
      if (seq === seqRef.current) {
        inFlightRef.current = false;
        setBusy(false);
        setLoadingMore(false);
      }
    }
  }, [token, language, category, tag, debouncedQuery, t.loadError]);

  useEffect(() => {
    if (!filtersReady) return;
    void loadPage(1, true);
  }, [filtersReady, loadPage]);

  // Deslizar hacia abajo para actualizar: recarga la primera página sin vaciar la
  // lista (silent) para que el spinner del gesto se mantenga.
  const { refreshing, onRefresh } = usePullRefresh(() => loadPage(1, true, { silent: true }));

  const categoryOptions = useMemo(
    () => (taxoCategories.length > 0
      ? taxoCategories
      : Array.from(new Set(posts.map((p) => p.category).filter((c): c is string => Boolean(c)))).sort((a, b) => a.localeCompare(b))),
    [taxoCategories, posts],
  );
  const tagOptions = useMemo(
    () => (taxoTags.length > 0
      ? taxoTags
      : Array.from(new Set(posts.flatMap((p) => p.tags))).sort((a, b) => a.localeCompare(b))),
    [taxoTags, posts],
  );
  const hasFilters = Boolean(debouncedQuery || category || tag);

  useEffect(() => {
    if (category && !categoryOptions.includes(category)) setCategory("");
  }, [category, categoryOptions]);

  useEffect(() => {
    if (tag && !tagOptions.includes(tag)) setTag("");
  }, [tag, tagOptions]);

  const maybeLoadMore = useCallback(() => {
    if (!hasMoreRef.current || inFlightRef.current) return;
    if (Date.now() < cooldownRef.current) return;
    void loadPage(pageRef.current + 1, false);
  }, [loadPage]);

  const categorySelectOptions: SelectOption[] = useMemo(
    () => [{ value: "", label: t.allCategories }, ...categoryOptions.map((option) => ({ value: option, label: option }))],
    [categoryOptions, t.allCategories],
  );
  const tagSelectOptions: SelectOption[] = useMemo(
    () => [{ value: "", label: t.allTags }, ...tagOptions.map((option) => ({ value: option, label: option }))],
    [tagOptions, t.allTags],
  );

  // Abre el artículo. Antes, si la petición fallaba (o el post no existía), se
  // pintaba el lector con el cuerpo VACÍO: parecía un artículo sin contenido en
  // vez de un fallo de red, y no había forma de reintentar. Ahora el lector se
  // abre al instante con lo que ya trae la tarjeta y el cuerpo llega… o falla con
  // su mensaje + botón de reintento.
  const openPost = useCallback(async (item: PublicBlogListItem) => {
    const seq = ++detailSeqRef.current;
    setDetailError("");
    setLoadingDetail(true);
    setSelected({ ...item, content: "" });
    try {
      const post = await getPublicBlogPost(item.slug, token, language);
      if (seq !== detailSeqRef.current) return; // el usuario ya abrió otro artículo
      if (post) setSelected(post);
      else setDetailError(t.articleError);
    } catch (e) {
      if (seq !== detailSeqRef.current) return;
      setDetailError(e instanceof Error && e.message ? e.message : t.articleError);
    } finally {
      if (seq === detailSeqRef.current) setLoadingDetail(false);
    }
  }, [token, language, t.articleError]);

  const closeDetail = useCallback(() => {
    detailSeqRef.current += 1; // invalida una respuesta tardía del artículo cerrado
    setSelected(null);
    setDetailError("");
    setLoadingDetail(false);
  }, []);

  const renderCard = useCallback(
    ({ item }: { item: PublicBlogListItem }) => (
      <Pressable style={styles.card} onPress={() => void openPost(item)}>
        {item.coverImageUrl ? (
          <Image source={{ uri: item.coverImageUrl }} style={styles.cardCover} resizeMode="cover" />
        ) : null}
        <View style={styles.cardText}>
          <View style={styles.cardMetaRow}>
            {item.category ? <Text style={[styles.cardCategory, { color: tokens.brandLight }]}>{item.category}</Text> : null}
            {item.publishedAt ? <Text style={[styles.cardDate, { color: tokens.textMuted }]}>{formatDate(item.publishedAt, language)}</Text> : null}
          </View>
          <Text numberOfLines={2} style={[styles.cardTitle, { color: tokens.textPrimary, textAlign }]}>{item.title}</Text>
          {item.excerpt ? (
            <Text numberOfLines={2} style={[styles.cardExcerpt, { color: tokens.textMuted, textAlign }]}>{item.excerpt}</Text>
          ) : null}
          <View style={styles.cardFooter}>
            <Text style={[styles.cardAuthor, { color: tokens.textMuted }]} numberOfLines={1}>
              {item.authorName || t.authorFallback}
            </Text>
            <View style={styles.cardViews}>
              <Eye size={12} color={tokens.textMuted} />
              <Text style={[styles.cardAuthor, { color: tokens.textMuted }]}>{item.viewCount}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    ),
    [styles, openPost, textAlign, t.authorFallback, tokens.brandLight, tokens.textMuted, tokens.textPrimary, language],
  );

  if (selected) {
    const metaLine =
      (selected.authorName || t.authorFallback) +
      (selected.publishedAt ? ` · ${formatDate(selected.publishedAt, language)}` : "") +
      ` · ${selected.viewCount}`;
    return (
      <View style={[styles.root, { backgroundColor: tokens.bgPrimary }]}>
        <View style={[styles.header, { borderBottomColor: tokens.border, backgroundColor: tokens.bgPrimary }]}>
          <View style={[styles.headerLeft, { flexDirection: compact ? "row" : "row" }]}>
            <Pressable
              onPress={closeDetail}
              accessibilityLabel={tCommon.close}
              style={[styles.headerIconBtn, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid }]}
            >
              <ArrowLeft size={16} color={tokens.textSecondary} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: tokens.textPrimary, textAlign }]} numberOfLines={1}>
              {t.screenTitle}
            </Text>
          </View>
          {onClose ? (
            <Pressable
              onPress={onClose}
              accessibilityLabel={tCommon.close}
              style={[styles.headerIconBtn, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid }]}
            >
              <X size={16} color={tokens.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        {loadingDetail && !selected.content ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={tokens.brand} />
          </View>
        ) : detailError && !selected.content ? (
          <View style={styles.centered}>
            <Text style={[styles.stateText, { color: tokens.danger, textAlign, marginBottom: 10 }]}>{detailError}</Text>
            <Pressable
              onPress={() => void openPost(selected)}
              style={[styles.headerIconBtn, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, paddingHorizontal: 14, width: "auto" }]}
            >
              <Text style={{ color: tokens.textSecondary, fontSize: 13, fontWeight: "600" }}>{t.retry}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={[styles.articleScroll, { backgroundColor: tokens.bgPrimary }]}
            contentContainerStyle={styles.articleContent}
            showsVerticalScrollIndicator={false}
          >
            {selected.coverImageUrl ? (
              <Image source={{ uri: selected.coverImageUrl }} style={styles.articleCover} resizeMode="cover" />
            ) : null}
            {selected.category ? (
              <Text style={[styles.articleCat, { backgroundColor: tokens.brandDim, color: tokens.brandLight, borderColor: tokens.borderBrand }]}>
                {selected.category}
              </Text>
            ) : null}
            <Text style={[styles.articleTitle, { color: tokens.textPrimary, textAlign }]}>{selected.title}</Text>
            <Text style={[styles.articleMeta, { color: tokens.textMuted, textAlign }]}>{metaLine}</Text>
            {selected.content ? (
              // Si el parser/render del cuerpo lanza con HTML inesperado, cae al
              // texto plano del post en vez de tumbar la pantalla del lector.
              <ErrorBoundary
                fallback={
                  <Text style={{ color: tokens.textPrimary, fontSize: 15.5, lineHeight: 25, textAlign, writingDirection }}>
                    {selected.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || selected.excerpt || ""}
                  </Text>
                }
              >
                <HtmlView
                  html={selected.content}
                  tokens={tokens}
                  copyLabel={tChat.copy}
                  copiedLabel={tChat.copied}
                  textAlign={textAlign}
                  writingDirection={writingDirection}
                />
              </ErrorBoundary>
            ) : selected.excerpt ? (
              <Text style={{ color: tokens.textPrimary, fontSize: 15.5, lineHeight: 25, textAlign, writingDirection }}>{selected.excerpt}</Text>
            ) : null}
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: tokens.bgPrimary }]}>
      {/* En el drawer (compact) el tab-bar superior ya rotula "Blog": se oculta el
          encabezado para que la fila de filtros quede de primero. */}
      {!compact ? (
        <View style={[styles.header, { borderBottomColor: tokens.border, backgroundColor: tokens.bgPrimary }]}>
          <View style={[styles.headerLeft, { flexDirection: "row" }]}>
            <Text style={[styles.headerTitle, { color: tokens.textPrimary, textAlign }]} numberOfLines={1}>
              {t.screenTitle}
            </Text>
          </View>
          {onClose ? (
            <Pressable
              onPress={onClose}
              accessibilityLabel={tCommon.close}
              style={[styles.headerIconBtn, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid }]}
            >
              <X size={16} color={tokens.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {(busy && posts.length === 0) || refreshing ? (
        // Carga inicial o pull-to-refresh: skeleton (con más espacio entre filas,
        // como las tarjetas reales del blog) mientras vuelven los posts.
        <ListPanelSkeleton rows={5} gap={16} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.stateText, { color: tokens.danger, textAlign, marginBottom: 10 }]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          onEndReachedThreshold={0.7}
          onEndReached={maybeLoadMore}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand} colors={[tokens.brand]} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.filterWrap}>
              <View style={[styles.searchBox, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
                <Search size={15} color={tokens.textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: tokens.textPrimary, textAlign }]}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t.searchPlaceholder}
                  placeholderTextColor={tokens.textMuted}
                  autoCapitalize="none"
                />
              </View>
              <Select
                value={category}
                options={categorySelectOptions}
                placeholder={t.allCategories}
                onChange={setCategory}
                style={styles.select}
              />
              <Select
                value={tag}
                options={tagSelectOptions}
                placeholder={t.allTags}
                onChange={setTag}
                style={styles.select}
              />
            </View>
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: tokens.textMuted, textAlign }]}>
              {busy ? "…" : (hasFilters ? t.noResults : t.noPosts)}
            </Text>
          }
          ListFooterComponent={
            <View style={styles.footerState}>
              {loadingMore ? <ActivityIndicator color={tokens.brand} /> : null}
              {reachedEnd && posts.length > 0 ? <Text style={[styles.footerText, { color: tokens.textMuted }]}>{t.endOfList}</Text> : null}
            </View>
          }
        />
      )}
      <View style={[styles.bottomInset, { height: Math.max(screenHeight * 0.01, 8) }]} />
    </View>
  );
}
