// @vitest-environment happy-dom
import {expect,it,vi} from "vitest";
import {mountLegacyTablePages} from "./legacy-table-pages";
import {DATATABLE_EVENTS as E} from "./datatable-events";
it("pages grouped rows without losing their headers, inputs or click handlers",()=>{
 document.documentElement.lang="es";const root=document.createElement("div");root.innerHTML='<table><tbody id="grouped"></tbody></table>';document.body.append(root);const tbody=root.querySelector('tbody')!;
 for(let group=0;group<11;group++){const header=document.createElement('tr');header.dataset.group=String(group);tbody.append(header);for(let i=0;i<5;i++){const row=document.createElement('tr');row.dataset.groupMember=String(group);row.innerHTML='<td><input value="initial"></td>';tbody.append(row);}}
 const row=tbody.querySelectorAll<HTMLTableRowElement>('[data-group-member]')[15]!;const clicked=vi.fn();row.addEventListener('click',clicked);const input=row.querySelector('input')!;input.value='unsaved';
 const dispose=mountLegacyTablePages(root,window),table=root.querySelector('table')!,buttons=root.querySelectorAll<HTMLButtonElement>('button');expect(table.dataset.loadedPages).toBe('2');expect(tbody.querySelectorAll('tr[data-group]:not([hidden])')).toHaveLength(2);
 buttons[2]!.click();expect(table.dataset.loadedPages).toBe('4');expect(table.dataset.pageIndex).toBe('1');row.click();expect(clicked).toHaveBeenCalledTimes(1);expect(input.value).toBe('unsaved');
 dispose();expect(tbody.querySelectorAll('[hidden]')).toHaveLength(0);expect(root.querySelector('[data-legacy-table-pages]')).toBeNull();root.remove();
});
it("requests more on the final loaded page and keeps its index when rows append",async()=>{
 const root=document.createElement('div');root.innerHTML='<table><tbody id="remote"></tbody></table>';document.body.append(root);const tbody=root.querySelector('tbody')!,events=new EventTarget() as Window;const more=vi.fn();events.addEventListener(E.LOAD_MORE,more);
 const rows=(count:number)=>{tbody.innerHTML=Array.from({length:count},(_,id)=>'<tr><td>'+id+'</td></tr>').join('');};rows(20);const dispose=mountLegacyTablePages(root,events);
 events.dispatchEvent(new CustomEvent(E.SET_PAGINATION,{detail:{tableId:'remote',window:true,version:1,total:55,hasMore:true,loading:false}}));root.querySelectorAll<HTMLButtonElement>('button')[2]!.click();expect(more).toHaveBeenCalledTimes(1);
 rows(40);await vi.waitFor(()=>expect(root.querySelector('table')!.dataset.loadedPages).toBe('4'));expect(root.querySelector('table')!.dataset.pageIndex).toBe('1');expect(tbody.querySelector('tr:not([hidden])')!.textContent).toBe('10');dispose();root.remove();
});
