// SPDX-License-Identifier: AGPL-3.0-only
import { publicGithub, CANONICAL_GITHUB } from "../../../shared/github/public-api.js";
import { sanitizePublicText } from "../../../shared/diagnostics/sanitize.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { releaseTranslationBridge, type ReleaseTranslationInput } from "../../../shared/releases/translation-bridge.js";
import { releasesService } from "./releases.service.js";

interface Announcement { number: number; html_url: string; comments: number; pull_request?: unknown }
interface Comment { id: number; body: string; html_url: string; updated_at: string; user: { login: string } | null }
const githubUrl = (url: string) => /^https:\/\/github\.com\/Luxisoft\/LUXIPANEL\/issues\/\d+(?:#issuecomment-\d+)?$/i.test(url);
const locales = new Set(["es", "en", "fr", "de", "it", "pt", "ar", "bn", "hi", "ja", "ko", "ru"]);

export async function releaseDetails(tag: string) {
  const release = await releasesService.publishedRelease(tag);
  let comments: { id: string; body: string; author: string; url: string; updatedAt: string }[] = [];
  let commentsUnavailable = false;
  let discussionUrl: string | undefined;
  try {
    // This label is created by the official publisher, associating discussion with
    // this exact version instead of mixing unrelated reports and contributions.
    const threads = await publicGithub<Announcement[]>(`${CANONICAL_GITHUB}/issues?state=all&labels=${encodeURIComponent(`release:${tag}`)}&per_page=10`);
    const thread = threads.find(row => !row.pull_request && githubUrl(row.html_url));
    if (thread) {
      discussionUrl = thread.html_url;
      const page = Math.max(1, Math.ceil(thread.comments / 10));
      const rows = await publicGithub<Comment[]>(`${CANONICAL_GITHUB}/issues/${thread.number}/comments?per_page=10&page=${page}`);
      comments = rows.filter(row => githubUrl(row.html_url)).map(row => ({ id: String(row.id), body: sanitizePublicText(row.body || "").slice(0, 1200), author: row.user?.login || "GitHub", url: row.html_url, updatedAt: row.updated_at }));
    }
  } catch { commentsUnavailable = true; }
  return { ...release, url: `https://github.com/Luxisoft/LUXIPANEL/releases/tag/${encodeURIComponent(tag)}`, discussionUrl, comments, commentsUnavailable };
}

export async function translatedReleaseDetails(tag: string, locale: unknown, context: Pick<ReleaseTranslationInput, "executor" | "user">) {
  if (typeof locale !== "string" || !locales.has(locale)) throw new ValidationError("Idioma inválido.");
  const original = await releaseDetails(tag);
  const result = await releaseTranslationBridge.translate({ ...context, locale, texts: [original.notes, ...original.comments.map(comment => comment.body)] });
  return { ...original, notes: result.texts[0] ?? original.notes, comments: original.comments.map((comment, index) => ({ ...comment, body: result.texts[index + 1] ?? comment.body })), translation: result.status, locale };
}
