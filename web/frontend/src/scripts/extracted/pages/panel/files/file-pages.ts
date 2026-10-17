export type FilePageResult = { ok: boolean; data?: any[]; meta?: { filesList?: { total: number; nextOffset: number; hasMore: boolean } }; error?: string; status?: number; code?: string };
export type FilePageState = { items: any[]; total: number; hasMore: boolean; loading: boolean; error: string | null };
export const FILES_BATCH_SIZE = 50;

/** A listing owns its responses until the directory, target, tab or query changes. */
export function createFilePages(
  context: () => string,
  fetchPage: (offset: number, limit: number) => Promise<FilePageResult>,
  publish: (state: FilePageState, added: any[] | null, replace: boolean) => void,
) {
  let generation = 0, activeContext = "", offset = 0;
  let state: FilePageState = { items: [], total: 0, hasMore: false, loading: false, error: null };
  const stale: FilePageResult = { ok: false, code: "STALE_FILES_LIST" };
  const load = async (replace: boolean): Promise<FilePageResult> => {
    if (!replace && (state.loading || !state.hasMore || context() !== activeContext)) return stale;
    const epoch = replace ? ++generation : generation;
    if (replace) {
      activeContext = context(); offset = 0;
      state = { items: [], total: 0, hasMore: false, loading: false, error: null };
    }
    state = { ...state, loading: true, error: null };
    publish(state, replace ? [] : null, replace);
    try {
      const result = await fetchPage(offset, FILES_BATCH_SIZE);
      if (epoch !== generation || context() !== activeContext) return stale;
      if (!result.ok) {
        state = { ...state, loading: false, error: result.error || "Error" };
        publish(state, null, replace);
        return result;
      }
      const received = Array.isArray(result.data) ? result.data : [];
      const known = new Set(state.items.map(entry => entry.name));
      const added = received.filter(entry => {
        if (known.has(entry.name)) return false;
        known.add(entry.name); return true;
      });
      const page = result.meta?.filesList;
      const nextOffset = page?.nextOffset ?? offset + received.length;
      const hasMore = received.length > 0 && nextOffset > offset && !!page?.hasMore;
      offset = nextOffset;
      state = { items: [...state.items, ...added], total: page?.total ?? received.length, hasMore, loading: false, error: null };
      publish(state, added, replace);
      return result;
    } catch {
      if (epoch !== generation || context() !== activeContext) return stale;
      state = { ...state, loading: false, error: "network" };
      publish(state, null, replace);
      return { ok: false, code: "FILES_NETWORK_ERROR" };
    }
  };
  return {
    first: () => load(true), next: () => load(false), get: () => state,
    cancel: () => { generation++; activeContext = ""; state = { items: [], total: 0, hasMore: false, loading: false, error: null }; },
  };
}
