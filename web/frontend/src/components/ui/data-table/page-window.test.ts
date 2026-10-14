// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import DataTable from "../DataTable";
import { DATATABLE_EVENTS } from "@/lib/datatable-events";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await act(async () => root.unmount()); document.body.replaceChildren(); localStorage.clear(); });
async function mount(props: Record<string, unknown> = {}) {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host); roots.push(root);
  const render = async (overrides: Record<string, unknown> = {}) => act(async () => root.render(createElement(DataTable, {
    tableId: "test-window", columns: [{id:"name", header:"Nombre", accessorKey:"name", sortable:true}],
    data: Array.from({length:55}, (_, i) => ({id:i, name:`row-${i}`})), pageSizeOptions:[10,20], ...props, ...overrides,
  })));
  await render(); return {host, render};
}
function next(host: HTMLElement) { return Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="Siguiente")!; }
it("keeps event-fed rows when a cached view rerenders with empty props, and accepts an explicit empty feed", async () => {
  const {host,render}=await mount({data:[]});
  await act(async()=>{window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_DATA,{detail:{tableId:"test-window",data:[{id:"build",name:"EAS build"}]}}));});
  await render({data:[]});
  expect(host.querySelector("tbody")!.textContent).toContain("EAS build");
  await act(async()=>{window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_DATA,{detail:{tableId:"test-window",data:[]}}));});
  expect(host.querySelector("tbody")!.textContent).not.toContain("EAS build");
});
it("starts with two pages and makes two more available at each boundary", async () => {
  const {host} = await mount(); const table=()=>host.querySelector('[data-table-id]')!;
  expect(table().getAttribute("data-loaded-pages")).toBe("2");
  expect(host.querySelector("tbody")!.textContent).toContain("row-0");
  await act(async () => next(host).click());
  expect(table().getAttribute("data-loaded-pages")).toBe("4");
  expect(host.querySelector("tbody")!.textContent).toContain("row-10");
  await act(async () => next(host).click()); await act(async () => next(host).click());
  expect(table().getAttribute("data-loaded-pages")).toBe("6");
  await act(async () => next(host).click()); await act(async () => next(host).click());
  expect(next(host).disabled).toBe(true); expect(host.querySelectorAll("tbody tr")).toHaveLength(5);
});
it("requests one batch at the last API page, preserves the current page and stops on an error", async () => {
  const loadMore=vi.fn(); const source={total:55,hasMore:true,loading:false,error:null,onLoadMore:loadMore};
  const {host,render}=await mount({data:Array.from({length:20},(_,id)=>({id,name:`row-${id}`})),pageWindowSource:source});
  expect(loadMore).not.toHaveBeenCalled(); await act(async () => next(host).click()); expect(loadMore).toHaveBeenCalledTimes(1);
  await render({data:Array.from({length:40},(_,id)=>({id,name:`row-${id}`})),pageWindowSource:{...source,loading:false}});
  expect(host.querySelector("tbody")!.textContent).toContain("row-10");
  await act(async () => next(host).click()); await act(async () => next(host).click()); expect(loadMore).toHaveBeenCalledTimes(2);
  await render({data:Array.from({length:40},(_,id)=>({id,name:`row-${id}`})),pageWindowSource:{...source,error:"offline"}});
  expect(host.querySelector('[role="alert"]')!.textContent).toContain("offline"); expect(loadMore).toHaveBeenCalledTimes(2);
});
it("places the unique settings trigger in the module's counter container", async () => {
  const counter=document.createElement("div");document.body.append(counter);
  const {host}=await mount({settingsButtonContainer:counter});
  expect(counter.querySelectorAll('[data-data-table-configure]')).toHaveLength(1);
  expect(host.querySelectorAll('[data-data-table-configure]')).toHaveLength(0);
});
it("accepts an external window without losing its local page navigation", async () => {
  const {host}=await mount({externalPagination:true,serverQuery:true,data:[]});
  await act(async () => {
    window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_DATA,{detail:{tableId:"test-window",data:Array.from({length:20},(_,id)=>({id,name:`row-${id}`}))}}));
    window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_PAGINATION,{detail:{tableId:"test-window",window:true,total:55,hasMore:true,loading:false}}));
  });
  const load=vi.fn();window.addEventListener(DATATABLE_EVENTS.LOAD_MORE,load);
  await act(async () => next(host).click());expect(load).toHaveBeenCalledTimes(1);
  expect(host.querySelectorAll("tbody tr")).toHaveLength(10);window.removeEventListener(DATATABLE_EVENTS.LOAD_MORE,load);
});
