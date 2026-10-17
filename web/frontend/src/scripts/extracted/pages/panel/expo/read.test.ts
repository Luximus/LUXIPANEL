import {beforeEach,describe,it,expect,vi} from 'vitest';
const scope=vi.hoisted(()=>({target:'local'}));
vi.mock('/scripts/extracted/lib/api-client.js?v=20260506a',()=>({resolveTargetScope:()=>scope.target}));
import {readExpoData} from './read';
import {S} from './state';
describe('Expo read recovery',()=>{
 beforeEach(()=>{document.body.innerHTML='<div id="expo-root"></div>';S.targetGeneration=0;scope.target='local';});
 const canceled={ok:false,code:'TARGET_SCOPE_CHANGED',status:409};
 it('recovers a canceled hydration read',async()=>{
  const read=vi.fn().mockResolvedValueOnce(canceled).mockResolvedValue({ok:true,status:200,data:{tokenSet:true}});
  expect((await readExpoData(read)).data).toEqual({tokenSet:true});expect(read).toHaveBeenCalledTimes(2);
 });
 it('bounds retries and does not retry API errors',async()=>{
  const read=vi.fn().mockResolvedValue(canceled);await readExpoData(read);expect(read).toHaveBeenCalledTimes(3);
  const denied=vi.fn().mockResolvedValue({ok:false,code:'FORBIDDEN',status:403});await readExpoData(denied);expect(denied).toHaveBeenCalledTimes(1);
 });
 it.each(['server','generation','root','project'])('discards old %s reads without retrying',async change=>{
  let selected=true;
  const read=vi.fn(async()=>{if(change==='server')scope.target='remote';if(change==='generation')S.targetGeneration++;if(change==='root')document.body.innerHTML='<div id="expo-root"></div>';if(change==='project')selected=false;return canceled;});
  expect((await readExpoData(read,()=>selected)).code).toBe('TARGET_SCOPE_CHANGED');expect(read).toHaveBeenCalledTimes(1);
 });
 it('does not request a removed view',async()=>{document.body.innerHTML='';const read=vi.fn();await readExpoData(read);expect(read).not.toHaveBeenCalled();});
 it('discards a successful response from an old target',async()=>{
  const read=vi.fn(async()=>{scope.target='remote';return {ok:true,status:200,data:'old-account'};});expect((await readExpoData(read)).data).toBeUndefined();
 });
});
