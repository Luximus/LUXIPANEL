import { api } from "@/lib/api-client";

export interface PanelRelease {
  tag: string;
  name: string;
  notes: string;
  publishedAt: string | null;
}

export interface PanelReleaseStatus {
  canInstall?: boolean;
  currentVersion?: string;
  installed: { tag?: string; commit?: string; path?: string } | null;
  latest: PanelRelease | null;
  releases: PanelRelease[];
  updateAvailable: boolean;
  error?: string;
  operation: { status: string; tag: string; stage?: string; startedAt?: number; error?: string; rollbackError?: string } | null;
  previous: { tag?: string; commit?: string } | null;
}

export async function readPanelReleases(): Promise<PanelReleaseStatus> {
  const response = await api.get<PanelReleaseStatus>("/api/ui/releases");
  if (!response.ok || !response.data) throw new Error(response.error || "No se pudo consultar las versiones.");
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
