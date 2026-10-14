/**
 * Muro social "Publicaciones" — capa API del cliente DESKTOP.
 *
 * Endpoints bajo `/portal/publicaciones/*`, consumidos con la sesión de portal
 * vigente. Las lecturas/acciones simples reusan el helper `request` de
 * `./client` (Authorization Bearer, 401 refresh, 403 step-up, 429). La creación
 * de publicaciones y comentarios usa un fetch crudo (`postRaw`) para preservar
 * el cuerpo estructurado de los errores 402 (sin saldo: `required`/`available`)
 * y 422 (moderación IA: `reasons`/`moderation`), que el `request` central
 * aplanaría a un simple `Error(message)`.
 *
 * Reglas de producto: publicar y comentar cuestan tokens; ver, dar me gusta y
 * votar son gratis. No se permiten enlaces/URLs (el backend rechaza con 422).
 */

import { ENV } from "../config/env";
import { request } from "./client";

// ── Tipos (espejo literal del contrato backend) ───────────────────────────────

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

export type PublicacionesPagination = { page: number; limit: number; total: number; totalPages: number };

export type PublicacionesMeta = {
  costs: { post: number; comment: number };
  maxLength: number;
  balance: number;
  canPost: boolean;
  canComment: boolean;
  canManageAll: boolean;
};

export type PublicacionesFeed = {
  posts: Post[];
  pagination: PublicacionesPagination;
  meta: PublicacionesMeta;
};

/** Error enriquecido lanzado por crear publicación/comentario:
 *  - 402: saldo insuficiente (`required`/`available`).
 *  - 422: la moderación IA rechazó el contenido (`reasons`/`moderation`). */
export class PublicacionError extends Error {
  status: number;
  required?: number;
  available?: number;
  reasons?: string[];
  moderation?: { hasUrl: boolean; obscene: boolean };
  constructor(message: string, status: number, extra?: Partial<PublicacionError>) {
    super(message);
    this.name = "PublicacionError";
    this.status = status;
    if (extra) Object.assign(this, extra);
  }
}

const DEFAULT_META: PublicacionesMeta = {
  costs: { post: 250, comment: 30 },
  maxLength: 255,
  balance: 0,
  canPost: false,
  canComment: false,
  canManageAll: false,
};

function getString(obj: Record<string, unknown> | null, field: string): string | undefined {
  const v = obj?.[field];
  return typeof v === "string" ? v : undefined;
}
function getNumber(obj: Record<string, unknown> | null, field: string): number | undefined {
  const v = obj?.[field];
  return typeof v === "number" ? v : undefined;
}

type RawResult = { ok: boolean; status: number; data: unknown };

/**
 * POST crudo que preserva status + cuerpo estructurado en errores (402/422) para
 * que el llamador pueda surtir `required`/`available`/`reasons` en la UI. Usa
 * `window.electronApi.request` cuando está (paridad con `client.ts`), si no
 * `fetch`. NO maneja refresh/step-up: estas acciones (publicar/comentar) son
 * directas y el 401 lo cubre el flujo general la próxima vez.
 */
