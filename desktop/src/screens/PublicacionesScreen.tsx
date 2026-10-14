// Muro social "Publicaciones" del cliente DESKTOP.
//
// Notas de texto (≤ maxLength) o encuestas (pregunta + 2..4 opciones). Publicar y
// comentar cuestan tokens (`meta.costs`); ver, dar me gusta y votar son gratis.
// Layout de cada publicación: FILA 1 = avatar + nombre del autor; FILA 2 =
// contenido + fecha + reacciones (me gusta / vistas / comentarios) + acciones
// (comentar, eliminar si es propia o admin). Errores: 402 (sin saldo) y 422
// (moderación IA) se muestran con su mensaje y `reasons`.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye, Heart, MessageSquare, Newspaper, Plus, RefreshCw, Send, Trash2, X,
} from "lucide-react";
import { NavActions } from "../components/NavActions";
import { UserAvatar } from "../components/ui/Avatar";
import { useToast } from "../components/ToastProvider";
import { useDialog } from "../hooks/useDialog";
import { useAuth } from "../context/useAuth";
import { getMessages, formatMessage } from "../i18n";
import type { NavAction } from "../features/app/types";
import {
  getPublicaciones, createPublicacion, deletePublicacion, toggleLike, registerView,
  votePoll, getComments, createComment, deleteComment, PublicacionError,
  type Post, type Comment, type PublicacionesMeta, type PollOption,
} from "../api/publicaciones";

type ComposerMode = "text" | "poll";

const PAGE_SIZE = 20;

