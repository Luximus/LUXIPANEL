import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('react-native',()=>({AppState:{currentState:'active',addEventListener:()=>({remove:()=>{}})}}));
vi.mock('./client/panels',()=>({getPublicPanelBranding:vi.fn()}));
vi.mock('./terminalSession',()=>({ensureDirectPanelSession:vi.fn(async()=>true)}));
import { connectWorkspaceContext, workspaceContextId, retainWorkspaceContext, disposeWorkspaceContext } from './workspaceContext';
import { callServerApi, getDirect, registerDirectServer, unregisterDirectServer, getDirectServerIds, type DirectTarget } from './serverApi';
import { buildTerminalWsUrl } from './client/terminal';
const fetchMock=vi.fn();
const response=(data:unknown,status=200)=>({ok:status===200,status,json:async()=>({ok:status===200,data}),headers:{get:()=> 'application/json'}});
const jwt=(jti:string)=>`x.${btoa(JSON.stringify({sub:'u',username:'u',jti}))}.x`;
const base:DirectTarget={baseUrl:'https://box.test',jwt:jwt('old'),csrf:{name:'csrf',value:'c'},exp:0};
beforeEach(()=>{vi.stubGlobal('fetch',fetchMock);fetchMock.mockReset();registerDirectServer('box',{...base,relogin:async()=>{const fresh={...base,jwt:jwt('new')};registerDirectServer('box',fresh);return fresh;}});});
afterEach(()=>{for(const id of getDirectServerIds())unregisterDirectServer(id);vi.unstubAllGlobals();});
it('partitions two targets on the same panel and sends HTTP and WS bridge scope',async()=>{
 const local=await connectWorkspaceContext('owner','box','account');
 fetchMock.mockResolvedValueOnce(response({bridgeSessionId:'remote-bridge'}));
 const remote=await connectWorkspaceContext('owner','box','account','node');
 expect(local).not.toBe(remote);expect(getDirect(remote)?.bridgeSessionId).toBe('remote-bridge');
 fetchMock.mockResolvedValue(response({token:'short-ticket'}));
 await callServerApi(remote,'account','GET','/api/monitor/status');
 expect(fetchMock.mock.calls.at(-1)?.[1].headers['X-Bridge-Session-Id']).toBe('remote-bridge');
 const url=new URL(await buildTerminalWsUrl(remote,'account',{cols:38,rows:22},'tmux-console'));
 expect(url.searchParams.get('bridge')).toBe('remote-bridge');expect(url.searchParams.get('sessionId')).toBe('tmux-console');
 await callServerApi(local,'account','GET','/api/monitor/status');expect(fetchMock.mock.calls.at(-1)?.[1].headers['X-Bridge-Session-Id']).toBeUndefined();
});
it('does not register a late connection after account navigation cancels it',async()=>{
 let live=true;fetchMock.mockImplementationOnce(async()=>{live=false;return response({bridgeSessionId:'late'});});
 await expect(connectWorkspaceContext('owner','box','account','node',()=>live)).rejects.toThrow('connect_required');
 expect(getDirect(workspaceContextId('owner','box','node'))).toBeUndefined();
});
it('renewal retains remote bridge and removing its parent disposes every child',async()=>{
 const jwt=(jti:string)=>`x.${btoa(JSON.stringify({sub:'u',username:'u',jti}))}.x`;
 registerDirectServer('box',{...base,jwt:jwt('old')});
 const local=await connectWorkspaceContext('owner','box','account');
 registerDirectServer('remote',{...base,jwt:jwt('old'),parentPanelId:'box',bridgeSessionId:'pinned',targetId:'node'});
 registerDirectServer('box',{...base,jwt:jwt('new')});
 expect(getDirect(local)?.jwt).toBe(jwt('new'));expect(getDirect('remote')?.bridgeSessionId).toBe('pinned');
 unregisterDirectServer('box');expect(getDirect(local)).toBeUndefined();expect(getDirect('remote')).toBeUndefined();
});
it('rejects stale data after a bridge is replaced even on the same host and bearer',async()=>{
 registerDirectServer('remote',{...base,parentPanelId:'box',bridgeSessionId:'first'});
 let finish:(value:unknown)=>void=()=>{};fetchMock.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const pending=callServerApi('remote','','GET','/api/monitor/status');
 registerDirectServer('remote',{...base,parentPanelId:'box',bridgeSessionId:'second'});
 finish(response({from:'first'}));expect(await pending).toMatchObject({ok:false,code:'DIRECT_AUTH_REQUIRED'});
});
it('never falls back to local when a remote bridge expires',async()=>{
 registerDirectServer('remote',{...base,parentPanelId:'box',bridgeSessionId:'expired'});
 fetchMock.mockResolvedValue(response({error:'bridge_required'},409));
 const result=await callServerApi('remote','','POST','/api/files/write',{path:'/x',content:'remote'});
 expect(result.ok).toBe(false);expect(fetchMock).toHaveBeenCalledTimes(1);expect(fetchMock.mock.calls[0][1].headers['X-Bridge-Session-Id']).toBe('expired');
});
it('an explicit remote reselection replaces an expired bridge using the saved panel session',async()=>{
 const id=workspaceContextId('owner','box','node');
 registerDirectServer(id,{...base,parentPanelId:'box',bridgeSessionId:'expired',targetId:'node'});
 fetchMock.mockResolvedValueOnce(response({bridgeSessionId:'renewed'}));
 expect(await connectWorkspaceContext('owner','box','account','node')).toBe(id);
 expect(getDirect(id)?.bridgeSessionId).toBe('renewed');
 expect(fetchMock.mock.calls[0][0]).toBe('https://box.test/api/servers/node/switch');
});
it('closing one workspace preserves the context used by another tab',async()=>{
 const id=await connectWorkspaceContext('owner','box','account');
 const first=Symbol(),second=Symbol();retainWorkspaceContext(id,first);retainWorkspaceContext(id,second);
 disposeWorkspaceContext(id,first);expect(getDirect(id)).toBeDefined();
 disposeWorkspaceContext(id,second);expect(getDirect(id)).toBeUndefined();
});

it('keeps the local native bearer and existing terminal when opening a target context', async()=>{
 const relogin=vi.fn();registerDirectServer('sa-local',{...base,relogin});
 const local=await connectWorkspaceContext('alice','sa-local','native-ui');
 fetchMock.mockResolvedValueOnce(response({workspaceContext:true}));
 fetchMock.mockResolvedValueOnce(response({bridgeSessionId:'isolated-target',sessionMode:'context'}));
 const remote=await connectWorkspaceContext('alice','sa-local','native-ui','node');
 expect(relogin).not.toHaveBeenCalled();expect(getDirect(local)?.jwt).toBe(base.jwt);expect(getDirect(remote)?.jwt).toBe(base.jwt);expect(getDirect(remote)?.bridgeSessionId).toBe('isolated-target');
 expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({sessionMode:'context'});
});

it('never rotates the native bearer on an older server without context support', async()=>{
 registerDirectServer('sa-old',{...base});
 fetchMock.mockResolvedValueOnce(response({},404));
 await expect(connectWorkspaceContext('alice','sa-old','native-ui','node')).rejects.toThrow('Update LUXIPANEL');
 expect(fetchMock).toHaveBeenCalledTimes(1);
 expect(fetchMock.mock.calls[0][0]).toBe('https://box.test/api/auth/native/capabilities');
 expect(fetchMock.mock.calls[0][1].method).toBe('GET');
 expect(getDirect('sa-old')?.jwt).toBe(base.jwt);
});
