import { DATATABLE_EVENTS as E } from "./datatable-events";
import {pageWindowLabels} from "./page-window";

/** Preserve vanilla row handlers and full configuration forms while paging rows. */
export function mountLegacyTablePages(root: HTMLElement, events: Window) {
  type Source={version?:number;total:number;hasMore:boolean;loading:boolean;error?:string|null};
  type State={page:number;available:number;rows:HTMLTableRowElement[];footer:HTMLElement;paint:()=>void;requested:number};
  const tables=new Map<HTMLTableElement,State>(), sources=new Map<string,Source>();
  const labels=pageWindowLabels(root.ownerDocument.documentElement.lang);
  const request=(id:string,state:State)=>{const source=sources.get(id);if(!source || source.loading || source.error || !source.hasMore || state.requested===state.rows.length)return;state.requested=state.rows.length;events.dispatchEvent(new CustomEvent(E.LOAD_MORE,{detail:{tableId:id,pageSize:10}}));};
  const refresh=()=>{
    for(const table of root.querySelectorAll<HTMLTableElement>("table")){
      const id=table.tBodies[0]?.id;
      if(table.closest("[data-table-id], [data-infinite-files]") || !id || table.closest('[data-module-id="docs-hosting-api"]'))continue;
      const rows=Array.from(table.tBodies[0].querySelectorAll<HTMLTableRowElement>(":scope > tr")).filter(row=>!row.dataset.group);
      let state=tables.get(table);
      if(!state){
        const footer=root.ownerDocument.createElement("div");footer.dataset.legacyTablePages=id;
        footer.className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs";
        const previous=root.ownerDocument.createElement("button"),next=root.ownerDocument.createElement("button"),retry=root.ownerDocument.createElement("button"),info=root.ownerDocument.createElement("span");
        for(const button of[previous,next,retry]){button.type="button";button.className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40";}
        previous.textContent=labels.previous;next.textContent=labels.next;retry.textContent=labels.retry;footer.append(previous,info,retry,next);table.after(footer);
        state={page:0,available:20,rows:[],footer,paint:()=>{},requested:-1};const current=state;
        current.paint=()=>{
          const source=sources.get(id);
          if(current.page>=Math.ceil(current.available/10)-1 && current.rows.length>current.available)current.available+=20;
          const pages=Math.max(1,Math.ceil(Math.min(current.rows.length,current.available)/10));current.page=Math.min(current.page,pages-1);
          current.rows.forEach((row,index)=>{row.hidden=index<current.page*10 || index>=(current.page+1)*10;});
          for(const header of table.tBodies[0]!.querySelectorAll<HTMLTableRowElement>("tr[data-group]"))header.hidden=!current.rows.some(row=>!row.hidden && row.dataset.groupMember===header.dataset.group);
          previous.disabled=current.page===0;next.disabled=current.page>=pages-1;retry.hidden=!source?.error;retry.disabled=!!source?.loading;
          info.textContent=`${labels.page} ${current.page+1} / ${pages} · ${source?.total ?? current.rows.length}`;info.title=source?.error ?? "";
          footer.hidden=current.rows.length<=10 && !source?.error;
          table.dataset.loadedPages=String(pages);table.dataset.pageIndex=String(current.page);table.setAttribute("aria-busy",String(!!source?.loading));
          if(current.page>=pages-1)request(id,current);
        };
        previous.addEventListener("click",()=>{current.page--;current.paint();});next.addEventListener("click",()=>{current.page++;current.paint();});retry.addEventListener("click",()=>{current.requested=-1;events.dispatchEvent(new CustomEvent(E.LOAD_MORE,{detail:{tableId:id,pageSize:10}}));});
        tables.set(table,state);events.dispatchEvent(new CustomEvent(E.READY,{detail:{tableId:id}}));
      }
      if(rows.length!==state.rows.length || rows.some((row,index)=>row!==state!.rows[index])){
        if(rows.length<state.rows.length){state.page=0;state.available=20;state.requested=-1;}state.rows=rows;state.paint();
      }
    }
    for(const[table,state]of tables)if(!root.contains(table)){state.footer.remove();tables.delete(table);}
  };
  const pagination=(event:Event)=>{const d=(event as CustomEvent).detail;if(!d?.window)return;const before=sources.get(d.tableId);sources.set(d.tableId,d);for(const[table,state]of tables)if(table.tBodies[0]?.id===d.tableId){if(before && before.version!==d.version){state.page=0;state.available=20;state.requested=-1;}state.paint();}};
  events.addEventListener(E.SET_PAGINATION,pagination);
  const observer=new MutationObserver(refresh);observer.observe(root,{childList:true,subtree:true});refresh();
  const dispose=()=>{observer.disconnect();events.removeEventListener(E.SET_PAGINATION,pagination);for(const state of tables.values()){Array.from(state.footer.previousElementSibling?.querySelectorAll<HTMLTableRowElement>("tbody tr")??[]).forEach(row=>{row.hidden=false;});state.footer.remove();}tables.clear();};
  events.addEventListener("lxp:module:dispose",dispose,{once:true});return dispose;
}
