import React, { useMemo, useState, useSyncExternalStore } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { createModuleSettingsStore, ModuleSettingsPagesContext, RegisteredModuleSettingsPage, useRegisterModuleSettingsPage } from "./module-settings-pages";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());});

it("edits table state from the shared drawer without remounting the table or looping metadata updates",async()=>{
 const opened=vi.fn(),mounts=vi.fn(),metadataRenders=vi.fn();
 function Table(){
  const [size,setSize]=useState(10);
  React.useEffect(()=>{mounts();},[]);
  const open=useRegisterModuleSettingsPage({key:"users",label:"Usuarios",content:React.createElement("Size",{size,onChange:setSize})});
  return React.createElement("Table",{size,open});
 }
 function Screen(){
  const store=useMemo(()=>createModuleSettingsStore(opened),[]);
  const pages=useSyncExternalStore(store.subscribe,store.pages);
  const [visible,setVisible]=useState(false);
  metadataRenders();
  return <ModuleSettingsPagesContext.Provider value={store}>
    {React.createElement("Screen",{setVisible,keys:pages.map(page=>page.key)},<Table />,
      visible?<RegisteredModuleSettingsPage store={store} pageKey="users"/>:null)}
  </ModuleSettingsPagesContext.Provider>;
 }
 await act(async()=>{tree=create(<Screen/>);});
 expect(tree.root.findByType("Screen" as any).props.keys).toEqual(["users"]);
 await act(async()=>tree.root.findByType("Table" as any).props.open());
 expect(opened).toHaveBeenCalledWith("users");
 await act(async()=>tree.root.findByType("Screen" as any).props.setVisible(true));
 const count=metadataRenders.mock.calls.length;
 await act(async()=>tree.root.findByType("Size" as any).props.onChange(50));
 expect(tree.root.findByType("Table" as any).props.size).toBe(50);
 expect(tree.root.findByType("Size" as any).props.size).toBe(50);
 expect(metadataRenders).toHaveBeenCalledTimes(count);
 await act(async()=>tree.root.findByType("Screen" as any).props.setVisible(false));
 await act(async()=>tree.root.findByType("Screen" as any).props.setVisible(true));
 expect(tree.root.findByType("Size" as any).props.size).toBe(50);
 expect(mounts).toHaveBeenCalledOnce();
});

it("removes settings when the owning table leaves and isolates independent module stores",()=>{
 const first=createModuleSettingsStore(()=>{}), second=createModuleSettingsStore(()=>{});
 const unregister=first.register({key:"rows",label:"Filas",render:()=>null});
 second.register({key:"rows",label:"Otros datos",render:()=>null});
 unregister();
 expect(first.pages()).toEqual([]);
 expect(second.pages().map(page=>page.label)).toEqual(["Otros datos"]);
});
