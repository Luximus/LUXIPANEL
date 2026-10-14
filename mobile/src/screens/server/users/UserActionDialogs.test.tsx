import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({api:vi.fn(),reload:vi.fn(),data:[{id:'fingerprint-a',comment:'Fixture key'}],ask:vi.fn()}));
vi.mock('react-native',()=>({View:'View',Text:'Text',Pressable:'Pressable',ScrollView:'ScrollView'}));
vi.mock('expo-clipboard',()=>({setStringAsync:vi.fn()}));
vi.mock('../../../components/ui/FormDrawer',()=>({FormDrawer:'drawer'}));
vi.mock('../../../components/ui/Modal',()=>({Modal:'modal'}));
vi.mock('../../../components/server/ModuleLoading',()=>({ModuleLoading:'loading'}));
vi.mock('../../../components/ui/Input',()=>({Input:'input'}));
vi.mock('../../../components/ui/Button',()=>({Button:'button'}));
vi.mock('../../../components/server/Form',()=>({Field:'field',DialogFooter:'footer',InfoBox:'info'}));
vi.mock('../../../features/app/tabler-icons',()=>({TablerTrash:'trash',TablerCopy:'copy'}));
vi.mock('../../../components/ui/useConfirmation',()=>({useConfirmation:()=>({askConfirmation:mocks.ask,confirmation:null})}));
vi.mock('../../../hooks/useTheme',()=>({useTheme:()=>({theme:'dark'})}));
vi.mock('../../../theme/colors',()=>({getThemeTokens:()=>({}),withAlpha:()=>''}));
vi.mock('../../../lib/session-state',()=>({loadSessionState:()=>({language:'es'})}));
vi.mock('../../../api/serverApi',()=>({callServerApi:mocks.api,unwrap:(r:any)=>r.data}));
vi.mock('../../../hooks/useServerApi',()=>({useServerResource:()=>({data:mocks.data,loading:false,reload:mocks.reload}),runServerMutation:async(_p:any,_t:any,fn:any)=>fn()}));
import {SshKeysDialog} from './UserActionDialogs';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let tree:ReactTestRenderer;
beforeEach(()=>{vi.clearAllMocks();mocks.api.mockResolvedValue({ok:true});});
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());});
const close=vi.fn(),toast=vi.fn();
async function mount(){await act(async()=>{tree=create(<SshKeysDialog panelId="box" token="token" user={{id:1001,username:'linux'}} onClose={close} onToast={toast}/>);});}
it('uses the publicKey body required by LUXIPANEL and reloads after creation',async()=>{
 await mount();await act(async()=>tree.root.findByType('input' as any).props.onChangeText('ssh-ed25519 fixture key'));
 await act(async()=>tree.root.findByType('button' as any).props.onPress());
 expect(mocks.api).toHaveBeenCalledWith('box','token','POST','/api/users/1001/ssh-keys',{publicKey:'ssh-ed25519 fixture key',username:'linux'});expect(mocks.reload).toHaveBeenCalledOnce();expect(close).not.toHaveBeenCalled();expect(tree.root.findByType('input' as any).props.value).toBe('');
});
it('confirms deletion and uses the collection route with keyId, preserving the drawer',async()=>{
 await mount();await act(async()=>tree.root.findByType('Pressable' as any).props.onPress());expect(mocks.api).not.toHaveBeenCalled();
 const action=mocks.ask.mock.calls[0][2].find((v:any)=>v.style==='destructive');await act(async()=>action.onPress());
 expect(mocks.api).toHaveBeenCalledWith('box','token','DELETE','/api/users/1001/ssh-keys',{keyId:'fingerprint-a',username:'linux'});expect(close).not.toHaveBeenCalled();expect(mocks.reload).toHaveBeenCalledOnce();
});
it('keeps the key draft and exposes a permission error without claiming success',async()=>{
 mocks.api.mockResolvedValue({ok:false,error:'Permiso denegado'});await mount();await act(async()=>tree.root.findByType('input' as any).props.onChangeText('ssh-ed25519 fixture'));
 await act(async()=>tree.root.findByType('button' as any).props.onPress());expect(tree.root.findByType('input' as any).props.value).toBe('ssh-ed25519 fixture');expect(JSON.stringify(tree.toJSON())).toContain('No tienes permiso para realizar esta operación.');expect(mocks.reload).not.toHaveBeenCalled();expect(toast).not.toHaveBeenCalled();
});
