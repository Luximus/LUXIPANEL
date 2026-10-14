// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import { createTablePages } from "./table-pages";
import { DATATABLE_EVENTS as E } from "./datatable-events";

it("appends exactly two pages, deduplicates demands and retries without dropping rows", async () => {
  const events = new EventTarget() as Window;
  const publish = vi.fn(); events.addEventListener(E.SET_PAGINATION, publish);
  const read = vi.fn(async (params: Record<string,string>) => {
    const q = JSON.parse(params.tableWindow!);
    return {ok:true,data:Array.from({length: Math.min(q.limit,55-q.offset)},(_,i)=>({id:q.offset+i})),meta:{tableWindow:{total:55,hasMore:q.offset+q.limit<55}}};
  });
  let pages: ReturnType<typeof createTablePages>;
  let current: any;
  const reload = async () => { current = await pages.read(read); };
  pages = createTablePages({tableId:"a",events,scope:()=>"local",reload});
  await reload(); expect(current.data).toHaveLength(20);
  const demand = () => events.dispatchEvent(new CustomEvent(E.LOAD_MORE,{detail:{tableId:"a",pageSize:10}}));
  demand(); demand(); await vi.waitFor(()=>expect(current.data).toHaveLength(40)); expect(read).toHaveBeenCalledTimes(2);
  read.mockRejectedValueOnce(new Error("offline")); demand(); await vi.waitFor(()=>expect(current.windowFailed).toBe(true));
  expect(current.data).toHaveLength(40); expect((publish.mock.lastCall![0] as CustomEvent).detail.error).toBe("offline");
  demand(); await vi.waitFor(()=>expect(current.data).toHaveLength(55)); demand(); expect(read).toHaveBeenCalledTimes(4);
  expect(read.mock.calls.map(([params])=>JSON.parse(params.tableWindow!).offset)).toEqual([0,20,40,40]);
});

it("applies global queries and discards late replies from a different source", async () => {
  const events = new EventTarget() as Window; let source="a", finish!: (response:any)=>void;
  const read = vi.fn((_params: Record<string,string>) => new Promise<any>(resolve => {finish=resolve;}));
  const pages = createTablePages({tableId:"b", events, scope:()=>source, reload:()=>{}, aliases:{name:"displayName"}});
  const pending = pages.read(read); source="b";
  finish({ok:true,data:[{id:1}]}); expect((await pending).code).toBe("TARGET_SCOPE_CHANGED");
  events.dispatchEvent(new CustomEvent(E.QUERY,{detail:{tableId:"b",pageSize:20,filterDefinitions:[{key:"name",type:"text",value:"z"}],sortDefinitions:[{key:"name",desc:true}]}}));
  const next=pages.read(read); const query=JSON.parse(read.mock.calls[1]![0]!.tableWindow);
  expect(query).toMatchObject({offset:0,limit:40,filters:[{key:"displayName",value:"z"}],sorting:[{key:"displayName",desc:true}]});
  finish({ok:true,data:[],meta:{tableWindow:{total:0,hasMore:false}}}); expect((await next).data).toEqual([]);
});


it("uses scoped preferences and preserves native controller filter translations",async()=>{
 document.body.innerHTML='<a id="messenger-link" data-me="admin"></a><select id="sidebar-server-switcher" data-current-target-id="remote"></select>';
 localStorage.setItem('lxp:prefs:admin:remote:data-table:hosting-accounts-table',JSON.stringify({pageSize:25}));
 const read=vi.fn(async(params:Record<string,string>)=>({ok:true,data:[],meta:{total:0}}));
 const pages=createTablePages({tableId:'hosting-accounts-table',events:window,scope:()=>"remote",reload:()=>{},native:'page',queryHandled:true});
 await pages.read(read);expect(read.mock.calls[0]?.[0]).toMatchObject({limit:'25',offset:'0',page:'1'});
 window.dispatchEvent(new CustomEvent(E.QUERY,{detail:{tableId:'hosting-accounts-table',pageSize:25,filterDefinitions:[{key:'estado',type:'select',value:'Activa'}],sortDefinitions:[{key:'creado',desc:true}]}}));
 await pages.read(read);expect(read.mock.calls[1]?.[0]).not.toHaveProperty('estado');expect(read.mock.calls[1]?.[0]).not.toHaveProperty('sortBy');
 localStorage.clear();document.body.innerHTML='';
});


