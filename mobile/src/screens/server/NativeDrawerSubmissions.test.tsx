import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ api: vi.fn(), mail: vi.fn(), cron: vi.fn(), settings: vi.fn(), job: vi.fn() }));
vi.mock('react-native', () => ({ View:'View', Text:'Text', Pressable:'Pressable', ScrollView:'ScrollView', FlatList:'FlatList', ActivityIndicator:'ActivityIndicator', Platform:{OS:'android'}, StyleSheet:{create:(v:unknown)=>v} }));
vi.mock('react-native-gesture-handler', () => ({ ScrollView:'ScrollView' }));
vi.mock('react-native-svg', () => ({default:'svg',Path:'path'}));
vi.mock('expo-clipboard',()=>({}));
vi.mock('../../hooks/useTheme',()=>({useTheme:()=>({theme:'dark'})}));
vi.mock('../../theme/colors',()=>({getThemeTokens:()=>({danger:'red'}),withAlpha:()=>''}));
vi.mock('../../lib/session-state',()=>({loadSessionState:()=>({language:'es'})}));
vi.mock('../../lib/use-live-module-data',()=>({useLiveModuleData:()=>{}}));
vi.mock('../main/native-module-visibility',()=>({useNativeModuleVisible:()=>true}));
vi.mock('../../components/server/module-settings-pages',()=>({useRegisterModuleSettingsPage:()=>{}}));
vi.mock('../../components/server/ModuleLoading',()=>({ModuleLoading:'loading'}));
vi.mock('../../components/ui/ModuleSettingsDrawer',()=>({ModuleSettingsDrawer:({children,footer,...p}:any)=>React.createElement('drawer',p,children,footer)}));
vi.mock('../../components/ui/PanelText',()=>({PanelText:'Text'}));
vi.mock('../../components/ui/Input',()=>({Input:'input'}));
vi.mock('../../components/ui/Button',()=>({Button:'button'}));
vi.mock('../../components/ui/Select',()=>({Select:'select'}));
vi.mock('../../components/ui/Modal',()=>({Modal:'modal'}));
vi.mock('../../components/ui/ConfirmationModal',()=>({ConfirmationModal:'confirm'}));
vi.mock('../../features/app/tabler-icons',()=>Object.fromEntries(['TablerCheck','TablerPlus','TablerTrash','TablerFile','TablerChevronLeft','TablerChevronRight','TablerRefresh'].map(k=>[k,'icon'])));
vi.mock('../../api/serverApi',()=>({callServerApi:io.api,unwrap:(r:any)=>r.data?.data??r.data,withFreshGateway:(f:any)=>f(),withJob:io.job,
 serverMailApi:Object.fromEntries(['createAccount','updateAccount','listForwards','setForwards','createFilter','updateFilter','send'].map(name=>[name,(...args:any[])=>io.mail(name,...args)])),
 serverCronApi:Object.fromEntries(['createJob','updateJob','createAiJob'].map(name=>[name,(...args:any[])=>io.cron(name,...args)])),
 serverSettingsApi:{set:(...args:any[])=>io.settings(...args)}
}));
import {AccountDialog,ForwardsDialog,ComposeDialog} from './mail/mail-ui';
import {FilterDialog,SignatureDialog,ContactDialog,CalendarDialog,FolderDialog,FolderRenameDialog} from './mail/mail-manage-dialogs';
import {JobDialog,AgentDialog} from './cron/cron-dialogs';
import {TokenCredDialog,StorageCredDialog,TotpSetupDialog,AssignImageDialog} from './settings/settings-dialogs';
import {OpDialog,PrivacyDialog,ShareDialog} from './files/files-dialogs';
import {fmtUsage} from './mail/mail-format';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let tree:ReactTestRenderer;
beforeEach(()=>{ for(const fn of Object.values(io))fn.mockReset().mockResolvedValue({ok:true,data:[]});io.job.mockResolvedValue(null); });
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());});
const account={id:7,address:'fixture@example.invalid',quotaMb:512,usedMb:120,enabled:false};
const folder={path:'INBOX/old',name:'old',specialUse:null,messageCount:0,isProtected:false};
const entries:any[]=[
 ['mail account create',AccountDialog,{mode:'create'},['fixture@example.invalid','fixture-password','256'],io.mail,'createAccount'],
 ['mail account edit',AccountDialog,{mode:'edit',row:account},[],io.mail,'updateAccount'],
 ['mail signature',SignatureDialog,{mode:'edit',account,row:{id:4,html:'draft'}},[],io.api,'PUT'],
 ['mail contact',ContactDialog,{mode:'edit',row:{id:4,email:'contact@example.invalid',displayName:'Draft',useCount:0}},[],io.api,'PUT'],
 ['mail calendar',CalendarDialog,{mode:'edit',row:{id:4,name:'Draft',color:'#ffffff',timezone:'UTC',enabled:false}},[],io.api,'PUT'],
 ['mail folder create',FolderDialog,{folders:[]},['Draft'],io.api,'POST'],
 ['mail folder rename',FolderRenameDialog,{folder},['New name'],io.api,'PUT'],
 ['mail filter',FilterDialog,{mode:'edit',row:{id:4,name:'Draft',rules:[{part:'from',match:'contains',value:'fixture'}],actions:[{type:'discard'}]}},[],io.mail,'updateFilter'],
 ['compose',ComposeDialog,{accounts:[account],seed:{to:'recipient@example.invalid',subject:'Draft',body:'Content'}},[],io.mail,'send'],
 ['cron create',JobDialog,{mode:'create'},['0 1 * * *','echo fixture','Draft'],io.cron,'createJob'],
 ['cron edit',JobDialog,{mode:'edit',row:{id:'job-1',schedule:'0 1 * * *',command:'echo fixture',enabled:false}},[],io.cron,'updateJob'],
 ['cron agent',AgentDialog,{},['Draft','0 1 * * *','Fixture prompt'],io.cron,'createAiJob'],
 ['token credentials',TokenCredDialog,{connector:{label:'Test',base:'/api/test',putKey:'token'}},['fixture-token'],io.api,'PUT'],
 ['storage credentials',StorageCredDialog,{provider:'r2',label:'R2',existing:{accountId:'fixture',accessKeyId:'key',hasSecret:true}},[],io.api,'PUT'],
 ['2FA code',TotpSetupDialog,{secret:'fixture'},['123456'],io.api,'POST'],
 ['branding image',AssignImageDialog,{image:{url:'/fixture.svg',name:'Fixture'}},[],io.settings,'set'],
 ...['copy','chmod','chown','compress','extract'].map(kind=>[`files ${kind}`,OpDialog,{kind,entry:{name:'file.txt',path:'/fixture/file.txt',isDir:false}},[kind==='chmod'?'640':kind==='chown'?'fixture':kind==='compress'?'/fixture/archive.tar.gz':'/fixture/new'],io.api,kind==='chmod'||kind==='chown'?'PUT':'POST'])
];
it.each(entries)('%s keeps its draft on denied save, suppresses duplicate presses, and permits retry',async(_label,Component,props,values,transport,operation)=>{
 const saved=vi.fn(),closed=vi.fn(),behindError=vi.fn();
 await act(async()=>{tree=create(<Component panelId="box" token="token" accountId="7" onClose={closed} onSaved={saved} onDone={saved} onAssigned={saved} onSent={saved} onError={behindError} {...props}/>);});
 await act(async()=>values.forEach((value:string,i:number)=>tree.root.findAllByType('input' as any)[i].props.onChangeText(value)));
 const draft=tree.root.findAllByType('input' as any).map(n=>n.props.value);
 const submit=()=>tree.root.findAllByType('button' as any).filter(n=>n.props.loading!==undefined).at(-1)!;
 expect(submit().props.disabled).not.toBe(true);
 let finish!:(r:unknown)=>void;transport.mockClear().mockImplementationOnce(()=>new Promise(r=>{finish=r}));
 await act(async()=>{submit().props.onPress();submit().props.onPress();tree.root.findByType('drawer' as any).props.onClose();});
 expect(transport).toHaveBeenCalledOnce();expect(closed).not.toHaveBeenCalled();
 await act(async()=>finish({ok:false,status:403,error:'Permiso denegado de prueba'}));
 expect(saved).not.toHaveBeenCalled();expect(behindError).not.toHaveBeenCalled();
 expect(tree.root.findAllByType('Text' as any).flatMap(n=>n.children.filter(c=>typeof c==='string')).join(' ')).toContain('No tienes permiso para realizar esta operación.');expect(submit().props.loading).toBe(false);
 expect(tree.root.findAllByType('input' as any).map(n=>n.props.value)).toEqual(draft);
 await act(async()=>submit().props.onPress());expect(transport).toHaveBeenCalledTimes(2);expect(saved).toHaveBeenCalledOnce();
 const call=transport.mock.calls[1];expect(call).toContain(operation==='set'?'box':operation);
 if(_label==='mail account edit'){expect(call.at(-1)).toEqual({quotaMb:512,enabled:false});}
 if(_label==='mail account create'){expect(call.at(-1)).toMatchObject({quotaMb:256});expect(call.at(-1)).not.toHaveProperty('quota');}
 if(_label==='storage credentials')expect(call.at(-1)).not.toHaveProperty('secretAccessKey');
});
it('does not allow failed forward loading to erase the saved forwarding configuration',async()=>{
 io.mail.mockResolvedValueOnce({ok:false,status:403,error:'Cannot load forwards'});
 await act(async()=>{tree=create(<ForwardsDialog panelId="box" token="token" account={account} onClose={()=>{}} onSaved={()=>{}} onError={()=>{}}/>);});
 const save=()=>tree.root.findAllByType('button' as any).find(n=>n.props.loading!==undefined)!;
 expect(save().props.disabled).toBe(true);expect(tree.root.findAllByType('Text' as any).flatMap(n=>n.children.filter(c=>typeof c==='string')).join(' ')).toContain('No se pudo completar la operación. Inténtalo de nuevo.');
 await act(async()=>save().props.onPress());expect(io.mail).toHaveBeenCalledOnce();
 io.mail.mockResolvedValueOnce({ok:true,data:[{destination:'forward@example.invalid',keepCopy:false}]});
 await act(async()=>tree.root.findAllByType('button' as any).find(n=>n.props.label==='Actualizar')!.props.onPress());
 expect(save().props.disabled).toBe(false);
 await act(async()=>save().props.onPress());
 expect(io.mail).toHaveBeenLastCalledWith('setForwards','box','token','7',{forwards:[{destination:'forward@example.invalid',keepCopy:false}]});
});
it.each(['not-a-number','-1','102401','1.5'])('rejects invalid mailbox quota %s without writing',async(quota)=>{
 await act(async()=>{tree=create(<AccountDialog panelId="box" token="token" mode="edit" row={account} onClose={()=>{}} onSaved={()=>{}} onError={()=>{}}/>);});
 await act(async()=>tree.root.findAllByType('input' as any).at(-1)!.props.onChangeText(quota));
 await act(async()=>tree.root.findAllByType('button' as any).at(-1)!.props.onPress());
 expect(io.mail).not.toHaveBeenCalled();expect(tree.root.findAllByType('Text' as any).flatMap(n=>n.children.filter(c=>typeof c==='string')).join(' ')).toContain('102400');
});
it('shows the real mailbox quota and preserves unlimited zero values',()=>{
 expect(fmtUsage(account,'Sin límite')).toBe('120 / 512 MB');expect(fmtUsage({...account,quotaMb:0,quota:512},'Sin límite')).toBe('120 / Sin límite');
});

