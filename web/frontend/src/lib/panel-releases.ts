import { api } from "@/lib/api-client";

export interface PanelRelease {
  tag: string;
  name: string;
  notes: string;
  publishedAt: string | null;
}

export interface PanelReleaseStatus {
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
