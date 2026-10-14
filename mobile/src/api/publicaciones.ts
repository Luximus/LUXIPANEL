import { ENV } from "../config/env";
import { request } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// Muro social "Publicaciones" del portal. Espejo RN del contrato del backend
// (`/portal/publicaciones/*`). Reutiliza el helper `request` (auth Bearer + 2FA
// step-up + refresh). Solo usuarios con saldo de tokens publican/comentan; like,
// ver y votar son gratis. Enlaces/URLs los rechaza el backend (422 con reasons).
// ─────────────────────────────────────────────────────────────────────────────

export type PollOption = { id: string; text: string; position: number; voteCount: number };

export type Poll = {
  totalVotes: number;
  votedOptionId: string | null;
  options: PollOption[];
};

export type Comment = {
  id: string;
  publicacionId: string;
  parentId: string | null;
  authorId: string | null;
  authorName: string | null;
  authorPhotoUrl: string | null;
  content: string;
  createdAt: string;
};

export type Post = {
  id: string;
  authorId: string | null;
  authorName: string | null;
  authorPhotoUrl: string | null;
  type: "text" | "poll";
  content: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  likedByMe: boolean;
  poll: Poll | null;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
};

export type FeedPagination = { page: number; limit: number; total: number; totalPages: number };

export type FeedMeta = {
  costs: { post: number; comment: number };
  maxLength: number;
  balance: number;
  canPost: boolean;
  canComment: boolean;
  canManageAll: boolean;
};

export type FeedResult = { posts: Post[]; pagination: FeedPagination; meta: FeedMeta };

const DEFAULT_META: FeedMeta = {
  costs: { post: 0, comment: 0 },
  maxLength: 255,
  balance: 0,
  canPost: false,
  canComment: false,
  canManageAll: false,
};

/**
 * Error tipado de las acciones que cuestan tokens (publicar/comentar). Conserva
 * la información estructurada del backend: saldo insuficiente (402) con
 * `required`/`available`, o moderación IA (422) con `reasons`. La UI las usa para
 * mostrar el mensaje correcto (saldo vs. razones de moderación).
 */
export class PublicacionError extends Error {
  required?: number;
  available?: number;
  reasons?: string[];
  kind: "balance" | "moderation" | "generic";
  constructor(
    message: string,
    opts?: { required?: number; available?: number; reasons?: string[]; kind?: "balance" | "moderation" | "generic" },
  ) {
    super(message);
    this.name = "PublicacionError";
    this.required = opts?.required;
    this.available = opts?.available;
    this.reasons = opts?.reasons;
    this.kind = opts?.kind ?? "generic";
  }
}

function getStr(obj: unknown, field: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const v = (obj as Record<string, unknown>)[field];
  return typeof v === "string" ? v : undefined;
}

/**
 * POST de las acciones que cuestan tokens (publicar/comentar). El helper
 * `request` aplana el body de error a `Error(message)`, perdiendo los campos
 * estructurados (402 saldo: required/available; 422 moderación: reasons); por
 * eso hacemos el fetch crudo y clasificamos el error en `PublicacionError`.
 */
async function postWithModeration<T>(path: string, token: string, body: unknown): Promise<T> {
  return rawJson<T>(path, token, { method: "POST", body: JSON.stringify(body) });
}

async function rawJson<T>(path: string, token: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${ENV.apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "x-client-platform": "app",
      ...(init.headers ?? {}),
    },
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = getStr(data, "error") ?? "Request failed";
    const d = (data ?? {}) as Record<string, unknown>;
    if (response.status === 402) {
      throw new PublicacionError(message, {
        kind: "balance",
        required: typeof d.required === "number" ? d.required : undefined,
        available: typeof d.available === "number" ? d.available : undefined,
      });
    }
    if (response.status === 422) {
      throw new PublicacionError(message, {
        kind: "moderation",
        reasons: Array.isArray(d.reasons) ? (d.reasons as string[]) : undefined,
      });
    }
    throw new PublicacionError(message);
  }
  return data as T;
}