it.each(['privacy','share'])('%s retains a rejected confirmation and its underlying drawer',async(kind)=>{
 io.api.mockImplementation(async(_p,_t,_method,route)=>({ok:true,data:route.startsWith('/api/files/privacy')?{protected:true,users:['fixture'],enforcement:{enforced:true}}:route==='/api/files/share/roots'?[{root:'/fixture',label:'Fixture'}]:[{id:'share1',path:'/fixture/file',url:'https://example.invalid/s',revoked:false}]}));
 const close=vi.fn();
 await act(async()=>{tree=create(kind==='privacy'?<PrivacyDialog panelId="box" token="token" dir="/fixture" onClose={close} onToast={()=>{}}/>:<ShareDialog panelId="box" token="token" seedPath="/fixture/file" onClose={close} onToast={()=>{}}/>);});
 await act(async()=>tree.root.findAllByType('button' as any).find(n=>n.props.variant==='danger')!.props.onPress());
 const confirmation=()=>tree.root.findByType('confirm' as any);io.api.mockResolvedValueOnce({ok:false,error:'Action denied'});
 await act(async()=>{await expect(confirmation().props.onConfirm()).rejects.toThrow('Action denied');});
 expect(confirmation().props.visible).toBe(true);expect(confirmation().props.submitting).toBe(false);expect(close).not.toHaveBeenCalled();
 expect(tree.root.findByType('drawer' as any)).toBeDefined();
 await act(async()=>confirmation().props.onConfirm());expect(tree.root.findAllByType('confirm' as any)).toHaveLength(0);expect(close).not.toHaveBeenCalled();
});

