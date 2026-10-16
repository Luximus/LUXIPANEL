// SPDX-License-Identifier: AGPL-3.0-only
import { CANONICAL_GITHUB, publicGithubPages } from "../../../shared/github/public-api.js";

export interface ProjectContributor { login: string; url: string; avatarUrl: string; contributions: number }
export async function projectContributors(): Promise<{ items: ProjectContributor[]; unavailable: boolean }> {
  try {
    // Public project metadata uses the same cache and request budget as releases.
    const rows = await publicGithubPages<{ login?: unknown; id?: unknown; contributions?: unknown }>(`${CANONICAL_GITHUB}/contributors`);
    const items: ProjectContributor[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row || typeof row.login !== "string" || !/^[a-z\d](?:[a-z\d-]{0,38})(?:\[bot\])?$/i.test(row.login)) continue;
      const key = row.login.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        login: row.login,
        url: `https://github.com/${encodeURIComponent(row.login)}`,
        avatarUrl: typeof row.id === "number" && Number.isSafeInteger(row.id) && row.id > 0 ? `https://avatars.githubusercontent.com/u/${row.id}?s=64&v=4` : "",
        contributions: typeof row.contributions === "number" && Number.isSafeInteger(row.contributions) && row.contributions >= 0 ? row.contributions : 0,
      });
    }
    return { items, unavailable: false };
  } catch { return { items: [], unavailable: true }; }
}
