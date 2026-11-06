import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageDigest, optionalDirectoryEntries, finalizePreview, discardCandidate } from './runtime-policy.mjs';
test('Podman IDs remain immutable with or without the sha256 prefix', () => {
  const id = 'a'.repeat(64);
  assert.equal(imageDigest(id), 'sha256:' + id);
  assert.equal(imageDigest('sha256:' + id + '\n'), 'sha256:' + id);
  for (const value of ['latest', 'docker.io/library/node:22', 'sha256:abc', 'sha512:' + id]) {
    assert.throws(() => imageDigest(value), /image_digest_invalid/);
  }
});


test('retirement tolerates only a missing service directory, preserving other errors', async () => {
  assert.deepEqual(await optionalDirectoryEntries('/fixture', async()=>{throw Object.assign(new Error('missing'),{code:'ENOENT'});}), []);
  const entries=['owned.container','other.container'];
  assert.deepEqual(await optionalDirectoryEntries('/fixture', async()=>entries), entries);
  await assert.rejects(optionalDirectoryEntries('/fixture',async()=>{throw Object.assign(new Error('denied'),{code:'EACCES'});}),/denied/);
});

function fixture() {
 const jobs=new Map([['old',{environment:'preview',units:['old-app','database'],result:{versionId:'v1'}}],['new',{environment:'preview',units:['new-app','database'],result:{versionId:'v2'}}]]);const stopped=[];
 return {jobs,stopped,io:{read:async id=>jobs.get(id),list:async()=>[...jobs.keys()],write:async(id,job)=>jobs.set(id,job),remove:async id=>jobs.delete(id),stop:async unit=>stopped.push(unit),activeUnits:async()=>[]}};
}
test('successful preview finalization preserves shared data and is idempotent',async()=>{
 const {jobs,stopped,io}=fixture();assert.deepEqual(await finalizePreview(io,'new'),{evictedVersionIds:['v1']});assert.deepEqual(stopped,['old-app']);assert.equal(jobs.has('old'),false);assert.deepEqual(await finalizePreview(io,'new'),{evictedVersionIds:['v1']});
});
test('failed candidate discard preserves the previous preview and shared data',async()=>{
 const {jobs,stopped,io}=fixture();await discardCandidate(io,'new');assert.deepEqual(stopped,['new-app']);assert.equal(jobs.has('old'),true);assert.equal(jobs.has('new'),false);
});
test('unrecorded failed candidate cleanup preserves other receipts and active units',async()=>{
 const {jobs,stopped,io}=fixture();jobs.delete('new');io.activeUnits=async()=>['production'];await discardCandidate(io,'new',['candidate','database','production']);assert.deepEqual(stopped,['candidate']);assert.equal(jobs.has('old'),true);
});
