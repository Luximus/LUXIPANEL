/**
 * Capa de API de la superficie de BLOG del portal (espejo del portal web,
 * `frontend/src/lib/portal-blog.ts`). Endpoints bajo `/portal/blog/*`,
 * consumidos con la sesión de portal vigente reusando el helper `request` de
 * `./client`. El backend hace cumplir el acceso por autor / `manage_all`.
 *
 * Cada autor gestiona solo sus publicaciones; admin/manage_all gestiona todas
 * (scope=all). Categorías y tags forman la taxonomía. El borrador IA es
 * asíncrono: POST arranca un job (texto + imágenes) y devuelve `jobId`; se
 * sondea `GET /portal/blog/ai/draft/{jobId}` hasta `done`/error.
 */
import { ENV } from "../config/env";
import { request } from "./client";

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Tokens IA: input/cache/output + total por categoría (texto/imagen) y combinado. */
export type TokenBucket = { input: number; cached: number; output: number; total: number };
export type AiUsage = { text: TokenBucket; image: TokenBucket; total: TokenBucket };

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string | null;
  tags: string[];
  coverImageUrl: string | null;
  status: "draft" | "published";
  authorId: string | null;
  authorName: string | null;
  viewCount: number;
  publishedAt: string | null;
  sourceLocale: string;
  translationStatus: string;
  translatedLocales: string[];
  createdAt: string;
  updatedAt: string;
  aiUsage?: AiUsage | null;
  // SEO / redes sociales (round-trip con el backend).
  seoTitle: string | null;
  seoDescription: string | null;
  hashtags: string[];
  socialCaption: string | null;
};

export type BlogTag = { id: string; name: string };
export type BlogCategory = { id: string; name: string; slug: string; tags: BlogTag[] };

/** Payload de creación/edición de un post (idéntico al portal web). */
export type BlogPostPayload = {
  title: string;
  /** URL pública (slug). Si se omite, el backend lo deriva del título en inglés.
   *  Si se envía, el backend lo usa y garantiza unicidad en su lado. */
  slug?: string;
  category: string | null;
  tags: string[];
  excerpt: string;
  content: string;
  status: "draft" | "published";
  sourceLocale: string;
  coverImageUrl: string | null;
  coverImageKey?: string;
  aiUsage?: AiUsage;
  // SEO / redes sociales (opcionales; el backend los acepta y los devuelve).
  seoTitle?: string | null;
  seoDescription?: string | null;
  hashtags?: string[];
  socialCaption?: string | null;
};

export type BlogTaxonomy = { categories: BlogCategory[]; aiEnabled: boolean };
export type BlogPostsResult = { posts: BlogPost[]; canManageAll: boolean };

// ─── Lectura PÚBLICA del blog (lo mismo que muestra la web) ──────────────────
// Endpoints abiertos `GET /blog/posts` y `GET /blog/posts/:slug` (sin permiso de
// autor). Es lo que ve cualquier usuario del portal en el tab "Blog". El listado
// llega SIN el cuerpo completo; el detalle por slug sí trae `content` (HTML ya
// saneado en el backend). `locale` traduce título/extracto/cuerpo (con fallback).
export type PublicBlogListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string | null;
  tags: string[];
  coverImageUrl: string | null;
  authorName: string | null;
  viewCount: number;
  publishedAt: string | null;
};
export type PublicBlogDetail = PublicBlogListItem & { content: string; locale?: string };
export type PublicBlogPagination = { page: number; limit: number; total: number; totalPages: number };
export type PublicBlogListResult = { posts: PublicBlogListItem[]; pagination: PublicBlogPagination };

export async function getPublicBlogPosts(
  token: string,
  opts?: { page?: number; limit?: number; locale?: string; category?: string; q?: string; tag?: string },
): Promise<PublicBlogListResult> {
  const qs = new URLSearchParams();
  qs.set("page", String(opts?.page ?? 1));
  qs.set("limit", String(opts?.limit ?? 20));
  if (opts?.locale) qs.set("locale", opts.locale);
  if (opts?.category) qs.set("category", opts.category);
  if (opts?.q) qs.set("q", opts.q);
  if (opts?.tag) qs.set("tag", opts.tag);
  const data = await request<{ ok: boolean; posts?: PublicBlogListItem[]; pagination?: PublicBlogPagination }>(
    `/blog/posts?${qs.toString()}`,
    token,
  );
  return {
    posts: Array.isArray(data.posts) ? data.posts : [],
    pagination: data.pagination ?? { page: opts?.page ?? 1, limit: opts?.limit ?? 20, total: 0, totalPages: 0 },
  };
}