/** Tiempo relativo legible (ahora / hace N min / h / d). Cae a fecha local. */
function relativeTime(iso: string, t: ReturnType<typeof getMessages>["publicaciones"]): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return t.timeNow;
  if (min < 60) return formatMessage(t.timeMinute, { n: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return formatMessage(t.timeHour, { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return formatMessage(t.timeDay, { n: days });
  return new Date(iso).toLocaleDateString();
}

export function PublicacionesScreen({
  token,
  language,
  currentUserId,
  isAdmin = false,
}: {
  token: string;
  language: string;
  currentUserId?: string | null;
  isAdmin?: boolean;
}) {
  const tAll = getMessages(language);
  const t = tAll.publicaciones;
  const toast = useToast();
  const dialog = useDialog(language);
  const { savedAccounts, userEmail } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [meta, setMeta] = useState<PublicacionesMeta | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState("");

  // Composer
  const [mode, setMode] = useState<ComposerMode>("text");
  const [text, setText] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [composerError, setComposerError] = useState("");
  const [publishing, setPublishing] = useState(false);

  // Avatar/nombre del usuario actual para el composer (mismo origen que el resto
  // de pantallas: la cuenta guardada que coincide por uid/email).
  const me = useMemo(() => {
    const acc = savedAccounts.find((a) => (currentUserId && a.uid === currentUserId) || (userEmail && a.email === userEmail));
    return { name: acc?.displayName ?? userEmail ?? t.authorFallback, photo: acc?.photoURL ?? null };
  }, [savedAccounts, currentUserId, userEmail, t.authorFallback]);

  const maxLength = meta?.maxLength ?? 255;

  // Vistas ya registradas en esta sesión (evita re-POST por re-render).
  const viewedRef = useRef<Set<string>>(new Set());

  const loadPage = useCallback(async (targetPage: number, mode: "replace" | "append") => {
    if (mode === "replace") { setLoading(true); setListError(""); }
    else setLoadingMore(true);
    try {
      const feed = await getPublicaciones(token, { page: targetPage, limit: PAGE_SIZE });
      setMeta(feed.meta);
      setTotalPages(feed.pagination.totalPages || 1);
      setPage(feed.pagination.page || targetPage);
      setPosts((prev) => (mode === "replace" ? feed.posts : [...prev, ...feed.posts.filter((p) => !prev.some((e) => e.id === p.id))]));
    } catch {
      if (mode === "replace") setListError(t.loadError);
      else toast.error(t.loadError);
    } finally {
      if (mode === "replace") setLoading(false);
      else setLoadingMore(false);
    }
  }, [token, t, toast]);

  useEffect(() => { void loadPage(1, "replace"); }, [loadPage]);

  // Registra una vista única por publicación visible que NO sea del usuario.
  useEffect(() => {
    if (!posts.length) return;
    for (const post of posts) {
      if (viewedRef.current.has(post.id)) continue;
      if (currentUserId && post.authorId === currentUserId) continue;
      viewedRef.current.add(post.id);
      void (async () => {
        const count = await registerView(post.id, token);
        if (count !== null) {
          setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, viewCount: count } : p)));
        }
      })();
    }
  }, [posts, currentUserId, token]);

  const patchPost = useCallback((id: string, patch: Partial<Post> | ((p: Post) => Post)) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? (typeof patch === "function" ? patch(p) : { ...p, ...patch }) : p)));
  }, []);

  // ── Errores enriquecidos (402 saldo / 422 moderación) ──────────────────────
  const surfaceError = useCallback((err: unknown, kind: "post" | "comment") => {
    if (err instanceof PublicacionError) {
      if (err.status === 402) {
        if (typeof err.required === "number" && typeof err.available === "number") {
          toast.error(formatMessage(t.needTokens, { n: Math.max(0, err.required - err.available) }));
        } else {
          toast.error(kind === "post" ? t.insufficientBalance : t.insufficientBalanceComment);
        }
        return;
      }
      if (err.status === 422) {
        const reasons = err.reasons?.length ? ` ${err.reasons.join(" · ")}` : (err.message ? ` ${err.message}` : ` ${t.noLinks}`);
        toast.error(`${t.moderationFailed}${reasons}`);
        return;
      }
    }
    toast.error(err instanceof Error ? err.message : t.loadError);
  }, [t, toast]);

  // ── Composer ───────────────────────────────────────────────────────────────
  const resetComposer = useCallback(() => {
    setText("");
    setPollQuestion("");
    setPollOptions(["", ""]);
    setComposerError("");
  }, []);

  const addPollOption = () => setPollOptions((opts) => (opts.length >= 4 ? opts : [...opts, ""]));
  const removePollOption = (idx: number) => setPollOptions((opts) => (opts.length <= 2 ? opts : opts.filter((_, i) => i !== idx)));
  const setPollOption = (idx: number, value: string) => setPollOptions((opts) => opts.map((o, i) => (i === idx ? value : o)));

  const canPost = meta?.canPost ?? false;

  const submitPost = useCallback(async () => {
    setComposerError("");
    let payload: { type: "text" | "poll"; content: string; options?: string[] };
    if (mode === "text") {
      const content = text.trim();
      if (!content) { setComposerError(t.emptyText); return; }
      payload = { type: "text", content };
    } else {
      const question = pollQuestion.trim();
      if (!question) { setComposerError(t.pollNeedsQuestion); return; }
      const options = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (options.length < 2 || options.length > 4) { setComposerError(t.pollNeedsOptions); return; }
      payload = { type: "poll", content: question, options };
    }
    setPublishing(true);
    try {
      const post = await createPublicacion(payload, token);
      setPosts((prev) => [post, ...prev]);
      // Refleja el nuevo saldo descontando el costo de publicar.
      setMeta((m) => (m ? { ...m, balance: Math.max(0, m.balance - m.costs.post), canPost: m.balance - m.costs.post >= m.costs.post } : m));
      resetComposer();
      setMode("text");
      toast.success(t.published);
    } catch (err) {
      surfaceError(err, "post");
    } finally {
      setPublishing(false);
    }
  }, [mode, text, pollQuestion, pollOptions, token, t, toast, resetComposer, surfaceError]);

  // ── Acciones de publicación ─────────────────────────────────────────────────
  const onLike = useCallback(async (post: Post) => {
    // Optimista: alterna y ajusta el contador; revierte si falla.
    const optimisticLiked = !post.likedByMe;
    patchPost(post.id, (p) => ({ ...p, likedByMe: optimisticLiked, likeCount: Math.max(0, p.likeCount + (optimisticLiked ? 1 : -1)) }));
    try {
      const res = await toggleLike(post.id, token);
      patchPost(post.id, { likedByMe: res.liked, likeCount: res.likeCount });
    } catch {
      patchPost(post.id, { likedByMe: post.likedByMe, likeCount: post.likeCount });
    }
  }, [token, patchPost]);

  const onDeletePost = useCallback(async (post: Post) => {
    const ok = await dialog.confirm({ title: t.deletePost, message: t.deletePostConfirm, tone: "danger", confirmLabel: t.delete, cancelLabel: t.cancel });
    if (!ok) return;
    try {
      await deletePublicacion(post.id, token);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast.success(t.deleted);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.loadError);
    }
  }, [dialog, t, token, toast]);

  const onVote = useCallback(async (post: Post, optionId: string) => {
    if (!post.poll || post.poll.votedOptionId) return;
    try {
      const res = await votePoll(post.id, optionId, token);
      patchPost(post.id, (p) => ({
        ...p,
        poll: p.poll ? { totalVotes: res.totalVotes, votedOptionId: res.votedOptionId, options: res.options.length ? res.options : p.poll.options } : p.poll,
      }));
      if (!res.alreadyVoted) toast.success(t.voted);
    } catch (err) {
      surfaceError(err, "post");
    }
  }, [token, patchPost, toast, t, surfaceError]);

  // ── Render ───────────────────────────────────────────────────────────────
  const navActions: NavAction[] = [
    { id: "refresh", label: t.refresh, icon: <RefreshCw size={16} />, onClick: () => void loadPage(1, "replace"), disabled: loading, busy: loading },
  ];

  const balanceLabel = meta ? formatMessage(t.balance, { n: meta.balance }) : "";
  const costLabel = meta ? formatMessage(t.costPost, { n: meta.costs.post }) : "";

  return (
    <main className="h-full w-full overflow-y-auto p-3 sm:p-4 md:p-6">
      <div className="panel-wrapper">
        <section className="panel-hero">
          <div className="panel-hero__grid">
            <div className="panel-hero__content">
              <span className="panel-hero__eyebrow inline-flex items-center gap-1"><Newspaper size={14} /> {t.section}</span>
              <h1 className="panel-hero__title">{t.title}</h1>
              <p className="panel-hero__subtitle">{t.subtitle}</p>
            </div>
          </div>
        </section>

        <section className="panel-section">
          <div className="support-section">
            <div className="support-section__header flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="badge badge-ghost gap-1">{balanceLabel}</span>
                <span className="text-base-content/60">{costLabel}</span>
              </div>
              <NavActions actions={navActions} />
            </div>

            {/* Composer */}
            <div className="mt-4 rounded-box border border-base-300 bg-base-100 p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <UserAvatar src={me.photo} name={me.name} email={userEmail} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="mb-2 flex gap-2">
                    <button type="button" className={`btn btn-xs ${mode === "text" ? "btn-primary" : "btn-outline"}`} onClick={() => { setMode("text"); setComposerError(""); }}>{t.tabText}</button>
                    <button type="button" className={`btn btn-xs ${mode === "poll" ? "btn-primary" : "btn-outline"}`} onClick={() => { setMode("poll"); setComposerError(""); }}>{t.tabPoll}</button>
                  </div>

                  {mode === "text" ? (
                    <>
                      <textarea
                        className="textarea textarea-bordered w-full"
                        rows={3}
                        maxLength={maxLength}
                        placeholder={t.textPlaceholder}
                        value={text}
                        disabled={!canPost || publishing}
                        onChange={(e) => setText(e.target.value)}
                      />
                      <div className="mt-1 text-right text-xs text-base-content/50">{formatMessage(t.charsLeft, { n: maxLength - text.length })}</div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input
                        className="input input-bordered w-full"
                        maxLength={maxLength}
                        placeholder={t.pollQuestionPlaceholder}
                        value={pollQuestion}
                        disabled={!canPost || publishing}
                        onChange={(e) => setPollQuestion(e.target.value)}
                      />
                      {pollOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            className="input input-bordered input-sm w-full"
                            maxLength={maxLength}
                            placeholder={formatMessage(t.pollOptionPlaceholder, { n: idx + 1 })}
                            value={opt}
                            disabled={!canPost || publishing}
                            onChange={(e) => setPollOption(idx, e.target.value)}
                          />
                          {pollOptions.length > 2 ? (
                            <button type="button" className="btn btn-ghost btn-xs btn-square" title={t.removeOption} onClick={() => removePollOption(idx)}>
                              <X size={14} />
                            </button>
                          ) : null}
                        </div>
                      ))}
                      {pollOptions.length < 4 ? (
                        <button type="button" className="btn btn-ghost btn-xs self-start gap-1" onClick={addPollOption} disabled={!canPost || publishing}>
                          <Plus size={14} /> {t.addOption}
                        </button>
                      ) : null}
                    </div>
                  )}

                  {!canPost ? <p className="mt-2 text-xs text-warning">{t.insufficientBalance}</p> : null}
                  {composerError ? <p className="mt-2 text-xs text-error">{composerError}</p> : null}

                  <div className="mt-3 flex justify-end">
                    <button type="button" className="btn btn-primary btn-sm gap-1" onClick={() => void submitPost()} disabled={!canPost || publishing}>
                      {publishing ? <span className="loading loading-spinner loading-xs" /> : <Send size={14} />}
                      {publishing ? t.publishing : t.publish}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Feed */}
            <div className="mt-4">
              {listError ? (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-error">{listError}</p>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => void loadPage(1, "replace")}>{t.refresh}</button>
                </div>
              ) : loading ? (
                <div className="py-10 text-center text-base-content/60"><span className="loading loading-spinner" /></div>
              ) : posts.length === 0 ? (
                <p className="py-10 text-center text-base-content/60">{t.noPosts}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      t={t}
                      token={token}
                      meta={meta}
                      canManage={isAdmin || (meta?.canManageAll ?? false) || (Boolean(currentUserId) && post.authorId === currentUserId)}
                      canComment={meta?.canComment ?? false}
                      onLike={onLike}
                      onDelete={onDeletePost}
                      onVote={onVote}
                      patchPost={patchPost}
                      surfaceError={surfaceError}
                      dialog={dialog}
                      toast={toast}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      onCommentBalance={() => setMeta((m) => (m ? { ...m, balance: Math.max(0, m.balance - m.costs.comment), canComment: m.balance - m.costs.comment >= m.costs.comment } : m))}
                    />
                  ))}

                  {page < totalPages ? (
                    <button type="button" className="btn btn-outline btn-sm self-center" onClick={() => void loadPage(page + 1, "append")} disabled={loadingMore}>
                      {loadingMore ? <span className="loading loading-spinner loading-xs" /> : null}
                      {t.loadMore}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {dialog.element}
    </main>
  );
}

