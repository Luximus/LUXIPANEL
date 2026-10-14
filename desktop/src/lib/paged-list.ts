export type ListPage<T> = { items: T[]; total: number; nextCursor?: string | null; hasMore?: boolean };
export type ListState<T> = ListPage<T> & { loading: boolean; error: unknown };

/** Demand-only pages. Superseded replies cannot modify a new search/session. */
export function createPagedList<T extends { id: string | number }>(
  fetchPage: (request: { limit: number; offset: number; cursor?: string }) => Promise<ListPage<T>>,
  publish: (state: ListState<T>) => void,
  pageSize = 15,
) {
  let generation = 0;
  let state: ListState<T> = { items: [], total: 0, hasMore: false, loading: false, error: null };
  let offset = 0;
  const emit = () => publish({ ...state });
  const load = async (replace: boolean) => {
    if (!replace && (state.loading || !state.hasMore)) return;
    const epoch = replace ? ++generation : generation;
    state = { ...state, loading: true, error: null };
    emit();
    try {
      const page = await fetchPage({ limit: pageSize, offset: replace ? 0 : offset,
        ...(!replace && state.nextCursor ? { cursor: state.nextCursor } : {}) });
      if (epoch !== generation) return;
      offset = (replace ? 0 : offset) + page.items.length;
      const unique = new Map((replace ? [] : state.items).map(item => [String(item.id), item]));
      for (const item of page.items) unique.set(String(item.id), item);
      state = { ...page, items: [...unique.values()], hasMore: page.hasMore ?? (offset < page.total && page.items.length > 0), loading: false, error: null };
    } catch (error) {
      if (epoch !== generation) return;
      state = { ...state, loading: false, error };
    }
    emit();
  };
  return { first: () => load(true), next: () => load(false), cancel: () => { generation++; state = { ...state, loading: false }; }, get: () => state };
}
