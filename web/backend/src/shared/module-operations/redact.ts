// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Module APIs can contain credential envelopes. Never forward those fields
 * to approval details, provider context, audit previews or chat traces. */
export function redactModuleData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactModuleData);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /(?:password|passwd|private[_-]?key|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|secrets|credentials|bearer|jwt[_-]?secret|token$|secret$)/i.test(key) ? "[redacted]" : redactModuleData(item)]));
}