it.each(['privacy','share'])('%s submits its inline form once and shows errors beside the retained draft',async(kind)=>{
 io.api.mockImplementation(async(_p,_t,_m,route)=>({ok:true,data:route.startsWith('/api/files/privacy')?{protected:false}:route==='/api/files/share/roots'?[{root:'/fixture',domain:'example.invalid'}]:[]}));
 const close=vi.fn(),toast=vi.fn();
 await act(async()=>{tree=create(kind==='privacy'?<PrivacyDialog panelId="box" token="token" dir="/fixture" onClose={close} onToast={toast}/>:<ShareDialog panelId="box" token="token" seedPath="/fixture/file" onClose={close} onToast={toast}/>);});
 if(kind==='privacy')await act(async()=>{const fields=tree.root.findAllByType('input' as any);fields[0].props.onChangeText('fixture');fields[1].props.onChangeText('fixture-password');});
 const draft=tree.root.findAllByType('input' as any).map(n=>n.props.value);
 const submit=()=>tree.root.findAllByType('button' as any).find(n=>n.props.loading!==undefined)!;
 let finish!:(r:any)=>void;io.api.mockClear().mockImplementationOnce(()=>new Promise(r=>{finish=r}));
 await act(async()=>{submit().props.onPress();submit().props.onPress();tree.root.findByType('drawer' as any).props.onClose();});
 expect(io.api).toHaveBeenCalledOnce();expect(close).not.toHaveBeenCalled();
 await act(async()=>finish({ok:false,error:'Not authorized'}));
 expect(tree.root.findAllByType('Text' as any).some(n=>n.children.includes('No tienes permiso para realizar esta operación.'))).toBe(true);expect(toast).not.toHaveBeenCalled();
 expect(tree.root.findAllByType('input' as any).map(n=>n.props.value)).toEqual(draft);expect(submit().props.loading).toBe(false);
 await act(async()=>submit().props.onPress());expect(toast).toHaveBeenCalledOnce();
});
