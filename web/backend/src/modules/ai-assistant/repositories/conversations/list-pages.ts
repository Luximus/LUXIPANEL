import { randomUUID } from "node:crypto";
import { ValidationError } from "../../../../shared/errors/index.js";

type Identified = { id: string | number };
type Snapshot = { scope: string; query: string; ids: string[]; expires: number };

/** A cursor freezes membership/order, never authorization or mutable content. */
export function createConversationPager(now = Date.now, ttl = 5 * 60_000) {
  const snapshots = new Map<string, Snapshot>();
  return function page<T extends Identified>(rows: T[], scope: string, query: string, limit: number, cursor?: string) {
    for (const [key, value] of snapshots) if (value.expires <= now()) snapshots.delete(key);
    let key: string;
    let offset = 0;
    let snapshot: Snapshot | undefined;
    if (cursor) {
      const parts = cursor.split(":");
      key = parts[0] ?? "";
      offset = Number(parts[1]);
      snapshot = snapshots.get(key);
      if (parts.length !== 2 || !Number.isSafeInteger(offset) || offset < 0
        || !snapshot || snapshot.scope !== scope || snapshot.query !== query || offset > snapshot.ids.length) {
        throw new ValidationError("Invalid pagination cursor");
      }
    } else {
      key = randomUUID();
      snapshot = { scope, query, ids: rows.map(row => String(row.id)), expires: now() + ttl };
      // Bound history sessions, including abandoned searches.
      if (snapshots.size >= 128) snapshots.delete(snapshots.keys().next().value!);
      snapshots.set(key, snapshot);
    }
    const current = new Map(rows.map(row => [String(row.id), row]));
    const items: T[] = [];
    while (offset < snapshot.ids.length && items.length < limit) {
      const row = current.get(snapshot.ids[offset++]!);
      if (row) items.push(row);
    }
    const hasMore = snapshot.ids.slice(offset).some(id => current.has(id));
    return {
      items,
      total: snapshot.ids.reduce((n, id) => n + Number(current.has(id)), 0),
      hasMore,
      nextCursor: hasMore ? `${key}:${offset}` : null,
    };
  };
}

export const pageConversations = createConversationPager();
