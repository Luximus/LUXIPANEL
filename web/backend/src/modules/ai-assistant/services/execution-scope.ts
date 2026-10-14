// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { getContextExecutor, LOCAL_TARGET_ID } from "../../../shared/executor/index.js";

/** In-memory execution state shares the same server identity as its files. */
export function executionTargetId(targetId?: string): string {
  return targetId ?? getContextExecutor()?.target.id ?? LOCAL_TARGET_ID;
}

export function executionKey(id: string, targetId?: string): string {
  return JSON.stringify([executionTargetId(targetId), id]);
}
