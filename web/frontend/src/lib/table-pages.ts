import { DATATABLE_EVENTS as E } from "./datatable-events";

type Response<T> = { ok: boolean; data?: T; error?: string; meta?: any; [key: string]: any };
const scopedTables=new Set(["cf-dns-table","cf-access-table","hosting-accounts-table","db-rows-table","db-structure-table","db-console-table","expo-builds-table","expo-store-table","expo-env-table","gateway-table","gw-detected-table","webhooks-table","apikeys-table","discovered-table","module-dev-table"]);
export function readTablePageSize(events:Window,tableId:string,defaultSize=10){
  try{const user=events.document.getElementById("messenger-link")?.getAttribute("data-me")||"anonymous",target=events.document.getElementById("sidebar-server-switcher")?.getAttribute("data-current-target-id")||events.sessionStorage.getItem("panel-active-target-scope")||"local";
    const key=scopedTables.has(tableId)?`lxp:prefs:${encodeURIComponent(user)}:${encodeURIComponent(target)}:data-table:${tableId}`:`lxp:data-table:prefs:${tableId}`;
    const size=Number(JSON.parse(events.localStorage.getItem(key)??"{}").pageSize);return [10,20,25,50,100].includes(size)?size:defaultSize;
  }catch{return defaultSize;}
}

type Definition = { tableId: string; events: Window; scope: () => string; reload: () => unknown;
  refreshSnapshot?: boolean; native?: "page"|"sql"; queryHandled?: boolean; nativeFilters?: Record<string,string>; deduplicate?: boolean;
  field?: string; catalog?: string[]; aliases?: Record<string, string>; values?: (() => Record<string, Record<string, string>>) | Record<string, Record<string, string>>;
  rowKey?: (row: any) => string; };