async function postRaw(path: string, token: string, body: unknown): Promise<RawResult> {
  const url = `${ENV.apiUrl}${path}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  } as Record<string, string>;
  const bodyStr = JSON.stringify(body);
  if (window.electronApi?.request) {
    const result = (await window.electronApi.request({ url, method: "POST", headers, body: bodyStr })) as {
      ok: boolean;
      status: number;
      data: unknown;
    };
    return { ok: result.ok, status: result.status, data: result.data };
  }
  const response = await fetch(url, { method: "POST", headers, body: bodyStr });
  const data: unknown = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

/** Convierte un `RawResult` fallido en un `PublicacionError` con los campos
 *  estructurados (402: required/available, 422: reasons/moderation). */
function toPublicacionError(result: RawResult): PublicacionError {
  const obj = (result.data && typeof result.data === "object" ? result.data : null) as Record<string, unknown> | null;
  const message = getString(obj, "error") ?? `HTTP ${result.status}`;
  const reasonsRaw = obj?.reasons;
  const reasons = Array.isArray(reasonsRaw) ? reasonsRaw.filter((r): r is string => typeof r === "string") : undefined;
  const modRaw = obj?.moderation;
  const moderation = modRaw && typeof modRaw === "object"
    ? {
        hasUrl: Boolean((modRaw as Record<string, unknown>).hasUrl),
        obscene: Boolean((modRaw as Record<string, unknown>).obscene),
      }
    : undefined;
  return new PublicacionError(message, result.status, {
    required: getNumber(obj, "required"),
    available: getNumber(obj, "available"),
    reasons,
    moderation,
  });
}

// ── Lectura del feed ──────────────────────────────────────────────────────────

export async function getPublicaciones(
  token: string,
  opts?: { page?: number; limit?: number },
): Promise<PublicacionesFeed> {
  const qs = new URLSearchParams();
  qs.set("page", String(opts?.page ?? 1));
  qs.set("limit", String(opts?.limit ?? 20));
  const data = await request<{
    ok: boolean;
    posts?: Post[];
    pagination?: PublicacionesPagination;
    meta?: Partial<PublicacionesMeta>;
  }>(`/portal/publicaciones?${qs.toString()}`, token);
  return {
    posts: Array.isArray(data.posts) ? data.posts : [],
    pagination: data.pagination ?? { page: opts?.page ?? 1, limit: opts?.limit ?? 20, total: 0, totalPages: 0 },
    meta: {
      costs: {
        post: data.meta?.costs?.post ?? DEFAULT_META.costs.post,
        comment: data.meta?.costs?.comment ?? DEFAULT_META.costs.comment,
      },
      maxLength: data.meta?.maxLength ?? DEFAULT_META.maxLength,
      balance: data.meta?.balance ?? DEFAULT_META.balance,
      canPost: data.meta?.canPost ?? DEFAULT_META.canPost,
      canComment: data.meta?.canComment ?? DEFAULT_META.canComment,
      canManageAll: data.meta?.canManageAll ?? DEFAULT_META.canManageAll,
    },
  };
}

// ── Creación de publicación (402/422 estructurados) ───────────────────────────

export type CreatePostInput = {
  type: "text" | "poll";
  content: string;
  options?: string[];
};

export async function createPublicacion(input: CreatePostInput, token: string): Promise<Post> {
  const result = await postRaw("/portal/publicaciones", token, input);
  if (!result.ok) throw toPublicacionError(result);
  const obj = result.data as { post?: Post };
  if (!obj?.post) throw new PublicacionError("Respuesta inválida del servidor", result.status);
  return obj.post;
}

export async function deletePublicacion(id: string, token: string): Promise<void> {
  await request(`/portal/publicaciones/${encodeURIComponent(id)}`, token, { method: "DELETE" });
}

// ── Reacciones (gratis) ───────────────────────────────────────────────────────

export async function toggleLike(id: string, token: string): Promise<{ liked: boolean; likeCount: number }> {
  const data = await request<{ ok: boolean; liked?: boolean; likeCount?: number }>(
    `/portal/publicaciones/${encodeURIComponent(id)}/like`,
    token,
    { method: "POST" },
  );
  return { liked: Boolean(data.liked), likeCount: data.likeCount ?? 0 };
}

/** Registra una vista única. Llamar una vez al renderizar una publicación que no
 *  sea propia. Nunca lanza (best-effort). */
export async function registerView(id: string, token: string): Promise<number | null> {
  try {
    const data = await request<{ ok: boolean; viewCount?: number }>(
      `/portal/publicaciones/${encodeURIComponent(id)}/view`,
      token,
      { method: "POST" },
    );
    return data.viewCount ?? null;
  } catch {
    return null;
  }
}

// ── Votar en encuesta (gratis) ────────────────────────────────────────────────

export type VoteResult = {
  alreadyVoted: boolean;
  votedOptionId: string;
  totalVotes: number;
  options: PollOption[];
};

export async function votePoll(id: string, optionId: string, token: string): Promise<VoteResult> {
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
    totalVotes: data.totalVotes ?? 0,
    options: Array.isArray(data.options) ? data.options : [],
  };
}

// ── Comentarios ───────────────────────────────────────────────────────────────

export async function getComments(id: string, token: string): Promise<Comment[]> {
  const data = await request<{ ok: boolean; comments?: Comment[] }>(
    `/portal/publicaciones/${encodeURIComponent(id)}/comments`,
    token,
  );
  return Array.isArray(data.comments) ? data.comments : [];
}

export async function createComment(
  id: string,
  input: { content: string; parentId?: string | null },
  token: string,
): Promise<Comment> {
  const result = await postRaw(`/portal/publicaciones/${encodeURIComponent(id)}/comments`, token, {
    content: input.content,
    parentId: input.parentId ?? null,
  });
  if (!result.ok) throw toPublicacionError(result);
  const obj = result.data as { comment?: Comment };
  if (!obj?.comment) throw new PublicacionError("Respuesta inválida del servidor", result.status);
  return obj.comment;
}

export async function deleteComment(commentId: string, token: string): Promise<void> {
  await request(`/portal/publicaciones/comments/${encodeURIComponent(commentId)}`, token, { method: "DELETE" });
}
