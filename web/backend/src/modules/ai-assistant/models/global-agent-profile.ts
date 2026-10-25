// SPDX-License-Identifier: AGPL-3.0-only
// Portable contract v1. Kept identical to LP-LICENSE-SERVER; contract tests check parity.
import { z } from "zod";

const avatarValue = z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/).optional();
export const globalAgentManifestSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  specialty: z.string().trim().max(200),
  technologies: z.array(z.string().trim().min(1).max(60)).max(40),
  knowledge: z.string().max(12000),
  systemPrompt: z.string().max(20000),
  allowedTools: z.array(z.string().regex(/^[A-Za-z0-9._-]{1,120}$/)).max(500).nullable(),
  icon: z.string().regex(/^[A-Za-z0-9-]{1,60}$/).default("robot"),
  color: z.string().regex(/^[a-z0-9-]{1,30}$/).default("violet"),
  avatarConfig: z.object({
    seed: avatarValue, top: avatarValue, hairColor: avatarValue, eyes: avatarValue,
    eyebrows: avatarValue, mouth: avatarValue, skinColor: avatarValue, clothing: avatarValue,
    clothesColor: avatarValue, accessories: avatarValue, facialHair: avatarValue, facialHairColor: avatarValue,
  }).strict().default({}),
}).strict();

export type GlobalAgentManifest = z.infer<typeof globalAgentManifestSchema>;
export const profileVersionSchema = z.string().regex(/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/);
export interface PublishedAgentProfile {
  id: string;
  version: string;
  hash: string;
  author: string;
  manifest: GlobalAgentManifest;
}
export interface ImportedAgentProfile {
  source: "bazaar" | "local";
  id: string;
  version: string;
  hash: string;
  snapshot: GlobalAgentManifest;
}

/** Editorial review remains required: heuristics cannot prove prose is public. */
export function publicProfileIssues(manifest: GlobalAgentManifest): string[] {
  const text = [manifest.name, manifest.description, manifest.specialty, ...manifest.technologies, manifest.knowledge, manifest.systemPrompt].join("\n");
  const issues: string[] = [];
  if (/(?:\/(?:var\/www|home|root|etc\/luxipanel)(?:\/|\\)|[A-Z]:\\Users\\)/i.test(text))
    issues.push("Retira las rutas de proyectos o usuarios del perfil público.");
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|lxp_live_[A-Za-z0-9_-]{12,})/.test(text) ||
      /(?:password|contraseña|api[_ -]?key|secret|token)\s*[:=]\s*["']?[^\s"']{8,}/i.test(text))
    issues.push("Retira las credenciales o secretos del perfil público.");
  if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(text))
    issues.push("Retira los identificadores privados del perfil público.");
  return issues;
}

/** Stable canonical form for immutable review hashes and retry comparisons. */
function sortValue(v: unknown): unknown {
  return Array.isArray(v) ? v.map(sortValue) : v && typeof v === "object"
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, sortValue(x)])) : v;
}
export function canonicalManifest(value: GlobalAgentManifest): string {
  return JSON.stringify(sortValue(globalAgentManifestSchema.parse(value)));
}

/** Only portable fields are considered; a private edit always wins. */
export function mergeProfileUpdate(current: GlobalAgentManifest, previous: GlobalAgentManifest, incoming: GlobalAgentManifest) {
  current = globalAgentManifestSchema.parse(current);
  previous = globalAgentManifestSchema.parse(previous);
  incoming = globalAgentManifestSchema.parse(incoming);
  const next = { ...current };
  const preserved: string[] = [];
  for (const key of Object.keys(incoming) as (keyof GlobalAgentManifest)[]) {
    if (JSON.stringify(sortValue(current[key])) === JSON.stringify(sortValue(previous[key]))) {
      Object.assign(next, { [key]: incoming[key] });
    } else if (JSON.stringify(sortValue(current[key])) !== JSON.stringify(sortValue(incoming[key]))) preserved.push(key);
  }
  return { manifest: next, preserved };
}
