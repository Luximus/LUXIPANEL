import { createHash } from "node:crypto";
import type { SessionUser } from "../../../shared/types/index.js";
import { dataStore } from "../../../shared/data-store/index.js";
import { localExecutor } from "../../../shared/executor/index.js";
import { publicGithub, publicGithubPages, CANONICAL_GITHUB, githubSince } from "../../../shared/github/public-api.js";
import { repairJobs } from "../../../shared/diagnostics/repair-jobs.js";
import { sanitizePublicText } from "../../../shared/diagnostics/sanitize.js";
interface Thread { id: number; number: number; title: string; html_url: string; updated_at: string; pull_request?: unknown; user: { login: string } }
interface Comment { id: number; body: string; html_url: string; updated_at: string; user: { login: string } }
export interface CommunityActivity { id: string; kind: "announcement" | "comment" | "contribution"; title: string; author: string; url: string; updatedAt: string; read?: boolean }
export function communityPrincipal(user: SessionUser): string {
  return user.tenantId ? `tenant:${user.tenantId}:${user.targetId || ""}:${user.userId}` : user.direct || (user.targetId && user.targetId !== "local") ? `remote:${user.targetId || user.targetHost || ""}:${user.userId}` : `local:${user.userId}`;
}
function state(principal: string) { return dataStore<{ id?: string; since: string; ids: string[] }>(localExecutor, "module-dev", `community-read-${createHash("sha256").update(principal).digest("hex").slice(0, 24)}`, { idStrategy: "uuid" }); }
export async function communityActivity(user: SessionUser, moduleIds: string[] = []) {
  const principal = communityPrincipal(user); const local = principal.startsWith("local:");
  let saved = await state(principal).get("read"); if (!saved) saved = await state(principal).create({ id: "read", since: new Date().toISOString(), ids: [] });
  const items: CommunityActivity[] = []; let error: string | undefined;
  try {
    const announcements = await publicGithub<Thread[]>(`${CANONICAL_GITHUB}/issues?state=all&labels=announcement&sort=updated&per_page=20`);
    const moduleReports = moduleIds.length ? await publicGithub<Thread[]>(`${CANONICAL_GITHUB}/issues?state=all&labels=module-report&sort=updated&since=${encodeURIComponent(githubSince())}&per_page=100`) : [];
    const ownedReports = moduleReports.filter((thread: Thread & { labels?: { name: string }[] }) => thread.labels?.some((label) => label.name.startsWith("module:") && moduleIds.includes(label.name.slice(7))));
    const jobs = local ? await repairJobs.forUser(user.userId) : [];
    const reports = local ? await dataStore<{ issueNumber: number }>(localExecutor, "module-dev", `reports-${user.userId}`, { idStrategy: "uuid" }).list() : [];
    const numbers = new Set<number>([...announcements.map((thread) => thread.number), ...reports.map((report) => report.issueNumber), ...ownedReports.map((thread) => thread.number)]);
    for (const job of jobs) { const number = Number(job.prUrl?.match(/\/pull\/(\d+)$/)?.[1]); if (number) numbers.add(number); }
    for (const number of [...numbers].slice(0, 50)) {
      const thread = announcements.find((entry) => entry.number === number) || await publicGithub<Thread>(`${CANONICAL_GITHUB}/issues/${number}`);
      items.push({ id: `gh-thread-${thread.id}`, kind: announcements.some((entry) => entry.number === number) ? "announcement" : "contribution", title: sanitizePublicText(thread.title), author: thread.user.login, url: thread.html_url, updatedAt: thread.updated_at });
      const comments = await publicGithubPages<Comment>(`${CANONICAL_GITHUB}/issues/${number}/comments?since=${encodeURIComponent(githubSince())}`);
      if (thread.pull_request) {
        const reviews = await publicGithubPages<Comment & { state: string; submitted_at?: string }>(`${CANONICAL_GITHUB}/pulls/${number}/reviews`);
        for (const review of reviews) items.push({ id: `gh-review-${review.id}`, kind: "comment", title: `${review.state}: ${sanitizePublicText(review.body || "").slice(0, 1200)}`, author: review.user.login, url: review.html_url, updatedAt: review.submitted_at || review.updated_at || thread.updated_at });
        const inline = await publicGithubPages<Comment>(`${CANONICAL_GITHUB}/pulls/${number}/comments?since=${encodeURIComponent(githubSince())}`);
        for (const comment of inline) items.push({ id: `gh-review-comment-${comment.id}`, kind: "comment", title: sanitizePublicText(comment.body).slice(0, 1500), author: comment.user.login, url: comment.html_url, updatedAt: comment.updated_at });
      }
      for (const comment of comments) items.push({ id: `gh-comment-${comment.id}`, kind: "comment", title: sanitizePublicText(comment.body).slice(0, 1500), author: comment.user.login, url: comment.html_url, updatedAt: comment.updated_at });
    }
  } catch (cause) { error = String((cause as Error).message).slice(0, 1000); }
  const allowed = items.filter((item) => /^https:\/\/github\.com\/Luxisoft\/LUXIPANEL\/(?:issues|pull)\/\d+(?:#.*)?$/i.test(item.url));
  const unique = [...new Map(allowed.map((item) => [item.id, item])).values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const marked = unique.map((item) => ({ ...item, read: saved!.ids.includes(item.id) || item.updatedAt < saved!.since }));
  return { items: marked.slice(0, 100), unread: marked.filter((item) => !item.read).length, error };
}
export async function markCommunityRead(user: SessionUser, id: string): Promise<void> {
  if (!/^gh-(?:thread|comment|review|review-comment)-\d+$/.test(id)) throw new Error("Identificador de actividad inválido");
  await state(communityPrincipal(user)).transaction(async current => {
    const saved = current.read;
    return { next: saved ? { ...current, read: { ...saved, ids: [...new Set([...saved.ids, id])].slice(-5000) } } : current, result: undefined };
  });
}