export async function getPublicBlogPost(slug: string, token: string, locale?: string): Promise<PublicBlogDetail | null> {
  const qs = locale ? `?locale=${encodeURIComponent(locale)}` : "";
  const data = await request<{ ok: boolean; post?: PublicBlogDetail }>(
    `/blog/posts/${encodeURIComponent(slug)}${qs}`,
    token,
  );
  return data.post ?? null;
}

/** Taxonomía pública (solo categorías/tags con posts publicados), para los
 *  selectores de filtro — la misma que usa el blog público de la web. */
export type PublicBlogTaxonomy = { categories: string[]; tags: string[] };

export async function getPublicBlogTaxonomy(token: string): Promise<PublicBlogTaxonomy> {
  const data = await request<{ ok: boolean; categories?: string[]; tags?: string[] }>("/blog/taxonomy", token);
  return {
    categories: Array.isArray(data.categories) ? data.categories : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
  };
}

// ─── Taxonomía / posts ─────────────────────────────────────────────────────

export async function getBlogTaxonomy(token: string): Promise<BlogTaxonomy> {
  const data = await request<{ ok: boolean; categories?: BlogCategory[]; aiEnabled?: boolean }>(
    "/portal/blog/taxonomy",
    token,
  );
  return {
    categories: Array.isArray(data.categories) ? data.categories : [],
    aiEnabled: !!data.aiEnabled,
  };
}

export async function getBlogPosts(token: string, scopeAll = false): Promise<BlogPostsResult> {
  const qs = scopeAll ? "?scope=all" : "";
  const data = await request<{ ok: boolean; posts?: BlogPost[]; canManageAll?: boolean }>(
    `/portal/blog/posts${qs}`,
    token,
  );
  return {
    posts: Array.isArray(data.posts) ? data.posts : [],
    canManageAll: !!data.canManageAll,
  };
}

