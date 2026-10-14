export type ConversationMediaItem = {name:string;url:string;mimeType:string};
export function conversationMediaPath(url: string, base: string): string {
  const target = new URL(url, base);
  if (target.origin !== new URL(base).origin || target.username || target.password || target.hash || !target.pathname.startsWith('/api/')) throw new Error('INVALID_MEDIA_ORIGIN');
  return target.pathname + target.search;
}
/** Persisted history stores attachment IDs; live turns may already contain URLs. */
export function conversationMediaItems(rows: unknown[], base: string): ConversationMediaItem[] {
  const items = new Map<string,ConversationMediaItem>();
  for (const row of rows) {
    const attachments = (row as {attachments?: unknown[]})?.attachments;
    if (!Array.isArray(attachments)) continue;
    for (const raw of attachments) {
      if (!raw || typeof raw !== 'object') continue;
      const a = raw as {id?:unknown;url?:unknown;name?:unknown;mimeType?:unknown};
      if (typeof a.name !== 'string') continue;
      const url = typeof a.url === 'string' ? a.url : typeof a.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(a.id) ? `/api/ai/attachments/${encodeURIComponent(a.id)}` : null;
      if (!url) continue;
      try { const path = conversationMediaPath(url,base); items.set(path,{name:a.name,url:path,mimeType:typeof a.mimeType === 'string' ? a.mimeType : 'application/octet-stream'}); } catch { /* Never forward panel credentials to external attachments. */ }
    }
  }
  return [...items.values()];
}
