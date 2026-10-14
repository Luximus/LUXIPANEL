import type { RequestHandler } from "express";

type Query = { field?: string; catalog?: string[]; offset: number; limit: number; filters?: { key: string; type?: string; value: string }[]; sorting?: { key: string; desc?: boolean }[] };
const read = (row: any, key: string): any => {
  if (key.startsWith("length:")) return read(row,key.slice(7))?.length ?? 0;
  if (key.startsWith("at:")) return "@" + String(read(row,key.slice(3)) ?? "");
  if (key.startsWith("coalesce:")) return key.slice(9).split(",").map(part=>read(row,part)).find(Boolean) ?? "";
  if (key === "webhookStatus") return !row.enabled ? "paused" : Number(row.failureCount)>0 ? "failing" : "active";
  if (key === "serverAuth") return row.authType === "password" ? "password" : "key";
  if (key === "serverStatus") return row.hostFingerprint ? "approved" : row.hostFingerprintPending ? "pending" : "untested";
  if (key === "serverHost") return row.host ? row.port ? `${row.host}:${row.port}` : row.host : "—";
  if (key === "uidGid") return `${row.systemUid ?? "-"} / ${row.systemGid ?? "-"}`;
  return /^[\w.]+$/.test(key) ? key.split(".").reduce((value, part) => value?.[part], row) : undefined;
};

/** Opt-in response paging. Route authentication and authorization still run normally. */
export function sliceTableWindow(body: any, query: Query, actorUsername?: string): any {
  if (!body?.ok || !body.data) return body;
  const field = query.field === "auto" ? (Array.isArray(body.data) ? undefined : ["items", "data", "records", "modules"].find(key => Array.isArray(body.data[key]))) : query.field;
  const rows = field ? read(body.data, field) : body.data;
  if (!Array.isArray(rows)) return body;
  const offset = Math.max(0, Math.floor(Number(query.offset) || 0));
  const limit = Math.min(200, Math.max(1, Math.floor(Number(query.limit) || 20)));
  const facets: Record<string, unknown[]> = {};
  for (const row of rows) for (const [key, value] of Object.entries(row ?? {})) {
    if (["string", "boolean", "number"].includes(typeof value)) {
      const list = facets[key] ??= [];
      if (list.length < 250 && !list.includes(value)) list.push(value);
    }
  }
  const filtered = rows.filter(row => (query.filters ?? []).every(filter => {
    if (!filter.value) return true;
    const actual = String(read(row, filter.key) ?? "").toLocaleLowerCase();
    const expected = String(filter.value).toLocaleLowerCase();
    return filter.type === "gte" ? actual>=expected : filter.type === "lte" ? actual<=expected : filter.type === "select" ? actual === expected : actual.includes(expected);
  }));
  const totals: Record<string,number> = {};
  for (const row of filtered) for (const [key,value] of Object.entries(row)) if(typeof value === "number" && Number.isFinite(value)) totals[key]=(totals[key]??0)+value;
  const sorting = query.sorting ?? [];
  const sorted = filtered.map((row, index) => ({ row, index })).sort((a, b) => {
    for (const sort of sorting) {
      const left = read(a.row, sort.key), right = read(b.row, sort.key);
      const difference = typeof left === "number" && typeof right === "number" ? left - right
        : String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true });
      if (difference) return sort.desc ? -difference : difference;
    }
    return a.index - b.index;
  }).map(item => item.row);
  const items = sorted.slice(offset, offset + limit);
  let data = items as any;
  if (field) {
    data = { ...body.data };
    const parts = field.split("."); let cursor = data;
    for (const part of parts.slice(0, -1)) cursor = cursor[part] = { ...cursor[part] };
    cursor[parts.at(-1)!] = items;
  }
  return { ...body, data, meta: { ...body.meta, tableWindow: {
    catalog: query.catalog?.length ? rows.map(row => Object.fromEntries(query.catalog!.map(key=>[key,read(row,key)]))) : undefined,
    actor: actorUsername ? rows.find(row => row.username === actorUsername) : undefined, field, total: filtered.length, unfilteredTotal: rows.length, offset, limit,
    hasMore: offset + items.length < filtered.length, facets, totals,
  } } };
}

export const tableWindow: RequestHandler = (req, res, next) => {
  const raw = req.query.tableWindow;
  // Only explicitly requested read endpoints use this contract.
  if (typeof raw !== "string" || raw.length > 12000 || (req.method !== "GET" && !/\/expo\/(build-list|env-list|store-credentials)$/.test(req.path))) return next();
  let query: Query;
  try { query = JSON.parse(raw); } catch { return next(); }
  if (!query || typeof query !== "object" || (query.field && !/^[\w.]+$/.test(query.field))
    || (query.field && query.field.split(".").some(part => ["__proto__", "constructor", "prototype"].includes(part)))
    || (query.filters && (!Array.isArray(query.filters) || query.filters.length > 30))
    || (query.sorting && (!Array.isArray(query.sorting) || query.sorting.length > 30))
    || (query.catalog && (!Array.isArray(query.catalog) || query.catalog.length > 15 || query.catalog.some(key=>typeof key!=="string")))
    || query.filters?.some(filter => !filter || typeof filter.key !== "string" || typeof filter.value !== "string")
    || query.sorting?.some(sort => !sort || typeof sort.key !== "string")) return next();
  const json = res.json.bind(res);
  res.json = (body) => json(sliceTableWindow(body, query, res.locals.user?.username));
  next();
};
