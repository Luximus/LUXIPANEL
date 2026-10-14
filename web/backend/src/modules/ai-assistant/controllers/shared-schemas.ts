// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Zod schemas shared verbatim by more than one assistant controller (B-06).
 *
 * These were byte-identical copies re-declared in several controllers. They
 * stay loose "shape gates": the repositories re-sanitize (whitelist keys +
 * charset, etc.) on write, so the wire contract each controller enforces is
 * unchanged by consolidating the declaration here.
 */

import { z } from "zod";

/** Avataaars config (DiceBear) — 12 optional string options; the repository
 *  re-sanitizes (whitelists keys + charset) so this is a loose shape gate.
 *  Shared by agents.controller and team-templates.controller. */
export const avatarConfigSchema = z
  .object({
    seed: z.string().max(60).optional(),
    top: z.string().max(60).optional(),
    hairColor: z.string().max(60).optional(),
    eyes: z.string().max(60).optional(),
    eyebrows: z.string().max(60).optional(),
    mouth: z.string().max(60).optional(),
    skinColor: z.string().max(60).optional(),
    clothing: z.string().max(60).optional(),
    clothesColor: z.string().max(60).optional(),
    accessories: z.string().max(60).optional(),
    facialHair: z.string().max(60).optional(),
    facialHairColor: z.string().max(60).optional(),
  })
  .optional();

/** Associated remote server connection (LP target). `id` routes the proxy
 *  executor; `name`/`host` are display-only. The repository re-sanitizes.
 *  Shared by projects.controller and agents.controller. */
export const serverSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().max(200).default(""),
  host: z.string().max(255).optional(),
});

/** Per-skill toggle + free-form string options. Shared by projects.controller
 *  and agents.controller. */
export const skillsSchema = z.record(
  z.object({ enabled: z.boolean().optional(), options: z.record(z.string()).optional() }),
);
