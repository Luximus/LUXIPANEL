import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({api:vi.fn(),mutation:vi.fn(),data:null as unknown,language:"es",reload:vi.fn()}));
vi.mock("react-native-gesture-handler", () => ({ GestureHandlerRootView: "GestureRoot", ScrollView: "ScrollView" }));
vi.mock("react-native",()=>({View:"View",Text:"Text",TextInput:"Input",ActivityIndicator:"Spinner",ScrollView:"ScrollView"}));
vi.mock("../../api/serverApi",()=>({callServerApi:mocks.api,unwrap:(response:any)=>response.data?.data??response.data}));
vi.mock("../../hooks/useServerApi",()=>({useServerResource:()=>({data:mocks.data,loading:false,error:null,reload:mocks.reload}),runServerMutation:mocks.mutation}));
vi.mock("../../hooks/useTheme",()=>({useTheme:()=>({theme:"dark"})}));
vi.mock("../../theme/colors",()=>({getThemeTokens:()=>({})}));
vi.mock("../../components/ui/ModuleSettingsDrawer",()=>({ModuleSettingsDrawer:"settings-drawer",SettingsColumns:"settings-columns"}));
vi.mock("../../lib/session-state",()=>({loadSessionState:()=>({language:mocks.language})}));
vi.mock("../../components/ui/FormDrawer",()=>({FormDrawer:"sheet"}));
vi.mock("./WorkspaceResultTable",()=>({WorkspaceResultTable:"table"}));
vi.mock("../../components/HtmlView",()=>({HtmlView:"html"}));
vi.mock("../../components/server/Form",()=>({Field:({children,label}:any)=>React.createElement("field",{label},children),Checkbox:"checkbox",ConfirmDialog:"confirm"}));
vi.mock("../../components/ui/Button",()=>({Button:"button"}));
vi.mock("../../components/ui/Select",()=>({Select:"select"}));
vi.mock("../../components/ui/SegmentedControl",()=>({SegmentedControl:"choice"}));
import { NativeOperationCard, NativeResult } from "./NativeOperationCard";
import { NativeModuleContext } from "../main/native-module-context";
import { query } from "./native-extras/operations";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let tree:ReactTestRenderer|undefined;
beforeEach(()=>{mocks.language="es";mocks.data=null;mocks.reload.mockReset();mocks.api.mockReset().mockResolvedValue({ok:true,data:{ok:true,data:{saved:true}}});mocks.mutation.mockReset().mockImplementation(async(_p,_t,fn)=>fn());});
afterEach(async()=>{if(tree)await act(async()=>tree!.unmount());tree=undefined;});
const button=(label:string)=>tree!.root.findAllByType("button" as any).find(node=>node.props.label===label)!;
it("consulta rutas codificadas sin enviar una mutación",async()=>{
 await act(async()=>{tree=create(<NativeOperationCard panelId="box" token="session" title="Buscar" fields={[{key:"q",label:"Consulta",required:true}]} method="GET" path={values=>query("/api/files/search",values)} initial={{q:"a&b # c"}} actionLabel="Consultar"/>);});
 await act(async()=>button("+ Buscar").props.onPress());await act(async()=>button("Consultar").props.onPress());
 expect(mocks.api).toHaveBeenCalledWith("box","session","GET","/api/files/search?q=a%26b+%23+c",undefined);
 expect(mocks.mutation).not.toHaveBeenCalled();
});
it("conserva la configuración leída y convierte campos anidados de números y listas",async()=>{
 mocks.data={untouched:"keep",external:{host:"smtp.example.com",port:25},paths:[]};
 await act(async()=>{tree=create(<NativeOperationCard panelId="box" token="session" title="Config" readPath="/api/config" path="/api/config" fields={[{key:"external.port",label:"Puerto",type:"number"},{key:"paths",label:"Rutas",type:"lines"}]} />);});
 await act(async()=>button("+ Config").props.onPress());
 const inputs=tree!.root.findAllByType("Input" as any);
 await act(async()=>{inputs[0].props.onChangeText("465");inputs[1].props.onChangeText(" /one \n /two \n");});
 await act(async()=>button("Guardar").props.onPress());
 expect(mocks.api.mock.calls[0][4]).toEqual({untouched:"keep",external:{host:"smtp.example.com",port:465},paths:["/one","/two"]});
});
it("no dibuja miles de resultados al abrir un catálogo",async()=>{
 await act(async()=>{tree=create(<NativeResult value={Array.from({length:2800},(_,i)=>`item ${i}`)}/>);});
 expect(JSON.stringify(tree!.toJSON())).not.toContain("item 25");
 await act(async()=>button("Mostrar más (25 de 2800)").props.onPress());
 expect(JSON.stringify(tree!.toJSON())).toContain("item 49");expect(JSON.stringify(tree!.toJSON())).not.toContain("item 50");
});

