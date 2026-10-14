// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Parsing of `grep -n` output lines (`file:lineNo:content`).
 *
 * Two modules had their own: `webhooks/discovery` split on the first two
 * colons, `obsidian` used a lazy regex. They disagree exactly when the FILE
 * NAME contains a colon (`notes/a:b.md:12:text`), where the split version
 * mis-reads the path and drops the hit. This is the lazy form — it anchors on
 * the first `:<digits>:` separator, so it is a strict superset.
 */

export interface GrepLineParts {
  file: string;
  /** Line number, exactly as printed by grep (digits only). */
  lineNo: string;
  content: string;
}

/** Parse `file:lineNo:content`, or `null` when the line is not a grep hit. */
export function parseGrepLine(line: string): GrepLineParts | null {
  const match = /^(.+?):(\d+):(.*)$/.exec(line);
  if (!match || !match[1]) return null;
  return { file: match[1], lineNo: match[2] ?? "", content: match[3] ?? "" };
}
