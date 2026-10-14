import { ENV } from "../config/env";
import { request } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// Blog del portal (solo admins/autores). Replica campos, payloads y endpoints de
// frontend/src/lib/portal-blog.ts. Reutiliza el helper `request` (auth Bearer +
// 2FA step-up). El upload de imágenes usa el patrón multipart de la app (igual
// que uploadTicketAttachment) contra POST /portal/blog/upload.
// El backend filtra por autor/manage_all; el cliente solo pinta lo permitido.
// ─────────────────────────────────────────────────────────────────────────────

export type BlogTokenBucket = { input: number; cached: number; output: number; total: number };
export type BlogAiUsage = { text: BlogTokenBucket; image: BlogTokenBucket; total: BlogTokenBucket };

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
  aiUsage?: BlogAiUsage | null;
  // SEO y redes (round-trip con el editor; el backend los devuelve en el GET admin).
  seoTitle: string | null;
  seoDescription: string | null;
  hashtags: string[];
  socialCaption: string | null;
};

export type BlogTagDef = { id: string; name: string };
export type BlogCategoryDef = { id: string; name: string; slug: string; tags: BlogTagDef[] };

export type BlogTaxonomy = { categories: BlogCategoryDef[]; aiEnabled: boolean };

export type BlogPostPayload = {
  title: string;
  // URL pública (path tras /blog/). Si se omite, el backend la deriva del título
  // (en inglés) y la hace única. Si se envía, la usa (también unificada).
  slug?: string;
  category: string | null;
  tags: string[];
  excerpt: string;
  content: string;
  status: "draft" | "published";
  sourceLocale: string;
  coverImageUrl: string | null;
  coverImageKey?: string;
  aiUsage?: BlogAiUsage;
  // SEO y redes (opcionales; el backend acepta null para limpiar).
  seoTitle?: string | null;
  seoDescription?: string | null;
  hashtags?: string[];
  socialCaption?: string | null;
};

// ── Taxonomía y posts ────────────────────────────────────────────────────────

export async function getBlogTaxonomy(token: string): Promise<BlogTaxonomy> {
  const data = await request<{ ok: boolean; categories?: BlogCategoryDef[]; aiEnabled?: boolean }>(
    "/portal/blog/taxonomy",
    token,
  );
  return {
    categories: Array.isArray(data.categories)
      ? data.categories.map((c) => ({ ...c, tags: Array.isArray(c.tags) ? c.tags : [] }))
      : [],
    aiEnabled: Boolean(data.aiEnabled),
  };
}

export async function getBlogPosts(
  token: string,
  scopeAll: boolean,
): Promise<{ posts: BlogPost[]; canManageAll: boolean }> {
  const qs = scopeAll ? "?scope=all" : "";
  const data = await request<{ ok: boolean; posts?: BlogPost[]; canManageAll?: boolean }>(
    `/portal/blog/posts${qs}`,
    token,
  );
  return {
    posts: Array.isArray(data.posts) ? data.posts : [],
    canManageAll: Boolean(data.canManageAll),
  };
}

// ── Lectura PÚBLICA del blog (lo mismo que muestra la web) ──────────────────
// Endpoints abiertos `GET /blog/posts` y `GET /blog/posts/:slug` (sin permiso de
// autor). Es lo que ve cualquier usuario del portal en la pantalla "Blog". El
// listado llega SIN cuerpo; el detalle por slug trae `content` (HTML saneado en
// backend). `locale` traduce título/extracto/cuerpo con fallback al base.
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

