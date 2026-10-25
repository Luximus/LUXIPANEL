// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { z } from "zod";

export const assistantAdmissionSchema = z.object({
  memPercent: z.number().int().min(50).max(90),
}).strict();

export type AssistantAdmissionConfig = z.infer<typeof assistantAdmissionSchema>;
export const DEFAULT_ASSISTANT_ADMISSION: AssistantAdmissionConfig = { memPercent: 85 };