/** One reader per table/root. Appends never move the visible page. */
export function createTablePages(definition: Definition) {
  const { tableId, events, scope, reload, field, aliases = {}, values = {} } = definition;
  let pageSize = readTablePageSize(events,tableId), preferenceScope=scope();
  let epoch = 0, pending = false, append = false, context = "";
  let nextOffset = 0, version = 0;
  let rows: any[] = [], total = 0, hasMore = false, error: string | null = null;
  let last: Response<any> | null = null;
  let totals: Record<string,number> = {};
  let nativeColumns:string[]=[];
  let filters: any[] = [], sorting: any[] = [];
  const emit = () => {
    events.dispatchEvent(new CustomEvent(E.SET_LOADING,{detail:{tableId,loading:pending && !rows.length}}));
    return events.dispatchEvent(new CustomEvent(E.SET_PAGINATION, { detail: {
    tableId, window: true, version, serverQuery: true, total, totals, hasMore, loading: pending, error,
  } }));
  };
  const bind = (type: string, handler: (detail: any) => void) => events.addEventListener(type, event => {
    const detail = (event as CustomEvent).detail;
    if (detail?.tableId === tableId) handler(detail);
  });
  bind(E.READY, emit);
  bind(E.LOAD_MORE, detail => {
    if (pending || (!hasMore && !error)) return;
    pageSize = detail.pageSize || pageSize; append = rows.length > 0; void reload();
  });
  bind(E.QUERY, detail => {
    preferenceScope=scope();
    const previous = JSON.stringify([pageSize, filters, sorting]);
    pageSize = detail.pageSize || pageSize;
    const translated = typeof values === "function" ? values() : values;
    filters = (detail.filterDefinitions ?? []).filter((filter: any) => filter.value).map((filter: any) => ({
      ...filter, key: aliases[filter.key] ?? filter.key,
      value: translated[filter.key]?.[filter.value] ?? filter.value,
    }));
    sorting = (detail.sortDefinitions ?? []).map((sort: any) => ({ ...sort, key: aliases[sort.key] ?? sort.key }));
    if (previous === JSON.stringify([pageSize, filters, sorting])) return;
    epoch++; append = false; pending = false; context=""; if(!definition.queryHandled)void reload();
  });
  events.addEventListener("lxp:module:dispose", () => { epoch++; pending = false; context = ""; });

  return { get rows(){return rows;}, get catalog(){return last?.meta?.tableWindow?.catalog;}, get actor(){return last?.meta?.tableWindow?.actor;}, async read<T>(fetch: (params: Record<string, string>) => Promise<Response<T>>, key = ""): Promise<Response<T>> {
    if(preferenceScope!==scope()){preferenceScope=scope();pageSize=readTablePageSize(events,tableId);}
    const nextContext = `${scope()}:${key}`;
    const extending = append && nextContext === context;
    const refreshing = !append && definition.refreshSnapshot && nextContext===context && !!last;
    const requestSize = refreshing ? Math.min(200,Math.max(pageSize*2,nextOffset)) : pageSize*2;
    append = false; context = nextContext;
    const generation = ++epoch;
    if (!extending && !refreshing) { version++; rows = []; nextOffset = 0; hasMore = false; total = 0; last = null; }
    pending = true; error = null; emit();
    const offset = extending ? nextOffset : 0;
    try {
      const params: Record<string,string> = definition.native ? {limit:String(pageSize*2),page:String(Math.floor(offset/(pageSize*2))+1),offset:String(offset)}
        : {tableWindow:JSON.stringify({field,catalog:definition.catalog,offset,limit:requestSize,filters,sorting})};
      if(definition.native && !definition.queryHandled) {
        for(const filter of filters)params[definition.nativeFilters?.[filter.key] ?? filter.key]=filter.value;
        const sort=sorting[0];
        if(sort){params.sortBy=definition.native==="sql" && /^c\d+$/.test(sort.key) ? nativeColumns[Number(sort.key.slice(1))] ?? sort.key : sort.key;params.sortDir=sort.desc ? "desc" : "asc";}
      }
      const fetchWindow=async ():Promise<Response<any>>=>{
      let result: Response<any>|undefined;
      if(definition.native === "page") {
        let batch:any[]=[];
        for(let page=0;page<2;page++) {
          const response:Response<any>=await fetch({...params,limit:String(pageSize),page:String(Math.floor(offset/pageSize)+page+1)});
          if(!response.ok || response.code==="TARGET_SCOPE_CHANGED"){result=response;break;}
          if(generation!==epoch || nextContext!==`${scope()}:${key}`)return {ok:false,code:"TARGET_SCOPE_CHANGED",status:409};
          const actual=field && field!=="auto" ? field : Array.isArray(response.data) ? undefined : ["items","data","records","modules"].find(key=>Array.isArray(response.data?.[key]));
          const chunk=actual ? response.data?.[actual] : response.data;
          if(!Array.isArray(chunk))throw new Error("Respuesta de tabla inválida");
          batch.push(...chunk);
          result={...response,data:actual ? {...response.data,[actual]:batch}:batch};
          const count=response.meta?.total ?? response.data?.total ?? 0;
          if(chunk.length<pageSize || (count && offset+batch.length>=count))break;
        }
      } else result=await fetch(params);
      if(!result)throw new Error("Respuesta de tabla inválida");
      return result;
      };
      let result=await fetchWindow();
      for(let attempt=0;attempt<2 && result.code === "TARGET_SCOPE_CHANGED" && generation===epoch && nextContext===`${scope()}:${key}`;attempt++){
        await new Promise(resolve=>globalThis.setTimeout(resolve,100));
        result=await fetchWindow();
      }
      if (generation !== epoch || nextContext !== `${scope()}:${key}`) return { ok: false, code: "TARGET_SCOPE_CHANGED", status: 409 };
      if (!result.ok) throw new Error(result.error ?? "Error al cargar datos");
      const actualField = field === "auto" ? result.meta?.tableWindow?.field ?? (Array.isArray(result.data) ? undefined : ["items", "data", "records", "modules"].find(key => Array.isArray((result.data as any)?.[key]))) : field;
      const items = actualField ? (result.data as any)?.[actualField] : result.data;
      if (!Array.isArray(items)) throw new Error("Respuesta de tabla inválida");
      const metadata = result.meta?.tableWindow ?? (definition.native ? {
        total: result.meta?.total ?? (result.data as any)?.total ?? items.length,
        hasMore: offset+items.length < (result.meta?.total ?? (result.data as any)?.total ?? items.length),
      } : undefined);
      nativeColumns=(result.data as any)?.columns ?? nativeColumns;
      totals={...metadata?.totals};
      for (const [display,raw] of Object.entries(aliases)) if(totals[raw]!==undefined) totals[display]=totals[raw]!;
      // Compatibility while an older backend is rolling over: slice the snapshot.
      const received = metadata ? items : items.slice(offset, offset + requestSize);
      const merged = extending ? [...rows] : [];
      const rowKey = definition.rowKey ?? ((row: any) => String(row.id ?? row._id ?? row.code ?? row.name ?? row.address ?? JSON.stringify(row)));
      const known = new Map(merged.map((row, index) => [rowKey(row), index]));
      for (const row of received) {
        const id = rowKey(row), index = definition.deduplicate === false ? undefined : known.get(id);
        if (index === undefined) { known.set(id, merged.length); merged.push(row); } else merged[index] = row;
      }
      nextOffset = offset + received.length;
      rows = merged; total = metadata?.total ?? items.length;
      hasMore = received.length > 0 && (metadata?.hasMore ?? offset + received.length < total);
      last = { ...result, data: actualField ? { ...result.data, [actualField]: rows } : rows };
      return last;
    } catch (caught) {
      if (generation !== epoch) return { ok: false, code: "TARGET_SCOPE_CHANGED", status: 409 };
      error = caught instanceof Error ? caught.message : String(caught);
      // Keep existing rows and row actions usable after a failed append.
      return last ? { ...last, windowFailed: true } : { ok: false, error };
    } finally {
      if (generation === epoch) { pending = false; emit(); }
    }
  } };
}
