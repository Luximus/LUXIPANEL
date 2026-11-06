import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageDigest, optionalDirectoryEntries } from './runtime-policy.mjs';
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
