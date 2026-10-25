import type { AvatarConfig } from "../types";
import { randomUUID } from "expo-crypto";
export interface GlobalManifest {
  schemaVersion: 1; name: string; description: string; specialty: string; technologies: string[];
  knowledge: string; systemPrompt: string; allowedTools: string[] | null;
  icon?: string; color?: string; avatarConfig?: AvatarConfig;
}
export interface GlobalDraft { id: string; revision: number; manifest: GlobalManifest }
export interface PublishedProfile { id: string; version: string; hash: string; author: string; manifest: GlobalManifest }
export interface ProfileSource { source: "local" | "bazaar"; id: string; version: string; hash: string; snapshot: GlobalManifest }
export interface UpdatePreview { current: ProfileSource; incoming: ProfileSource; revision: number; preserved: string[]; manifest: GlobalManifest; inheritedFrom: string | null }
export interface AuthorProfile { id: string; draft: GlobalManifest; revision: number; visibility: string; publishedVersion: string | null }
export interface ProfileHistory { profile: AuthorProfile; versions: { version: string; status: string; manifest: GlobalManifest }[]; events: { action: string; message: string; createdAt: string }[] }
export function emptyGlobalManifest(): GlobalManifest {
  return { schemaVersion: 1, name: "", description: "", specialty: "", technologies: [], knowledge: "", systemPrompt: "", allowedTools: [], color: "violet", avatarConfig: { seed: randomUUID() } };
}
