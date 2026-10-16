import { api } from "@/lib/api-client";

export interface PanelRelease {
  tag: string;
  name: string;
  notes: string;
  publishedAt: string | null;
}

export interface PanelReleaseStatus {
  branches?: PanelBranch[];
  comparisonKnown?: boolean;
  branchesError?: string;
  checkout?: { commit: string; branch: string | null } | null;
  canInstall?: boolean;
  currentVersion?: string;
  installed: { tag?: string; branch?: string; commit?: string; path?: string } | null;
  latest: PanelRelease | null;
  releases: PanelRelease[];
  updateAvailable: boolean;
  error?: string;
  operation: { status: string; tag?: string; branch?: string; commit?: string; stage?: string; startedAt?: number; error?: string; rollbackError?: string } | null;
  previous: { tag?: string; commit?: string } | null;
}

export async function readPanelReleases(fresh = false): Promise<PanelReleaseStatus> {
  const response = await api.get<PanelReleaseStatus>("/api/ui/releases", { fresh: true, ...(fresh ? { params: { fresh: "1" } } : {}) });
  if (!response.ok || !response.data) throw new Error(response.error || "No se pudo consultar las versiones.");
  return response.data;
}

export interface PanelReleasePreflight {
  ok: boolean;
  reason?: "assistant-active" | "publication-pending" | "contribution-review" | "checkout-sync" | "local-changes";
}

export async function readPanelReleasePreflight(): Promise<PanelReleasePreflight> {
  const response = await api.get<PanelReleasePreflight>("/api/admin/system/releases/preflight", { fresh: true });
  if (!response.ok || typeof response.data?.ok !== "boolean") throw new Error(response.error || "No se pudo comprobar si la instalación permite actualizar.");
  return response.data;
}

export async function installPanelRelease(tag: string): Promise<void> {
  const response = await api.post("/api/admin/system/releases/install", { tag });
  if (!response.ok) throw new Error(response.error || "No se pudo iniciar la instalación.");
}

export interface PanelReleaseDetails extends PanelRelease {
  url: string;
  discussionUrl?: string;
  comments: { id: string; body: string; author: string; url: string; updatedAt: string }[];
  commentsUnavailable: boolean;
  translation?: "translated" | "original" | "unavailable";
  translationReason?: "insufficient_balance";
  locale?: string;
}
export function versionTag(version: string): string {
  return `v${version.replace(/^v/i, "")}`;
}
export async function readReleaseDetails(tag: string): Promise<PanelReleaseDetails> {
  const result = await api.get<PanelReleaseDetails>(`/api/ui/releases/${encodeURIComponent(tag)}/details`);
  if (!result.ok || !result.data) throw new Error(result.error || "Release unavailable");
  return result.data;
}
export async function translateReleaseDetails(tag: string, locale: string): Promise<PanelReleaseDetails> {
  const result = await api.post<PanelReleaseDetails>(`/api/ui/releases/${encodeURIComponent(tag)}/translate`, { locale });
  if (!result.ok || !result.data) throw new Error(result.error || "Translation unavailable");
  return result.data;
}

export interface ProjectContributors {
  items: { login: string; url: string; avatarUrl: string; contributions: number }[];
  unavailable: boolean;
}
export async function readProjectContributors(): Promise<ProjectContributors> {
  const result = await api.get<ProjectContributors>("/api/ui/releases/contributors");
  if (!result.ok || !result.data) throw new Error(result.error || "Contributors unavailable");
  return result.data;
}

export interface PanelBranch { name: string; commit: string; updateAvailable: boolean; ahead: number; error?: string }
export interface PanelBranchDetails extends PanelBranch {
  installable: boolean;
  notes?: { id: string; title: string; changes: string[]; date: string | null }[];
  notesIncomplete?: boolean;
  commits: { sha: string; message: string; author: string; date: string | null; url: string }[];
}
export async function readPanelBranch(name: string, commit: string): Promise<PanelBranchDetails> {
  const response = await api.get<PanelBranchDetails>(`/api/ui/releases/branches/${encodeURIComponent(name)}?commit=${encodeURIComponent(commit)}`);
  if (!response.ok || !response.data) throw new Error(response.error || "No se pudo consultar la rama.");
  return response.data;
}
export async function installPanelBranch(branch: string, commit: string): Promise<void> {
  const response = await api.post("/api/admin/system/releases/install", { branch, commit });
  if (!response.ok) throw Object.assign(new Error(response.error || "No se pudo iniciar la actualización de la rama."), { code: response.code });
}
export const branchColor = (name: string): string => ({ releases: "#15803d", developer: "#eab308", main: "#0369a1", web: "#7e22ce", desktop: "#be185d", mobile: "#c2410c", modules: "#4338ca" }[name] || "#475569");
