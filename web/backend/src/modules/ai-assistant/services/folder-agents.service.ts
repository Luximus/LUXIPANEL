// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Folder summary for the "propose agents from folder" flow.
 *
 * Reads a compact, read-only picture of a directory ON THE CONNECTED SERVER
 * (shallow file tree + package.json + README head) in a single round-trip, so
 * the LLM can reason about the project's stack and propose a team of agents to
 * manage it. Never mutates the target; fail-open to an empty summary.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { quoteArg } from "../../../shared/executor/index.js";

const SEC = "__LXP_SEC__";

/** Read a `${SEC}<NAME>`-delimited section out of the probe output. */
function section(out: string, name: string): string {
  const tag = `${SEC}${name}`;
  const start = out.indexOf(tag);
  if (start === -1) return "";
  const after = start + tag.length;
  const next = out.indexOf(SEC, after);
  return out.slice(after, next === -1 ? undefined : next).trim();
}

/**
 * Build a compact textual summary of `folderPath` for the agent-proposal LLM.
 * One exec: a depth-3 file tree (node_modules/.git/build dirs pruned) + the head
 * of package.json and README. All sections are capped so the prompt stays small.
 */
export async function summarizeFolder(executor: Executor, folderPath: string): Promise<string> {
  const root = folderPath.replace(/\/+$/, "") || "/";
  const q = quoteArg(root);
  // Single line (managed executor rejects newlines in the command itself); the
  // `\n` inside find's -printf is two chars and is interpreted by find at runtime.
  const cmd =
    `echo ${SEC}TREE; cd ${q} 2>/dev/null && find . -maxdepth 3 ` +
    `\\( -path './node_modules' -o -path './.git' -o -path './dist' -o -path './build' ` +
    `-o -path './.next' -o -path './vendor' -o -path './__pycache__' \\) -prune ` +
    `-o -printf '%y %P\\n' 2>/dev/null | head -300; ` +
    `echo ${SEC}PKG; head -c 4000 ${quoteArg(`${root}/package.json`)} 2>/dev/null; ` +
    `echo ${SEC}README; { head -c 2000 ${quoteArg(`${root}/README.md`)} 2>/dev/null || head -c 2000 ${quoteArg(`${root}/readme.md`)} 2>/dev/null; }`;

  let out = "";
  try {
    const r = await executor.exec(`sh -lc ${quoteArg(cmd)}`, { timeoutMs: 20_000 });
    out = (r.stdout || "").slice(0, 13000);
  } catch {
    out = "";
  }

  const tree = section(out, "TREE");
  const pkg = section(out, "PKG");
  const readme = section(out, "README");
  const parts: string[] = [`Ruta: ${root}`];
  if (tree) parts.push(`Árbol de archivos (hasta 3 niveles):\n${tree.slice(0, 6000)}`);
  if (pkg) parts.push(`package.json (recortado):\n${pkg.slice(0, 3000)}`);
  if (readme) parts.push(`README (recortado):\n${readme.slice(0, 1500)}`);
  return parts.join("\n\n").slice(0, 11000);
}