export async function getFeed(token: string, opts?: { page?: number; limit?: number }): Promise<FeedResult> {
  const qs = new URLSearchParams();
  qs.set("page", String(opts?.page ?? 1));
  qs.set("limit", String(opts?.limit ?? 20));
  const data = await request<{
    ok: boolean;
    posts?: Post[];
    pagination?: FeedPagination;
    meta?: Partial<FeedMeta>;
  }>(`/portal/publicaciones?${qs.toString()}`, token);
  return {
    posts: Array.isArray(data.posts) ? data.posts : [],
    pagination: data.pagination ?? { page: opts?.page ?? 1, limit: opts?.limit ?? 20, total: 0, totalPages: 0 },
    meta: { ...DEFAULT_META, ...(data.meta ?? {}), costs: { ...DEFAULT_META.costs, ...(data.meta?.costs ?? {}) } },
  };
}

export async function createPost(
  token: string,
  payload: { type: "text" | "poll"; content: string; options?: string[] },
): Promise<Post> {
  const data = await postWithModeration<{ ok: boolean; post?: Post }>("/portal/publicaciones", token, payload);
  if (!data.post) throw new PublicacionError("No se pudo crear la publicación.");
  return data.post;
}

export async function deletePost(token: string, id: string): Promise<void> {
  await request<{ ok: boolean }>(`/portal/publicaciones/${encodeURIComponent(id)}`, token, { method: "DELETE" });
}

export async function toggleLike(token: string, id: string): Promise<{ liked: boolean; likeCount: number }> {
  const data = await request<{ ok: boolean; liked?: boolean; likeCount?: number }>(
    `/portal/publicaciones/${encodeURIComponent(id)}/like`,
    token,
    { method: "POST" },
  );
  return { liked: Boolean(data.liked), likeCount: typeof data.likeCount === "number" ? data.likeCount : 0 };
}

/** Registra una vista única (fire-and-forget). Nunca lanza: ver es gratis y no
 *  debe romper el render del feed si falla. */
export async function registerView(token: string, id: string): Promise<{ viewCount: number } | null> {
  try {
    const data = await request<{ ok: boolean; viewCount?: number }>(
      `/portal/publicaciones/${encodeURIComponent(id)}/view`,
      token,
      { method: "POST" },
    );
    return { viewCount: typeof data.viewCount === "number" ? data.viewCount : 0 };
  } catch {
    return null;
  }
}

export type VoteResult = {
  alreadyVoted: boolean;
  votedOptionId: string;
  totalVotes: number;
  options: PollOption[];
};

export async function votePoll(token: string, id: string, optionId: string): Promise<VoteResult> {
  const data = await request<{
    ok: boolean;
    alreadyVoted?: boolean;
    votedOptionId?: string;
    totalVotes?: number;
    options?: PollOption[];
  }>(`/portal/publicaciones/${encodeURIComponent(id)}/vote`, token, {
    method: "POST",
    body: JSON.stringify({ optionId }),
  });
  return {
    alreadyVoted: Boolean(data.alreadyVoted),
    votedOptionId: data.votedOptionId ?? optionId,
    totalVotes: typeof data.totalVotes === "number" ? data.totalVotes : 0,
    options: Array.isArray(data.options) ? data.options : [],
  };
}

export async function getComments(token: string, id: string): Promise<Comment[]> {
  const data = await request<{ ok: boolean; comments?: Comment[] }>(
    `/portal/publicaciones/${encodeURIComponent(id)}/comments`,
    token,
  );
  return Array.isArray(data.comments) ? data.comments : [];
}

export async function createComment(
  token: string,
  id: string,
  payload: { content: string; parentId?: string | null },
): Promise<Comment> {
  const data = await postWithModeration<{ ok: boolean; comment?: Comment }>(
    `/portal/publicaciones/${encodeURIComponent(id)}/comments`,
    token,
    payload,
  );
  if (!data.comment) throw new PublicacionError("No se pudo crear el comentario.");
  return data.comment;
}

export async function deleteComment(token: string, commentId: string): Promise<void> {
  await request<{ ok: boolean }>(
    `/portal/publicaciones/comments/${encodeURIComponent(commentId)}`,
    token,
    { method: "DELETE" },
  );
}
