// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/** Lexical POSIX directory comparison for the project picker, not a permission check. */
function directory(path: string): string | null {
  if (!path.startsWith("/") || path.includes("\0")) return null;
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

/** Modules may share their parent's folder; sibling/prefix-lookalike folders are excluded. */
export function isProjectPathWithinRoot(candidate: string, root: string): boolean {
  const parent = directory(root);
  const child = directory(candidate);
  return parent !== null && child !== null
    && (parent === "/" || child === parent || child.startsWith(`${parent}/`));
}
