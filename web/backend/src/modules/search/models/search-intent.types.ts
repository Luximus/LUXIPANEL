// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { z } from "zod";

/** Candidato del catálogo del super buscador (lo envía el frontend). */
export const searchCandidateSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  path: z.string().max(200).optional(),
  keywords: z.array(z.string().max(80)).max(24).default([]),
});

export const searchIntentRequestSchema = z.object({
  query: z.string().trim().min(2).max(300),
  locale: z.string().trim().min(2).max(10).default("es"),
  candidates: z.array(searchCandidateSchema).min(1).max(300),
});

export type SearchCandidate = z.infer<typeof searchCandidateSchema>;
export type SearchIntentRequest = z.infer<typeof searchIntentRequestSchema>;

export interface SearchIntentResult {
  /** id del candidato elegido, o null si la IA no encontró uno claro. */
  id: string | null;
  /** 0..1 */
  confidence: number;
}
