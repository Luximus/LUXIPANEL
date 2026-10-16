// SPDX-License-Identifier: AGPL-3.0-only
import { publicGithub, CANONICAL_GITHUB } from "../../../shared/github/public-api.js";
import { env } from "../../../config/env.js";
import { AppError, ValidationError } from "../../../shared/errors/index.js";
import { sanitizePublicText } from "../../../shared/diagnostics/sanitize.js";
import { publishedChangeNotes, type PublicChangeNote } from "../../../shared/github/change-notes.js";
import { legacyChangeNotes } from "../../../shared/github/legacy-change-notes.js";

export const BRANCHES = ["main", "developer", "web", "desktop", "mobile", "modules"] as const;
export const validBranch = (value: string): boolean => (BRANCHES as readonly string[]).includes(value);
const SHA = /^[a-f0-9]{40}$/;
export interface PanelBranch { name: string; commit: string; updateAvailable: boolean; ahead: number; error?: string }
export interface BranchDetails extends PanelBranch {
  installable: boolean;
  notes: (PublicChangeNote & { id: string; date: string | null })[];
  notesIncomplete: boolean;
  commits: { sha: string; message: string; author: string; date: string | null; url: string }[];
}
export async function releaseBranches(base?: string): Promise<{ branches: PanelBranch[]; error?: string }> {
  try {
    const rows = await publicGithub<{ name: string; commit: { sha: string } }[]>(`${CANONICAL_GITHUB}/branches?per_page=100`, { maxAgeMs: 300000 });
    if (!Array.isArray(rows)) throw new Error();
    const candidates = BRANCHES.flatMap(name => {
      const row = rows.find(r => r?.name === name && SHA.test(r.commit?.sha));
      return row ? [{ name, commit: row.commit.sha, updateAvailable: false, ahead: 0 } as PanelBranch] : [];
    });
    const branches = await Promise.all(candidates.map(async branch => {
      if (base && SHA.test(base) && base !== branch.commit) {
        try {
          const comparison = await publicGithub<{ ahead_by: number; behind_by: number }>(`${CANONICAL_GITHUB}/compare/${base}...${branch.commit}`);
          if (!Number.isInteger(comparison.ahead_by) || comparison.ahead_by < 0 || !Number.isInteger(comparison.behind_by) || comparison.behind_by < 0) throw new Error("Invalid comparison");
          branch.ahead = comparison.ahead_by;
          branch.updateAvailable = branch.ahead > 0 && comparison.behind_by === 0;
          if (branch.ahead > 0 && comparison.behind_by > 0) branch.error = "Esta rama no incluye todas las mejoras instaladas. Deben integrarse antes de actualizar.";
        } catch { branch.error = "No se pudo comparar esta rama con el código instalado."; }
      }
      return branch;
    }));
    return { branches };
  } catch { return { branches: [], error: "No se pudieron consultar las ramas de GitHub." }; }
}
export async function releaseBranchDetails(name: string, commit: string): Promise<BranchDetails> {
  if (!validBranch(name) || !SHA.test(commit)) throw new ValidationError("Rama o revisión inválida.");
  const catalog = await releaseBranches();
  const branch = catalog.branches.find(b => b.name === name && b.commit === commit);
  if (!branch) throw new AppError("La rama cambió o no está disponible. Actualiza la lista antes de continuar.", 409);
  const rows = await publicGithub<{ sha: string; commit: { message: string; author: { name: string; date: string } } }[]>(`${CANONICAL_GITHUB}/commits?sha=${commit}&per_page=30`);
  let installable = false;
  try {
    const files = await publicGithub<{ name: string; type: string }[]>(`${CANONICAL_GITHUB}/contents/web?ref=${commit}`);
    installable = ["backend", "frontend"].every(name => files.some(f => f.name === name && f.type === "dir")) && files.some(f => f.name === "ecosystem.config.cjs" && f.type === "file");
  } catch (error) {
    // A missing web directory is valid for a component branch. Network failures are not.
    if (!(error instanceof Error && /^GitHub 404:/.test(error.message))) throw new AppError("No se pudo comprobar si esta rama permite actualizar el panel. Reintenta más tarde.", 503);
  }
  const validRows = rows.filter(row => SHA.test(row.sha));
  let notesIncomplete = false;
  const notes = validRows.flatMap(row => {
    const authored = publishedChangeNotes(row.commit.message);
    const entries = authored.length ? authored : legacyChangeNotes[row.sha];
    if (!entries) { notesIncomplete = true; return []; }
    return entries.map((note, index) => ({ ...note, id: row.sha + ":" + index, date: row.commit.author.date || null }));
  });
  return { ...branch, installable, notes, notesIncomplete, commits: validRows.map(row => ({ sha: row.sha,
    message: sanitizePublicText(row.commit.message).slice(0, 2000), author: sanitizePublicText(row.commit.author.name).slice(0, 100),
    date: row.commit.author.date || null, url: `https://github.com/Luxisoft/LUXIPANEL/commit/${row.sha}` })) };
}
/** Mutations revalidate the exact SHA without a cache or stale fallback. */
export async function verifyBranchRevision(name: string, commit: string, installedCommit?: string): Promise<void> {
  if (!validBranch(name) || !SHA.test(commit)) throw new ValidationError("Rama o revisión inválida.");
  if (!installedCommit || !SHA.test(installedCommit)) throw new AppError("No se pudo verificar la revisión instalada. La actualización no se ha iniciado.", 409);
  if (installedCommit === commit) throw new AppError("Esta revisión ya está instalada. No hay cambios pendientes.", 409);
  const response = await fetch(`https://api.github.com${CANONICAL_GITHUB}/branches/${name}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "LUXIPANEL-release-manager", ...(env.LUXIPANEL_GITHUB_TOKEN ? { Authorization: `Bearer ${env.LUXIPANEL_GITHUB_TOKEN}` } : {}) },
    signal: AbortSignal.timeout(10000), redirect: "error",
  }).catch(() => { throw new AppError("GitHub no respondió a tiempo. La actualización no se ha iniciado.", 503); });
  if (!response.ok) throw new AppError("No se pudo verificar la rama en GitHub. La actualización no se ha iniciado.", 503);
  const row = await response.json() as { commit?: { sha?: string } };
  if (row.commit?.sha !== commit) throw new AppError("Hay una revisión más reciente. Revisa los nuevos cambios antes de actualizar.", 409);
  await verifyForwardUpdate(installedCommit, commit);
}

/** Compare immutable commits without stale cache; updates must preserve installed history. */
async function verifyForwardUpdate(installedCommit: string, commit: string): Promise<void> {
  const response = await fetch(`https://api.github.com${CANONICAL_GITHUB}/compare/${installedCommit}...${commit}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "LUXIPANEL-release-manager", ...(env.LUXIPANEL_GITHUB_TOKEN ? { Authorization: `Bearer ${env.LUXIPANEL_GITHUB_TOKEN}` } : {}) },
    signal: AbortSignal.timeout(10000), redirect: "error",
  }).catch(() => { throw new AppError("No se pudo comparar la rama con la instalación. La actualización no se ha iniciado.", 503); });
  if (!response.ok) throw new AppError("No se pudo comparar la rama con la instalación. La actualización no se ha iniciado.", 503);
  const comparison = await response.json() as { ahead_by?: number; behind_by?: number };
  if (!Number.isInteger(comparison.ahead_by) || !Number.isInteger(comparison.behind_by) || comparison.ahead_by! < 0 || comparison.behind_by! < 0)
    throw new AppError("No se pudo verificar la comparación. La actualización no se ha iniciado.", 503);
  if (comparison.ahead_by! <= 0 || comparison.behind_by !== 0)
    throw new AppError("Esta rama no ofrece una actualización que conserve todas las mejoras instaladas. Se mantiene la instalación actual.", 409);
}
