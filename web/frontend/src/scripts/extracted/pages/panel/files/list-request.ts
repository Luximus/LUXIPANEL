// The browser listing and the folder tree often request the same directory at
// startup. Coalesce only concurrent reads: after completion, the next read
// still reaches the backend so file mutations are visible immediately.
import { S } from "./state";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";

const pending = new Map<string, Promise<any>>();

export function fetchFilesList(path: string): Promise<any> {
  const key = `${S.activeTargetScope || "local"}\0${path}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = api.get<any>("/api/files/list", { params: { path } }).finally(() => {
    if (pending.get(key) === request) pending.delete(key);
  });
  pending.set(key, request);
  return request;
}

export function fetchFilesPage(path: string, offset: number, limit: number, options: { sortKey: string; sortDir: number; showHidden: boolean; query: string }): Promise<any> {
  return api.get<any>("/api/files/list", { params: {
    path, offset: String(offset), limit: String(limit), sortKey: options.sortKey,
    sortDir: options.sortDir === -1 ? "desc" : "asc", showHidden: String(options.showHidden), query: options.query,
  } });
}