it("fetches two native pages within the API limit and appends the next two",async()=>{
 const events=new EventTarget() as Window;let current:any,pages:ReturnType<typeof createTablePages>;
 const read=vi.fn(async(params:Record<string,string>)=>{const size=Number(params.limit),offset=(Number(params.page)-1)*size;expect(size).toBeLessThanOrEqual(100);return {ok:true,data:{items:Array.from({length:Math.min(size,250-offset)},(_,i)=>({id:offset+i})),total:250}};});
 const reload=async()=>{current=await pages.read(read);};pages=createTablePages({tableId:'native',events,scope:()=>"local",reload,native:'page',field:'items'});
 events.dispatchEvent(new CustomEvent(E.QUERY,{detail:{tableId:'native',pageSize:100}}));await vi.waitFor(()=>expect(current?.data.items).toHaveLength(200));
 events.dispatchEvent(new CustomEvent(E.LOAD_MORE,{detail:{tableId:'native',pageSize:100}}));await vi.waitFor(()=>expect(current.data.items).toHaveLength(250));expect(read.mock.calls.map(([params])=>params.page)).toEqual(['1','2','3']);
});

it("retries a stale native window using valid page limits",async()=>{
 const events=new EventTarget() as Window;
 const read=vi.fn(async(params:Record<string,string>)=>{expect(Number(params.limit)).toBeLessThanOrEqual(100);const offset=(Number(params.page)-1)*Number(params.limit);return {ok:true,data:{items:Array.from({length:100},(_,i)=>({id:offset+i})),total:250}};});
 read.mockResolvedValueOnce({ok:false,code:'TARGET_SCOPE_CHANGED'} as any);
 const pages=createTablePages({tableId:'retry-native',events,scope:()=>"local",reload:()=>{},native:'page',field:'items'});
 events.dispatchEvent(new CustomEvent(E.QUERY,{detail:{tableId:'retry-native',pageSize:100}}));
 const result=await pages.read(read);expect(result.data?.items).toHaveLength(200);expect(read.mock.calls.map(([params])=>params.page)).toEqual(['1','1','2']);
});


it("keeps the loaded process window and version across periodic snapshots",async()=>{
 const events=new EventTarget() as Window;const publish=vi.fn();events.addEventListener(E.SET_PAGINATION,publish);let current:any,pages:ReturnType<typeof createTablePages>;
 const read=vi.fn(async(params:Record<string,string>)=>{const q=JSON.parse(params.tableWindow);return {ok:true,data:{processes:Array.from({length:Math.min(q.limit,55-q.offset)},(_,i)=>({id:q.offset+i}))},meta:{tableWindow:{total:55,hasMore:q.offset+q.limit<55}}};});
 const reload=async()=>{current=await pages.read(read);};pages=createTablePages({tableId:'processes',events,scope:()=>"local",reload,field:'processes',refreshSnapshot:true});
 await reload();events.dispatchEvent(new CustomEvent(E.LOAD_MORE,{detail:{tableId:'processes',pageSize:10}}));await vi.waitFor(()=>expect(current.data.processes).toHaveLength(40));const version=publish.mock.lastCall![0].detail.version;
 await reload();expect(current.data.processes).toHaveLength(40);expect(publish.mock.lastCall![0].detail.version).toBe(version);expect(JSON.parse(read.mock.lastCall![0].tableWindow)).toMatchObject({offset:0,limit:40});
 events.dispatchEvent(new CustomEvent(E.QUERY,{detail:{tableId:'processes',pageSize:20}}));await vi.waitFor(()=>expect(publish.mock.lastCall![0].detail.version).toBeGreaterThan(version));
});


it("preserves pools with the same name in different configuration files",async()=>{
 const events=new EventTarget() as Window;let current:any,pages:ReturnType<typeof createTablePages>;
 const rows=Array.from({length:55},(_,i)=>({name:'shared-pool',file:'/config/'+i}));
 const read=async(params:Record<string,string>)=>{const q=JSON.parse(params.tableWindow!);return {ok:true,data:rows.slice(q.offset,q.offset+q.limit),meta:{tableWindow:{total:55,hasMore:q.offset+q.limit<55}}};};
 const reload=async()=>{current=await pages.read(read);};pages=createTablePages({tableId:'pools',events,scope:()=>"local",reload,rowKey:row=>JSON.stringify([row.name,row.file])});
 await reload();expect(current.data).toHaveLength(20);events.dispatchEvent(new CustomEvent(E.LOAD_MORE,{detail:{tableId:'pools',pageSize:10}}));await vi.waitFor(()=>expect(current.data).toHaveLength(40));
});