// ── Tarjeta de publicación ─────────────────────────────────────────────────────

type PublicacionesT = ReturnType<typeof getMessages>["publicaciones"];

function PostCard({
  post, t, token, meta, canManage, canComment, onLike, onDelete, onVote, patchPost, surfaceError,
  dialog, toast, currentUserId, isAdmin, onCommentBalance,
}: {
  post: Post;
  t: PublicacionesT;
  token: string;
  meta: PublicacionesMeta | null;
  canManage: boolean;
  canComment: boolean;
  onLike: (post: Post) => void;
  onDelete: (post: Post) => void;
  onVote: (post: Post, optionId: string) => void;
  patchPost: (id: string, patch: Partial<Post> | ((p: Post) => Post)) => void;
  surfaceError: (err: unknown, kind: "post" | "comment") => void;
  dialog: ReturnType<typeof useDialog>;
  toast: ReturnType<typeof useToast>;
  currentUserId?: string | null;
  isAdmin?: boolean;
  onCommentBalance: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>(post.comments ?? []);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const list = await getComments(post.id, token);
      setComments(list);
    } catch {
      /* keep what we have */
    } finally {
      setLoadingComments(false);
    }
  }, [post.id, token]);

  const toggleComments = useCallback(() => {
    setShowComments((open) => {
      const next = !open;
      if (next && comments.length === 0 && post.commentCount > 0) void loadComments();
      return next;
    });
  }, [comments.length, post.commentCount, loadComments]);

  const submitComment = useCallback(async () => {
    const content = commentText.trim();
    if (!content) return;
    setSending(true);
    try {
      const comment = await createComment(post.id, { content }, token);
      setComments((prev) => [...prev, comment]);
      setCommentText("");
      patchPost(post.id, (p) => ({ ...p, commentCount: p.commentCount + 1 }));
      onCommentBalance();
      toast.success(t.commented);
    } catch (err) {
      surfaceError(err, "comment");
    } finally {
      setSending(false);
    }
  }, [commentText, post.id, token, patchPost, onCommentBalance, toast, t, surfaceError]);

  const onDeleteComment = useCallback(async (comment: Comment) => {
    const ok = await dialog.confirm({ title: t.deleteComment, message: t.deleteCommentConfirm, tone: "danger", confirmLabel: t.delete, cancelLabel: t.cancel });
    if (!ok) return;
    try {
      await deleteComment(comment.id, token);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      patchPost(post.id, (p) => ({ ...p, commentCount: Math.max(0, p.commentCount - 1) }));
      toast.success(t.commentDeleted);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.loadError);
    }
  }, [dialog, t, token, patchPost, post.id, toast]);

  const authorName = post.authorName || t.authorFallback;

  return (
    <article className="rounded-box border border-base-300 bg-base-100 p-3 sm:p-4">
      {/* FILA 1: avatar + nombre del autor */}
      <header className="flex items-center gap-3">
        <UserAvatar src={post.authorPhotoUrl} name={authorName} size={40} />
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">{authorName}</p>
        </div>
      </header>

      {/* FILA 2: contenido + fecha + reacciones/acciones */}
      <div className="mt-2 pl-[52px]">
        <p className="whitespace-pre-wrap break-words text-sm">{post.content}</p>

        {post.type === "poll" && post.poll ? (
          <PollView poll={post.poll} t={t} onVote={(optionId) => onVote(post, optionId)} />
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/60">
          <span>{relativeTime(post.createdAt, t)}</span>
          <button type="button" className={`inline-flex items-center gap-1 hover:text-error ${post.likedByMe ? "text-error" : ""}`} onClick={() => onLike(post)} title={t.like}>
            <Heart size={14} fill={post.likedByMe ? "currentColor" : "none"} /> {post.likeCount}
          </button>
          <span className="inline-flex items-center gap-1" title={formatMessage(t.views, { n: post.viewCount })}>
            <Eye size={14} /> {formatMessage(t.views, { n: post.viewCount })}
          </span>
          <button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={toggleComments} title={t.comment}>
            <MessageSquare size={14} /> {formatMessage(t.comments, { n: post.commentCount })}
          </button>
          {canManage ? (
            <button type="button" className="inline-flex items-center gap-1 hover:text-error" onClick={() => onDelete(post)} title={t.deletePost}>
              <Trash2 size={14} /> {t.delete}
            </button>
          ) : null}
        </div>

        {/* Comentarios */}
        {showComments ? (
          <div className="mt-3 border-t border-base-300 pt-3">
            <p className="mb-2 text-xs font-semibold text-base-content/70">{t.commentsTitle}</p>
            {loadingComments ? (
              <div className="py-2 text-center text-base-content/50"><span className="loading loading-spinner loading-xs" /></div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-base-content/50">{t.noComments}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {comments.map((comment) => {
                  const canDelComment = isAdmin || (meta?.canManageAll ?? false) || (Boolean(currentUserId) && comment.authorId === currentUserId);
                  return (
                    <li key={comment.id} className="flex items-start gap-2">
                      <UserAvatar src={comment.authorPhotoUrl} name={comment.authorName || t.authorFallback} size={28} />
                      <div className="flex-1 min-w-0 rounded-box bg-base-200 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold">{comment.authorName || t.authorFallback}</span>
                          <span className="shrink-0 text-[10px] text-base-content/50">{relativeTime(comment.createdAt, t)}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm">{comment.content}</p>
                      </div>
                      {canDelComment ? (
                        <button type="button" className="btn btn-ghost btn-xs btn-square text-base-content/50 hover:text-error" title={t.deleteComment} onClick={() => void onDeleteComment(comment)}>
                          <Trash2 size={12} />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            {canComment ? (
              <div className="mt-3 flex items-center gap-2">
                <input
                  className="input input-bordered input-sm w-full"
                  placeholder={t.commentPlaceholder}
                  value={commentText}
                  disabled={sending}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submitComment(); } }}
                />
                <button type="button" className="btn btn-primary btn-sm btn-square" onClick={() => void submitComment()} disabled={sending || !commentText.trim()} title={t.sendComment}>
                  {sending ? <span className="loading loading-spinner loading-xs" /> : <Send size={14} />}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-warning">{t.insufficientBalanceComment}</p>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

// ── Encuesta (barras de % + conteos, resalta la opción votada) ─────────────────

function PollView({
  poll, t, onVote,
}: {
  poll: NonNullable<Post["poll"]>;
  t: PublicacionesT;
  onVote: (optionId: string) => void;
}) {
  const voted = poll.votedOptionId !== null;
  const total = poll.totalVotes;
  const options = [...poll.options].sort((a, b) => a.position - b.position);
  return (
    <div className="mt-2 flex flex-col gap-2">
      {options.map((opt: PollOption) => {
        const pct = total > 0 ? Math.round((opt.voteCount / total) * 100) : 0;
        const isVoted = poll.votedOptionId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={voted}
            onClick={() => onVote(opt.id)}
            className={`relative w-full overflow-hidden rounded-box border px-3 py-2 text-left text-sm transition ${isVoted ? "border-primary" : "border-base-300"} ${voted ? "cursor-default" : "hover:border-primary"}`}
            title={voted ? (isVoted ? t.pollVoted : undefined) : t.pollVote}
          >
            {voted ? (
              <span
                className={`absolute inset-y-0 left-0 ${isVoted ? "bg-primary/20" : "bg-base-300/60"}`}
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            ) : null}
            <span className="relative flex items-center justify-between gap-2">
              <span className={`truncate ${isVoted ? "font-semibold text-primary" : ""}`}>{opt.text}</span>
              {voted ? <span className="shrink-0 text-xs text-base-content/60">{pct}% · {formatMessage(t.pollVotes, { n: opt.voteCount })}</span> : null}
            </span>
          </button>
        );
      })}
      {voted ? <p className="text-xs text-base-content/50">{formatMessage(t.pollVotes, { n: total })}</p> : null}
    </div>
  );
}
