import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,expect,it,vi} from 'vitest';
const events=vi.hoisted(()=>({subscribe:vi.fn()}));
vi.mock('../api/serverApi',()=>({unwrap:(r:any)=>r.data,withFreshGateway:(f:any)=>f(),withJob:vi.fn()}));
vi.mock('../lib/use-live-module-data',()=>({useLiveModuleData:events.subscribe}));
vi.mock('../screens/main/native-module-visibility',()=>({useNativeModuleVisible:()=>true}));
import {useServerResource} from './useServerApi';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let tree:ReactTestRenderer,state:ReturnType<typeof useServerResource<string>>;
function Resource({panel,load}:{panel:string;load:any}){state=useServerResource<string>(load,[panel]);return null;}
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());vi.clearAllMocks();});
it('ignores a delayed response from a previously selected server',async()=>{
 let finish!:(r:any)=>void;const old=()=>new Promise(r=>{finish=r});
 await act(async()=>{tree=create(<Resource panel="old" load={old}/>);});
 await act(async()=>tree.update(<Resource panel="new" load={async()=>({ok:true,data:'new server'})}/>));
 await act(async()=>finish({ok:true,data:'old server'}));expect(state.data).toBe('new server');expect(state.loading).toBe(false);
});
it('keeps the latest explicit refresh when responses arrive out of order',async()=>{
 const load=vi.fn().mockResolvedValue({ok:true,data:'initial'});
 await act(async()=>{tree=create(<Resource panel="one" load={load}/>);});
 let finish!:(r:any)=>void;load.mockImplementationOnce(()=>new Promise(r=>{finish=r}));let old!:Promise<void>;
 await act(async()=>{old=state.reload();});load.mockResolvedValueOnce({ok:true,data:'latest'});
 await act(async()=>state.reload());await act(async()=>{finish({ok:false,error:'stale error'});await old;});
 expect(state.data).toBe('latest');expect(state.error).toBeNull();
});
it.each([{ok:false,code:'DIRECT_AUTH_REQUIRED'}, {ok:false,status:403,error:'Forbidden'}])('clears protected data when access is lost (%j)',async(response)=>{
 const load=vi.fn().mockResolvedValueOnce({ok:true,data:'protected',liveResource:{serverId:'one',resource:'users'}}).mockResolvedValue(response);
 await act(async()=>{tree=create(<Resource panel="one" load={load}/>);});expect(state.data).toBe('protected');
 await act(async()=>state.reload());expect(state.data).toBeNull();expect(state.loading).toBe(false);expect(events.subscribe.mock.calls.at(-1)?.[0]).toBe('');
});
it('drops the old live subscription when changing to a server without live metadata',async()=>{
 await act(async()=>{tree=create(<Resource panel="one" load={async()=>({ok:true,data:'one',liveResource:{serverId:'one',resource:'users'}})}/>);});
 await act(async()=>tree.update(<Resource panel="two" load={async()=>({ok:true,data:'two'})}/>));
 expect(events.subscribe.mock.calls.at(-1)?.[0]).toBe('');expect(state.data).toBe('two');
});
it('preserves loaded data on a transient network error and recovers on retry',async()=>{
 const load=vi.fn().mockResolvedValueOnce({ok:true,data:'cached'}).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ok:true,data:'fresh'});
 await act(async()=>{tree=create(<Resource panel="one" load={load}/>);});await act(async()=>state.reload());
 expect(state.data).toBe('cached');expect(state.error).toBe('offline');expect(state.loading).toBe(false);
 await act(async()=>state.reload());expect(state.data).toBe('fresh');expect(state.error).toBeNull();
});
