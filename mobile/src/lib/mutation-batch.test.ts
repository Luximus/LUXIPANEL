import {expect,it,vi} from 'vitest';
import {createMutationBatch} from './mutation-batch';
it('stops on failure and retries only the remaining records',async()=>{
 const apply=vi.fn().mockResolvedValueOnce({ok:true}).mockResolvedValueOnce({ok:false,error:'Forbidden'}).mockResolvedValue({ok:true});
 const run=createMutationBatch(['one','two','three'],apply,x=>x);
 await expect(run()).rejects.toThrow('two: Forbidden');expect(apply.mock.calls.map(c=>c[0])).toEqual(['one','two']);
 await run();expect(apply.mock.calls.map(c=>c[0])).toEqual(['one','two','two','three']);
 await run();expect(apply).toHaveBeenCalledTimes(4);
});
it('prevents overlapping batches and releases the lock after a network exception',async()=>{
 let fail!:(cause:Error)=>void;const apply=vi.fn().mockImplementationOnce(()=>new Promise((_resolve,reject)=>{fail=reject;})).mockResolvedValue({ok:true});
 const run=createMutationBatch(['one'],apply,x=>x);const pending=run();await expect(run()).rejects.toThrow('en curso');fail(new Error('Offline'));await expect(pending).rejects.toThrow('Offline');await run();expect(apply).toHaveBeenCalledTimes(2);
});
