import { useConfirmation } from "../components/ui/useConfirmation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  BarChart3,
  Coins,
  Eye,
  Heart,
  MessageCircle,
  Plus,
  Send,
  Trash2,
  Type,
  X,
} from "lucide-react-native";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { getLocaleTextAlign, getMessages } from "../i18n";
import { usePullRefresh } from "../hooks/usePullRefresh";
import { ListPanelSkeleton } from "../components/skeletons";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Toast, type ToastVariant } from "../components/ui/Toast";
import {
  createComment,
  createPost,
  deleteComment as apiDeleteComment,
  deletePost as apiDeletePost,
  getComments,
  getFeed,
  PublicacionError,
  registerView,
  toggleLike,
  votePoll,
  type Comment,
  type FeedMeta,
  type Post,
} from "../api/publicaciones";
import { makeStyles } from "./PublicacionesScreen.styles";

const PAGE_SIZE = 10;

function tmpl(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

// Tiempo relativo ("hace 5 min"). Cae a fechas simples para >7 días.
function relativeTime(iso: string, t: ReturnType<typeof getMessages>["publicaciones"]): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return t.timeNow;
  if (min < 60) return tmpl(t.timeMinute, { n: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return tmpl(t.timeHour, { n: hours });
  const days = Math.floor(hours / 24);
  if (days <= 7) return tmpl(t.timeDay, { n: days });
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return tmpl(t.timeDay, { n: days });
  }
}

export function PublicacionesScreen({
  language,
  token,
  displayName,
  photoURL,
  currentUserId,
  compact = false,
}: {
  language: string;
  token: string;
  displayName?: string;
  photoURL?: string | null;
  currentUserId?: string | null;
  compact?: boolean;
}) {
  const { askConfirmation, confirmation } = useConfirmation(language);
  const t = getMessages(language).publicaciones;
  const tCommon = getMessages(language).common;
  const textAlign = getLocaleTextAlign(language);
  const { theme } = useTheme();
  const dark = theme === "dark";
  const tokens = getThemeTokens(dark);
  const styles = useMemo(() => makeStyles(tokens, compact), [tokens, compact]);

  const [posts, setPosts] = useState<Post[]>([]);
  const [meta, setMeta] = useState<FeedMeta | null>(null);
  const [busy, setBusy] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [error, setError] = useState("");

  // Composer.
  const [composerType, setComposerType] = useState<"text" | "poll">("text");
  const [content, setContent] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [publishing, setPublishing] = useState(false);
  const [composerNotice, setComposerNotice] = useState("");

  // Toast (estado local + nonce; la app no tiene hook compartido).
  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string; nonce: number }>(
    { visible: false, variant: "success", message: "", nonce: 0 },
  );
  const notify = useCallback((message: string, variant: ToastVariant = "success") => {
    setToast((prev) => ({ visible: true, variant, message, nonce: prev.nonce + 1 }));
  }, []);

  const loadedRef = useRef(false);
  const pageRef = useRef(1);
  const seqRef = useRef(0);
  const inFlightRef = useRef(false);
  const hasMoreRef = useRef(false);
  const cooldownRef = useRef(0);
  const viewedRef = useRef<Set<string>>(new Set());

  const maxLength = meta?.maxLength ?? 255;

  const loadPage = useCallback(async (page: number, replace: boolean, opts?: { silent?: boolean }) => {
    const seq = replace ? ++seqRef.current : seqRef.current;
    inFlightRef.current = true;
    if (replace) {
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
      const { posts: batch, pagination, meta: m } = await getFeed(token, { page, limit: PAGE_SIZE });
      if (seq !== seqRef.current) return;
      setMeta(m);
      setPosts((prev) => (replace ? batch : [...prev, ...batch]));
      pageRef.current = page;
      const more = batch.length > 0 && page < (pagination?.totalPages ?? 0);
      hasMoreRef.current = more;
      if (!more && !replace) setReachedEnd(true);
      cooldownRef.current = Date.now() + 500;
    } catch (e) {
      if (seq !== seqRef.current) return;
      if (replace) setError(e instanceof Error ? e.message : t.loadError);
      else cooldownRef.current = Date.now() + 450;
    } finally {
      if (seq === seqRef.current) {
        inFlightRef.current = false;
        setBusy(false);
        setLoadingMore(false);
      }
    }
  }, [token, t.loadError]);

  useEffect(() => {
    if (!token || loadedRef.current) return;
    loadedRef.current = true;
    void loadPage(1, true);
  }, [token, loadPage]);

  const { refreshing, onRefresh } = usePullRefresh(() => loadPage(1, true, { silent: true }));

  const maybeLoadMore = useCallback(() => {
    if (!hasMoreRef.current || inFlightRef.current) return;
    if (Date.now() < cooldownRef.current) return;
    void loadPage(pageRef.current + 1, false);
  }, [loadPage]);

  // ── Vista única: POST /:id/view una vez por publicación AJENA al renderizarse.
  const registerViewOnce = useCallback((post: Post) => {
    if (!token || viewedRef.current.has(post.id)) return;
    if (post.authorId && currentUserId && post.authorId === currentUserId) return;
    viewedRef.current.add(post.id);
    void registerView(token, post.id).then((res) => {
      if (!res) return;
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, viewCount: res.viewCount } : p)));
    });
  }, [token, currentUserId]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: Post }> }) => {
    for (const v of viewableItems) registerViewOnce(v.item);
  });
  // Mantener el callback fresco sin recrear la config de viewability.
  onViewableItemsChanged.current = ({ viewableItems }: { viewableItems: Array<{ item: Post }> }) => {
    for (const v of viewableItems) registerViewOnce(v.item);
  };
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // ── Composer ────────────────────────────────────────────────────────────────
  const canPost = meta?.canPost ?? false;
  const resetComposer = useCallback(() => {
    setContent("");
    setPollOptions(["", ""]);
    setComposerType("text");
    setComposerNotice("");
  }, []);

  const handlePublish = useCallback(async () => {
    setComposerNotice("");
    const trimmed = content.trim();
    if (!trimmed) {
      setComposerNotice(t.emptyContent);
      return;
    }
    let options: string[] | undefined;
    if (composerType === "poll") {
      options = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (options.length < 2 || options.length > 4) {
        setComposerNotice(t.pollNeedsOptions);
        return;
      }
    }
    setPublishing(true);
    try {
      const post = await createPost(token, { type: composerType, content: trimmed, options });
      setPosts((prev) => [post, ...prev]);
      resetComposer();
      notify(t.posted, "success");
    } catch (e) {
      if (e instanceof PublicacionError) {
        if (e.kind === "balance") {
          setComposerNotice(tmpl(t.insufficientBalance, { required: e.required ?? meta?.costs.post ?? 0, available: e.available ?? meta?.balance ?? 0 }));
        } else if (e.kind === "moderation") {
          setComposerNotice(e.reasons && e.reasons.length > 0 ? e.reasons.join(" ") : e.message || t.noLinks);
        } else {
          setComposerNotice(e.message);
        }
      } else {
        setComposerNotice(e instanceof Error ? e.message : t.loadError);
      }
    } finally {
      setPublishing(false);
    }
  }, [content, composerType, pollOptions, token, resetComposer, notify, t, meta]);

  // ── Acciones de tarjeta (espejadas en el estado local del feed) ─────────────
  const handleLike = useCallback(async (post: Post) => {
    // Optimista; revertir si falla.
    setPosts((prev) => prev.map((p) => (p.id === post.id
      ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
      : p)));
    try {
      const res = await toggleLike(token, post.id);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likedByMe: res.liked, likeCount: res.likeCount } : p)));
    } catch {
      setPosts((prev) => prev.map((p) => (p.id === post.id
        ? { ...p, likedByMe: post.likedByMe, likeCount: post.likeCount }
        : p)));
    }
  }, [token]);

  const handleVote = useCallback(async (post: Post, optionId: string) => {
    if (!post.poll || post.poll.votedOptionId) return;
    try {
      const res = await votePoll(token, post.id, optionId);
      setPosts((prev) => prev.map((p) => (p.id === post.id && p.poll
        ? { ...p, poll: { totalVotes: res.totalVotes, votedOptionId: res.votedOptionId, options: res.options } }
        : p)));
    } catch (e) {
      notify(e instanceof Error ? e.message : t.loadError, "error");
    }
  }, [token, notify, t.loadError]);

  const confirm = useCallback((title: string, message: string): Promise<boolean> =>
    new Promise((resolve) => {
      askConfirmation(title, message, [
        { text: tCommon.cancel, style: "cancel", onPress: () => resolve(false) },
        { text: tCommon.accept, style: "destructive", onPress: () => resolve(true) },
      ]);
    }), [askConfirmation, tCommon]);

  const handleDeletePost = useCallback(async (post: Post) => {
    const ok = await confirm(t.deletePost, t.deletePostConfirm);
    if (!ok) return;
    try {
      await apiDeletePost(token, post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      notify(t.postDeleted, "success");
    } catch (e) {
      notify(e instanceof Error ? e.message : t.loadError, "error");
    }
  }, [confirm, token, notify, t]);

  const canDeletePost = useCallback((post: Post): boolean => {
    if (meta?.canManageAll) return true;
    return Boolean(post.authorId && currentUserId && post.authorId === currentUserId);
  }, [meta, currentUserId]);

  const updatePostComments = useCallback((postId: string, fn: (c: Comment[]) => Comment[], commentCountDelta = 0) => {
    setPosts((prev) => prev.map((p) => (p.id === postId
      ? { ...p, comments: fn(p.comments ?? []), commentCount: Math.max(0, p.commentCount + commentCountDelta) }
      : p)));
  }, []);

  const renderItem = useCallback(({ item }: { item: Post }) => (
    <PostCard
      post={item}
      token={token}
      language={language}
      meta={meta}
      styles={styles}
      tokens={tokens}
      textAlign={textAlign}
      t={t}
      tCommon={tCommon}
      canDelete={canDeletePost(item)}
      currentUserId={currentUserId ?? null}
      onLike={handleLike}
      onVote={handleVote}
      onDeletePost={handleDeletePost}
      onCommentsChange={updatePostComments}
      notify={notify}
      confirm={confirm}
    />
  ), [token, language, meta, styles, tokens, textAlign, t, tCommon, canDeletePost, currentUserId, handleLike, handleVote, handleDeletePost, updatePostComments, notify, confirm]);

  const composerNode = (
    <View style={{ gap: 12, marginBottom: 2 }}>
      {/* Banner de saldo + costo de publicar. */}
      <View style={[styles.balanceBanner, { borderColor: tokens.borderBrand, backgroundColor: tokens.brandDim }]}>
        <View style={styles.balanceLeft}>
          <Coins size={15} color={tokens.brandLight} />
          <Text style={[styles.balanceText, { color: tokens.textPrimary }]}>
            {tmpl(t.balance, { n: meta?.balance ?? 0 })}
          </Text>
        </View>
        <Text style={[styles.balanceCost, { color: tokens.textMuted }]}>
          {tmpl(t.costPost, { n: meta?.costs.post ?? 0 })}
        </Text>
      </View>

      <View style={styles.composer}>
        <View style={styles.composerTopRow}>
          <Avatar photoURL={photoURL ?? null} displayName={displayName || t.authorFallback} size={36} />
          <TextInput
            style={[styles.composerInput, { color: tokens.textPrimary, textAlign }]}
            value={content}
            onChangeText={(v) => setContent(v.slice(0, maxLength))}
            placeholder={composerType === "poll" ? t.composerPlaceholderPoll : t.composerPlaceholderText}
            placeholderTextColor={tokens.textMuted}
            editable={canPost && !publishing}
            multiline
            maxLength={maxLength}
          />
        </View>

        {/* Selector de tipo: Nota / Encuesta. */}
        <View style={styles.typeToggle}>
          {(["text", "poll"] as const).map((typeKey) => {
            const active = composerType === typeKey;
            const Icon = typeKey === "poll" ? BarChart3 : Type;
            return (
              <Pressable
                key={typeKey}
                onPress={() => { setComposerType(typeKey); setComposerNotice(""); }}
                disabled={!canPost || publishing}
                style={[styles.typeChip, {
                  borderColor: active ? tokens.borderBrand : tokens.border,
                  backgroundColor: active ? tokens.brandDim : "transparent",
                }]}
              >
                <Icon size={13} color={active ? tokens.brandLight : tokens.textMuted} />
                <Text style={[styles.typeChipText, { color: active ? tokens.brandLight : tokens.textMuted }]}>
                  {typeKey === "poll" ? t.typePoll : t.typeText}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Opciones de encuesta (2-4). */}
        {composerType === "poll" ? (
          <View style={{ gap: 8 }}>
            {pollOptions.map((opt, idx) => (
              <View key={idx} style={styles.pollOptionRow}>
                <TextInput
                  style={[styles.pollOptionInput, { color: tokens.textPrimary, borderColor: tokens.border, backgroundColor: tokens.bgInput, textAlign }]}
                  value={opt}
                  onChangeText={(v) => setPollOptions((prev) => prev.map((o, i) => (i === idx ? v : o)))}
                  placeholder={tmpl(t.pollOptionPlaceholder, { n: idx + 1 })}
                  placeholderTextColor={tokens.textMuted}
                  editable={canPost && !publishing}
                />
                {pollOptions.length > 2 ? (
                  <Pressable
                    onPress={() => setPollOptions((prev) => prev.filter((_, i) => i !== idx))}
                    style={[styles.pollOptionRemove, { borderColor: tokens.border }]}
                    accessibilityLabel={tCommon.delete}
                  >
                    <X size={15} color={tokens.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            {pollOptions.length < 4 ? (
              <Pressable
                onPress={() => setPollOptions((prev) => [...prev, ""])}
                disabled={!canPost || publishing}
                style={styles.addOptionBtn}
              >
                <Plus size={14} color={tokens.brandLight} />
                <Text style={[styles.addOptionText, { color: tokens.brandLight }]}>{t.addOption}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {composerNotice ? (
          <Text style={[styles.composerNotice, { color: tokens.danger, textAlign }]}>{composerNotice}</Text>
        ) : !canPost ? (
          <Text style={[styles.composerNotice, { color: tokens.textMuted, textAlign }]}>{t.noBalanceToPost}</Text>
        ) : null}

        <View style={styles.composerBottomRow}>
          <Text style={[styles.charCounter, { color: content.length >= maxLength ? tokens.danger : tokens.textMuted }]}>
            {tmpl(t.charsLeft, { n: Math.max(0, maxLength - content.length) })}
          </Text>
          <Button
            label={publishing ? t.publishing : t.publish}
            variant="primary"
            size="sm"
            icon={<Send size={14} />}
            loading={publishing}
            disabled={!canPost}
            onPress={() => void handlePublish()}
          />
        </View>
      </View>
    </View>
  );

  return <>
      {confirmation}
    <View style={[styles.root, { backgroundColor: tokens.bgPrimary }]}>
      {!compact ? (
        <View style={[styles.header, { borderBottomColor: tokens.border, backgroundColor: tokens.bgPrimary }]}>
          <Text style={[styles.headerTitle, { color: tokens.textPrimary, textAlign }]} numberOfLines={1}>
            {t.title}
          </Text>
        </View>
      ) : null}

      {busy && posts.length === 0 ? (
        <ListPanelSkeleton rows={4} gap={14} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.stateText, { color: tokens.danger, textAlign, marginBottom: 10 }]}>{error}</Text>
          <Button label={t.retry} variant="ghost" size="sm" onPress={() => void loadPage(1, true)} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onEndReachedThreshold={0.7}
          onEndReached={maybeLoadMore}
          keyboardShouldPersistTaps="handled"
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand} colors={[tokens.brand]} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={composerNode}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: tokens.textMuted, textAlign }]}>{busy ? "…" : t.noPosts}</Text>
          }
          ListFooterComponent={
            <View style={styles.footerState}>
              {loadingMore ? <ActivityIndicator color={tokens.brand} /> : null}
              {reachedEnd && posts.length > 0 ? <Text style={[styles.footerText, { color: tokens.textMuted }]}>·</Text> : null}
            </View>
          }
        />
      )}

      <Toast
        visible={toast.visible}
        variant={toast.variant}
        message={toast.message}
        nonce={toast.nonce}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  </>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta de publicación: Fila 1 = avatar + nombre; Fila 2 = contenido + fecha +
// reacciones (corazón/vistas/comentarios) y acciones (comentar, eliminar). Las
// encuestas pintan barras de % con resaltado del voto. Los comentarios se cargan
// bajo demanda y soportan responder (parentId) y eliminar.
// ─────────────────────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof makeStyles>;
type ThemeTokens = ReturnType<typeof getThemeTokens>;
type PubMsgs = ReturnType<typeof getMessages>["publicaciones"];
type CommonMsgs = ReturnType<typeof getMessages>["common"];

function PostCard({
  post,
  token,
  language,
  meta,
  styles,
  tokens,
  textAlign,
  t,
  tCommon,
  canDelete,
  currentUserId,
  onLike,
  onVote,
  onDeletePost,
  onCommentsChange,
  notify,
  confirm,
}: {
  post: Post;
  token: string;
  language: string;
  meta: FeedMeta | null;
  styles: Styles;
  tokens: ThemeTokens;
  textAlign: "left" | "right";
  t: PubMsgs;
  tCommon: CommonMsgs;
  canDelete: boolean;
  /** Autor de la sesión: decide qué COMENTARIOS puede borrar (no el dueño del post). */
  currentUserId: string | null;
  onLike: (post: Post) => void;
  onVote: (post: Post, optionId: string) => void;
  onDeletePost: (post: Post) => void;
  onCommentsChange: (postId: string, fn: (c: Comment[]) => Comment[], delta?: number) => void;
  notify: (message: string, variant?: ToastVariant) => void;
  confirm: (title: string, message: string) => Promise<boolean>;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);
  const loadedCommentsRef = useRef(false);

  const comments = post.comments ?? [];
  const canComment = meta?.canComment ?? false;

  const openComments = useCallback(async () => {
    setCommentsOpen((v) => !v);
    if (loadedCommentsRef.current || commentsOpen) return;
    loadedCommentsRef.current = true;
    setLoadingComments(true);
    try {
      const list = await getComments(token, post.id);
      onCommentsChange(post.id, () => list);
    } catch {
      /* mantiene lo que ya hubiera (incrustado en el feed) */
    } finally {
      setLoadingComments(false);
    }
  }, [commentsOpen, token, post.id, onCommentsChange]);

  const handleSend = useCallback(async () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const comment = await createComment(token, post.id, { content: trimmed, parentId: replyTo?.id ?? null });
      onCommentsChange(post.id, (prev) => [...prev, comment], 1);
      setCommentText("");
      setReplyTo(null);
      notify(t.commented, "success");
    } catch (e) {
      if (e instanceof PublicacionError) {
        if (e.kind === "balance") {
          notify(tmpl(t.insufficientBalance, { required: e.required ?? meta?.costs.comment ?? 0, available: e.available ?? meta?.balance ?? 0 }), "error");
        } else if (e.kind === "moderation") {
          notify(e.reasons && e.reasons.length > 0 ? e.reasons.join(" ") : e.message || t.noLinks, "error");
        } else {
          notify(e.message, "error");
        }
      } else {
        notify(e instanceof Error ? e.message : t.loadError, "error");
      }
    } finally {
      setSending(false);
    }
  }, [commentText, token, post.id, replyTo, onCommentsChange, notify, t, meta]);

  const handleDeleteComment = useCallback(async (c: Comment) => {
    const ok = await confirm(t.deleteComment, t.deleteCommentConfirm);
    if (!ok) return;
    try {
      await apiDeleteComment(token, c.id);
      // El backend borra EN CASCADA las respuestas del comentario y descuenta
      // 1 + respuestas del contador. Sin replicarlo aquí, las respuestas quedaban
      // huérfanas en pantalla y `commentCount` se iba desfasando (solo restaba 1).
      const replies = (post.comments ?? []).filter((x) => x.parentId === c.id).length;
      onCommentsChange(
        post.id,
        (prev) => prev.filter((x) => x.id !== c.id && x.parentId !== c.id),
        -(1 + replies),
      );
      notify(t.commentDeleted, "success");
    } catch (e) {
      notify(e instanceof Error ? e.message : t.loadError, "error");
    }
  }, [confirm, token, post.id, post.comments, onCommentsChange, notify, t]);

  // Un comentario lo borra SU AUTOR o un admin con `canManageAll` (regla del
  // backend: 403 "No es tu comentario" en cualquier otro caso). Antes se reusaba
  // el `canDelete` del POST, con dos fallos: en un post PROPIO se ofrecía borrar
  // comentarios AJENOS (403 al pulsar) y, en un post ajeno, el usuario NO podía
  // borrar SU PROPIO comentario (la acción ni se pintaba).
  const canDeleteComment = useCallback(
    (c: Comment): boolean =>
      Boolean(meta?.canManageAll) || Boolean(c.authorId && currentUserId && c.authorId === currentUserId),
    [meta?.canManageAll, currentUserId],
  );

  const poll = post.poll;
  const maxVotes = poll ? Math.max(1, ...poll.options.map((o) => o.voteCount)) : 1;

  return (
    <View style={styles.card}>
      {/* Fila 1: avatar + nombre. */}
      <View style={styles.authorRow}>
        <Avatar photoURL={post.authorPhotoUrl} displayName={post.authorName || t.authorFallback} size={38} />
        <Text style={[styles.authorName, { color: tokens.textPrimary, textAlign }]} numberOfLines={1}>
          {post.authorName || t.authorFallback}
        </Text>
        {canDelete ? (
          <Pressable onPress={() => onDeletePost(post)} accessibilityLabel={t.deletePost} hitSlop={8}>
            <Trash2 size={16} color={tokens.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Fila 2: contenido. */}
      {post.content ? (
        <Text style={[styles.contentText, { color: tokens.textPrimary, textAlign }]}>{post.content}</Text>
      ) : null}

      {/* Encuesta: barras de % + conteos; resalta el votado; deshabilita si ya votó. */}
      {poll ? (
        <View style={styles.pollWrap}>
          {poll.options.map((opt) => {
            const voted = poll.votedOptionId === opt.id;
            const pct = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
            const barWidth = `${Math.round((opt.voteCount / maxVotes) * 100)}%` as const;
            const disabled = Boolean(poll.votedOptionId);
            return (
              <Pressable
                key={opt.id}
                onPress={() => !disabled && onVote(post, opt.id)}
                disabled={disabled}
                style={[styles.pollOption, {
                  borderColor: voted ? tokens.borderBrand : tokens.border,
                  backgroundColor: tokens.bgInput,
                }]}
              >
                <View style={[styles.pollOptionBar, { width: barWidth, backgroundColor: voted ? tokens.brandDim : tokens.bgSecondary }]} />
                <View style={styles.pollOptionContent}>
                  <Text style={[styles.pollOptionLabel, { color: voted ? tokens.brandLight : tokens.textPrimary, textAlign }]} numberOfLines={2}>
                    {opt.text}
                  </Text>
                  {poll.votedOptionId ? (
                    <Text style={[styles.pollOptionCount, { color: voted ? tokens.brandLight : tokens.textMuted }]}>
                      {pct}% · {opt.voteCount}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
          <Text style={[styles.pollTotal, { color: tokens.textMuted, textAlign }]}>
            {tmpl(t.totalVotes, { n: poll.totalVotes })}
          </Text>
        </View>
      ) : null}

      {/* Fecha. */}
      <Text style={[styles.dateText, { color: tokens.textMuted, textAlign }]}>{relativeTime(post.createdAt, t)}</Text>

      {/* Reacciones + acciones. */}
      <View style={styles.reactionsRow}>
        <Pressable style={styles.reactionBtn} onPress={() => onLike(post)} accessibilityLabel={t.like}>
          <Heart size={16} color={post.likedByMe ? tokens.danger : tokens.textMuted} fill={post.likedByMe ? tokens.danger : "transparent"} />
          <Text style={[styles.reactionText, { color: post.likedByMe ? tokens.danger : tokens.textMuted }]}>{post.likeCount}</Text>
        </Pressable>
        <Pressable style={styles.reactionBtn} onPress={() => void openComments()} accessibilityLabel={t.comment}>
          <MessageCircle size={16} color={tokens.textMuted} />
          <Text style={[styles.reactionText, { color: tokens.textMuted }]}>{post.commentCount}</Text>
        </Pressable>
        <View style={styles.reactionBtn}>
          <Eye size={15} color={tokens.textMuted} />
          <Text style={[styles.reactionText, { color: tokens.textMuted }]}>{tmpl(t.views, { n: post.viewCount })}</Text>
        </View>
      </View>

      {/* Comentarios (bajo demanda). */}
      {commentsOpen ? (
        <View style={styles.commentsWrap}>
          {loadingComments ? (
            <ActivityIndicator color={tokens.brand} />
          ) : comments.length === 0 ? (
            <Text style={[styles.commentText, { color: tokens.textMuted, textAlign }]}>{t.noComments}</Text>
          ) : (
            comments.map((c) => {
              const own = canDeleteComment(c);
              return (
                <View key={c.id} style={[styles.commentRow, c.parentId ? { marginLeft: 28 } : null]}>
                  <Avatar photoURL={c.authorPhotoUrl} displayName={c.authorName || t.authorFallback} size={26} />
                  <View style={styles.commentBubble}>
                    <View style={styles.commentHeader}>
                      <Text style={[styles.commentAuthor, { color: tokens.textPrimary }]} numberOfLines={1}>
                        {c.authorName || t.authorFallback}
                      </Text>
                      <Text style={[styles.commentDate, { color: tokens.textMuted }]}>{relativeTime(c.createdAt, t)}</Text>
                    </View>
                    <Text style={[styles.commentText, { color: tokens.textPrimary, textAlign }]}>{c.content}</Text>
                    <View style={styles.commentActionsRow}>
                      {!c.parentId && canComment ? (
                        <Pressable onPress={() => setReplyTo(c)}>
                          <Text style={[styles.commentActionText, { color: tokens.brandLight }]}>{t.reply}</Text>
                        </Pressable>
                      ) : null}
                      {own ? (
                        <Pressable onPress={() => void handleDeleteComment(c)}>
                          <Text style={[styles.commentActionText, { color: tokens.textMuted }]}>{t.delete}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })
          )}

          {/* Caja para comentar / responder. */}
          {canComment ? (
            <View style={{ gap: 6 }}>
              {replyTo ? (
                <View style={styles.replyingBanner}>
                  <Text style={[styles.replyingText, { color: tokens.brandLight }]} numberOfLines={1}>
                    {tmpl(t.replyPlaceholder, { name: replyTo.authorName || t.authorFallback })}
                  </Text>
                  <Pressable onPress={() => setReplyTo(null)} accessibilityLabel={t.cancelReply} hitSlop={6}>
                    <X size={14} color={tokens.textMuted} />
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.commentComposer}>
                <TextInput
                  style={[styles.commentInput, { color: tokens.textPrimary, borderColor: tokens.border, backgroundColor: tokens.bgInput, textAlign }]}
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder={replyTo ? tmpl(t.replyPlaceholder, { name: replyTo.authorName || t.authorFallback }) : t.commentPlaceholder}
                  placeholderTextColor={tokens.textMuted}
                  editable={!sending}
                  multiline
                />
                <Pressable
                  onPress={() => void handleSend()}
                  disabled={sending || !commentText.trim()}
                  style={[styles.commentSendBtn, { backgroundColor: tokens.brand, opacity: sending || !commentText.trim() ? 0.5 : 1 }]}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={tokens.accentText} />
                  ) : (
                    <Text style={[styles.commentSendText, { color: tokens.accentText }]}>{t.send}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={[styles.composerNotice, { color: tokens.textMuted, textAlign }]}>
              {tmpl(t.costComment, { n: meta?.costs.comment ?? 0 })} · {t.noBalanceToComment}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
