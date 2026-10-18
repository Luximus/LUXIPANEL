// @vitest-environment happy-dom
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {ModalShell} from "./ModalShell";
import {ModalNavbar} from "./ModalNavbar";
import {useDeferredClose,useModalClose} from "./use-deferred-close";

let root:Root,host:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());vi.useRealTimers();document.body.replaceChildren();});
it("closes a structured consumer once after its animation and names the dialog",async()=>{
 const close=vi.fn();
 await act(async()=>root.render(createElement(ModalShell,{onClose:close,title:createElement("span",null,"Configuración"),closeLabel:"Cerrar",children:"Contenido"})));
 const dialog=document.querySelector('[role="dialog"]')!;
 const id=dialog.getAttribute("aria-labelledby")!;
 expect(id).toBeTruthy();expect(document.getElementById(id)?.textContent).toBe("Configuración");
 await act(async()=>document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click());
 expect(close).not.toHaveBeenCalled();expect(dialog.classList.contains("pointer-events-none")).toBe(true);
 await act(async()=>vi.advanceTimersByTimeAsync(200));expect(close).toHaveBeenCalledTimes(1);
 await act(async()=>vi.advanceTimersByTimeAsync(1000));expect(close).toHaveBeenCalledTimes(1);
});
it("guards custom chrome, footer, backdrop and Escape before an external controller starts closing",async()=>{
 const close=vi.fn();
 function Footer(){const controller=useModalClose();return createElement("button",{onClick:()=>controller?.requestClose(),id:"cancel"},"Cancelar");}
 function Probe({blocked}:{blocked:boolean}){
  const controller=useDeferredClose(close);
  return createElement(ModalShell,{onClose:close,closeDisabled:blocked,closeController:controller,ariaLabel:"Adjuntos",children:[
   createElement(ModalNavbar,{key:"header",title:"Adjuntos",onClose:close,closeLabel:"Cerrar"}),
   createElement(Footer,{key:"footer"}),
  ]});
 }
 await act(async()=>root.render(createElement(Probe,{blocked:true})));
 const dialog=document.querySelector<HTMLElement>('[role="dialog"]')!;
 expect(dialog.getAttribute("aria-label")).toBe("Adjuntos");
 await act(async()=>{
  document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click();
  document.querySelector<HTMLButtonElement>("#cancel")!.click();dialog.click();
  window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}));
  await vi.advanceTimersByTimeAsync(250);
 });
 expect(close).not.toHaveBeenCalled();expect(dialog.classList.contains("pointer-events-none")).toBe(false);
 await act(async()=>root.render(createElement(Probe,{blocked:false})));
 await act(async()=>document.querySelector<HTMLButtonElement>("#cancel")!.click());
 await act(async()=>vi.advanceTimersByTimeAsync(200));expect(close).toHaveBeenCalledTimes(1);
});
it("keeps unique stable heading references across simultaneous dialogs and rerenders",async()=>{
 const view=(title:string)=>createElement("div",null,...[title,"Segundo"].map((name,index)=>createElement(ModalShell,{key:index,onClose:()=>{},title:name,children:"Contenido"})));
 await act(async()=>root.render(view("Primero")));
 const ids=[...document.querySelectorAll('[role="dialog"]')].map(el=>el.getAttribute("aria-labelledby"));
 expect(new Set(ids).size).toBe(2);expect(ids.every(Boolean)).toBe(true);
 await act(async()=>root.render(view("Actualizado")));
 expect([...document.querySelectorAll('[role="dialog"]')].map(el=>el.getAttribute("aria-labelledby"))).toEqual(ids);
 expect(document.getElementById(ids[0]!)?.textContent).toBe("Actualizado");
});