it("shows workspace configuration in a two-column drawer and embedded settings save without opening another sheet", async()=>{
 mocks.data={fontSize:13,other:"keep"};
 const props={panelId:"box",token:"session",title:"Preferencias",readPath:"/api/preferences",path:"/api/preferences",fields:[{key:"fontSize",label:"Tamaño",type:"number" as const}]};
 await act(async()=>{tree=create(<NativeModuleContext.Provider value={{key:"box:module",visible:true,insideWorkspace:true}}><NativeOperationCard {...props}/></NativeModuleContext.Provider>);});
 expect(tree!.root.findAllByType("sheet" as any)).toHaveLength(0);
 expect(tree!.root.findByType("settings-drawer" as any).props.visible).toBe(false);
 await act(async()=>button("Preferencias").props.onPress());
 expect(tree!.root.findByType("settings-drawer" as any).props.visible).toBe(true);
 expect(tree!.root.findByType("settings-columns" as any).props.sections[0].label).toBe("Preferencias");
 await act(async()=>tree!.update(<NativeModuleContext.Provider value={{key:"box:module",visible:true,insideWorkspace:true}}><NativeOperationCard {...props} embedded/></NativeModuleContext.Provider>));
 expect(tree!.root.findAllByType("settings-drawer" as any)).toHaveLength(0);
 expect(mocks.api).not.toHaveBeenCalled();
 await act(async()=>tree!.root.findByType("Input" as any).props.onChangeText("16"));
 await act(async()=>button("Guardar").props.onPress());
 expect(mocks.api).toHaveBeenCalledWith("box","session","PUT","/api/preferences",{fontSize:16,other:"keep"});
});

it('keeps confirmation and draft on failure, rejects duplicate presses, and allows retry',async()=>{
 let finish!:(value:any)=>void;
 mocks.api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 await act(async()=>{tree=create(<NativeOperationCard embedded panelId="box" token="session" title="Editar" path="/api/config" confirmation="Aplicar" fields={[{key:'name',label:'Nombre',required:true}]} initial={{name:'draft'}}/>);});
 await act(async()=>button('Guardar').props.onPress());
 await act(async()=>{tree!.root.findByType('confirm' as any).props.onConfirm();tree!.root.findByType('confirm' as any).props.onConfirm();});
 expect(mocks.api).toHaveBeenCalledTimes(1);expect(tree!.root.findByType('confirm' as any).props.visible).toBe(true);
 await act(async()=>finish({ok:false,error:'Permiso denegado'}));
 expect(tree!.root.findByType('confirm' as any).props.error).toBe('Permiso denegado');
 expect(tree!.root.findByType('Input' as any).props.value).toBe('draft');
 expect(mocks.reload).not.toHaveBeenCalled();
 await act(async()=>tree!.root.findByType('confirm' as any).props.onConfirm());
 expect(mocks.api).toHaveBeenCalledTimes(2);expect(tree!.root.findByType('confirm' as any).props.visible).toBe(false);
});
it('rejects whitespace required inputs without calling the backend',async()=>{
 await act(async()=>{tree=create(<NativeOperationCard embedded panelId="box" token="session" title="Crear" path="/api/item" fields={[{key:'name',label:'Nombre',required:true}]} initial={{name:'  '}}/>);});
 await act(async()=>button('Guardar').props.onPress());expect(mocks.api).not.toHaveBeenCalled();expect(JSON.stringify(tree!.toJSON())).toContain('Completa Nombre');
});


it.each(['es','en','fr','pt','it','ru','zh','ko','ja','hi','ar'])('localizes the form and errors in %s while retaining API values and the draft',async language=>{
 mocks.language=language;
 const {nativeText}=await import('../../i18n/native-text');
 const {nativeOptionLabel}=await import('../../i18n/native-options');
 const {localizeServerError}=await import('../../lib/server-error-localization');
 mocks.api.mockResolvedValueOnce({ok:false,status:403,error:'Permission denied'});
 await act(async()=>{tree=create(<NativeOperationCard embedded panelId="box" token="session" title="Editar" path="/api/config" fields={[{key:'name',label:'Nombre',required:true},{key:'action',label:'Acción',options:[{key:'enable',label:'enable'},{key:'disable',label:'disable'}]}]} initial={{name:'my-server',action:'enable'}}/>);});
 expect(tree!.root.findAllByType('field' as any)[0].props.label).toBe(nativeText('Nombre'));
 expect(tree!.root.findByType('select' as any).props.options).toEqual([{value:'enable',label:nativeOptionLabel('enable')},{value:'disable',label:nativeOptionLabel('disable')}]);
 await act(async()=>button(nativeText('Guardar')).props.onPress());
 expect(mocks.api).toHaveBeenCalledWith('box','session','PUT','/api/config',{name:'my-server',action:'enable'});
 expect(tree!.root.findByType('Input' as any).props.value).toBe('my-server');
 expect(JSON.stringify(tree!.toJSON())).toContain(localizeServerError('Permission denied'));
 if(language!=='en')expect(tree!.root.findAllByType('Text' as any).flatMap(n=>n.children).join(' ')).not.toContain('Permission denied');
});