export async function createBlogPost(payload: BlogPostPayload, token: string): Promise<void> {
  await request("/portal/blog/posts", token, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateBlogPost(id: string, payload: BlogPostPayload, token: string): Promise<void> {
  await request(`/portal/blog/posts/${id}`, token, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteBlogPost(id: string, token: string): Promise<void> {
  await request(`/portal/blog/posts/${id}`, token, { method: "DELETE" });
}

/**
 * Re-lanza la traducción de un post YA publicado a los demás idiomas. El backend
 * arranca el trabajo en background y devuelve `translationStatus: "pending"`.
 * Solo aplica a publicados (409 si es borrador) y exige IA activa (503 si está
 * apagada); el `request` propaga esos errores con su mensaje.
 */
export async function retranslateBlogPost(
  id: string,
  token: string,
): Promise<{ translationStatus: string }> {
  const data = await request<{ ok: boolean; translationStatus?: string }>(
    `/portal/blog/posts/${id}/retranslate`,
    token,
    { method: "POST" },
  );
  return { translationStatus: data.translationStatus ?? "pending" };
}

// ─── SEO / redes (IA, síncrono) ──────────────────────────────────────────────

export type SeoSocialInput = {
  title: string;
  excerpt: string;
  content: string;
  category: string | null;
  tags: string[];
  locale: string;
};

export type SeoSocialResult = {
  seoTitle: string | null;
  seoDescription: string | null;
  hashtags: string[];
  socialCaption: string | null;
  usage?: AiUsage;
};

/**
 * Genera (síncrono) metadatos SEO + copy para redes a partir del borrador
 * actual. POST /portal/blog/ai/seo. Devuelve los cuatro campos para rellenar el
 * formulario. 503 si la IA está apagada (lo propaga `request`).
 */
export async function generateBlogSeoSocial(
  input: SeoSocialInput,
  token: string,
): Promise<SeoSocialResult> {
  const data = await request<{
    ok: boolean;
    seoTitle?: string | null;
    seoDescription?: string | null;
    hashtags?: string[];
    socialCaption?: string | null;
    usage?: AiUsage;
  }>("/portal/blog/ai/seo", token, { method: "POST", body: JSON.stringify(input) });
  return {
    seoTitle: data.seoTitle ?? null,
    seoDescription: data.seoDescription ?? null,
    hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
    socialCaption: data.socialCaption ?? null,
    usage: data.usage,
  };
}

// ─── Categorías ──────────────────────────────────────────────────────────────

export async function createBlogCategory(name: string, token: string): Promise<BlogCategory> {
  const data = await request<{ ok: boolean; category: BlogCategory }>(
    "/portal/blog/categories",
    token,
    { method: "POST", body: JSON.stringify({ name }) },
  );
  return { ...data.category, tags: data.category.tags ?? [] };
}

export async function renameBlogCategory(id: string, name: string, token: string): Promise<void> {
  await request(`/portal/blog/categories/${id}`, token, { method: "PUT", body: JSON.stringify({ name }) });
}

export async function deleteBlogCategory(id: string, token: string): Promise<void> {
  await request(`/portal/blog/categories/${id}`, token, { method: "DELETE" });
}

// ─── Tags ────────────────────────────────────────────────────────────────────

/**
 * Crea un tag en la categoría. El backend deduplica por nombre case-insensitive:
 * si ya existe uno igual responde 200 con `{ deduped: true, tag }` (en vez de
 * 201) y auto-capitaliza la primera letra. En ambos casos `request` lo trata
 * como éxito; SIEMPRE usamos el `tag` devuelto (no asumimos el nombre enviado)
 * y nunca tratamos el 200/dedupe como error.
 */
export async function createBlogTag(categoryId: string, name: string, token: string): Promise<BlogTag> {
  const data = await request<{ ok: boolean; deduped?: boolean; tag: BlogTag }>(
    "/portal/blog/tags",
    token,
    { method: "POST", body: JSON.stringify({ categoryId, name }) },
  );
  return data.tag;
}

export async function renameBlogTag(id: string, name: string, token: string): Promise<void> {
  await request(`/portal/blog/tags/${id}`, token, { method: "PUT", body: JSON.stringify({ name }) });
}

export async function deleteBlogTag(id: string, token: string): Promise<void> {
  await request(`/portal/blog/tags/${id}`, token, { method: "DELETE" });
}

// ─── Subida de imágenes (multipart) ──────────────────────────────────────────

export type BlogUploadResult = { url: string; key: string | null };

/** Sube una imagen (portada o de contenido) por multipart. El backend pone el
 *  boundary; no fijamos Content-Type. Devuelve url + key del recurso. */
export async function uploadBlogImage(file: File, token: string): Promise<BlogUploadResult> {
  const url = `${ENV.apiUrl}/portal/blog/upload`;
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = (await response.json().catch(() => null)) as { ok?: boolean; url?: string; key?: string; error?: string } | null;
  if (!response.ok || !data?.ok || !data.url) {
    throw new Error(data?.error ?? "No se pudo subir la imagen");
  }
  return { url: data.url, key: data.key ?? null };
}

// ─── Borrador con IA (asíncrono: arranca job → sondea jobId) ─────────────────

export type AiDraftOptions = { category: string; locale: string; minChars?: number; imageCount?: number; tags?: string[] };
export type AiDraft = {
  title: string;
  excerpt: string;
  tags: string[];
  contentHtml: string;
  coverImageUrl: string | null;
  coverImageKey: string | null;
};
export type AiDraftResult = { draft: AiDraft; usage?: AiUsage };

/** Arranca el job de borrador IA y devuelve el `jobId` para sondear. */
export async function startBlogAiDraft(opts: AiDraftOptions, token: string): Promise<string> {
  const body: Record<string, unknown> = { category: opts.category, locale: opts.locale };
  if (Number.isFinite(opts.minChars) && (opts.minChars ?? 0) > 0) body.minChars = opts.minChars;
  if (Number.isFinite(opts.imageCount) && (opts.imageCount ?? -1) >= 0) body.imageCount = opts.imageCount;
  if (Array.isArray(opts.tags) && opts.tags.length > 0) body.tags = opts.tags;
  const data = await request<{ ok: boolean; jobId: string }>(
    "/portal/blog/ai/draft",
    token,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.jobId;
}

/** Una lectura del estado del job. `status` es `pending` o `done`. */
export async function getBlogAiDraft(
  jobId: string,
  token: string,
): Promise<{ status: "pending" | "done"; draft?: AiDraft; usage?: AiUsage }> {
  const res = await request<{ ok: boolean; status: "pending" | "done"; draft?: AiDraft; usage?: AiUsage }>(
    `/portal/blog/ai/draft/${encodeURIComponent(jobId)}`,
    token,
  );
  return { status: res.status, draft: res.draft, usage: res.usage };
}

/**
 * Sondea el job de borrador IA hasta done/error. El backend genera en
 * background (texto + imágenes) para esquivar el timeout de nginx/Cloudflare;
 * sondea cada ~3 s con un tope de seguridad (~5 min). `onProgress` recibe los
 * segundos transcurridos para refrescar el indicador de la UI.
 */
export async function pollBlogAiDraft(
  jobId: string,
  token: string,
  onProgress?: (seconds: number) => void,
): Promise<AiDraftResult> {
  const DELAY_MS = 3000;
  const MAX_TRIES = 100; // ~5 min de margen antes de rendirse.
  for (let i = 0; i < MAX_TRIES; i++) {
    await new Promise((r) => setTimeout(r, DELAY_MS));
    const res = await getBlogAiDraft(jobId, token);
    if (res.status === "done" && res.draft) return { draft: res.draft, usage: res.usage };
    onProgress?.(Math.round(((i + 1) * DELAY_MS) / 1000));
  }
  throw new Error("La generación está tardando demasiado. Inténtalo de nuevo.");
}
