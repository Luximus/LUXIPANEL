import { env } from "../../config/env.js";
const cache = new Map<string, { until: number; value: unknown; error?: string; etag?: string }>();
const pending = new Map<string, Promise<unknown>>();
const anonymousRequests: number[] = [];
const cacheDuration = () => env.LUXIPANEL_GITHUB_TOKEN ? 300000 : 3600000;
export async function publicGithub<T>(route: string): Promise<T> {
  if (!/^\/repos\/Luxisoft\/LUXIPANEL(?:[/?]|$)/i.test(route)) throw new Error("Repositorio no permitido");
  const saved = cache.get(route); if (saved && saved.until > Date.now()) { if (saved.error) throw new Error(saved.error); return saved.value as T; }
  if (pending.has(route)) return pending.get(route) as Promise<T>;
  const request = (async () => {
    if (!env.LUXIPANEL_GITHUB_TOKEN) {
      const cutoff = Date.now() - 3600000;
      while (anonymousRequests.length && anonymousRequests[0]! <= cutoff) anonymousRequests.shift();
      if (anonymousRequests.length >= 45) {
        if (saved?.value !== undefined) { saved.until = Date.now() + 60000; return saved.value; }
        throw new Error("La comunidad se actualizará al renovar el límite de consultas de GitHub");
      }
      anonymousRequests.push(Date.now());
    }
    const response = await fetch(`https://api.github.com${route}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "LUXIPANEL-community", ...(saved?.etag ? { "If-None-Match": saved.etag } : {}), ...(env.LUXIPANEL_GITHUB_TOKEN ? { Authorization: `Bearer ${env.LUXIPANEL_GITHUB_TOKEN}` } : {}) }, signal: AbortSignal.timeout(10000), redirect: "error",
    });
    if (response.status === 304 && saved) { saved.until = Date.now() + cacheDuration(); saved.error = undefined; return saved.value; }
    if (!response.ok) throw new Error(`GitHub ${response.status}: ${response.status === 404 ? "repositorio o recurso no accesible" : response.status === 403 || response.status === 429 ? "límite de consultas; reintenta más tarde" : "no se pudo consultar la comunidad"}`);
    const value: unknown = await response.json();
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(route, { until: Date.now() + cacheDuration(), value, etag: response.headers.get("etag") || undefined }); return value;
  })().catch((error) => { cache.set(route, { until: Date.now() + 300000, value: saved?.value, etag: saved?.etag, error: String((error as Error).message) }); throw error; }).finally(() => pending.delete(route));
  pending.set(route, request); return request as Promise<T>;
}
export async function publicGithubPages<T>(path: string): Promise<T[]> {
  const result: T[] = [];
  for (let page = 1; page <= 100; page++) {
    const rows = await publicGithub<T[]>(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    if (!Array.isArray(rows)) throw new Error("Respuesta GitHub inválida");
    result.push(...rows); if (rows.length < 100) return result;
  }
  throw new Error("Demasiados resultados de GitHub; reduce el periodo consultado");
}
export const CANONICAL_GITHUB = "/repos/Luxisoft/LUXIPANEL";

export function githubSince(days = 30): string { return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10) + "T00:00:00.000Z"; }
