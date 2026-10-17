/** Optional directory windows; unpaged consumers (tree/pickers) keep the full list. */
export type DirectoryPageOptions = {
  limit?: number;
  offset?: number;
  sortKey?: "name" | "type" | "size" | "modified";
  sortDir?: "asc" | "desc";
  showHidden?: "true" | "false";
  query?: string;
};

export function directoryPage<T extends { name: string; isDir: boolean; isHidden?: boolean; type?: string; size?: number; mtime?: unknown }>(
  entries: T[], options: DirectoryPageOptions,
) {
  if (options.limit === undefined) return { data: entries };
  const offset = options.offset ?? 0;
  const direction = options.sortDir === "desc" ? -1 : 1;
  const nameCompare = (a: T, b: T) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  const type = (entry: T) => entry.type === "symlink" ? "symlink" : entry.name.lastIndexOf(".") > 0 ? entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase() : "file";
  const modified = (entry: T) => new Date(entry.mtime as string).getTime() || 0;
  const query = options.query?.trim().toLowerCase() ?? "";
  const sorted = entries.filter(entry => (options.showHidden === "true" || !(entry.isHidden ?? entry.name.startsWith(".")))
    && (!query || entry.name.toLowerCase().includes(query))).sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    const difference = options.sortKey === "size" ? (a.size ?? 0) - (b.size ?? 0)
      : options.sortKey === "modified" ? modified(a) - modified(b)
      : options.sortKey === "type" ? type(a).localeCompare(type(b), undefined, { sensitivity: "base" }) : 0;
    return (difference || nameCompare(a, b)) * direction;
  });
  const data = sorted.slice(offset, offset + options.limit);
  return { data, meta: { filesList: { total: sorted.length, nextOffset: offset + data.length, hasMore: offset + data.length < sorted.length } } };
}