export async function getPublicBlogTaxonomy(token: string): Promise<{ categories: string[]; tags: string[] }> {
  const data = await request<{ ok: boolean; categories?: string[]; tags?: string[] }>(
    "/blog/taxonomy",
    token,
  );
  return {
    categories: Array.isArray(data.categories) ? data.categories : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
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

export async function createBlogPost(payload: BlogPostPayload, token: string): Promise<BlogPost | null> {
  const data = await request<{ ok: boolean; post?: BlogPost }>("/portal/blog/posts", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.post ?? null;
}

export async function updateBlogPost(
  id: string,
  payload: BlogPostPayload,
  token: string,
): Promise<BlogPost | null> {
  const data = await request<{ ok: boolean; post?: BlogPost }>(`/portal/blog/posts/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return data.post ?? null;
}

export async function deleteBlogPost(id: string, token: string): Promise<void> {
  await request<{ ok: boolean }>(`/portal/blog/posts/${id}`, token, { method: "DELETE" });
}

/**
 * Re-traduce un post a todos los idiomas con IA. Solo funciona sobre posts
 * publicados (el backend responde 409 si es borrador) y exige IA habilitada
 * (503 si no). Devuelve `translationStatus:"pending"`; el job corre en background.
 */
export async function retranslateBlogPost(id: string, token: string): Promise<{ translationStatus: string }> {
  const data = await request<{ ok: boolean; translationStatus?: string }>(
    `/portal/blog/posts/${id}/retranslate`,
    token,
    { method: "POST" },
  );
  return { translationStatus: data.translationStatus ?? "pending" };
}

// ── SEO / redes con IA (síncrono) ─────────────────────────────────────────────

export type BlogSeoInput = {
  title: string;
  excerpt: string;
  content: string;
  category: string | null;
  tags: string[];
  locale: string;
};
export type BlogSeoResult = {
  seoTitle: string | null;
  seoDescription: string | null;
  hashtags: string[];
  socialCaption: string | null;
  usage?: BlogAiUsage;
};

/**
 * Genera meta título/descripción, hashtags y caption para redes a partir del
 * contenido actual. Síncrono (el backend responde con el resultado en la misma
 * petición). 503 si la IA está deshabilitada.
 */
export async function generateBlogSeo(input: BlogSeoInput, token: string): Promise<BlogSeoResult> {
  const data = await request<{
    ok: boolean;
    seoTitle?: string | null;
    seoDescription?: string | null;
    hashtags?: string[];
    socialCaption?: string | null;
    usage?: BlogAiUsage;
  }>("/portal/blog/ai/seo", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return {
    seoTitle: data.seoTitle ?? null,
    seoDescription: data.seoDescription ?? null,
    hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
    socialCaption: data.socialCaption ?? null,
    usage: data.usage,
  };
}

// ── Categorías ───────────────────────────────────────────────────────────────

export async function createBlogCategory(name: string, token: string): Promise<BlogCategoryDef | null> {
  const data = await request<{ ok: boolean; category?: BlogCategoryDef }>("/portal/blog/categories", token, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data.category ? { ...data.category, tags: data.category.tags ?? [] } : null;
}

export async function updateBlogCategory(id: string, name: string, token: string): Promise<void> {
  await request<{ ok: boolean }>(`/portal/blog/categories/${id}`, token, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export async function deleteBlogCategory(id: string, token: string): Promise<void> {
  await request<{ ok: boolean }>(`/portal/blog/categories/${id}`, token, { method: "DELETE" });
}

// ── Tags ─────────────────────────────────────────────────────────────────────

/**
 * Crea un tag o reutiliza el existente con el mismo nombre (case-insensitive):
 * el backend responde 201 al crear y 200 con `deduped:true` al reutilizar.
 * Ambos son éxito (`ok:true`), así que `request` no lanza; SIEMPRE devolvemos el
 * tag de la respuesta (id+name, con la primera letra ya capitalizada por el
 * servidor), nunca el nombre escrito. El campo `categoryId` viene en la
 * respuesta pero `BlogTagDef` solo expone {id,name} para el resto de la UI.
 */
export async function createBlogTag(categoryId: string, name: string, token: string): Promise<BlogTagDef | null> {
  const data = await request<{ ok: boolean; deduped?: boolean; tag?: BlogTagDef & { categoryId?: string } }>(
    "/portal/blog/tags",
    token,
    {
      method: "POST",
      body: JSON.stringify({ categoryId, name }),
    },
  );
  return data.tag ? { id: data.tag.id, name: data.tag.name } : null;
}

export async function updateBlogTag(id: string, name: string, token: string): Promise<void> {
  await request<{ ok: boolean }>(`/portal/blog/tags/${id}`, token, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export async function deleteBlogTag(id: string, token: string): Promise<void> {
  await request<{ ok: boolean }>(`/portal/blog/tags/${id}`, token, { method: "DELETE" });
}

// ── Subida de imágenes (cover/contenido) ─────────────────────────────────────

export type BlogUploadFile = { uri: string; name: string; type: string };
export type BlogUploadResult = { url: string; key: string | null };

/**
 * Sube una imagen (portada o de contenido) vía multipart, igual que
 * uploadTicketAttachment: RN acepta el objeto {uri,name,type} en FormData.
 * Devuelve `{ url, key }` para persistir en el post.
 */
export function uploadBlogImage(file: BlogUploadFile, token: string): Promise<BlogUploadResult> {
  return new Promise<BlogUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${ENV.apiUrl}/portal/blog/upload`;
    const form = new FormData();
    form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);

    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-client-platform", "app");

    xhr.addEventListener("load", () => {
      let data: { ok?: boolean; url?: string; key?: string; error?: string } | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Respuesta inválida del servidor"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.ok && typeof data.url === "string") {
        resolve({ url: data.url, key: data.key ?? null });
      } else {
        reject(new Error(data?.error ?? `HTTP ${xhr.status}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Error de red al subir la imagen")));
    xhr.addEventListener("abort", () => reject(new Error("Carga cancelada")));

    try {
      xhr.send(form as unknown as Document);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Error al subir"));
    }
  });
}

// ── Borrador con IA (async: POST arranca job, GET sondea hasta done/error) ─────

export type BlogAiDraftOptions = { category: string; locale: string; minChars?: number; imageCount?: number; tags?: string[] };
export type BlogAiDraft = {
  title: string;
  excerpt: string;
  tags: string[];
  contentHtml: string;
  coverImageUrl: string | null;
  coverImageKey: string | null;
};
export type BlogAiDraftResult = { draft: BlogAiDraft; usage?: BlogAiUsage };

export async function startBlogAiDraft(opts: BlogAiDraftOptions, token: string): Promise<string> {
  const body: Record<string, unknown> = { category: opts.category, locale: opts.locale };
  if (typeof opts.minChars === "number" && opts.minChars > 0) body.minChars = opts.minChars;
  if (typeof opts.imageCount === "number" && opts.imageCount >= 0) body.imageCount = opts.imageCount;
  if (Array.isArray(opts.tags) && opts.tags.length > 0) body.tags = opts.tags;
  const data = await request<{ ok: boolean; jobId?: string }>("/portal/blog/ai/draft", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!data.jobId) throw new Error("No se pudo iniciar la generación con IA.");
  return data.jobId;
}

export async function pollBlogAiDraftOnce(
  jobId: string,
  token: string,
): Promise<{ status: "pending" | "done"; draft?: BlogAiDraft; usage?: BlogAiUsage }> {
  const res = await request<{ ok: boolean; status: "pending" | "done"; draft?: BlogAiDraft; usage?: BlogAiUsage }>(
    `/portal/blog/ai/draft/${encodeURIComponent(jobId)}`,
    token,
  );
  return { status: res.status, draft: res.draft, usage: res.usage };
}

/**
 * Sondea el job de borrador IA hasta done/error. El backend genera en background
 * (texto + imágenes) para esquivar el timeout de nginx/Cloudflare. ~3s/intento,
 * tope ~5min. `onTick` reporta segundos transcurridos para el progreso en UI.
 */
export async function pollBlogAiDraft(
  jobId: string,
  token: string,
  onTick?: (seconds: number) => void,
): Promise<BlogAiDraftResult> {
  const DELAY_MS = 3000;
  const MAX_TRIES = 100;
  for (let i = 0; i < MAX_TRIES; i++) {
    await new Promise((r) => setTimeout(r, DELAY_MS));
    const res = await pollBlogAiDraftOnce(jobId, token);
    if (res.status === "done" && res.draft) return { draft: res.draft, usage: res.usage };
    onTick?.(Math.round(((i + 1) * DELAY_MS) / 1000));
  }
  throw new Error("La generación está tardando demasiado. Inténtalo de nuevo.");
}
