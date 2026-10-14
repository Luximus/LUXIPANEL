vi.mock('react-native-gesture-handler',()=>({GestureHandlerRootView:'GestureRoot',ScrollView:'ScrollView'}));
vi.mock('expo-status-bar',()=>({StatusBar:'StatusBar'}));
vi.mock('../components/login/PixelSnowBackground',()=>({PixelSnowBackground:'Background'}));
vi.mock('../hooks/useAmbientMotion',()=>({useAmbientMotion:()=>false}));
vi.mock('../theme/ThemeTransitionProvider',()=>({ThemeTransitionScope:()=>null}));
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({profiles:[{id:'sa-a',name:'Panel A',baseUrl:'https://a.test',username:'alice',savePassword:false},{id:'sa-b',name:'Panel B',baseUrl:'https://b.test',username:'bob',savePassword:false}],probe:vi.fn(),branding:vi.fn(),add:vi.fn(),activeId:'sa-a',registry:new Map<string,any>(),login:vi.fn(),totp:vi.fn(),saved:vi.fn(),persist:vi.fn(),clear:vi.fn(),call:vi.fn(),unregisterPush:vi.fn(async()=>{}),reset:vi.fn()}));
vi.mock('react-native',()=>({BackHandler:{addEventListener:()=>({remove(){}})},Animated:{View:'AnimatedView',Value:class{constructor(public value:number){} setValue(value:number){this.value=value} interpolate(){return 0}},timing:()=>({start(){},stop(){}})},Easing:{out:(value:any)=>value,cubic:()=>{}},View:'View',Pressable:'Pressable',Text:'Text',TextInput:'TextInput',Modal:'Modal',KeyboardAvoidingView:'KAV',ScrollView:'ScrollView',Image:'Image',ActivityIndicator:'Spinner',StyleSheet:{create:(value:any)=>value,absoluteFill:{},absoluteFillObject:{}},Platform:{OS:'android'},Alert:{alert:vi.fn()}}));
vi.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:24,bottom:20,left:0,right:0})}));
vi.mock('lucide-react-native',()=>Object.fromEntries(['Settings','X','Sun','Moon','Eye','EyeOff','Server','Pencil','Trash2','Check','CheckCircle2','AlertCircle','ArrowRight','ChevronDown','Fingerprint','Globe2','KeyRound','LockKeyhole','ShieldCheck','UserRound','Plus'].map(name=>[name,'Icon'])));
vi.mock('@react-native-async-storage/async-storage',()=>({default:{getItem:async()=> mocks.activeId,setItem:async()=>{}}}));
vi.mock('./main/NativePanelWorkspace',()=>({NativePanelWorkspace:'Workspace'}));
vi.mock('./main/NativeOverlayHost',()=>({NativeOverlayHost:'Overlay',useNativeOverlay:()=>false,OverlayExitingContext:React.createContext(false)}));
vi.mock('../components/ServerCallHost',()=>({ServerCallHost:'Calls'}));
vi.mock('../components/ui/PanelLogo',()=>({PanelLogo:'Logo'}));
vi.mock('../hooks/useTheme',()=>({useTheme:()=>{const [theme,setTheme]=React.useState('dark');return {theme,toggleTheme:()=>setTheme(value=>value==='dark'?'light':'dark')};}}));
vi.mock('../theme/panel-palette',()=>({paletteFromLayout:()=>({}),setActivePalette:()=>{}}));
vi.mock('../theme/colors',()=>({withAlpha:(color:string)=>color,readableTextOn:()=> '#151c2c',getThemeTokens:()=>({bgPrimary:'#181b20',textPrimary:'#fff',textMuted:'#aaa',brand:'#63e6ae'})}));
vi.mock('../lib/session-state',()=>({loadSessionState:()=>({language:'es'}),hydrateSessionState:async()=>({language:'es'}),saveSessionState:async()=>{}}));
vi.mock('../lib/store-reset',()=>({resetAllStores:()=>{mocks.registry.clear();mocks.reset();}}));
vi.mock('../api/serverApi',()=>({getDirect:(id:string)=>mocks.registry.get(id),registerDirectServer:(id:string,value:any)=>mocks.registry.set(id,value),unregisterDirectServer:(id:string)=>mocks.registry.delete(id),onDirectAuthRequired:()=>()=>{},callServerApi:mocks.call}));
vi.mock('../api/directAuth',()=>({probePanel:mocks.probe,publicLayout:mocks.branding,loginStandalone:mocks.login,verifyStandaloneTotp:mocks.totp,refreshStandaloneSession:vi.fn(),normalizePanelProfileUrl:(value:string)=>new URL(/^https?:\/\//i.test(value)?value:`https://${value}`).origin,recoveryStandalone:vi.fn()}));
vi.mock('../api/nativeBrowserAuth',()=>({loginInSystemBrowser:vi.fn()}));
vi.mock('../storage/standaloneServers',()=>({listStandaloneServers:async()=>mocks.profiles,addStandaloneServer:mocks.add,updateStandaloneServer:async()=>{},removeStandaloneServer:vi.fn(),getStandaloneSession:mocks.saved,setStandaloneSession:mocks.persist,clearStandaloneSession:mocks.clear}));
vi.mock('../lib/notifications',()=>({registerForPanelPushNotifications:vi.fn(async()=>{}),unregisterForPanelPushNotifications:mocks.unregisterPush}));
import DirectPanelApp from './DirectPanelApp';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let tree:ReactTestRenderer;
const complete={jwt:'full',csrf:{name:'luxipanel_csrf',value:'csrf'},exp:Date.now()+3600000};
const text=(node:any,label:string)=>node.findAllByType('Text').some((child:any)=>child.children.includes(label));
const press=(label:string)=>tree.root.findAllByType('Pressable' as any).find(node=>node.props.accessibilityLabel===label||text(node,label))!.props.onPress();
const input=(label:string,value:string)=>tree.root.findAllByType('TextInput' as any).find(node=>node.props.accessibilityLabel===label)!.props.onChangeText(value);
async function mount(){await act(async()=>{tree=create(<DirectPanelApp/>);});}
beforeEach(()=>{vi.clearAllMocks();mocks.profiles=[{id:'sa-a',name:'Panel A',baseUrl:'https://a.test',username:'alice',savePassword:false},{id:'sa-b',name:'Panel B',baseUrl:'https://b.test',username:'bob',savePassword:false}];mocks.activeId='sa-a';mocks.probe.mockResolvedValue({password:true,passkey:false,recovery:true});mocks.branding.mockResolvedValue({});mocks.add.mockImplementation(async (value:any)=>{const profile={...value,id:'sa-new'};mocks.profiles.push(profile);return profile;});mocks.registry.clear();mocks.saved.mockResolvedValue(null);mocks.login.mockResolvedValue({status:'ok',session:complete});mocks.call.mockImplementation(async(id:string,_token:string,_method:string,path:string)=>path==='/api/session'?{ok:true,data:{user:{userId:id==='sa-a'?1:2,username:id==='sa-a'?'alice':'bob'}}}:{ok:true});});
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());});
it('requires a full second factor before mounting a workspace or persisting a session',async()=>{
 mocks.login.mockResolvedValueOnce({status:'mfa',partial:{...complete,jwt:'partial'}});
 mocks.totp.mockResolvedValueOnce({status:'ok',session:complete});
 await mount();await act(async()=>{input('Usuario','alice');input('Contraseña','pass');});
 await act(async()=>press('Iniciar sesión'));
 expect(tree.root.findAllByType('Workspace' as any)).toHaveLength(0);expect(mocks.persist).not.toHaveBeenCalled();expect(mocks.registry.size).toBe(0);
 await act(async()=>input('Código de 6 dígitos','123456'));await act(async()=>press('Verificar'));
 expect(tree.root.findByType('Workspace' as any).props.account).toBe('sa-a:1:alice');
 expect(mocks.totp).toHaveBeenCalledWith('https://a.test',expect.objectContaining({jwt:'partial'}),'123456');
 expect(mocks.persist).not.toHaveBeenCalled();expect(mocks.clear).toHaveBeenCalledWith('sa-a');
});
it('does not enter the old profile when its login finishes after a profile change',async()=>{
 let finish:(value:any)=>void=()=>{};mocks.login.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 await mount();await act(async()=>press('Iniciar sesión'));
 await act(async()=>press('Configurar conexión'));await act(async()=>press('Selecciona tu servidor para iniciar sesión.'));await act(async()=>press('Panel B'));
 await act(async()=>finish({status:'ok',session:complete}));
 expect(tree.root.findAllByType('Workspace' as any)).toHaveLength(0);expect(mocks.registry.size).toBe(0);expect(mocks.persist).not.toHaveBeenCalled();
 expect(tree.root.findAllByType('Text' as any).some(node=>node.children.includes('Panel B'))).toBe(true);
});
it('persists the renewed bearer used to validate a saved session',async()=>{
 mocks.saved.mockResolvedValueOnce({...complete,jwt:'old'});
 mocks.call.mockImplementationOnce(async()=>{const target=mocks.registry.get('sa-a');mocks.registry.set('sa-a',{...target,jwt:'renewed'});return {ok:true,data:{user:{username:'alice',userId:1}}};});
 await mount();expect(mocks.persist).toHaveBeenCalledWith('sa-a',expect.objectContaining({jwt:'renewed'}));
 expect(tree.root.findByType('Workspace' as any).props.token).toBe('renewed');
});
it('a late logout never tears down a different profile selected during the request',async()=>{
 await mount();await act(async()=>press('Iniciar sesión'));
 let finish:(value:any)=>void=()=>{};mocks.call.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 await act(async()=>tree.root.findByType('Workspace' as any).props.onLogout());
 await act(async()=>tree.root.findByType('Workspace' as any).props.onManagePanels());
 await act(async()=>press('Selecciona tu servidor para iniciar sesión.'));await act(async()=>press('Panel B'));await act(async()=>press('Iniciar sesión'));
 expect(tree.root.findByType('Workspace' as any).props.account).toBe('sa-b:2:bob');
 await act(async()=>finish({ok:true}));expect(tree.root.findByType('Workspace' as any).props.account).toBe('sa-b:2:bob');
 expect(mocks.registry.get('sa-b')?.jwt).toBe('full');
});

it('preserves the typed credentials when toggling the global theme',async()=>{
 await mount();await act(async()=>{input('Usuario','alice');input('Contraseña','draft-secret');});
 await act(async()=>press('Cambiar tema'));
 expect(tree.root.findByProps({accessibilityLabel:'Usuario'}).props.value).toBe('alice');
 expect(tree.root.findByProps({accessibilityLabel:'Contraseña'}).props.value).toBe('draft-secret');
 expect(mocks.login).not.toHaveBeenCalled();expect(tree.root.findAllByType('Workspace' as any)).toHaveLength(0);
});

it('shows a checkmark and persists the validated session only when remember is selected',async()=>{
 await mount();
 const checkbox=()=>tree.root.findAllByType('Pressable' as any).find(node=>node.props.accessibilityRole==='checkbox')!;
 expect(checkbox().props.accessibilityState.checked).toBe(false);
 await act(async()=>checkbox().props.onPress());expect(checkbox().props.accessibilityState.checked).toBe(true);
 await act(async()=>press('Iniciar sesión'));
 expect(mocks.login).toHaveBeenCalledWith('https://a.test',expect.any(String),expect.any(String),{remember:true});
 expect(mocks.persist).toHaveBeenCalledWith('sa-a',expect.objectContaining({jwt:'full'}));
});

it('uses the bundled logo when the server does not configure a login logo',async()=>{
 await mount();expect(tree.root.findByType('Image' as any).props.source).not.toHaveProperty('uri');
});

it('does not offer a password reset flow on the direct panel login',async()=>{
 await mount();
 expect(tree.root.findAllByType('Text' as any).some(node=>node.children.includes('Olvidé mi contraseña'))).toBe(false);
 expect(tree.root.findAllByProps({accessibilityLabel:'Correo electrónico'})).toHaveLength(0);
 expect(tree.root.findByProps({accessibilityLabel:'Contraseña'})).toBeDefined();
});

it('opens connection fields directly on first launch without a connection modal',async()=>{
 mocks.profiles=[];await mount();
 expect(tree.root.findByProps({testID:'login-connection-form'})).toBeDefined();
 expect(tree.root.findByProps({accessibilityLabel:'Dominio del servidor'}).props.placeholder).toBe('panel.example.com');
 expect(tree.root.findAllByType('Modal' as any).filter(node=>node.props.visible)).toHaveLength(0);
 await act(async()=>input('Dominio del servidor','draft.example'));await act(async()=>press('Configurar conexión'));
 expect(tree.root.findByProps({accessibilityLabel:'Dominio del servidor'}).props.value).toBe('draft.example');
 expect(mocks.login).not.toHaveBeenCalled();
});
it('saves a bare domain then shows login with the saved server selector',async()=>{
 mocks.profiles=[];await mount();
 await act(async()=>{input('Nombre (opcional)','Mi servidor');input('Dominio del servidor','panel.example.org');});
 await act(async()=>press('Guardar y abrir'));
 expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({name:'Mi servidor',baseUrl:'https://panel.example.org'}));
 expect(tree.root.findAllByProps({testID:'login-connection-form'})).toHaveLength(0);
 expect(tree.root.findByProps({accessibilityLabel:'Usuario'})).toBeDefined();
 expect(tree.root.findByProps({accessibilityLabel:'Selecciona tu servidor para iniciar sesión.'})).toBeDefined();
 expect(mocks.login).not.toHaveBeenCalled();
});
it('keeps typed credentials and a single background when returning from inline connection settings',async()=>{
 await mount();await act(async()=>{input('Usuario','draft-user');input('Contraseña','draft-secret');});
 await act(async()=>press('Configurar conexión'));
 expect(tree.root.findByProps({testID:'login-connection-form'})).toBeDefined();
 expect(tree.root.findAllByType('Modal' as any).filter(node=>node.props.visible)).toHaveLength(0);
 expect(tree.root.findAllByType('Background' as any)).toHaveLength(1);
 await act(async()=>press('Volver al inicio de sesión'));
 expect(tree.root.findByProps({accessibilityLabel:'Usuario'}).props.value).toBe('draft-user');
 expect(tree.root.findByProps({accessibilityLabel:'Contraseña'}).props.value).toBe('draft-secret');
});
it('tests the connection without saving it or hiding the inline fields',async()=>{
 mocks.profiles=[];await mount();await act(async()=>input('Dominio del servidor','panel.example.org'));
 await act(async()=>press('Probar conexión'));
 expect(mocks.probe).toHaveBeenCalledWith('https://panel.example.org');expect(mocks.add).not.toHaveBeenCalled();
 expect(tree.root.findByProps({accessibilityLabel:'Dominio del servidor'}).props.value).toBe('panel.example.org');
 expect(tree.root.findByProps({testID:'login-connection-form'})).toBeDefined();
});
it('loads each selected server logo and falls back to the bundled logo on image error',async()=>{
 mocks.branding.mockImplementation(async(base:string)=>({layout_logo_login:base==='https://a.test'?'/branding/a.png':'/branding/b.png'}));
 await mount();expect(tree.root.findByType('Image' as any).props.source).toEqual({uri:'https://a.test/branding/a.png'});
 await act(async()=>press('Selecciona tu servidor para iniciar sesión.'));await act(async()=>press('Panel B'));
 expect(mocks.branding).toHaveBeenCalledWith('https://b.test');expect(tree.root.findByType('Image' as any).props.source).toEqual({uri:'https://b.test/branding/b.png'});
 await act(async()=>tree.root.findByType('Image' as any).props.onError());expect(tree.root.findByType('Image' as any).props.source).not.toHaveProperty('uri');
});
it('keeps a failed connection draft available for correction',async()=>{
 mocks.profiles=[];mocks.probe.mockRejectedValue(new Error('network_error'));await mount();
 await act(async()=>input('Dominio del servidor','offline.example'));await act(async()=>press('Guardar y abrir'));
 expect(mocks.add).not.toHaveBeenCalled();expect(tree.root.findByProps({accessibilityLabel:'Dominio del servidor'}).props.value).toBe('offline.example');
 expect(tree.root.findByProps({testID:'login-connection-form'})).toBeDefined();
});

it('never displays a late logo response from the previous selected server',async()=>{
 let finish!:(value:unknown)=>void;
 mocks.branding.mockImplementation((base:string)=>base==='https://a.test'?new Promise(resolve=>{finish=resolve;}):Promise.resolve({layout_logo_login:'/branding/b.png'}));
 await mount();expect(tree.root.findByType('Image' as any).props.source).not.toHaveProperty('uri');
 await act(async()=>press('Selecciona tu servidor para iniciar sesión.'));await act(async()=>press('Panel B'));
 expect(tree.root.findByType('Image' as any).props.source).toEqual({uri:'https://b.test/branding/b.png'});
 await act(async()=>finish({layout_logo_login:'/branding/a.png'}));
 expect(tree.root.findByType('Image' as any).props.source).toEqual({uri:'https://b.test/branding/b.png'});
});
