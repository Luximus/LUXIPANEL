// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Matches the simple SDK ranges accepted by the module manifest schema. */
export function sdkRangeSupported(value: unknown, version: string): boolean {
  if (value === undefined) return true; // Legacy manifests predate the sdk field.
  if (typeof value !== "string") return false;
  const match = /^(\^|~|>=|>|<=|<)?(\d+(?:\.\d+){0,2})$/.exec(value);
  if (!match) return false;
  const parts = match[2]!.split(".").map(Number), min = [parts[0]!, parts[1] ?? 0, parts[2] ?? 0];
  const current = version.split(".").map(Number);
  const compare = (bound: number[]) => { for (let i = 0; i < 3; i++) { const delta = current[i]! - bound[i]!; if (delta) return Math.sign(delta); } return 0; };
  const next = [...min], count = parts.length;
  const bump = (index: number) => { next[index] = next[index]! + 1; for (let i = index + 1; i < 3; i++) next[i] = 0; };
  switch (match[1]) {
    case ">=": return compare(min) >= 0;
    case "<": return compare(min) < 0;
    case ">": if (count === 3) return compare(min) > 0; bump(count - 1); return compare(next) >= 0;
    case "<=": if (count === 3) return compare(min) <= 0; bump(count - 1); return compare(next) < 0;
    case "^": bump(min[0] !== 0 || count === 1 ? 0 : min[1] !== 0 || count === 2 ? 1 : 2); return compare(min) >= 0 && compare(next) < 0;
    case "~": bump(count === 1 ? 0 : 1); return compare(min) >= 0 && compare(next) < 0;
    default: if (count === 3) return compare(min) === 0; bump(count - 1); return compare(min) >= 0 && compare(next) < 0;
  }
}
