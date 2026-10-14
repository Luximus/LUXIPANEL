import {expect,it,vi,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({job:vi.fn()}));
vi.mock('../lib/use-live-module-data',()=>({useLiveModuleData:()=>{}}));
vi.mock('../screens/main/native-module-visibility',()=>({useNativeModuleVisible:()=>true}));
vi.mock('../api/serverApi',()=>({unwrap:(r:any)=>r.data,withFreshGateway:(fn:any)=>fn(),withJob:mocks.job}));
import {runServerMutation} from './useServerApi';
beforeEach(()=>{mocks.job.mockReset().mockResolvedValue(null);});
it.each(['NO_CREDENTIALS','FINGERPRINT_PENDING','PANEL_UNAVAILABLE','DIRECT_AUTH_REQUIRED'])('keeps %s failures distinct and never polls a job',async(code)=>{
 const result=await runServerMutation('box','token',async()=>({ok:false,code:code as any}));expect(result).toMatchObject({ok:false,code});expect(mocks.job).not.toHaveBeenCalled();
});
it.each([400,401,403,409,422,500])('does not report HTTP %s as a successful save',async(status)=>{
 expect(await runServerMutation('box','token',async()=>({ok:false,status,data:{error:'Denied',code:'DENIED'}}))).toMatchObject({ok:false,status,error:'Denied',code:'DENIED'});expect(mocks.job).not.toHaveBeenCalled();
});
it.each(['failed','unknown'])('does not close a form for an unconfirmed %s write-behind job',async(state)=>{
 mocks.job.mockResolvedValue({state,error:'Job not applied'});expect(await runServerMutation('box','token',async()=>({ok:true,status:202,data:{job:{id:'job'}}}))).toMatchObject({ok:false,error:'Job not applied'});
});
it('waits for the job before reporting success',async()=>{
 let finish!:(r:any)=>void;mocks.job.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));let settled=false;
 const run=runServerMutation('box','token',async()=>({ok:true,status:202})).then(result=>{settled=true;return result;});await Promise.resolve();await Promise.resolve();expect(settled).toBe(false);finish({state:'done'});expect(await run).toEqual({ok:true,status:202});
});
it('normalizes thrown transport failures',async()=>{
 expect(await runServerMutation('box','token',async()=>{throw new Error('network offline')})).toEqual({ok:false,error:'network offline'});
});
